<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { activitiesApi } from '@/api/activities'
import type { Activity, Submission } from '@/api/types'
import { useCourseStore } from '@/stores/course'
import { Q_LABEL, fmt, fmtScore, optionLetter } from '@/utils/format'
import BackBar from '@/components/BackBar.vue'

/** 测试答卷查看；教师/助教可以给简答题打分。 */
const props = defineProps<{ submissionId: number }>()
const cs = useCourseStore()
const sub = ref<Submission | null>(null)
const act = ref<Activity | null>(null)
const manual = ref<Record<string, number | undefined>>({})
const comment = ref('')
const saving = ref(false)

async function load() {
  sub.value = await activitiesApi.submission(props.submissionId)
  act.value = await activitiesApi.get(sub.value.activity_id).catch(() => null)
  manual.value = {}
  for (const q of sub.value.questions || []) {
    if (q.type === 'short') manual.value[q.id] = q.got ?? undefined
  }
  comment.value = sub.value.comment || ''
}
onMounted(load)

type Q = NonNullable<Submission['questions']>[number]

function optionText(q: Q, key: number) {
  return `${optionLetter(key)}. ${q.options[key] ?? ''}`
}
function givenText(q: Q): string {
  const g = q.given
  if (g === null || g === undefined || g === '' || (Array.isArray(g) && !g.length)) return '未作答'
  if (q.type === 'single') return optionLetter(Number(g))
  if (q.type === 'multiple') return (g as number[]).map((x) => optionLetter(Number(x))).join('、')
  if (q.type === 'judge') return g === true || g === 'true' ? '正确' : '错误'
  if (q.type === 'fill') return (g as string[]).map((x, i) => `${i + 1}. ${x || '（空）'}`).join('　')
  return String(g)
}
function answerText(q: Q): string {
  if (q.type === 'single') return optionLetter(Number(q.answer))
  if (q.type === 'multiple') return (q.answer as number[]).map((x) => optionLetter(x)).join('、')
  if (q.type === 'judge') return q.answer ? '正确' : '错误'
  if (q.type === 'fill') return (q.answer as string[]).map((x, i) => `${i + 1}. ${x.split('|').join(' 或 ')}`).join('　')
  return q.answer || '（无参考答案）'
}
function resultOf(q: Q): 'right' | 'wrong' | 'partial' | 'pending' {
  if (q.got === null || q.got === undefined) return 'pending'
  if (q.got >= q.score) return 'right'
  if (q.got <= 0) return 'wrong'
  return 'partial'
}

const shortQuestions = computed(() => (sub.value?.questions || []).filter((q) => q.type === 'short'))

async function saveGrade() {
  if (!sub.value) return
  const qs: Record<string, number> = {}
  for (const q of shortQuestions.value) {
    const v = manual.value[q.id]
    if (v !== undefined && v !== null) qs[String(q.id)] = v
  }
  if (!Object.keys(qs).length && !comment.value.trim()) return ElMessage.warning('请给简答题打分或填写评语')
  saving.value = true
  try {
    await activitiesApi.grade(sub.value.id, { question_scores: qs, comment: comment.value })
    ElMessage.success('已保存')
    await load()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="sub">
    <BackBar :items="[{ label: '课程内容', to: `/courses/${cs.course?.id}` }, { label: act?.title || '测试', to: `/courses/${cs.course?.id}/activities/${sub.activity_id}` }, { label: '答卷' }]" />

    <section class="card head">
      <div>
        <div class="title">{{ sub.user?.name }} 的答卷 · 第 {{ sub.attempt_no }} 次</div>
        <div class="muted">交卷时间 {{ fmt(sub.submitted_at) }}<template v-if="sub.user?.student_no"> · 学号 {{ sub.user.student_no }}</template></div>
      </div>
      <span class="spacer" />
      <div class="score-box">
        <template v-if="sub.score_published === false && !cs.canGrade">
          <div class="big pending">成绩未公布</div>
          <div class="muted">{{ sub.score_publish === 'scheduled' ? `将于 ${fmt(sub.score_publish_at)} 公布` : '等待老师公布' }}</div>
        </template>
        <template v-else-if="sub.status === 'graded'">
          <div class="big">{{ fmtScore(sub.score) }}</div>
          <div class="muted">/ {{ act?.full_score ?? '' }} 分</div>
        </template>
        <template v-else>
          <div class="big pending">待批改</div>
          <div class="muted">客观题 {{ fmtScore(sub.auto_score) }} 分</div>
        </template>
      </div>
    </section>

    <el-alert v-if="cs.canGrade && sub.score_published === false" type="info" :closable="false" show-icon title="该测试的成绩尚未对学生公布" style="margin-top: 12px" />
    <el-alert
      v-else-if="!sub.show_answer && !cs.canGrade"
      type="info"
      :closable="false"
      show-icon
      :title="sub.score_published === false ? '成绩公布后才能查看得分和答案' : '老师设置了不显示答案和解析'"
      style="margin-top: 12px"
    />
    <section v-if="sub.comment && !cs.canGrade" class="card" style="margin-top: 12px">
      <b>老师评语：</b>{{ sub.comment }}
    </section>

    <section v-for="(q, i) in sub.questions" :key="q.id" class="card q" :class="sub.show_answer ? resultOf(q) : ''">
      <div class="q-head">
        <b>{{ i + 1 }}.</b>
        <el-tag size="small" effect="plain">{{ Q_LABEL[q.type] }}</el-tag>
        <span class="muted">{{ q.score }} 分</span>
        <span class="spacer" />
        <template v-if="cs.canGrade && q.type === 'short'">
          <span class="muted">得分</span>
          <el-input-number v-model="manual[q.id]" :min="0" :max="q.score" :precision="1" size="small" />
        </template>
        <b v-else-if="sub.score_published !== false || cs.canGrade" class="got">{{ q.got === null || q.got === undefined ? '待评分' : `${fmtScore(q.got)} 分` }}</b>
      </div>
      <div class="rich-text stem">{{ q.stem }}</div>
      <div v-if="(q.type === 'single' || q.type === 'multiple') && q.options.length" class="opts">
        <div v-for="(o, oi) in q.options" :key="oi">{{ optionText(q, oi) }}</div>
      </div>
      <div class="ans"><span class="muted">作答：</span><span class="rich-text">{{ givenText(q) }}</span></div>
      <template v-if="sub.show_answer">
        <div class="ans"><span class="muted">{{ q.type === 'short' ? '参考答案：' : '正确答案：' }}</span><span class="rich-text">{{ answerText(q) }}</span></div>
        <div v-if="q.analysis" class="ans"><span class="muted">解析：</span>{{ q.analysis }}</div>
      </template>
    </section>

    <section v-if="cs.canGrade" class="card grade-box">
      <b>批改</b>
      <el-input v-model="comment" type="textarea" :rows="3" placeholder="评语（可选）" style="margin: 10px 0" />
      <el-button type="primary" :loading="saving" @click="saveGrade">保存评分</el-button>
      <span class="muted" style="margin-left: 8px">所有简答题都打分后，答卷才会出分</span>
    </section>
  </div>
  <div v-else v-loading="true" style="height: 300px" />
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 16px;
}
.title {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 4px;
}
.score-box {
  text-align: right;
}
.big {
  font-size: 28px;
  font-weight: 700;
  color: var(--ch-primary-text);
}
.big.pending {
  font-size: 20px;
  color: var(--el-color-warning);
}
.q {
  margin-top: 12px;
  border-left: 4px solid var(--ch-border);
}
.q.right {
  border-left-color: var(--el-color-success);
}
.q.wrong {
  border-left-color: var(--el-color-danger);
}
.q.partial {
  border-left-color: var(--el-color-warning);
}
.q-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.got {
  color: var(--ch-primary-text);
}
.stem {
  margin-bottom: 8px;
}
.opts {
  color: var(--ch-text-2);
  margin-bottom: 8px;
  line-height: 1.8;
}
.ans {
  margin-top: 4px;
  line-height: 1.7;
}
.grade-box {
  margin-top: 16px;
  position: sticky;
  bottom: 0;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
}
</style>

<script setup lang="ts">
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { type MySubmissions, activitiesApi } from '@/api/activities'
import { coursesApi } from '@/api/courses'
import type { Activity, SubmissionRow } from '@/api/types'
import { STATUS_LABEL, STATUS_TAG, fmt, fmtScore } from '@/utils/format'

const props = defineProps<{ activity: Activity; role: string }>()
const router = useRouter()
const a = computed(() => props.activity)
const isStudent = computed(() => props.role === 'student')
const s = computed(() => a.value.settings)

// ---------- 学生 ----------
const mine = ref<MySubmissions | null>(null)
const notStarted = computed(() => !!a.value.start_at && dayjs().isBefore(a.value.start_at))
const ended = computed(() => !!a.value.due_at && dayjs().isAfter(a.value.due_at))
const attemptsLeft = computed(() =>
  s.value.attempts ? Math.max(s.value.attempts - (mine.value?.attempts_used ?? 0), 0) : Infinity,
)
const canStart = computed(() => !notStarted.value && !ended.value && (mine.value?.draft_id || attemptsLeft.value > 0))

async function start() {
  if (!mine.value?.draft_id) {
    const tips = [
      s.value.duration_min ? `限时 ${s.value.duration_min} 分钟，开始后计时不会暂停。` : '本测试不限时。',
      s.value.attempts ? `共可作答 ${s.value.attempts} 次，这将是第 ${(mine.value?.attempts_used ?? 0) + 1} 次。` : '',
    ]
    await ElMessageBox.confirm(tips.join(''), '开始作答', { confirmButtonText: '开始' })
  }
  router.push(`/courses/${a.value.course_id}/activities/${a.value.id}/take`)
}

// ---------- 教师 ----------
const rows = ref<SubmissionRow[]>([])
const filter = ref('')
const loadingRows = ref(false)
async function loadRows() {
  loadingRows.value = true
  try {
    const params =
      filter.value === 'not_submitted' ? { submit_status: 'not_submitted' } : filter.value ? { grade_status: filter.value } : {}
    rows.value = (await activitiesApi.submissionRows(a.value.id, params)).rows
  } finally {
    loadingRows.value = false
  }
}
async function setFinal(r: SubmissionRow) {
  const { value } = await ElMessageBox.prompt(
    `修改「${r.user.name}」的最终成绩（满分 ${a.value.full_score}）。留空表示撤销修改。`,
    '最终成绩',
    { inputValue: r.override !== null ? String(r.override) : '', inputPattern: /^(\d+(\.\d+)?)?$/, inputErrorMessage: '请输入数字' },
  )
  await coursesApi.setOverride(a.value.course_id, {
    user_id: r.user.id,
    activity_id: a.value.id,
    score: value === '' || value === null ? null : Number(value),
  })
  ElMessage.success('已保存')
  loadRows()
}

onMounted(async () => {
  if (isStudent.value) mine.value = await activitiesApi.mySubmissions(a.value.id)
  else loadRows()
})
</script>

<template>
  <section class="card block info">
    <div><span class="muted">作答时间</span>{{ a.start_at ? fmt(a.start_at) : '发布即可作答' }} ~ {{ a.due_at ? fmt(a.due_at) : '不限' }}</div>
    <div><span class="muted">限时</span>{{ s.duration_min ? `${s.duration_min} 分钟` : '不限时' }}</div>
    <div><span class="muted">作答次数</span>{{ s.attempts ? `${s.attempts} 次（取最高分）` : '不限' }}</div>
    <div><span class="muted">题目 / 满分</span>{{ a.question_count ?? 0 }} 题 / {{ a.full_score }} 分</div>
  </section>

  <!-- 学生端 -->
  <template v-if="isStudent && mine">
    <section class="card block">
      <div class="flex">
        <b>我的成绩</b>
        <span v-if="mine.score !== null" class="score">{{ fmtScore(mine.score) }} / {{ a.full_score }}</span>
        <el-tag v-else-if="mine.status === 'pending'" type="warning" size="small">主观题待批改</el-tag>
        <span v-else class="muted">尚未作答</span>
        <span class="spacer" />
        <el-button v-if="canStart" type="primary" @click="start">
          {{ mine.draft_id ? '继续作答' : mine.attempts_used ? '再次作答' : '开始作答' }}
        </el-button>
        <el-tag v-else-if="notStarted" type="info">{{ fmt(a.start_at) }} 开始</el-tag>
        <el-tag v-else-if="ended" type="info">测试已结束</el-tag>
        <el-tag v-else type="info">作答次数已用完</el-tag>
      </div>
      <el-table v-if="mine.submissions.length" :data="mine.submissions" size="small" style="margin-top: 12px">
        <el-table-column label="次数" width="80"><template #default="{ row }">第 {{ row.attempt_no }} 次</template></el-table-column>
        <el-table-column label="交卷时间"><template #default="{ row }">{{ fmt(row.submitted_at) }}</template></el-table-column>
        <el-table-column label="得分" width="120">
          <template #default="{ row }">{{ row.status === 'graded' ? fmtScore(row.score) : `客观题 ${fmtScore(row.auto_score)}` }}</template>
        </el-table-column>
        <el-table-column label="" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/courses/${a.course_id}/submissions/${row.id}`)">查看答卷</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </template>

  <!-- 教师端 -->
  <section v-else-if="!isStudent" class="card block">
    <div class="flex" style="margin-bottom: 12px; flex-wrap: wrap">
      <el-radio-group v-model="filter" size="small" @change="loadRows">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="pending">待批改</el-radio-button>
        <el-radio-button value="graded">已出分</el-radio-button>
        <el-radio-button value="not_submitted">未作答</el-radio-button>
      </el-radio-group>
      <span class="spacer" />
      <el-button v-if="role === 'teacher'" size="small" type="primary" @click="router.push(`/courses/${a.course_id}/activities/${a.id}/questions`)">
        <el-icon><List /></el-icon>&nbsp;管理题目
      </el-button>
    </div>
    <el-table v-loading="loadingRows" :data="rows" stripe size="small">
      <el-table-column label="学号" width="110"><template #default="{ row }">{{ row.user.student_no || '—' }}</template></el-table-column>
      <el-table-column label="姓名" min-width="90"><template #default="{ row }">{{ row.user.name }}</template></el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }"><el-tag size="small" :type="STATUS_TAG[row.status as keyof typeof STATUS_TAG]">{{ STATUS_LABEL[row.status as keyof typeof STATUS_LABEL] }}</el-tag></template>
      </el-table-column>
      <el-table-column label="作答次数" width="80" prop="attempts" />
      <el-table-column label="交卷时间" width="150"><template #default="{ row }">{{ fmt(row.latest_submitted_at) }}</template></el-table-column>
      <el-table-column label="最终成绩" width="110">
        <template #default="{ row }">
          <el-button link type="primary" @click="setFinal(row as SubmissionRow)">
            {{ fmtScore(row.final) }}
            <el-icon v-if="row.override !== null" style="margin-left: 2px"><EditPen /></el-icon>
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="答卷" width="160" fixed="right">
        <template #default="{ row }">
          <el-button
            v-for="(sid, i) in row.submission_ids"
            :key="sid"
            link
            type="primary"
            @click="router.push(`/courses/${a.course_id}/submissions/${sid}`)"
          >
            {{ row.submission_ids.length > 1 ? `第${i + 1}次` : row.status === 'pending' ? '批改' : '查看' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </section>
</template>

<style scoped>
.block {
  margin-top: 16px;
}
.info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px 24px;
}
.info .muted {
  margin-right: 8px;
}
.score {
  font-weight: 600;
  font-size: 18px;
  color: var(--ch-primary);
}
</style>

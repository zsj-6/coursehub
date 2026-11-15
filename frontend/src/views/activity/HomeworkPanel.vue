<script setup lang="ts">
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { type MySubmissions, activitiesApi } from '@/api/activities'
import { coursesApi } from '@/api/courses'
import type { Activity, FileInfo, SubmissionRow } from '@/api/types'
import FileUploader from '@/components/FileUploader.vue'
import { STATUS_LABEL, STATUS_TAG, fmt, fmtScore, fmtSize } from '@/utils/format'

const props = defineProps<{ activity: Activity; role: string }>()
const isStudent = computed(() => props.role === 'student')
const a = computed(() => props.activity)

// ---------- 学生 ----------
const mine = ref<MySubmissions | null>(null)
const content = ref('')
const files = ref<FileInfo[]>([])
const submitting = ref(false)
const maxAttempts = computed(() => a.value.settings.max_attempts || 0)
const overdue = computed(() => !!a.value.due_at && dayjs().isAfter(a.value.due_at))
const canSubmit = computed(
  () => !overdue.value && (!maxAttempts.value || (mine.value?.attempts_used ?? 0) < maxAttempts.value),
)

async function loadMine() {
  mine.value = await activitiesApi.mySubmissions(a.value.id)
}
async function submit() {
  if (!content.value.trim() && !files.value.length) return ElMessage.warning('请填写内容或上传附件')
  await ElMessageBox.confirm('确认提交吗？', '提交作业', { confirmButtonText: '提交' })
  submitting.value = true
  try {
    await activitiesApi.submitHomework(a.value.id, content.value, files.value.map((f) => f.id))
    ElMessage.success('提交成功')
    content.value = ''
    files.value = []
    loadMine()
  } finally {
    submitting.value = false
  }
}

// ---------- 教师 ----------
const rows = ref<SubmissionRow[]>([])
const filter = ref('')
const loadingRows = ref(false)
async function loadRows() {
  loadingRows.value = true
  try {
    const params =
      filter.value === 'not_submitted'
        ? { submit_status: 'not_submitted' }
        : filter.value
          ? { grade_status: filter.value }
          : {}
    rows.value = (await activitiesApi.submissionRows(a.value.id, params)).rows
  } finally {
    loadingRows.value = false
  }
}
async function setFinal(r: SubmissionRow) {
  const { value } = await ElMessageBox.prompt(
    `直接给「${r.user.name}」最终成绩（满分 ${a.value.full_score}）。留空表示撤销手动修改，按批改结果计分。`,
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
const counts = computed(() => ({
  total: a.value.student_count ?? rows.value.length,
}))

onMounted(() => (isStudent.value ? loadMine() : loadRows()))
</script>

<template>
  <!-- 学生端 -->
  <div v-if="isStudent">
    <section v-if="mine" class="card block">
      <div class="flex">
        <b>我的提交</b>
        <el-tag :type="STATUS_TAG[mine.status]" size="small">{{ STATUS_LABEL[mine.status] }}</el-tag>
        <span class="spacer" />
        <span class="muted">已提交 {{ mine.attempts_used }} 次{{ maxAttempts ? ` / 最多 ${maxAttempts} 次` : '' }}</span>
        <span v-if="mine.score !== null" class="score">得分 {{ fmtScore(mine.score) }} / {{ a.full_score }}</span>
      </div>
      <el-timeline v-if="mine.submissions.length" style="margin-top: 16px; padding-left: 4px">
        <el-timeline-item
          v-for="s in [...mine.submissions].reverse()"
          :key="s.id"
          :timestamp="`第 ${s.attempt_no} 次提交 · ${fmt(s.submitted_at)}`"
          placement="top"
        >
          <div class="sub">
            <div v-if="s.content" class="rich-text">{{ s.content }}</div>
            <div v-for="f in s.files" :key="f.id">
              <a :href="f.url" target="_blank"><el-icon><Paperclip /></el-icon> {{ f.filename }}</a>
              <span class="muted"> {{ fmtSize(f.size) }}</span>
            </div>
            <div v-if="s.status === 'graded'" class="feedback">
              <b>{{ fmtScore(s.score) }} 分</b>
              <span v-if="s.comment"> · 评语：{{ s.comment }}</span>
            </div>
            <div v-else class="muted">等待老师批改</div>
          </div>
        </el-timeline-item>
      </el-timeline>
    </section>

    <section class="card block">
      <b>{{ mine?.attempts_used ? '再次提交' : '提交作业' }}</b>
      <el-alert v-if="overdue" type="warning" :closable="false" title="已过截止时间，不能再提交" style="margin-top: 12px" />
      <el-alert v-else-if="!canSubmit" type="info" :closable="false" title="提交次数已用完" style="margin-top: 12px" />
      <template v-else>
        <el-input v-model="content" type="textarea" :rows="6" placeholder="在这里输入作业内容（可选）" style="margin: 12px 0" />
        <FileUploader v-model="files" button-text="上传附件" />
        <div style="margin-top: 16px">
          <el-button type="primary" :loading="submitting" @click="submit">提交</el-button>
          <span class="muted" style="margin-left: 8px">
            计分规则：{{ { last: '最后一次得分', max: '最高得分', avg: '平均得分' }[a.settings.score_rule as string] || '最后一次得分' }}
          </span>
        </div>
      </template>
    </section>
  </div>

  <!-- 教师 / 助教端 -->
  <section v-else class="card block">
    <div class="flex" style="margin-bottom: 12px; flex-wrap: wrap">
      <el-radio-group v-model="filter" size="small" @change="loadRows">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="pending">待批改</el-radio-button>
        <el-radio-button value="graded">已批改</el-radio-button>
        <el-radio-button value="not_submitted">未提交</el-radio-button>
      </el-radio-group>
      <span class="spacer" />
      <el-button size="small" @click="activitiesApi.exportZip(a.id, a.title)">
        <el-icon><Download /></el-icon>&nbsp;打包下载
      </el-button>
      <el-button size="small" type="primary" @click="$router.push(`/courses/${a.course_id}/activities/${a.id}/grade`)">
        <el-icon><EditPen /></el-icon>&nbsp;进入批改
      </el-button>
    </div>
    <el-table v-loading="loadingRows" :data="rows" stripe size="small">
      <el-table-column label="学号" width="110"><template #default="{ row }">{{ row.user.student_no || '—' }}</template></el-table-column>
      <el-table-column label="姓名" min-width="90"><template #default="{ row }">{{ row.user.name }}</template></el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }"><el-tag size="small" :type="STATUS_TAG[row.status as keyof typeof STATUS_TAG]">{{ STATUS_LABEL[row.status as keyof typeof STATUS_LABEL] }}</el-tag></template>
      </el-table-column>
      <el-table-column label="提交次数" width="80" prop="attempts" />
      <el-table-column label="最近提交" width="150"><template #default="{ row }">{{ fmt(row.latest_submitted_at) }}</template></el-table-column>
      <el-table-column label="成绩" width="110">
        <template #default="{ row }">
          <el-button link type="primary" @click="setFinal(row as SubmissionRow)">
            {{ fmtScore(row.final) }}
            <el-tooltip v-if="row.override !== null" content="已手动修改最终成绩"><el-icon style="margin-left: 2px"><EditPen /></el-icon></el-tooltip>
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.attempts"
            link
            type="primary"
            @click="$router.push(`/courses/${a.course_id}/activities/${a.id}/grade?user=${row.user.id}`)"
          >
            批改
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="muted" style="margin-top: 8px">共 {{ counts.total }} 名学生 · 点击成绩可以直接给出最终成绩</div>
  </section>
</template>

<style scoped>
.block {
  margin-top: 16px;
}
.score {
  font-weight: 600;
  color: var(--ch-primary-text);
}
.sub {
  background: var(--ch-fill);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.feedback {
  border-top: 1px dashed var(--ch-border);
  padding-top: 6px;
  color: var(--ch-primary-text);
}
</style>

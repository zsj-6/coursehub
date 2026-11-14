<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { activitiesApi } from '@/api/activities'
import type { Activity, Submission, SubmissionRow } from '@/api/types'
import FilePreview from '@/components/FilePreview.vue'
import { STATUS_LABEL, STATUS_TAG, fmt, fmtScore } from '@/utils/format'

/** 三栏批改页：左 学生与版本 / 中 提交内容 / 右 评分。 */
const props = defineProps<{ courseId: number; activityId: number; userId?: number }>()
const router = useRouter()

const act = ref<Activity | null>(null)
const rows = ref<SubmissionRow[]>([])
const gradeFilter = ref<'all' | 'pending' | 'graded'>('all')
const currentUserId = ref<number | null>(null)
const versions = ref<Submission[]>([])
const currentSub = ref<Submission | null>(null)
const score = ref<number | undefined>()
const comment = ref('')
const saving = ref(false)
const loadingSub = ref(false)

const submittedRows = computed(() => rows.value.filter((r) => r.attempts > 0))
const visibleRows = computed(() => submittedRows.value.filter((r) => gradeFilter.value === 'all' || r.status === gradeFilter.value))
const currentRow = computed(() => rows.value.find((r) => r.user.id === currentUserId.value) || null)
const idx = computed(() => visibleRows.value.findIndex((r) => r.user.id === currentUserId.value))
const gradedCount = computed(() => submittedRows.value.filter((r) => r.status === 'graded').length)

async function loadRows() {
  rows.value = (await activitiesApi.submissionRows(props.activityId)).rows
}

onMounted(async () => {
  act.value = await activitiesApi.get(props.activityId)
  if (act.value.type !== 'homework') {
    router.replace(`/courses/${props.courseId}/activities/${props.activityId}`)
    return
  }
  await loadRows()
  const first = submittedRows.value.find((r) => r.status === 'pending') || submittedRows.value[0]
  currentUserId.value = props.userId ?? first?.user.id ?? null
})

watch(currentUserId, async (uid) => {
  versions.value = []
  currentSub.value = null
  const row = rows.value.find((r) => r.user.id === uid)
  if (!row || !row.submission_ids.length) return
  loadingSub.value = true
  try {
    versions.value = await Promise.all(row.submission_ids.map((id) => activitiesApi.submission(id)))
    selectVersion(versions.value[versions.value.length - 1])
  } finally {
    loadingSub.value = false
  }
})

function selectVersion(s: Submission) {
  currentSub.value = s
  score.value = s.score ?? undefined
  comment.value = s.comment || ''
}

function go(step: number) {
  const next = visibleRows.value[idx.value + step]
  if (next) currentUserId.value = next.user.id
}

async function save(goNext: boolean) {
  if (!currentSub.value) return
  if (score.value === undefined && !comment.value.trim()) return ElMessage.warning('请至少填写成绩或评语其中一项')
  saving.value = true
  try {
    const updated = await activitiesApi.grade(currentSub.value.id, {
      ...(score.value !== undefined ? { score: score.value } : {}),
      comment: comment.value,
    })
    versions.value = versions.value.map((v) => (v.id === updated.id ? updated : v))
    currentSub.value = updated
    ElMessage.success('已保存')
    const uid = currentUserId.value
    await loadRows()
    if (goNext) {
      const pending = submittedRows.value.find((r) => r.status === 'pending' && r.user.id !== uid)
      if (pending) currentUserId.value = pending.user.id
      else ElMessage.info('所有提交都已批改完')
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="grade-page">
    <header class="bar">
      <el-button @click="router.push(`/courses/${courseId}/activities/${activityId}`)"><el-icon><ArrowLeft /></el-icon>&nbsp;返回</el-button>
      <b class="title">批改作业 · {{ act?.title }}</b>
      <span class="spacer" />
      <span class="muted">已批改 {{ gradedCount }} 人，剩余 {{ submittedRows.length - gradedCount }} 人</span>
      <el-progress
        :percentage="submittedRows.length ? Math.round((gradedCount / submittedRows.length) * 100) : 0"
        :show-text="false"
        style="width: 140px"
      />
    </header>

    <div class="cols">
      <!-- 左：学生与版本 -->
      <aside class="left">
        <div class="label">批改状态</div>
        <el-select v-model="gradeFilter" style="width: 100%">
          <el-option label="全部" value="all" />
          <el-option label="待批改" value="pending" />
          <el-option label="已批改" value="graded" />
        </el-select>
        <div class="label">当前学生</div>
        <el-select v-model="currentUserId" filterable style="width: 100%" placeholder="选择学生">
          <el-option
            v-for="r in visibleRows"
            :key="r.user.id"
            :label="`${r.user.name}（${r.user.student_no || r.user.username}）`"
            :value="r.user.id"
          >
            <span>{{ r.user.name }}</span>
            <el-tag size="small" :type="STATUS_TAG[r.status]" style="float: right; margin-top: 6px">{{ STATUS_LABEL[r.status] }}</el-tag>
          </el-option>
        </el-select>
        <div v-if="currentRow" class="flex" style="margin-top: 8px">
          <span class="muted">状态</span>
          <el-tag size="small" :type="STATUS_TAG[currentRow.status]">{{ STATUS_LABEL[currentRow.status] }}</el-tag>
        </div>
        <div class="flex" style="margin-top: 10px">
          <el-button :disabled="idx <= 0" style="flex: 1" @click="go(-1)">‹ 上一个</el-button>
          <el-button :disabled="idx < 0 || idx >= visibleRows.length - 1" type="primary" plain style="flex: 1" @click="go(1)">下一个 ›</el-button>
        </div>
        <div class="label">提交版本</div>
        <div
          v-for="v in versions"
          :key="v.id"
          class="version"
          :class="{ active: currentSub?.id === v.id }"
          @click="selectVersion(v)"
        >
          <div>第 {{ v.attempt_no }} 次 · {{ fmt(v.submitted_at, 'MM-DD HH:mm') }}</div>
          <div class="muted">{{ v.status === 'graded' ? `已批改 ${fmtScore(v.score)} 分` : '未批改' }}</div>
        </div>
        <div v-if="!submittedRows.length" class="muted" style="margin-top: 12px">还没有学生提交</div>
      </aside>

      <!-- 中：提交内容 -->
      <main v-loading="loadingSub" class="middle">
        <template v-if="currentSub">
          <div v-if="currentSub.content" class="card text">
            <div class="label" style="margin-top: 0">文本内容</div>
            <div class="rich-text">{{ currentSub.content }}</div>
          </div>
          <div v-if="currentSub.files.length" class="card" style="margin-top: 12px">
            <FilePreview :files="currentSub.files" />
          </div>
          <el-empty v-if="!currentSub.content && !currentSub.files.length" description="空提交" />
        </template>
        <el-empty v-else description="选择左侧的学生开始批改" />
      </main>

      <!-- 右：评分 -->
      <aside class="right">
        <template v-if="currentSub">
          <div class="label" style="margin-top: 0">成绩（满分 {{ act?.full_score }}）</div>
          <el-input-number v-model="score" :min="0" :max="act?.full_score" :precision="1" style="width: 100%" placeholder="分数" />
          <div class="quick">
            <el-button v-for="p in [100, 90, 80, 70, 60]" :key="p" size="small" @click="score = Math.round(((act?.full_score || 100) * p) / 100)">
              {{ p }}%
            </el-button>
          </div>
          <div class="label">评语</div>
          <el-input v-model="comment" type="textarea" :rows="8" placeholder="写给学生的评语" />
          <div class="actions">
            <el-button :loading="saving" @click="save(false)">保存</el-button>
            <el-button type="primary" :loading="saving" @click="save(true)">保存并批改下一个</el-button>
          </div>
          <div class="muted" style="margin-top: 12px">
            计分规则：{{ { last: '最后一次得分', max: '最高得分', avg: '平均得分' }[act?.settings.score_rule as string] || '最后一次得分' }}
            <template v-if="currentRow"> · 当前计入 {{ fmtScore(currentRow.final) }} 分</template>
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.grade-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--ch-bg);
}
.bar {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid var(--ch-border);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  flex-shrink: 0;
}
.title {
  font-size: 16px;
}
.cols {
  flex: 1;
  display: flex;
  min-height: 0;
}
.left,
.right {
  width: 280px;
  background: #fff;
  padding: 16px;
  overflow-y: auto;
  flex-shrink: 0;
}
.left {
  border-right: 1px solid var(--ch-border);
}
.right {
  border-left: 1px solid var(--ch-border);
}
.middle {
  flex: 1;
  min-width: 0;
  padding: 16px;
  overflow-y: auto;
}
.label {
  font-weight: 600;
  margin: 16px 0 8px;
  padding-left: 8px;
  border-left: 3px solid var(--ch-primary);
}
.version {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
}
.version.active,
.version:hover {
  background: var(--el-color-primary-light-9);
}
.version.active {
  color: var(--ch-primary);
}
.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}
.quick .el-button {
  margin: 0;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.actions .el-button {
  flex: 1;
  margin: 0;
}
@media (max-width: 900px) {
  .grade-page {
    height: auto;
  }
  .cols {
    flex-direction: column;
  }
  .left,
  .right {
    width: 100%;
  }
}
</style>

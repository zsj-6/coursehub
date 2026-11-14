<script setup lang="ts">
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { type ExamPaper, activitiesApi } from '@/api/activities'
import type { Activity, PaperQuestion } from '@/api/types'
import { Q_LABEL, optionLetter } from '@/utils/format'

const props = defineProps<{ courseId: number; activityId: number }>()
const router = useRouter()

const act = ref<Activity | null>(null)
const paper = ref<ExamPaper | null>(null)
const answers = ref<Record<string, any>>({})
const error = ref('')
const submitting = ref(false)
const finished = ref(false)
const lastSaved = ref<string | null>(null)
let changed = false
let clockOffset = 0 // 服务器时间 - 本机时间
const now = ref(Date.now())
let tick: number | undefined
let autosave: number | undefined

onMounted(async () => {
  try {
    act.value = await activitiesApi.get(props.activityId)
    paper.value = await activitiesApi.startExam(props.activityId)
  } catch (e: any) {
    error.value = e?.response?.data?.detail || '无法开始作答'
    return
  }
  clockOffset = dayjs(paper.value.server_now).valueOf() - Date.now()
  const init: Record<string, any> = {}
  for (const q of paper.value.questions) {
    const saved = paper.value.answers[String(q.id)]
    if (q.type === 'multiple') init[q.id] = Array.isArray(saved) ? saved : []
    else if (q.type === 'fill') {
      const arr = Array.isArray(saved) ? saved : []
      init[q.id] = Array.from({ length: q.blank_count || 1 }, (_, i) => arr[i] ?? '')
    } else init[q.id] = saved ?? null
  }
  answers.value = init
  tick = window.setInterval(() => {
    now.value = Date.now()
    if (remainingMs.value !== null && remainingMs.value <= 0 && !finished.value && !submitting.value) {
      ElMessage.warning('作答时间到，系统自动交卷')
      submit(true)
    }
  }, 1000)
  autosave = window.setInterval(save, 15000)
  window.addEventListener('beforeunload', beforeUnload)
})

onBeforeUnmount(() => {
  clearInterval(tick)
  clearInterval(autosave)
  window.removeEventListener('beforeunload', beforeUnload)
})

function beforeUnload(e: BeforeUnloadEvent) {
  if (!finished.value && paper.value) {
    save()
    e.preventDefault()
  }
}

onBeforeRouteLeave(async () => {
  if (finished.value || !paper.value) return true
  try {
    await ElMessageBox.confirm('答案已自动保存，离开后计时不会暂停。确定离开吗？', '提示', { confirmButtonText: '离开' })
    await save()
    return true
  } catch {
    return false
  }
})

const remainingMs = computed(() => {
  if (!paper.value?.deadline) return null
  return dayjs(paper.value.deadline).valueOf() - (now.value + clockOffset)
})
const remainingText = computed(() => {
  const ms = remainingMs.value
  if (ms === null) return '不限时'
  const s = Math.max(Math.floor(ms / 1000), 0)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
})

function isAnswered(q: PaperQuestion) {
  const v = answers.value[q.id]
  if (q.type === 'multiple') return Array.isArray(v) && v.length > 0
  if (q.type === 'fill') return Array.isArray(v) && v.some((x: string) => x && x.trim())
  if (q.type === 'short') return typeof v === 'string' && v.trim() !== ''
  return v !== null && v !== undefined
}
const answeredCount = computed(() => paper.value?.questions.filter(isAnswered).length ?? 0)

function payload() {
  return Object.fromEntries(Object.entries(answers.value).map(([k, v]) => [String(k), v]))
}

async function save() {
  if (!paper.value || finished.value || !changed) return
  changed = false
  try {
    await activitiesApi.saveAnswers(paper.value.submission_id, payload())
    lastSaved.value = dayjs().format('HH:mm:ss')
  } catch (e: any) {
    changed = true
    if (e?.response?.status === 400) {
      finished.value = true
      ElMessage.warning(e.response.data.detail)
      router.replace(`/courses/${props.courseId}/activities/${props.activityId}`)
    }
  }
}

async function submit(auto = false) {
  if (!paper.value) return
  if (!auto) {
    const left = paper.value.questions.length - answeredCount.value
    await ElMessageBox.confirm(left ? `还有 ${left} 题未作答，确定交卷吗？` : '确定交卷吗？交卷后不能修改。', '交卷', {
      confirmButtonText: '交卷',
      type: left ? 'warning' : 'info',
    })
  }
  submitting.value = true
  try {
    const sub = await activitiesApi.submitExam(paper.value.submission_id, payload())
    finished.value = true
    ElMessage.success('已交卷')
    router.replace(`/courses/${props.courseId}/submissions/${sub.id}`)
  } finally {
    submitting.value = false
  }
}

function jump(i: number) {
  document.getElementById(`q-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="take">
    <header class="bar">
      <b>{{ act?.title }}</b>
      <span v-if="paper" class="muted">第 {{ paper.attempt_no }} 次作答</span>
      <span class="spacer" />
      <span v-if="lastSaved" class="muted">已自动保存 {{ lastSaved }}</span>
      <span class="clock" :class="{ danger: remainingMs !== null && remainingMs < 5 * 60 * 1000 }">
        <el-icon><Timer /></el-icon> {{ remainingText }}
      </span>
      <el-button v-if="paper" type="primary" :loading="submitting" @click="submit()">交卷</el-button>
    </header>

    <el-result v-if="error" icon="warning" :title="error">
      <template #extra>
        <el-button @click="router.replace(`/courses/${courseId}/activities/${activityId}`)">返回</el-button>
      </template>
    </el-result>

    <div v-else-if="paper" class="body">
      <aside class="nav card">
        <div class="muted">已答 {{ answeredCount }} / {{ paper.questions.length }}</div>
        <div class="grid">
          <button
            v-for="(q, i) in paper.questions"
            :key="q.id"
            class="num"
            :class="{ done: isAnswered(q) }"
            @click="jump(i)"
          >
            {{ i + 1 }}
          </button>
        </div>
      </aside>

      <main class="paper" @input="changed = true" @change="changed = true">
        <section v-for="(q, i) in paper.questions" :id="`q-${i}`" :key="q.id" class="card q">
          <div class="q-head">
            <b>{{ i + 1 }}.</b>
            <el-tag size="small" effect="plain">{{ Q_LABEL[q.type] }}</el-tag>
            <span class="muted">{{ q.score }} 分</span>
          </div>
          <div class="rich-text stem">{{ q.stem }}</div>

          <el-radio-group v-if="q.type === 'single'" v-model="answers[q.id]" class="opts" @change="changed = true">
            <el-radio v-for="(o, oi) in q.options" :key="o.key" :value="o.key" class="opt">
              {{ optionLetter(oi) }}. {{ o.text }}
            </el-radio>
          </el-radio-group>

          <el-checkbox-group v-else-if="q.type === 'multiple'" v-model="answers[q.id]" class="opts" @change="changed = true">
            <el-checkbox v-for="(o, oi) in q.options" :key="o.key" :value="o.key" class="opt">
              {{ optionLetter(oi) }}. {{ o.text }}
            </el-checkbox>
          </el-checkbox-group>

          <el-radio-group v-else-if="q.type === 'judge'" v-model="answers[q.id]" class="opts" @change="changed = true">
            <el-radio :value="true" class="opt">正确</el-radio>
            <el-radio :value="false" class="opt">错误</el-radio>
          </el-radio-group>

          <div v-else-if="q.type === 'fill'" class="opts">
            <el-input
              v-for="(_, bi) in answers[q.id]"
              :key="bi"
              v-model="answers[q.id][bi]"
              :placeholder="`第 ${bi + 1} 空`"
              style="max-width: 360px; margin-bottom: 8px"
            />
          </div>

          <el-input
            v-else
            v-model="answers[q.id]"
            type="textarea"
            :autosize="{ minRows: 4 }"
            placeholder="请输入你的答案"
            class="opts"
          />
        </section>
        <div class="flex" style="justify-content: center; margin: 20px 0 40px">
          <el-button type="primary" size="large" :loading="submitting" @click="submit()">交卷</el-button>
        </div>
      </main>
    </div>
    <div v-else v-loading="true" style="height: 60vh" />
  </div>
</template>

<style scoped>
.take {
  min-height: 100vh;
  background: var(--ch-bg);
}
.bar {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid var(--ch-border);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  position: sticky;
  top: 0;
  z-index: 10;
}
.clock {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.clock.danger {
  color: var(--el-color-danger);
}
.body {
  display: flex;
  gap: 16px;
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
  align-items: flex-start;
}
.nav {
  width: 200px;
  flex-shrink: 0;
  position: sticky;
  top: 72px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  margin-top: 10px;
}
.num {
  height: 30px;
  border: 1px solid var(--ch-border);
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
}
.num.done {
  background: var(--ch-primary);
  border-color: var(--ch-primary);
  color: #fff;
}
.paper {
  flex: 1;
  min-width: 0;
}
.q {
  margin-bottom: 12px;
}
.q-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.stem {
  margin-bottom: 12px;
}
.opts {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.opt {
  height: auto;
  white-space: normal;
  line-height: 1.6;
}
@media (max-width: 700px) {
  .nav {
    display: none;
  }
  .bar {
    gap: 8px;
    padding: 0 12px;
  }
}
</style>

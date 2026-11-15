<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { activitiesApi } from '@/api/activities'
import type { Activity, Question, QuestionType } from '@/api/types'
import { Q_LABEL, optionLetter } from '@/utils/format'
import BackBar from '@/components/BackBar.vue'

const props = defineProps<{ activityId: number }>()
const act = ref<Activity | null>(null)
const questions = ref<Question[]>([])
const saving = ref(false)
const dirty = ref(false)
const checked = ref<Set<number>>(new Set())

onMounted(async () => {
  act.value = await activitiesApi.get(props.activityId)
  questions.value = await activitiesApi.questions(props.activityId)
})

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  try {
    await ElMessageBox.confirm('题目还没有保存，确定离开吗？', '提示', { confirmButtonText: '离开', type: 'warning' })
    return true
  } catch {
    return false
  }
})

const total = computed(() => questions.value.reduce((s, q) => s + (Number(q.score) || 0), 0))

function blank(type: QuestionType): Question {
  const base = { type, stem: '', score: type === 'short' ? 10 : 5, analysis: '' }
  switch (type) {
    case 'single':
      return { ...base, options: ['', '', '', ''], answer: null }
    case 'multiple':
      return { ...base, options: ['', '', '', ''], answer: [] }
    case 'judge':
      return { ...base, options: [], answer: true }
    case 'fill':
      return { ...base, options: [], answer: [''] }
    default:
      return { ...base, options: [], answer: '' }
  }
}

function add(type: QuestionType) {
  questions.value.push(blank(type))
  dirty.value = true
  setTimeout(() => document.querySelector('.q-card:last-child')?.scrollIntoView({ behavior: 'smooth' }), 50)
}
function removeAt(i: number) {
  questions.value.splice(i, 1)
  checked.value = new Set()
  dirty.value = true
}
function move(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= questions.value.length) return
  const arr = questions.value
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  dirty.value = true
}
function copyAt(i: number) {
  const q = JSON.parse(JSON.stringify(questions.value[i]))
  delete q.id
  questions.value.splice(i + 1, 0, q)
  dirty.value = true
}
function batchDelete() {
  questions.value = questions.value.filter((_, i) => !checked.value.has(i))
  checked.value = new Set()
  dirty.value = true
}
function toggleCheck(i: number, v: boolean) {
  const s = new Set(checked.value)
  if (v) s.add(i)
  else s.delete(i)
  checked.value = s
}

function addOption(q: Question) {
  q.options.push('')
}
function removeOption(q: Question, i: number) {
  if (q.options.length <= 2) return ElMessage.warning('至少保留 2 个选项')
  q.options.splice(i, 1)
  if (q.type === 'single') {
    if (q.answer === i) q.answer = null
    else if (typeof q.answer === 'number' && q.answer > i) q.answer -= 1
  } else {
    q.answer = (q.answer as number[]).filter((x) => x !== i).map((x) => (x > i ? x - 1 : x))
  }
}
function toggleMulti(q: Question, i: number) {
  const set = new Set<number>(q.answer || [])
  if (set.has(i)) set.delete(i)
  else set.add(i)
  q.answer = [...set].sort((a, b) => a - b)
}

function validate(): string | null {
  for (const [i, q] of questions.value.entries()) {
    const n = `第 ${i + 1} 题`
    if (!q.stem.trim()) return `${n}题干为空`
    if (q.type === 'single' || q.type === 'multiple') {
      if (q.options.some((o) => !o.trim())) return `${n}有空选项`
      if (q.type === 'single' && typeof q.answer !== 'number') return `${n}请选择正确答案`
      if (q.type === 'multiple' && !q.answer?.length) return `${n}请选择正确答案`
    }
    if (q.type === 'fill' && (q.answer as string[]).some((a) => !a.trim())) return `${n}有空的填空答案`
  }
  return null
}

async function save() {
  const err = validate()
  if (err) return ElMessage.warning(err)
  saving.value = true
  try {
    questions.value = await activitiesApi.saveQuestions(props.activityId, questions.value)
    dirty.value = false
    ElMessage.success(`已保存，共 ${questions.value.length} 题，满分 ${total.value} 分`)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="act" @input="dirty = true">
    <BackBar :items="[{ label: '课程内容', to: `/courses/${act.course_id}` }, { label: act.title, to: `/courses/${act.course_id}/activities/${act.id}` }, { label: '管理题目' }]" />

    <div class="toolbar card">
      <b>{{ act.title }}</b>
      <span class="muted">共 {{ questions.length }} 题 · 满分 {{ total }} 分</span>
      <span class="spacer" />
      <el-button v-if="checked.size" type="danger" plain size="small" @click="batchDelete">删除选中（{{ checked.size }}）</el-button>
      <el-dropdown trigger="click" @command="add">
        <el-button type="primary" plain><el-icon><Plus /></el-icon>&nbsp;新增题目</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="(label, t) in Q_LABEL" :key="t" :command="t">{{ label }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </div>

    <el-alert
      v-if="act.is_published && questions.some((q) => q.id)"
      type="warning"
      :closable="false"
      show-icon
      title="测试已发布：修改题目和答案不会重新判已交的答卷，删除题目会让已交答卷中该题的作答失效。"
      style="margin-bottom: 12px"
    />

    <div v-if="!questions.length" class="card empty-tip">还没有题目，点击右上角「新增题目」</div>

    <section v-for="(q, i) in questions" :key="i" class="card q-card">
      <div class="q-head">
        <el-checkbox :model-value="checked.has(i)" @change="(v: any) => toggleCheck(i, !!v)" />
        <b>第 {{ i + 1 }} 题</b>
        <el-tag size="small" effect="plain">{{ Q_LABEL[q.type] }}</el-tag>
        <span class="muted">分值</span>
        <el-input-number v-model="q.score" :min="0" :max="1000" size="small" :precision="1" @change="dirty = true" />
        <span class="spacer" />
        <el-button link :disabled="i === 0" @click="move(i, -1)"><el-icon><Top /></el-icon></el-button>
        <el-button link :disabled="i === questions.length - 1" @click="move(i, 1)"><el-icon><Bottom /></el-icon></el-button>
        <el-button link @click="copyAt(i)"><el-icon><CopyDocument /></el-icon></el-button>
        <el-button link type="danger" @click="removeAt(i)"><el-icon><Delete /></el-icon></el-button>
      </div>

      <el-input
        v-model="q.stem"
        type="textarea"
        :autosize="{ minRows: 2 }"
        :placeholder="q.type === 'fill' ? '题干，用 ____ 表示填空位置' : '题干'"
      />

      <!-- 单选 / 多选 -->
      <div v-if="q.type === 'single' || q.type === 'multiple'" class="options">
        <div v-for="(_, oi) in q.options" :key="oi" class="option">
          <el-radio
            v-if="q.type === 'single'"
            :model-value="q.answer"
            :value="oi"
            @change="(q.answer = oi), (dirty = true)"
          >
            {{ optionLetter(oi) }}
          </el-radio>
          <el-checkbox
            v-else
            :model-value="(q.answer || []).includes(oi)"
            @change="toggleMulti(q, oi), (dirty = true)"
          >
            {{ optionLetter(oi) }}
          </el-checkbox>
          <el-input v-model="q.options[oi]" :placeholder="`选项 ${optionLetter(oi)}`" />
          <el-button link type="danger" @click="removeOption(q, oi), (dirty = true)"><el-icon><Close /></el-icon></el-button>
        </div>
        <div class="flex">
          <el-button size="small" link type="primary" @click="addOption(q), (dirty = true)"><el-icon><Plus /></el-icon> 添加选项</el-button>
          <span class="muted">勾选左侧的字母设置正确答案{{ q.type === 'multiple' ? '（可多选，全对才得分）' : '' }}</span>
        </div>
      </div>

      <!-- 判断 -->
      <div v-if="q.type === 'judge'" class="options">
        <span class="muted" style="margin-right: 12px">正确答案</span>
        <el-radio-group v-model="q.answer" @change="dirty = true">
          <el-radio :value="true">正确</el-radio>
          <el-radio :value="false">错误</el-radio>
        </el-radio-group>
      </div>

      <!-- 填空 -->
      <div v-if="q.type === 'fill'" class="options">
        <div v-for="(_, bi) in q.answer" :key="bi" class="option">
          <span class="muted" style="width: 60px">第 {{ bi + 1 }} 空</span>
          <el-input v-model="q.answer[bi]" placeholder="正确答案，多个可接受答案用 | 分隔" />
          <el-button link type="danger" :disabled="q.answer.length <= 1" @click="q.answer.splice(bi, 1), (dirty = true)">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
        <el-button size="small" link type="primary" @click="q.answer.push(''), (dirty = true)"><el-icon><Plus /></el-icon> 添加一个空</el-button>
        <span class="muted"> 每空平均分配分值，判分时忽略首尾空格和大小写</span>
      </div>

      <!-- 简答 -->
      <div v-if="q.type === 'short'" class="options">
        <el-input v-model="q.answer" type="textarea" :autosize="{ minRows: 2 }" placeholder="参考答案（仅教师批改时可见，学生交卷后按设置显示）" />
        <div class="muted" style="margin-top: 4px">简答题需要教师人工评分</div>
      </div>

      <el-input v-model="q.analysis" placeholder="解析（可选）" style="margin-top: 10px" size="small">
        <template #prepend>解析</template>
      </el-input>
    </section>

    <div v-if="questions.length" class="flex" style="justify-content: center; margin-top: 16px">
      <el-button type="primary" :loading="saving" @click="save">保存全部题目</el-button>
    </div>
  </div>
  <div v-else v-loading="true" style="height: 300px" />
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  position: sticky;
  top: calc(var(--ch-header-h) + 8px);
  z-index: 5;
}
.q-card {
  margin-bottom: 12px;
}
.q-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.q-head .el-button + .el-button {
  margin-left: 0;
}
.options {
  margin-top: 10px;
}
.option {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.option .el-radio,
.option .el-checkbox {
  margin-right: 0;
  width: 44px;
}
</style>

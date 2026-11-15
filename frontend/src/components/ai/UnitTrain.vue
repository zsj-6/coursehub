<script setup lang="ts">
/**
 * 能力单元 · AI 训练（领导版）：
 *  - 训练任务：对话 / 生成 / 评测 / 角色扮演，作答后 AI 按规则给反馈和参考分（不计成绩）
 *  - 思维探索小径：AI 一步步提问引导，不直接给答案
 * 教师 / 助教看到每个任务的班级完成情况。
 */
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { THINK_THEMES } from '@/mock/growth'
import type { Unit } from '@/mock/ai'
import { useAiStore } from '@/stores/ai'
import { useGrowthStore, type TrainTask } from '@/stores/growth'

const props = defineProps<{ unit: Unit }>()
const g = useGrowthStore()
const ai = useAiStore()
const tasks = computed(() => g.tasksOf(props.unit.id))

const TYPE: Record<string, string> = { DIALOG: '对话训练', GENERATE: '生成训练', EVALUATE: '评测', ROLE_PLAY: '角色扮演' }
const DIFF: Record<string, { label: string; type: 'success' | 'warning' | 'danger' }> = {
  EASY: { label: '简单', type: 'success' },
  MEDIUM: { label: '中等', type: 'warning' },
  HARD: { label: '困难', type: 'danger' },
}
const myScore = (t: TrainTask) => g.trainScore(t.id)?.score ?? t.lastScore
/** 教师视图：班级完成情况（演示数据，按任务 id 稳定生成） */
const classStat = (t: TrainTask) => {
  const n = ai.roster.length
  const h = [...t.id].reduce((s, c) => s + c.charCodeAt(0), 0)
  const done = Math.min(n, 8 + (h % (n - 8)))
  return { done, n, avg: 62 + (h % 25) }
}

// ---------- 训练过程
const cur = ref<TrainTask | null>(null)
const step = ref(0)
const answer = ref('')
const result = ref<{ score: number; good: string[]; tips: string[] } | null>(null)
const SCENARIO: Record<string, (t: TrainTask) => string> = {
  DIALOG: (t) => `${t.expert}：我们开始吧。${t.intro}\n\n命题：「只要每天坚持刷题，算法竞赛就一定能拿奖。」请找出其中的逻辑问题，并说明理由。`,
  GENERATE: (t) => `${t.expert}：${t.intro}\n\n请直接在下方写出你的答案，尽量分点、写清理由。`,
  EVALUATE: (t) => `${t.expert}：${t.intro}\n\n请逐条写出你的判断和理由。`,
  ROLE_PLAY: (t) => `${t.expert}（扮演评审）：${t.intro}\n\n第一个问题：你的方案里，最大的技术风险是什么？你准备怎么验证它？`,
}
function start(t: TrainTask) {
  cur.value = t
  step.value = 0
  answer.value = ''
  result.value = null
}
function submit() {
  const a = answer.value.trim()
  if (a.length < 10) return ElMessage.warning('多写一点，至少说清楚一个观点和理由')
  const good: string[] = []
  const tips: string[] = []
  const points = (a.match(/[1-9][.、)]|[；;]|\n/g) ?? []).length
  if (points >= 2) good.push('分点表达，结构清楚')
  else tips.push('试着分点写：观点 → 理由 → 例子')
  if (/因为|所以|理由|原因|证据|例如|比如/.test(a)) good.push('给出了理由或例子')
  else tips.push('每个观点后面补一句"因为……"或一个具体例子')
  if (a.length >= 80) good.push('内容比较充分')
  else tips.push('篇幅偏短，可以再展开一个方面')
  const node = ai.findNode(a, props.unit.id)
  if (node) good.push(`用到了「${node.name}」的知识`)
  const score = Math.min(98, 55 + good.length * 10 + Math.min(10, Math.floor(a.length / 30)))
  result.value = { score, good, tips }
  g.setTrainScore(cur.value!.id, score)
  step.value = 2
}

// ---------- 思维探索小径
const themeIdx = ref<number | null>(null)
const tStep = ref(0)
const tAnswer = ref('')
const showHint = ref(false)
const trail = ref<{ q: string; a: string }[]>([])
const theme = computed(() => (themeIdx.value === null ? null : THINK_THEMES[themeIdx.value]))
function startTheme(i: number) {
  themeIdx.value = i
  tStep.value = 0
  trail.value = []
  tAnswer.value = ''
  showHint.value = false
}
function nextStep() {
  if (!theme.value || !tAnswer.value.trim()) return
  trail.value.push({ q: theme.value.steps[tStep.value].q, a: tAnswer.value.trim() })
  tAnswer.value = ''
  showHint.value = false
  tStep.value++
}
</script>

<template>
  <div>
    <p class="intro muted">AI 训练用来练习"用得出来"：作答后 AI 按规则给反馈和参考分，<b>不计成绩</b>。训练任务来自领导版原型，机甲大师单元另补了 3 个。</p>

    <div v-if="!tasks.length" class="card empty-tip">这个能力还没有训练任务</div>
    <div class="tasks">
      <article v-for="t in tasks" :key="t.id" class="task card">
        <div class="t-head">
          <el-tag size="small" type="info">{{ TYPE[t.type] }}</el-tag>
          <el-tag size="small" :type="DIFF[t.difficulty]?.type">{{ DIFF[t.difficulty]?.label }}</el-tag>
          <span class="muted">约 {{ t.mins }} 分钟 · {{ t.expert }}</span>
        </div>
        <b class="t-name">{{ t.name }}</b>
        <p class="muted">{{ t.intro }}</p>
        <div class="t-foot">
          <template v-if="g.isStudent">
            <span v-if="myScore(t) != null" class="score">上次 {{ myScore(t) }} 分</span>
            <span v-else class="muted">还没练过</span>
            <div class="spacer" />
            <el-button size="small" type="primary" @click="start(t)">{{ myScore(t) != null ? '再练一次' : '开始训练' }}</el-button>
          </template>
          <template v-else>
            <span class="muted">班级完成 {{ classStat(t).done }}/{{ classStat(t).n }} · 平均参考分 {{ classStat(t).avg }}</span>
          </template>
        </div>
      </article>
    </div>

    <section class="card think">
      <h3 class="card-title">思维探索小径 <span class="muted">AI 一步步提问，不直接给答案</span></h3>
      <div class="themes">
        <button v-for="(th, i) in THINK_THEMES" :key="th.name" :class="{ on: themeIdx === i }" @click="startTheme(i)">{{ th.name }} · {{ th.steps.length }} 步</button>
      </div>
      <div v-if="theme" class="path">
        <div v-for="(x, i) in trail" :key="i" class="done-step">
          <div class="q">{{ i + 1 }}. {{ x.q }}</div>
          <div class="a">{{ x.a }}</div>
        </div>
        <template v-if="tStep < theme.steps.length">
          <div class="q cur">{{ tStep + 1 }}. {{ theme.steps[tStep].q }}</div>
          <div v-if="showHint" class="hint">提示：{{ theme.steps[tStep].hint }}</div>
          <div class="ans">
            <el-input v-model="tAnswer" placeholder="写下你的想法" @keydown.enter="nextStep" />
            <el-button v-if="!showHint" @click="showHint = true">给点提示</el-button>
            <el-button type="primary" :disabled="!tAnswer.trim()" @click="nextStep">下一步</el-button>
          </div>
        </template>
        <div v-else class="finish"><el-icon><CircleCheckFilled /></el-icon>{{ theme.done }}</div>
      </div>
    </section>

    <el-dialog :model-value="!!cur" :title="cur?.name" width="640px" @close="cur = null">
      <template v-if="cur">
        <el-steps :active="step" finish-status="success" simple class="steps">
          <el-step title="任务说明" />
          <el-step title="作答" />
          <el-step title="AI 反馈" />
        </el-steps>
        <div v-if="step === 0" class="scenario">{{ SCENARIO[cur.type]?.(cur) ?? cur.intro }}</div>
        <template v-if="step === 1">
          <div class="scenario small">{{ SCENARIO[cur.type]?.(cur) ?? cur.intro }}</div>
          <el-input v-model="answer" type="textarea" :rows="7" placeholder="在这里作答……" />
        </template>
        <template v-if="step === 2 && result">
          <div class="res-head">
            <span class="big">{{ result.score }}</span><span class="muted">参考分 · 不计成绩</span>
            <el-tag size="small" type="warning">AI 反馈</el-tag>
          </div>
          <div v-if="result.good.length" class="res-sec"><b class="ok">做得好</b><span v-for="x in result.good" :key="x">· {{ x }}</span></div>
          <div v-if="result.tips.length" class="res-sec"><b class="warn">可以改进</b><span v-for="x in result.tips" :key="x">· {{ x }}</span></div>
        </template>
      </template>
      <template #footer>
        <el-button v-if="step === 0" type="primary" @click="step = 1">开始作答</el-button>
        <template v-if="step === 1">
          <el-button @click="step = 0">上一步</el-button>
          <el-button type="primary" @click="submit">提交，看 AI 反馈</el-button>
        </template>
        <template v-if="step === 2">
          <el-button @click="step = 1">修改后再交</el-button>
          <el-button type="primary" @click="cur = null">完成</el-button>
        </template>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.intro {
  margin: 0 0 14px;
}
.intro b {
  color: var(--ch-text);
  font-weight: 500;
}
.tasks {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}
.task {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px;
}
.t-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.t-head .muted {
  font-size: 12px;
}
.t-name {
  font-size: 15px;
}
.task p {
  margin: 0;
  font-size: 13px;
}
.t-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--ch-border-light);
  font-size: 12.5px;
}
.score {
  color: var(--ch-primary-text);
  font-weight: 500;
}
.card-title .muted {
  margin-left: 6px;
  font-weight: 400;
  font-size: 12px;
}
.themes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.themes button {
  border: 1px solid var(--ch-border);
  background: #fff;
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 13px;
  cursor: pointer;
  color: var(--ch-text);
}
.themes button.on {
  border-color: var(--ch-primary);
  background: var(--ch-primary-bg);
  color: var(--ch-primary-text);
}
.path {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 760px;
}
.q {
  font-size: 14px;
  font-weight: 500;
}
.q.cur {
  color: var(--ch-primary-text);
}
.done-step .a {
  margin: 4px 0 0 18px;
  padding: 6px 10px;
  background: var(--ch-fill);
  border-radius: 6px;
  font-size: 13px;
}
.hint {
  font-size: 13px;
  color: var(--ch-warning);
}
.ans {
  display: flex;
  gap: 8px;
}
.finish {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ch-success);
  font-weight: 500;
}
.steps {
  margin-bottom: 14px;
}
.scenario {
  white-space: pre-wrap;
  line-height: 1.8;
  padding: 12px 14px;
  background: var(--ch-fill);
  border-radius: 6px;
}
.scenario.small {
  font-size: 13px;
  margin-bottom: 10px;
}
.res-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}
.big {
  font-size: 34px;
  font-weight: 600;
  color: var(--ch-primary-text);
}
.res-sec {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 13.5px;
  margin-bottom: 8px;
}
.ok {
  color: var(--ch-success);
}
.warn {
  color: var(--ch-warning);
}
</style>

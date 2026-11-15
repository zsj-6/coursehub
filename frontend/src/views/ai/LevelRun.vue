<script setup lang="ts">
/**
 * 闯关：诊断 → 分到三条路径之一 → 过关检测（标准对所有人一样）→ 结果
 * 诊断和过关检测期间不显示 AI 辅学入口、不给提示。
 */
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BackBar from '@/components/BackBar.vue'
import QuestionCard from '@/components/ai/QuestionCard.vue'
import { LEVEL_PATH_META, type QLevel } from '@/mock/ai'
import { MASTERY_LABEL, masteryLevel, useAiStore } from '@/stores/ai'

const props = defineProps<{ unitId: string; levelId: string }>()
const ai = useAiStore()
const router = useRouter()
const unit = computed(() => ai.unit(props.unitId))
const level = computed(() => ai.level(props.levelId))

const step = ref(0) // 0 诊断 1 学习路径 2 过关检测 3 结果
const PASS_LINE = 0.6

// 诊断和过关检测期间屏蔽 AI 辅学
watch(
  step,
  (s, old) => {
    ai.tutorBlocked = s === 0 || s === 2
    if (old !== undefined) window.scrollTo({ top: 0 })
  },
  { immediate: true },
)
onBeforeUnmount(() => (ai.tutorBlocked = false))

const qs = (ids: string[]) => ids.map((id) => ai.question(id)!).filter(Boolean)
const diagQs = computed(() => qs(level.value?.diagnose ?? []))
const passQs = computed(() => qs(level.value?.pass ?? []))

const diagAns = reactive<Record<string, number | null>>({})
const diagDone = ref(false)
const passAns = reactive<Record<string, number | null>>({})
const passDone = ref(false)
const practiceAns = reactive<Record<string, number | null>>({})
const practiceDone = reactive<Record<string, boolean>>({})
const path = ref<QLevel>('standard')
const challengeText = ref('')

const diagCorrect = computed(() => diagQs.value.filter((q) => diagAns[q.id] === q.answer).length)
const passCorrect = computed(() => passQs.value.filter((q) => passAns[q.id] === q.answer).length)
const passed = computed(() => passCorrect.value >= Math.ceil(passQs.value.length * PASS_LINE))

function submitDiag() {
  if (diagQs.value.some((q) => diagAns[q.id] === undefined || diagAns[q.id] === null)) return ElMessage.warning('还有题没有作答')
  diagDone.value = true
  for (const q of diagQs.value) ai.addRecord(q.nodeId, diagAns[q.id] === q.answer, `闯关诊断 · 第 ${level.value!.order} 关`)
  path.value = ai.assignPath(diagCorrect.value, diagQs.value.length)
  ai.setPath(props.levelId, path.value)
}
function submitPass() {
  if (passQs.value.some((q) => passAns[q.id] === undefined || passAns[q.id] === null)) return ElMessage.warning('还有题没有作答')
  passDone.value = true
  for (const q of passQs.value) ai.addRecord(q.nodeId, passAns[q.id] === q.answer, `过关检测 · 第 ${level.value!.order} 关`)
  if (passed.value) ai.passLevel(props.levelId)
  step.value = 3
}
function retry() {
  for (const k of Object.keys(passAns)) delete passAns[k]
  passDone.value = false
  step.value = 1
}

// ---------- 学习路径内容
const wrongDiag = computed(() => diagQs.value.filter((q) => diagAns[q.id] !== q.answer))
/** 补基础：本关知识点的前置里，还没掌握的那些 */
const prereqs = computed(() => {
  const u = unit.value
  if (!u || !level.value) return []
  const ids = new Set<string>()
  for (const id of level.value.nodeIds)
    for (const e of u.edges) if (e.to === id && !level.value.nodeIds.includes(e.from) && (ai.mastery(e.from) ?? 0) < 80) ids.add(e.from)
  return [...ids]
})
const studyNodes = computed(() => (path.value === 'basic' ? [...prereqs.value, ...(level.value?.nodeIds ?? [])] : level.value?.nodeIds ?? []))
const practiceQs = computed(() => (path.value === 'challenge' ? [] : wrongDiag.value.length ? wrongDiag.value : diagQs.value))
function sourceLink(s: { resId: string; partId: string }) {
  return `/units/${props.unitId}/read/${s.resId}?part=${s.partId}`
}
function practice(qid: string) {
  const q = ai.question(qid)!
  practiceDone[qid] = true
  ai.addRecord(q.nodeId, practiceAns[qid] === q.answer, `闯关练习 · 第 ${level.value!.order} 关`)
}
const nextLevel = computed(() => ai.levelsOf(props.unitId).find((l) => l.order === (level.value?.order ?? 0) + 1))
</script>

<template>
  <div v-if="!unit || !level" class="empty-tip">关卡不存在</div>
  <div v-else class="run">
    <BackBar :items="[{ label: '能力成长', to: '/units' }, { label: unit.name, to: `/units/${unit.id}?tab=levels` }, { label: `第 ${level.order} 关` }]" />
    <section class="card head">
      <div>
        <div class="muted">第 {{ level.order }} 关</div>
        <h1>{{ level.title }}</h1>
        <div class="nodes">
          <span v-for="id in level.nodeIds" :key="id" class="nchip" :class="masteryLevel(ai.mastery(id))">
            {{ ai.node(id)?.name }} · {{ MASTERY_LABEL[masteryLevel(ai.mastery(id))] }}{{ ai.mastery(id) !== null ? ` ${ai.mastery(id)}%` : '' }}
          </span>
        </div>
      </div>
      <el-steps :active="step" finish-status="success" simple class="steps">
        <el-step title="诊断" />
        <el-step title="学习路径" />
        <el-step title="过关检测" />
        <el-step title="结果" />
      </el-steps>
    </section>

    <!-- 0 诊断 -->
    <section v-if="step === 0" class="card">
      <h3 class="card-title">诊断 <span class="muted">{{ diagQs.length }} 题 · 按结果分到三条路径之一 · 作答期间不提供提示</span></h3>
      <QuestionCard v-for="(q, i) in diagQs" :key="q.id" v-model="diagAns[q.id]" :q="q" mode="test" :revealed="diagDone" :index="i" :unit-id="unitId" />
      <div class="actions">
        <el-button v-if="!diagDone" type="primary" @click="submitDiag">提交诊断</el-button>
        <template v-else>
          <div class="assign">
            答对 <b>{{ diagCorrect }}/{{ diagQs.length }}</b>，分到
            <el-tag :type="path === 'basic' ? 'warning' : path === 'challenge' ? 'success' : 'primary'">{{ LEVEL_PATH_META[path].label }}</el-tag>
            <span class="muted">{{ LEVEL_PATH_META[path].desc }}（全对 → 挑战，答对过半 → 标准，其余 → 补基础）</span>
          </div>
          <el-button type="primary" @click="step = 1">进入学习路径</el-button>
        </template>
      </div>
    </section>

    <!-- 1 学习路径 -->
    <template v-if="step === 1">
      <section class="card">
        <h3 class="card-title">
          {{ LEVEL_PATH_META[path].label }}
          <span class="muted">{{ LEVEL_PATH_META[path].desc }} · 过关标准和其他路径一样</span>
        </h3>
        <template v-if="path !== 'challenge'">
          <div class="sub">先学这些{{ path === 'basic' ? '（含没掌握的前置知识）' : '' }}</div>
          <div class="study">
            <div v-for="id in studyNodes" :key="id" class="study-row">
              <span class="nm">{{ ai.node(id)?.name }}</span>
              <span v-if="prereqs.includes(id)" class="tag-pre">前置</span>
              <span class="lv" :class="masteryLevel(ai.mastery(id))">{{ MASTERY_LABEL[masteryLevel(ai.mastery(id))] }}</span>
              <div class="spacer" />
              <router-link v-for="s in ai.sourcesOf(id, 2)" :key="s.resId + s.partId" :to="sourceLink(s)" class="src">
                <el-icon><Link /></el-icon>{{ s.label }}
              </router-link>
            </div>
          </div>
          <div class="sub">再练一练 <span class="muted">{{ wrongDiag.length ? '诊断里做错的题' : '巩固练习' }} · 可以要提示，也可以问 AI 辅学</span></div>
          <QuestionCard
            v-for="(q, i) in practiceQs"
            :key="q.id"
            v-model="practiceAns[q.id]"
            :q="q"
            mode="practice"
            :revealed="!!practiceDone[q.id]"
            :index="i"
            :unit-id="unitId"
          />
          <div class="practice-actions">
            <el-button v-for="q in practiceQs.filter((x) => !practiceDone[x.id])" :key="q.id" size="small" :disabled="practiceAns[q.id] == null" @click="practice(q.id)">
              提交第 {{ practiceQs.indexOf(q) + 1 }} 题
            </el-button>
          </div>
        </template>
        <template v-else>
          <p>诊断全对，可以直接挑战过关。过关后完成下面的拓展任务（不计分，提交后教师可见）：</p>
          <div class="challenge">{{ level.challenge || '拓展任务：找一个本关知识点在机器人上的实际用例，写 200 字说明。' }}</div>
          <el-input v-model="challengeText" type="textarea" :rows="3" placeholder="写下你的思路……" />
        </template>
      </section>
      <div class="actions"><el-button type="primary" size="large" @click="step = 2">我准备好了，开始过关检测</el-button></div>
    </template>

    <!-- 2 过关检测 -->
    <section v-if="step === 2" class="card">
      <h3 class="card-title">过关检测 <span class="muted">{{ passQs.length }} 题 · 答对 {{ Math.ceil(passQs.length * PASS_LINE) }} 题过关 · 三条路径同一套标准</span></h3>
      <QuestionCard v-for="(q, i) in passQs" :key="q.id" v-model="passAns[q.id]" :q="q" mode="test" :revealed="false" :index="i" :unit-id="unitId" />
      <div class="actions"><el-button type="primary" @click="submitPass">交卷</el-button></div>
    </section>

    <!-- 3 结果 -->
    <section v-if="step === 3" class="card result">
      <div class="r-head" :class="passed ? 'ok' : 'bad'">
        <el-icon :size="28"><component :is="passed ? 'CircleCheckFilled' : 'WarningFilled'" /></el-icon>
        <div>
          <h2>{{ passed ? '过关了' : '这次还差一点' }}</h2>
          <div class="muted">答对 {{ passCorrect }}/{{ passQs.length }} · 掌握度已按本次作答更新</div>
        </div>
      </div>
      <div class="lit">
        <span v-for="id in level.nodeIds" :key="id" class="nchip" :class="masteryLevel(ai.mastery(id))">
          {{ ai.node(id)?.name }} {{ ai.mastery(id) }}%
        </span>
      </div>
      <template v-if="!passed">
        <div class="sub">AI 辅学分析错因</div>
        <QuestionCard v-for="(q, i) in passQs.filter((x) => passAns[x.id] !== x.answer)" :key="q.id" v-model="passAns[q.id]" :q="q" mode="test" :revealed="true" :index="i" />
      </template>
      <div class="actions">
        <el-button v-if="!passed" type="primary" @click="retry">回到学习路径再练</el-button>
        <el-button v-if="passed && nextLevel && nextLevel.diagnose.length" type="primary" @click="router.push(`/units/${unitId}/levels/${nextLevel.id}`)">
          下一关：{{ nextLevel.title }}
        </el-button>
        <el-button @click="router.push(`/units/${unitId}?tab=levels`)">返回闯关地图</el-button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.run {
  max-width: 1000px;
}
.head {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 16px;
}
.head h1 {
  margin: 2px 0 8px;
  font-size: 20px;
}
.nodes,
.lit {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.nchip {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 4px;
  background: var(--ch-fill);
  color: var(--ch-text-2);
}
.nchip.weak {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}
.nchip.good {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success-dark-2);
}
.nchip.mid {
  background: var(--ch-primary-bg);
  color: var(--ch-primary-text);
}
.steps {
  --el-fill-color-light: var(--ch-fill);
}
.card-title .muted {
  margin-left: 8px;
  font-weight: 400;
  font-size: 12.5px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: wrap;
}
.assign {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 14px;
}
.sub {
  margin: 12px 0 8px;
  font-weight: 600;
  font-size: 14px;
}
.sub .muted {
  font-weight: 400;
  font-size: 12.5px;
  margin-left: 6px;
}
.study {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ch-border-light);
  border-radius: 6px;
}
.study-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  font-size: 13px;
  flex-wrap: wrap;
}
.study-row + .study-row {
  border-top: 1px solid var(--ch-border-light);
}
.nm {
  font-weight: 500;
}
.tag-pre {
  font-size: 11px;
  padding: 0 5px;
  border-radius: 3px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}
.lv {
  font-size: 12px;
  color: var(--ch-text-3);
}
.lv.weak {
  color: var(--ch-warning);
}
.lv.good {
  color: var(--ch-success);
}
.lv.mid {
  color: var(--ch-primary-text);
}
.src {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12.5px;
}
.practice-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.challenge {
  padding: 10px 12px;
  background: var(--ch-fill);
  border-radius: 6px;
  margin-bottom: 10px;
  font-size: 13.5px;
}
.r-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.r-head h2 {
  margin: 0;
  font-size: 18px;
}
.r-head.ok .el-icon {
  color: var(--ch-success);
}
.r-head.bad .el-icon {
  color: var(--ch-warning);
}
</style>

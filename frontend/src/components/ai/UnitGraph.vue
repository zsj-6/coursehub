<script setup lang="ts">
/**
 * 能力单元 · 知识图谱页签
 * 学生：看自己的掌握度、选目标生成学习路径、点节点定位到书页 / 视频片段、问 AI 辅学
 * 教师：看班级平均掌握度、演示 AI 生成图谱、审核 AI 候选节点
 */
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, ref } from 'vue'
import KnowledgeGraph from '@/components/ai/KnowledgeGraph.vue'
import { EDGE_REL_LABEL, NODE_TYPE_META, type Unit } from '@/mock/ai'
import { MASTERY_LABEL, masteryLevel, useAiStore } from '@/stores/ai'

const props = defineProps<{ unit: Unit }>()
const ai = useAiStore()

const nodes = computed(() => ai.nodesOf(props.unit))
const edges = computed(() => ai.edgesOf(props.unit))
const pending = computed(() => nodes.value.filter((n) => ai.nodeStatus(n) === 'ai').map((n) => n.id))
const colorBy = ref<'mastery' | 'type'>('mastery')

const weakest = computed(() =>
  [...nodes.value]
    .filter((n) => ai.viewMastery(n.id) !== null)
    .sort((a, b) => (ai.viewMastery(a.id) ?? 0) - (ai.viewMastery(b.id) ?? 0))[0],
)
const selected = ref<string>(weakest.value?.id ?? nodes.value[0]?.id ?? '')
const node = computed(() => ai.node(selected.value))
const m = computed(() => (node.value ? ai.viewMastery(node.value.id) : null))
const isPending = computed(() => !!node.value && ai.nodeStatus(node.value) === 'ai')

// ---------- 学习路径
const target = ref<string>('')
const path = computed(() => (target.value ? ai.learningPath(props.unit, target.value) : []))
const targets = computed(() => nodes.value.filter((n) => n.type === 'apply' || n.type === 'core').filter((n) => ai.nodeStatus(n) !== 'ai'))
function setTarget(id: string) {
  target.value = id
  selected.value = id
}

// ---------- 节点详情
const related = computed(() => {
  if (!node.value) return { pre: [], next: [] }
  const id = node.value.id
  return {
    pre: edges.value.filter((e) => e.to === id).map((e) => ({ id: e.from, rel: EDGE_REL_LABEL[e.rel] })),
    next: edges.value.filter((e) => e.from === id).map((e) => ({ id: e.to, rel: EDGE_REL_LABEL[e.rel] })),
  }
})
const sources = computed(() => (node.value ? ai.sourcesOf(node.value.id, 5) : []))
const records = computed(() => (node.value && ai.isStudent ? ai.recordsOf(node.value.id) : []))
const distribution = computed(() => {
  if (!node.value || ai.isStudent) return null
  const c = { none: 0, weak: 0, mid: 0, good: 0 }
  for (const p of ai.roster) c[masteryLevel(ai.classMastery(node.value.id, p.id))]++
  return c
})
function sourceLink(s: { resId: string; partId: string }) {
  return `/units/${props.unit.id}/read/${s.resId}?part=${s.partId}`
}
function ask() {
  if (node.value) ai.openTutor({ unitId: props.unit.id, nodeId: node.value.id }, `「${node.value.name}」的要点是什么？`)
}
function review(decision: 'confirmed' | 'rejected') {
  if (!node.value) return
  ai.reviewNode(node.value.id, decision)
  ElMessage.success(decision === 'confirmed' ? '已采纳，学生现在能看到这个知识点' : '已驳回')
  if (decision === 'rejected') selected.value = nodes.value[0]?.id ?? ''
}

// ---------- AI 生成图谱（演示动画）
const reveal = ref<number | undefined>(undefined)
const genMsg = ref('')
let timer: number | undefined
function generate() {
  const total = nodes.value.length
  const res = ai.resourcesOf(props.unit.id).length
  const steps = [
    `正在解析 ${res} 份资料（教材、讲义、视频字幕、项目报告）…`,
    '正在抽取候选知识点和关系…',
    '正在合并同义知识点，标注出处（页码 / 时间点）…',
  ]
  reveal.value = 0
  target.value = ''
  let i = 0
  clearInterval(timer)
  timer = window.setInterval(() => {
    i++
    reveal.value = Math.min(total, i)
    genMsg.value = steps[Math.min(steps.length - 1, Math.floor((i / total) * steps.length))]
    if (i >= total) {
      clearInterval(timer)
      genMsg.value = `生成完成：${total - pending.value.length} 个知识点沿用已审核结果，${pending.value.length} 个新候选等待教师审核（虚线紫色）。`
      setTimeout(() => (reveal.value = undefined), 400)
    }
  }, 140)
}
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div v-if="!nodes.length" class="card empty">
    <div class="empty-tip">
      这个能力的知识图谱还没有生成。<br />
      <template v-if="!ai.isStudent">导入课件、教材、视频后，AI 会抽取知识点和关系，教师审核后发布。完整流程可以在「机器人视觉与控制」单元体验。</template>
    </div>
  </div>
  <div v-else class="graph-tab">
    <section class="card graph-card">
      <div class="toolbar">
        <div class="legend">
          <template v-if="colorBy === 'mastery'">
            <span><i class="lg none" />未学</span>
            <span><i class="lg weak" />薄弱 &lt;60%</span>
            <span><i class="lg mid" />学习中</span>
            <span><i class="lg good" />已掌握 ≥80%</span>
          </template>
          <template v-else>
            <span v-for="(v, k) in NODE_TYPE_META" :key="k"><i class="lg" :class="`t-${k}`" />{{ v.label }}</span>
          </template>
          <span v-if="pending.length"><i class="lg ai" />AI 候选（待审核）</span>
          <span class="muted">· 圆内数字为{{ ai.isStudent ? '我的' : '班级平均' }}掌握度 · 双圈 = 跨课程知识点</span>
        </div>
        <div class="spacer" />
        <el-radio-group v-model="colorBy" size="small">
          <el-radio-button value="mastery">按掌握度</el-radio-button>
          <el-radio-button value="type">按类型</el-radio-button>
        </el-radio-group>
      </div>
      <div class="toolbar">
        <template v-if="ai.isStudent">
          <span class="muted">学习目标</span>
          <el-select v-model="target" placeholder="选一个想掌握的知识点，生成学习路径" clearable filterable size="small" style="width: 300px">
            <el-option v-for="n in targets" :key="n.id" :value="n.id" :label="n.name" />
          </el-select>
        </template>
        <template v-else-if="ai.canPublish">
          <el-button size="small" :icon="'MagicStick'" @click="generate">演示：AI 从资料生成图谱</el-button>
          <span v-if="genMsg" class="gen-msg">{{ genMsg }}</span>
        </template>
      </div>
      <KnowledgeGraph
        :nodes="nodes"
        :edges="edges"
        :mastery-of="ai.viewMastery"
        :selected="selected"
        :path="path"
        :pending="pending"
        :color-by="colorBy"
        :reveal="reveal"
        @select="(id) => (selected = id)"
      />

      <div v-if="path.length" class="path">
        <div class="path-head">
          <b>学习路径 · 目标「{{ ai.node(target)?.name }}」</b>
          <span class="muted">沿前置关系往回找，跳过已掌握（≥80%）的知识点 · 共 {{ path.length }} 步，约 {{ path.length * 30 }} 分钟</span>
        </div>
        <ol class="steps">
          <li v-for="(id, i) in path" :key="id" :class="{ cur: selected === id }" @click="selected = id">
            <span class="idx">{{ i + 1 }}</span>
            <span class="nm">{{ ai.node(id)?.name }}</span>
            <span class="lv" :class="masteryLevel(ai.mastery(id))">{{ MASTERY_LABEL[masteryLevel(ai.mastery(id))] }}{{ ai.mastery(id) !== null ? ` ${ai.mastery(id)}%` : '' }}</span>
          </li>
        </ol>
      </div>
    </section>

    <aside v-if="node" class="card side">
      <div class="side-head">
        <h3>{{ node.name }}</h3>
        <el-tag size="small" type="info">{{ NODE_TYPE_META[node.type].label }}</el-tag>
      </div>
      <div v-if="node.courses?.length" class="courses">
        <span v-for="c in node.courses" :key="c">{{ c }}</span>
      </div>

      <div v-if="isPending" class="ai-box">
        <div><el-tag size="small" type="warning">AI 建议</el-tag> 从资料中抽取的新知识点，学生还看不到</div>
        <div class="muted">出处：{{ node.aiSource }}</div>
        <div v-if="ai.canPublish" class="ai-actions">
          <el-button size="small" type="primary" @click="review('confirmed')">采纳</el-button>
          <el-button size="small" @click="review('rejected')">驳回</el-button>
        </div>
      </div>

      <template v-else>
        <div class="m-row">
          <span class="m-val" :class="masteryLevel(m)">{{ m === null ? '—' : `${m}%` }}</span>
          <span class="muted">{{ ai.isStudent ? '我的掌握度' : '班级平均掌握度' }} · {{ MASTERY_LABEL[masteryLevel(m)] }}</span>
        </div>
        <details v-if="ai.isStudent" class="basis">
          <summary>由 {{ records.length }} 次作答算出（近 30 天权重 ×2）</summary>
          <div v-if="!records.length" class="muted">还没有作答记录</div>
          <div v-for="(r, i) in records" :key="i" class="rec">
            <span>{{ r.from }}</span><span class="muted">{{ dayjs(r.at).format('MM-DD') }}</span><b>{{ r.score }}</b>
          </div>
        </details>
        <div v-else-if="distribution" class="dist">
          <span>已掌握 <b>{{ distribution.good }}</b></span>
          <span>学习中 <b>{{ distribution.mid }}</b></span>
          <span class="warn">薄弱 <b>{{ distribution.weak }}</b></span>
          <span>未学 <b>{{ distribution.none }}</b></span>
        </div>
      </template>

      <p class="desc">{{ node.explain || node.desc }}</p>

      <div v-if="related.pre.length || related.next.length" class="rel">
        <div v-if="related.pre.length">
          <span class="muted">前置</span>
          <button v-for="r in related.pre" :key="r.id" class="chip" @click="selected = r.id">{{ ai.node(r.id)?.name }}</button>
        </div>
        <div v-if="related.next.length">
          <span class="muted">后续</span>
          <button v-for="r in related.next" :key="r.id" class="chip" @click="selected = r.id">{{ ai.node(r.id)?.name }}</button>
        </div>
      </div>

      <div class="sec-title">资源定位 <span class="muted">直接跳到对应页码 / 时间点</span></div>
      <div v-if="!sources.length" class="muted">还没有资源挂在这个知识点上</div>
      <router-link v-for="s in sources" :key="s.resId + s.partId" :to="sourceLink(s)" class="src">
        <el-icon><Link /></el-icon><span>{{ s.label }}</span>
      </router-link>

      <div v-if="!isPending" class="side-actions">
        <el-button v-if="ai.isStudent" type="primary" :icon="'ChatDotRound'" @click="ask">问 AI 辅学</el-button>
        <el-button v-if="ai.isStudent && target !== node.id" @click="setTarget(node.id)">设为学习目标</el-button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.graph-tab {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
  align-items: start;
}
.graph-card {
  padding: 16px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--ch-text-2);
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.lg {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid;
  display: inline-block;
}
.lg.none {
  border-color: #c5c9ce;
  border-style: dashed;
}
.lg.weak {
  border-color: var(--ch-warning);
  background: var(--el-color-warning-light-9);
}
.lg.mid {
  border-color: var(--ch-primary);
  background: var(--ch-primary-bg);
}
.lg.good {
  border-color: var(--ch-success);
  background: var(--ch-success);
}
.lg.ai {
  border-color: var(--ch-purple);
  border-style: dashed;
}
.lg.t-core {
  background: var(--ch-blue);
  border-color: var(--ch-blue);
}
.lg.t-skill {
  background: var(--ch-purple);
  border-color: var(--ch-purple);
}
.lg.t-apply {
  background: var(--ch-primary);
  border-color: var(--ch-primary);
}
.lg.t-prereq {
  background: var(--ch-warning);
  border-color: var(--ch-warning);
}
.gen-msg {
  font-size: 12.5px;
  color: var(--ch-primary-text);
}
.path {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--ch-border-light);
}
.path-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.steps li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--ch-border);
  border-radius: 16px;
  font-size: 13px;
  cursor: pointer;
}
.steps li.cur {
  border-color: var(--ch-primary);
}
.idx {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--ch-primary);
  color: #fff;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lv {
  font-size: 12px;
  color: var(--ch-text-3);
}
.lv.weak,
.m-val.weak {
  color: var(--ch-warning);
}
.lv.good,
.m-val.good {
  color: var(--ch-success);
}
.lv.mid,
.m-val.mid {
  color: var(--ch-primary-text);
}
.side {
  position: sticky;
  top: calc(var(--ch-header-h) + 64px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.side-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.side-head h3 {
  margin: 0;
  font-size: 17px;
}
.courses {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.courses span {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 4px;
  background: var(--ch-fill);
  color: var(--ch-text-2);
}
.ai-box {
  padding: 10px 12px;
  border: 1px dashed var(--ch-purple);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}
.ai-actions {
  display: flex;
  gap: 6px;
}
.m-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.m-val {
  font-size: 28px;
  font-weight: 600;
  color: var(--ch-text-3);
}
.basis summary {
  cursor: pointer;
  font-size: 12.5px;
  color: var(--ch-text-2);
}
.basis .rec {
  display: grid;
  grid-template-columns: 1fr auto 32px;
  gap: 8px;
  font-size: 12.5px;
  padding: 4px 0;
  border-bottom: 1px solid var(--ch-border-light);
}
.basis .rec b {
  text-align: right;
  font-weight: 500;
}
.dist {
  display: flex;
  gap: 12px;
  font-size: 12.5px;
  color: var(--ch-text-2);
}
.dist b {
  color: var(--ch-text);
}
.dist .warn b {
  color: var(--ch-warning);
}
.desc {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--ch-text);
}
.rel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rel > div {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  border: 1px solid var(--ch-border);
  background: #fff;
  border-radius: 12px;
  padding: 1px 9px;
  font-size: 12px;
  color: var(--ch-text);
  cursor: pointer;
}
.chip:hover {
  border-color: var(--ch-primary);
  color: var(--ch-primary-text);
}
.sec-title {
  font-weight: 600;
  font-size: 13.5px;
  margin-top: 4px;
}
.sec-title .muted {
  font-weight: 400;
  font-size: 12px;
  margin-left: 4px;
}
.src {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.src:hover span {
  text-decoration: underline;
}
.side-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
@media (max-width: 1100px) {
  .graph-tab {
    grid-template-columns: minmax(0, 1fr);
  }
  .side {
    position: static;
  }
}
</style>

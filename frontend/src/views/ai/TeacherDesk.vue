<script setup lang="ts">
/**
 * AI 助教工作台（教师侧）。来自领导版"智能体广场"里与教学主线相关的 4 个智能体：
 * 学情分析、作业批改（共性错因）、课堂出题（分层练习）、以及图谱 / 回答的审核。
 * 所有 AI 产出都标"AI 建议"，教师确认后才生效。
 */
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RateBars from '@/components/charts/RateBars.vue'
import QuestionCard from '@/components/ai/QuestionCard.vue'
import { LEVEL_PATH_META, type QLevel } from '@/mock/ai'
import { masteryLevel, useAiStore } from '@/stores/ai'

const ai = useAiStore()
const route = useRoute()
const router = useRouter()
const tab = computed({
  get: () => (route.query.tab as string) || 'report',
  set: (v) => router.replace({ query: { ...route.query, tab: v } }),
})
const unitId = ref('robo')
const unit = computed(() => ai.unit(unitId.value)!)
const unitsWithGraph = computed(() => ai.units.filter((u) => u.nodes.length))
const nodes = computed(() => ai.nodesOf(unit.value, false))

// ---------- 学情周报
const report = computed(() => {
  const rows = nodes.value
    .map((n) => ({ n, avg: ai.classAvg(n.id) }))
    .filter((x): x is { n: (typeof nodes.value)[number]; avg: number } => x.avg !== null)
    .sort((a, b) => a.avg - b.avg)
  const avg = rows.length ? Math.round(rows.reduce((s, x) => s + x.avg, 0) / rows.length) : 0
  const weak = rows.filter((x) => x.avg < 60)
  const notStarted = ai.roster.filter((p) => !ai.passedList(p.id).some((id) => id.startsWith(`lv-${unitId.value}`))).length
  return { rows, avg, weak, notStarted }
})
const bars = computed(() =>
  report.value.rows.map((x) => ({ key: x.n.id, label: x.n.name, percent: x.avg, note: x.avg < 60 ? '薄弱' : '' })),
)
const summary = computed(() => {
  const r = report.value
  if (!r.rows.length) return []
  const w = r.weak.slice(0, 3)
  const lines = [`本单元 ${r.rows.length} 个知识点的班级平均掌握度为 ${r.avg}%，其中 ${r.weak.length} 个低于 60%。`]
  if (w.length) lines.push(`最薄弱的是「${w.map((x) => x.n.name).join('」「')}」，平均分别为 ${w.map((x) => `${x.avg}%`).join('、')}。`)
  const err = ai.errorReports[0]
  if (err) lines.push(`「${ai.node(ai.question(err.questionId)!.nodeId)?.name}」相关题目错误率 ${Math.round((err.wrong / err.answered) * 100)}%，主要错因是"${err.clusters[0].label}"，建议在共性错因里确认后推送补充资料。`)
  lines.push(`还有 ${r.notStarted} 名同学没有通过任何关卡，可以在「闯关」页签的分层视图里查看他们卡在哪。`)
  return lines
})
const heatNodes = computed(() => report.value.rows.slice(0, 8).map((x) => x.n))
const heatRows = computed(() =>
  ai.roster.map((p) => ({ id: p.id, name: p.name, cells: heatNodes.value.map((n) => ai.classMastery(n.id, p.id)) })),
)

// ---------- 共性错因
const reports = computed(() => ai.errorReports.filter((r) => ai.question(r.questionId)?.nodeId && nodes.value.some((n) => n.id === ai.question(r.questionId)!.nodeId)))
function clusterStudents(qid: string, ci: number, count: number) {
  const list = [...ai.roster].sort((a, b) => ((a.id.charCodeAt(1) * 7 + qid.length * 3 + ci) % 11) - ((b.id.charCodeAt(1) * 5 + ci) % 11))
  return list.slice(ci * 3, ci * 3 + count).map((p) => p.name)
}
function confirm(qid: string) {
  ai.confirmCluster(qid)
  ElMessage.success('已确认归类')
}
function pushRes(qid: string, ci: number, count: number) {
  ai.push(`${qid}-${ci}`)
  ElMessage.success(`已把补充资料推送给 ${count} 名同学`)
}

// ---------- 分层练习
const practiceNode = ref('r6')
const practiceNodes = computed(() => nodes.value.filter((n) => Object.values(ai.practiceSet(n.id)).some((g) => g.length)))
const generating = ref(false)
const generatedFor = ref('')
function generate() {
  generating.value = true
  setTimeout(() => {
    generating.value = false
    generatedFor.value = practiceNode.value
  }, 1200)
}
const set = computed(() => ai.practiceSet(generatedFor.value))
const adoptedCount = computed(() => Object.values(ai.state.questionReview).filter((v) => v === 'adopted').length)
function decide(id: string, d: 'adopted' | 'rejected') {
  ai.reviewQuestion(id, d)
}

// ---------- 审核队列
const allCandidates = computed(() => ai.units.flatMap((u) => u.nodes.filter((n) => n.status === 'ai')))
function review(id: string, d: 'confirmed' | 'rejected') {
  ai.reviewNode(id, d)
  ElMessage.success(d === 'confirmed' ? '已采纳，学生现在能看到这个知识点' : '已驳回')
}
function fixFeedback(id: string, status: 'fixed' | 'dismissed') {
  const f = ai.state.feedback.find((x) => x.id === id)
  if (f) f.status = status
  ElMessage.success(status === 'fixed' ? '已更正，更正内容进入知识库' : '已忽略')
}
const LV: QLevel[] = ['basic', 'standard', 'challenge']
</script>

<template>
  <div>
    <h1 class="page-title">
      <span>AI 助教 <span class="sub">AI 给建议，教师确认后才生效</span></span>
      <el-select v-model="unitId" style="width: 280px">
        <el-option v-for="u in unitsWithGraph" :key="u.id" :value="u.id" :label="u.name" />
      </el-select>
    </h1>

    <el-tabs v-model="tab">
      <el-tab-pane label="学情周报" name="report" />
      <el-tab-pane label="共性错因" name="errors" />
      <el-tab-pane label="分层练习" name="practice" />
      <el-tab-pane :label="`审核队列${ai.pendingNodes.length + ai.state.feedback.filter((f) => f.status === 'pending').length ? ` (${ai.pendingNodes.length + ai.state.feedback.filter((f) => f.status === 'pending').length})` : ''}`" name="review" />
    </el-tabs>

    <!-- 学情周报 -->
    <template v-if="tab === 'report'">
      <div class="stat-strip">
        <div class="stat is-key">
          <div class="stat-label">班级平均掌握度</div>
          <div class="stat-value">{{ report.avg }}<small>%</small></div>
          <div class="stat-note">{{ ai.roster.length }} 名同学 · {{ report.rows.length }} 个知识点</div>
        </div>
        <div class="stat" :class="{ 'is-warn': report.weak.length }">
          <div class="stat-label">薄弱知识点</div>
          <div class="stat-value">{{ report.weak.length }}<small>个</small></div>
          <div class="stat-note">班级平均低于 60%</div>
        </div>
        <div class="stat" :class="{ 'is-warn': report.notStarted }">
          <div class="stat-label">还没通过任何关卡</div>
          <div class="stat-value">{{ report.notStarted }}<small>人</small></div>
          <div class="stat-note">本单元</div>
        </div>
        <div class="stat">
          <div class="stat-label">本周 AI 辅学提问</div>
          <div class="stat-value">126<small>次</small></div>
          <div class="stat-note">有帮助 87% · 报错 {{ ai.state.feedback.length }} 条</div>
        </div>
      </div>
      <section class="card ai-sum">
        <div class="ai-head"><el-tag size="small" type="warning">AI 摘要</el-tag><span class="muted">由下方数据生成，数字按规则计算</span></div>
        <p v-for="(l, i) in summary" :key="i">{{ l }}</p>
      </section>
      <div class="grid2">
        <section class="card">
          <h3 class="card-title">各知识点班级平均掌握度 <span class="muted">从低到高</span></h3>
          <RateBars :rows="bars" />
        </section>
        <section class="card heat">
          <h3 class="card-title">学生 × 薄弱知识点 <span class="muted">最薄弱的 8 个知识点</span></h3>
          <div class="heat-wrap">
            <table>
              <thead>
                <tr>
                  <th>学生</th>
                  <th v-for="n in heatNodes" :key="n.id">{{ n.name }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in heatRows" :key="r.id">
                  <td class="nm">{{ r.name }}</td>
                  <td v-for="(c, i) in r.cells" :key="i"><span class="cell" :class="masteryLevel(c)">{{ c ?? '—' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </template>

    <!-- 共性错因 -->
    <template v-if="tab === 'errors'">
      <div v-if="!reports.length" class="card empty-tip">这个单元暂时没有共性错因</div>
      <section v-for="r in reports" :key="r.questionId" class="card err">
        <div class="err-head">
          <div>
            <el-tag size="small" type="info">{{ ai.node(ai.question(r.questionId)!.nodeId)?.name }}</el-tag>
            <b class="stem">{{ ai.question(r.questionId)?.stem }}</b>
          </div>
          <div class="err-stat">
            作答 {{ r.answered }} 人，错 <b>{{ r.wrong }}</b> 人（{{ Math.round((r.wrong / r.answered) * 100) }}%）
          </div>
        </div>
        <div class="ai-head"><el-tag size="small" type="warning">AI 归类</el-tag><span class="muted">按错误选项和作答过程归类，教师确认后可推送补充资料</span></div>
        <div v-for="(c, ci) in r.clusters" :key="ci" class="cluster">
          <div class="c-main">
            <div class="c-label">
              <b>{{ c.label }}</b>
              <span class="muted">选了 {{ 'ABCD'[c.option] }} · {{ c.count }} 人</span>
            </div>
            <div class="c-bar"><div :style="{ width: `${(c.count / r.wrong) * 100}%` }" /></div>
            <div class="muted names">{{ clusterStudents(r.questionId, ci, c.count).join('、') }}</div>
            <div class="sugg">建议：{{ c.suggestion }}</div>
          </div>
          <el-button
            v-if="c.ref"
            size="small"
            :disabled="!ai.state.clusterConfirmed.includes(r.questionId) || ai.state.pushed.includes(`${r.questionId}-${ci}`)"
            @click="pushRes(r.questionId, ci, c.count)"
          >
            {{ ai.state.pushed.includes(`${r.questionId}-${ci}`) ? '已推送' : '推送补充资料' }}
          </el-button>
        </div>
        <div class="err-actions">
          <el-button v-if="!ai.state.clusterConfirmed.includes(r.questionId)" type="primary" size="small" @click="confirm(r.questionId)">确认归类</el-button>
          <span v-else class="ok">已确认</span>
        </div>
      </section>
    </template>

    <!-- 分层练习 -->
    <template v-if="tab === 'practice'">
      <section class="card">
        <div class="gen-bar">
          <span class="muted">知识点</span>
          <el-select v-model="practiceNode" filterable style="width: 220px">
            <el-option v-for="n in practiceNodes" :key="n.id" :value="n.id" :label="n.name" />
          </el-select>
          <el-button type="primary" :loading="generating" :icon="'MagicStick'" @click="generate">AI 生成分层练习</el-button>
          <span class="muted">已采纳入库 {{ adoptedCount }} 题</span>
        </div>
        <div v-if="generating" class="muted gen-tip">正在根据「{{ ai.node(practiceNode)?.name }}」的知识点说明、教材原文和班级错因生成…</div>
      </section>
      <div v-if="generatedFor && !generating" class="lv-cols">
        <section v-for="lv in LV" :key="lv" class="card">
          <h3 class="card-title">{{ LEVEL_PATH_META[lv].label.replace('路径', '') }} <span class="muted">{{ set[lv].length }} 题</span></h3>
          <div v-if="!set[lv].length" class="empty-tip">这一档暂时没有题</div>
          <div v-for="q in set[lv]" :key="q.id" class="pq">
            <QuestionCard :q="q" mode="test" :revealed="true" :model-value="q.answer" />
            <div class="pq-actions">
              <template v-if="q.ai">
                <template v-if="!ai.state.questionReview[q.id]">
                  <el-button size="small" type="primary" @click="decide(q.id, 'adopted')">采纳入库</el-button>
                  <el-button size="small" @click="decide(q.id, 'rejected')">弃用</el-button>
                </template>
                <span v-else :class="ai.state.questionReview[q.id] === 'adopted' ? 'ok' : 'muted'">{{ ai.state.questionReview[q.id] === 'adopted' ? '已采纳' : '已弃用' }}</span>
              </template>
              <span v-else class="muted">题库已有</span>
            </div>
          </div>
        </section>
      </div>
    </template>

    <!-- 审核队列 -->
    <template v-if="tab === 'review'">
      <section class="card">
        <h3 class="card-title">AI 生成的知识点 <span class="muted">采纳后才对学生可见</span></h3>
        <div v-for="n in allCandidates" :key="n.id" class="rv-row">
          <div class="rv-main">
            <b>{{ n.name }}</b>
            <span class="muted">{{ ai.unitOfNode(n.id)?.name }} · 出处：{{ n.aiSource }}</span>
            <span>{{ n.desc }}</span>
          </div>
          <template v-if="ai.nodeStatus(n) === 'ai'">
            <el-button size="small" type="primary" @click="review(n.id, 'confirmed')">采纳</el-button>
            <el-button size="small" @click="review(n.id, 'rejected')">驳回</el-button>
          </template>
          <span v-else :class="ai.nodeStatus(n) === 'confirmed' ? 'ok' : 'muted'">{{ ai.nodeStatus(n) === 'confirmed' ? '已采纳' : '已驳回' }}</span>
        </div>
      </section>
      <section class="card">
        <h3 class="card-title">学生反馈"有错误"的回答 <span class="muted">更正后进入知识库</span></h3>
        <div v-if="!ai.state.feedback.length" class="empty-tip">还没有反馈。学生在 AI 辅学里点"有错误"后会出现在这里。</div>
        <div v-for="f in ai.state.feedback" :key="f.id" class="rv-row">
          <div class="rv-main">
            <b>问：{{ f.question || '（未记录问题）' }}</b>
            <span class="muted fb-ans">AI 答：{{ f.answer.slice(0, 120) }}{{ f.answer.length > 120 ? '…' : '' }}</span>
          </div>
          <template v-if="f.status === 'pending'">
            <el-button size="small" type="primary" @click="fixFeedback(f.id, 'fixed')">更正</el-button>
            <el-button size="small" @click="fixFeedback(f.id, 'dismissed')">忽略</el-button>
          </template>
          <span v-else :class="f.status === 'fixed' ? 'ok' : 'muted'">{{ f.status === 'fixed' ? '已更正' : '已忽略' }}</span>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.sub {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 400;
  color: var(--ch-text-3);
}
.card-title .muted {
  margin-left: 6px;
  font-weight: 400;
  font-size: 12px;
}
.ai-sum {
  margin-bottom: 16px;
}
.ai-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.ai-head .muted {
  font-size: 12px;
}
.ai-sum p {
  margin: 4px 0;
  line-height: 1.8;
  font-size: 14px;
}
.grid2 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
  gap: 16px;
}
.heat-wrap {
  max-height: 520px;
  overflow: auto;
}
.heat table {
  border-collapse: collapse;
  font-size: 12px;
  width: 100%;
}
.heat th {
  position: sticky;
  top: 0;
  background: #fafafb;
  font-weight: 500;
  color: var(--ch-text-2);
  padding: 6px 4px;
  white-space: nowrap;
}
.heat td {
  padding: 3px 4px;
  text-align: center;
  border-bottom: 1px solid var(--ch-border-light);
}
.heat td.nm {
  text-align: left;
  white-space: nowrap;
}
.cell {
  display: inline-block;
  min-width: 34px;
  padding: 1px 0;
  border-radius: 3px;
  color: var(--ch-text-3);
}
.cell.weak {
  background: var(--el-color-warning-light-8);
  color: var(--el-color-warning-dark-2);
}
.cell.mid {
  background: var(--ch-primary-bg);
  color: var(--ch-primary-text);
}
.cell.good {
  background: var(--el-color-success-light-8);
  color: var(--el-color-success-dark-2);
}
.err {
  margin-bottom: 16px;
}
.err-head {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  justify-content: space-between;
  margin-bottom: 12px;
}
.stem {
  margin-left: 8px;
  font-weight: 500;
  line-height: 1.6;
}
.err-stat {
  flex: none;
  font-size: 13px;
  color: var(--ch-text-2);
}
.err-stat b {
  color: var(--ch-warning);
}
.cluster {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
  border-top: 1px solid var(--ch-border-light);
}
.c-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.c-label {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.c-label b {
  font-weight: 500;
}
.c-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--el-fill-color);
  max-width: 360px;
}
.c-bar div {
  height: 100%;
  border-radius: 3px;
  background: var(--ch-warning);
}
.names {
  font-size: 12px;
}
.sugg {
  font-size: 13px;
}
.err-actions {
  margin-top: 8px;
}
.ok {
  color: var(--ch-success);
  font-size: 13px;
}
.gen-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}
.gen-tip {
  margin-top: 10px;
}
.lv-cols {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
  align-items: start;
}
.pq {
  border-bottom: 1px solid var(--ch-border-light);
}
.pq:last-child {
  border-bottom: none;
}
.pq :deep(.qc) {
  border-bottom: none;
  padding-bottom: 8px;
}
.pq-actions {
  display: flex;
  gap: 6px;
  padding: 0 0 12px 30px;
}
.rv-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--ch-border-light);
}
.rv-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  min-width: 0;
}
.rv-main b {
  font-weight: 500;
  font-size: 14px;
}
.fb-ans {
  white-space: pre-wrap;
}
.card + .card {
  margin-top: 16px;
}
@media (max-width: 1100px) {
  .grid2,
  .lv-cols {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

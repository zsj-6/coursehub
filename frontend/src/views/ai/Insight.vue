<script setup lang="ts">
/**
 * AI 办学（学院 / 学校侧，教学质量分析）
 * 学校 → 学院 → 能力单元 → 课程逐层下钻；数字由规则算，AI 只写结论摘要，每句话都能点到对应图表。
 */
import { computed, ref } from 'vue'
import RateBars from '@/components/charts/RateBars.vue'
import BarChart from '@/components/pbl/BarChart.vue'
import { ACADEMIC_ALERTS, INSIGHT, type InsightRow } from '@/mock/ai'
import { useAiStore } from '@/stores/ai'
import { usePblStore } from '@/stores/pbl'

const ai = useAiStore()
const pbl = usePblStore()
const trail = ref<string[]>(['school'])
const cur = computed(() => INSIGHT.find((r) => r.id === trail.value[trail.value.length - 1])!)
const children = computed(() => INSIGHT.filter((r) => r.parent === cur.value.id))
const LEVEL_NAME = { school: '学校', college: '学院', unit: '能力单元', course: '课程' } as const
const childName = computed(() => (children.value[0] ? LEVEL_NAME[children.value[0].level] : ''))

function drill(r: InsightRow) {
  trail.value.push(r.id)
}
function goTo(i: number) {
  trail.value = trail.value.slice(0, i + 1)
}

// ---------- 知识点层面（能力单元 / 课程）
const unitNodes = computed(() => {
  const r = cur.value
  if (!r.unitId) return []
  const u = ai.unit(r.unitId)
  if (!u) return []
  return ai.nodesOf(u, false).filter((n) => !r.course || n.courses?.includes(r.course))
})
const nodeBars = computed(() =>
  unitNodes.value
    .map((n) => ({ n, avg: ai.classAvg(n.id), res: ai.sourcesOf(n.id, 9).length }))
    .filter((x) => x.avg !== null)
    .sort((a, b) => a.avg! - b.avg!)
    .slice(0, 8),
)
const gaps = computed(() => unitNodes.value.map((n) => ({ n, res: ai.sourcesOf(n.id, 9).length })).filter((x) => x.res <= 1))

// ---------- AI 摘要（模板 + 规则数据）
const summary = computed(() => {
  const r = cur.value
  const kids = children.value.filter((k) => k.mastery !== null)
  const lines: { text: string; anchor: string }[] = []
  if (kids.length) {
    const low = [...kids].sort((a, b) => a.mastery! - b.mastery!)[0]
    // 活跃率和上一级整体比，避免只有一个子项有掌握度数据时自己和自己比
    const avgActive = r.active
    const head =
      kids.length > 1
        ? `${r.name}下 ${children.value.length} 个${childName.value}中，「${low.name}」平均掌握度最低（${low.mastery}%，${r.name}平均 ${r.mastery}%）`
        : `「${low.name}」平均掌握度 ${low.mastery}%${r.mastery !== null ? `（${r.name}平均 ${r.mastery}%）` : ''}`
    lines.push({
      text:
        head +
        (low.active >= avgActive
          ? `，但活跃率 ${low.active}% 不低于平均（${avgActive}%）——学得多、掌握得少，说明薄弱点集中，建议下钻查看。`
          : `，活跃率 ${low.active}% 也低于平均（${avgActive}%），建议先提升学习投入。`),
      anchor: 'ch-mastery',
    })
    const late = [...children.value].sort((a, b) => a.onTime - b.onTime)[0]
    if (late.onTime < 82) lines.push({ text: `「${late.name}」作业按时提交率只有 ${late.onTime}%，是同级里最低的。`, anchor: 'ch-input' })
    const cold = [...children.value].sort((a, b) => b.zeroRes - a.zeroRes)[0]
    if (cold.zeroRes >= 15) lines.push({ text: `「${cold.name}」有 ${cold.zeroRes}% 的资源从没被访问过，建议做一次资源治理。`, anchor: 'ch-table' })
  }
  if (nodeBars.value.length) {
    const w = nodeBars.value[0]
    lines.push({
      text: `知识点层面，「${w.n.name}」班级平均掌握度 ${w.avg}%，是最薄弱的；该知识点下只有 ${w.res} 份资源${w.res <= 2 ? '，建议补充讲解视频或例题' : ''}。`,
      anchor: 'ch-nodes',
    })
  }
  if (r.levelPass !== null && r.levelPass < 50) lines.push({ text: `闯关通过率 ${r.levelPass}%，低于全校 ${INSIGHT[0].levelPass}%。`, anchor: 'ch-table' })
  return lines
})
function jump(anchor: string) {
  document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

const alerts = computed(() => {
  const r = cur.value
  const unitIds = new Set(
    r.level === 'school'
      ? INSIGHT.filter((x) => x.unitId).map((x) => x.unitId!)
      : r.level === 'college'
        ? children.value.map((x) => x.unitId!)
        : [r.unitId!],
  )
  return ACADEMIC_ALERTS.filter((a) => unitIds.has(a.unitId))
})
const pct = (v: number | null) => (v === null ? '—' : `${v}%`)
</script>

<template>
  <div>
    <h1 class="page-title">
      <span>AI 办学 <span class="sub">教学质量分析 · 数字按规则计算，AI 只写结论</span></span>
    </h1>
    <div class="crumbs">
      <template v-for="(id, i) in trail" :key="id">
        <span v-if="i" class="sep">/</span>
        <button :class="{ cur: i === trail.length - 1 }" @click="goTo(i)">{{ INSIGHT.find((r) => r.id === id)?.name }}</button>
      </template>
      <el-tag size="small" type="info">演示数据</el-tag>
    </div>

    <div class="stat-strip">
      <div class="stat">
        <div class="stat-label">学生</div>
        <div class="stat-value">{{ cur.students }}<small>人</small></div>
        <div class="stat-note">活跃率 {{ cur.active }}%</div>
      </div>
      <div class="stat is-key">
        <div class="stat-label">平均掌握度</div>
        <div class="stat-value">{{ cur.mastery ?? '—' }}<small v-if="cur.mastery !== null">%</small></div>
        <div class="stat-note">{{ cur.mastery === null ? '知识图谱未生成' : '按知识点作答加权计算' }}</div>
      </div>
      <div class="stat" :class="{ 'is-warn': cur.levelPass !== null && cur.levelPass < 50 }">
        <div class="stat-label">闯关通过率</div>
        <div class="stat-value">{{ cur.levelPass ?? '—' }}<small v-if="cur.levelPass !== null">%</small></div>
        <div class="stat-note">不计成绩、不算学分</div>
      </div>
      <div class="stat">
        <div class="stat-label">作业按时提交率</div>
        <div class="stat-value">{{ cur.onTime }}<small>%</small></div>
        <div class="stat-note">视频完成率 {{ cur.videoDone }}%</div>
      </div>
      <div class="stat" :class="{ 'is-warn': cur.zeroRes >= 15 }">
        <div class="stat-label">零访问资源</div>
        <div class="stat-value">{{ cur.zeroRes }}<small>%</small></div>
        <div class="stat-note">AI 辅学提问 {{ cur.aiAsks }} 次 · 有帮助 {{ cur.aiHelpful }}%</div>
      </div>
    </div>

    <section class="card ai-sum">
      <div class="ai-head"><el-tag size="small" type="warning">AI 摘要</el-tag><span class="muted">点击句子定位到对应图表；只给建议，不直接执行</span></div>
      <p v-for="(l, i) in summary" :key="i" class="line" @click="jump(l.anchor)">{{ l.text }}<el-icon><Bottom /></el-icon></p>
      <p v-if="!summary.length" class="muted">数据不足，暂不生成结论</p>
    </section>

    <div class="grid2">
      <section v-if="children.length" id="ch-mastery" class="card">
        <h3 class="card-title">各{{ childName }}平均掌握度</h3>
        <RateBars :rows="children.map((c) => ({ key: c.id, label: c.name, percent: c.mastery, note: c.mastery === null ? '图谱未生成' : `${c.students} 人` }))" />
      </section>
      <section v-if="children.length" id="ch-input" class="card">
        <h3 class="card-title">学习投入</h3>
        <BarChart
          :rows="children.map((c) => ({ label: c.name, values: [c.active, c.videoDone, c.onTime] }))"
          :series="[
            { name: '活跃率 %', color: 'var(--ch-primary)' },
            { name: '视频完成率 %', color: 'var(--ch-blue)' },
            { name: '按时提交率 %', color: '#c5c9ce' },
          ]"
        />
      </section>
      <section v-if="nodeBars.length" id="ch-nodes" class="card">
        <h3 class="card-title">最薄弱的知识点 <span class="muted">班级平均掌握度</span></h3>
        <RateBars :rows="nodeBars.map((x) => ({ key: x.n.id, label: x.n.name, percent: x.avg, note: `${x.res} 份资源`, to: `/units/${cur.unitId}?tab=graph` }))" />
      </section>
      <section v-if="unitNodes.length" class="card">
        <h3 class="card-title">资源缺口 <span class="muted">资源不超过 1 份的知识点</span></h3>
        <div v-if="!gaps.length" class="empty-tip">没有资源缺口</div>
        <div v-for="g in gaps" :key="g.n.id" class="gap">
          <span>{{ g.n.name }}</span>
          <span class="muted">{{ g.n.courses?.join('、') || '综合应用' }}</span>
          <div class="spacer" />
          <span :class="g.res ? 'muted' : 'warn'">{{ g.res }} 份资源</span>
        </div>
      </section>
    </div>

    <section v-if="children.length" id="ch-table" class="card table-card">
      <h3 class="card-title">{{ childName }}明细 <span class="muted">点击一行继续下钻</span></h3>
      <el-table :data="children" @row-click="drill">
        <el-table-column prop="name" :label="childName" min-width="200" />
        <el-table-column prop="students" label="学生" width="80" />
        <el-table-column label="活跃率" width="90"><template #default="{ row }">{{ pct(row.active) }}</template></el-table-column>
        <el-table-column label="平均掌握度" width="110"><template #default="{ row }">{{ pct(row.mastery) }}</template></el-table-column>
        <el-table-column label="闯关通过率" width="110"><template #default="{ row }">{{ pct(row.levelPass) }}</template></el-table-column>
        <el-table-column label="按时提交率" width="110"><template #default="{ row }">{{ pct(row.onTime) }}</template></el-table-column>
        <el-table-column label="零访问资源" width="110">
          <template #default="{ row }"><span :class="{ warn: row.zeroRes >= 15 }">{{ pct(row.zeroRes) }}</span></template>
        </el-table-column>
        <el-table-column label="AI 辅学提问" width="110"><template #default="{ row }">{{ row.aiAsks }}</template></el-table-column>
        <el-table-column width="40"><template #default><el-icon class="go"><ArrowRight /></el-icon></template></el-table-column>
      </el-table>
    </section>

    <section class="card">
      <h3 class="card-title">学业预警 <span class="muted">只做学业预警，不做心理预警</span></h3>
      <div v-if="!alerts.length" class="empty-tip">没有预警</div>
      <div v-for="a in alerts" :key="a.sid + a.kind" class="alert">
        <b>{{ pbl.person(a.sid)?.name }}</b>
        <el-tag size="small" type="warning">{{ a.kind }}</el-tag>
        <span class="muted">{{ ai.unit(a.unitId)?.name }}</span>
        <span class="detail">{{ a.detail }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sub {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 400;
  color: var(--ch-text-3);
}
.crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
}
.crumbs button {
  border: none;
  background: none;
  padding: 0;
  font-size: 14px;
  color: var(--ch-primary-text);
  cursor: pointer;
}
.crumbs button.cur {
  color: var(--ch-text);
  font-weight: 600;
  cursor: default;
}
.sep {
  color: var(--ch-text-3);
}
.ai-sum {
  margin-bottom: 16px;
}
.ai-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.ai-head .muted {
  font-size: 12px;
}
.line {
  margin: 4px 0;
  line-height: 1.8;
  font-size: 14px;
  cursor: pointer;
}
.line .el-icon {
  margin-left: 4px;
  color: var(--ch-text-3);
  vertical-align: -2px;
}
.line:hover {
  color: var(--ch-primary-text);
}
.grid2 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}
.card-title .muted {
  margin-left: 6px;
  font-weight: 400;
  font-size: 12px;
}
.gap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--ch-border-light);
  font-size: 13px;
}
.warn {
  color: var(--ch-warning);
}
.table-card {
  margin-bottom: 16px;
}
.table-card :deep(.el-table__row) {
  cursor: pointer;
}
.go {
  color: var(--ch-text-3);
}
.alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--ch-border-light);
  font-size: 13px;
  flex-wrap: wrap;
}
.alert b {
  font-weight: 500;
}
.detail {
  flex-basis: 100%;
  color: var(--ch-text);
}
@media (max-width: 1000px) {
  .grid2 {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<script setup lang="ts">
/**
 * 成长画像（领导版）：综合能力 5 维雷达、全量画像标签（置信度筛选 / 标记不准确）、成长轨迹、
 * 学期趋势、AI 综合评语、版本对比、更新画像；另加本平台的"学习画像"（知识点掌握度）。
 * 画像数据为演示数据——正式上线需要对接教务、学工等系统，并先做数据安全评估。
 */
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import RateBars from '@/components/charts/RateBars.vue'
import BarChart from '@/components/pbl/BarChart.vue'
import { PROFILE } from '@/mock/growth'
import { masteryLevel, useAiStore } from '@/stores/ai'
import { useGrowthStore } from '@/stores/growth'
import { usePblStore } from '@/stores/pbl'

const g = useGrowthStore()
const ai = useAiStore()
const pbl = usePblStore()

// ---------- 雷达图
const dims = PROFILE.dims
const R = 110
const C = 150
const pt = (i: number, v: number) => {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / dims.length
  return [C + Math.cos(a) * R * (v / 100), C + Math.sin(a) * R * (v / 100)]
}
const ring = (v: number) => dims.map((_, i) => pt(i, v).join(',')).join(' ')
const shape = computed(() => dims.map((d, i) => pt(i, d.score).join(',')).join(' '))
const labelPos = (i: number) => {
  const [x, y] = pt(i, 122)
  return { x, y }
}
const avg = Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length)

// ---------- 学习画像（本平台）
const unitBars = computed(() =>
  ai.units
    .filter((u) => u.nodes.length)
    .map((u) => {
      const nodes = ai.nodesOf(u, false)
      const good = nodes.filter((n) => masteryLevel(ai.mastery(n.id)) === 'good').length
      return { key: u.id, label: u.name, percent: (good / nodes.length) * 100, note: `已掌握 ${good}/${nodes.length}`, to: `/units/${u.id}` }
    }),
)

// ---------- 全量画像标签
const level = ref<'all' | 'high' | 'mid' | 'low'>('all')
const onlyMarked = ref(false)
const TAGS = PROFILE.tags as Record<string, { name: string; confidence: number; source: string }[]>
function tagsOf(code: string) {
  return (TAGS[code] ?? []).filter((t) => {
    if (onlyMarked.value && !g.tagMarks.includes(t.name)) return false
    if (level.value === 'high') return t.confidence >= 0.8
    if (level.value === 'mid') return t.confidence >= 0.6 && t.confidence < 0.8
    if (level.value === 'low') return t.confidence < 0.6
    return true
  })
}
function mark(name: string) {
  const was = g.tagMarks.includes(name)
  g.toggleTagMark(name)
  ElMessage.success(was ? '已取消标记' : '已标记为不准确，下次更新画像会降低这个标签的权重')
}

// ---------- 成长轨迹 / 学期趋势
const tl = ref<'all' | 'core' | 'work'>('all')
const timeline = computed(() => PROFILE.timeline.filter((t) => tl.value === 'all' || t.type === tl.value))
const semesterRows = PROFILE.semester.map((s) => ({ label: s.term, values: [s.core, s.work] }))

// ---------- AI 综合评语（模板 + 数据）
const comment = computed(() => {
  const sorted = [...dims].sort((a, b) => b.score - a.score)
  const top = sorted[0]
  const low = sorted[sorted.length - 1]
  const weakNodes = ai.recommendations(2).map((r) => r.node.name)
  return [
    `${pbl.me.name}同学综合能力平均 ${avg} 分，其中「${top.name}」最突出（${top.score} 分），${top.desc.replace(/^基于/, '依据')}。`,
    `「${low.name}」相对薄弱（${low.score} 分），建议多参与${low.tags.slice(0, 2).join('、')}相关的活动。`,
    weakNodes.length ? `从课程学习看，「${weakNodes.join('」「')}」掌握度偏低，可以在能力成长里按学习路径补上。` : '课程学习方面没有明显的薄弱知识点，继续保持。',
  ]
})

// ---------- 版本
const versions = computed(() => {
  const extra = g.profileVersion - PROFILE.versions[0].version
  const added = Array.from({ length: Math.max(0, extra) }, (_, i) => ({
    version: PROFILE.versions[0].version + extra - i,
    time: '刚刚',
    type: 'MANUAL',
    trigger: '学生手动更新',
    growth: 0.8,
  }))
  return [...added, ...PROFILE.versions]
})
const compareOpen = ref(false)
const updating = ref(false)
function update() {
  updating.value = true
  setTimeout(() => {
    updating.value = false
    g.bumpProfile()
    ElMessage.success(`画像已更新到 v${g.profileVersion}${g.tagMarks.length ? `，已降低 ${g.tagMarks.length} 个被标记标签的权重` : ''}`)
  }, 1500)
}
const SCORE_NAMES: Record<string, string> = Object.fromEntries(PROFILE.groups.map((x) => [x.code, x.name]))
const scores = PROFILE.scores as Record<string, number>
</script>

<template>
  <div>
    <h1 class="page-title">
      <span>成长画像 <span class="sub">综合能力 + 课程学习，帮你看清自己的强项和短板</span></span>
      <span class="actions">
        <el-button :icon="'Switch'" @click="compareOpen = true">版本对比</el-button>
        <el-button type="primary" :icon="'Refresh'" :loading="updating" @click="update">{{ updating ? '正在更新画像…' : '更新画像' }}</el-button>
      </span>
    </h1>
    <el-alert type="info" show-icon :closable="false" class="note" title="画像中的成绩、活动、答卷等为演示数据；正式上线需对接教务、学工系统，并先完成数据安全评估。学生只看得到自己的画像。" />

    <div class="stat-strip">
      <div class="stat is-key">
        <div class="stat-label">综合能力</div>
        <div class="stat-value">{{ avg }}<small>分</small></div>
        <div class="stat-note">5 个维度平均</div>
      </div>
      <div class="stat">
        <div class="stat-label">画像版本</div>
        <div class="stat-value">v{{ g.profileVersion }}</div>
        <div class="stat-note">最近更新：{{ versions[0].time }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">画像标签</div>
        <div class="stat-value">{{ Object.values(TAGS).flat().length }}<small>个</small></div>
        <div class="stat-note">已标记不准确 {{ g.tagMarks.length }} 个</div>
      </div>
      <div class="stat">
        <div class="stat-label">成长轨迹</div>
        <div class="stat-value">{{ PROFILE.timeline.length }}<small>条</small></div>
        <div class="stat-note">本学年</div>
      </div>
    </div>

    <div class="grid2">
      <section class="card">
        <h3 class="card-title">综合能力画像 <span class="muted">5 维度</span></h3>
        <div class="radar-wrap">
          <svg viewBox="-50 0 400 300" class="radar">
            <polygon v-for="v in [20, 40, 60, 80, 100]" :key="v" :points="ring(v)" class="grid-line" />
            <line v-for="(_, i) in dims" :key="i" :x1="C" :y1="C" :x2="pt(i, 100)[0]" :y2="pt(i, 100)[1]" class="grid-line" />
            <polygon :points="shape" class="area" />
            <circle v-for="(d, i) in dims" :key="d.code" :cx="pt(i, d.score)[0]" :cy="pt(i, d.score)[1]" r="3.5" class="pt" />
            <text v-for="(d, i) in dims" :key="`l${d.code}`" :x="labelPos(i).x" :y="labelPos(i).y" text-anchor="middle" class="lbl">{{ d.name }} {{ d.score }}</text>
          </svg>
          <div class="dims">
            <div v-for="d in dims" :key="d.code" class="dim">
              <div class="d-head"><b>{{ d.name }}</b><span>{{ d.score }}</span></div>
              <div class="muted">{{ d.desc }}</div>
              <div class="d-tags"><span v-for="t in d.tags" :key="t">{{ t }}</span></div>
            </div>
          </div>
        </div>
      </section>
      <section class="card">
        <h3 class="card-title">学习画像 <span class="muted">本平台数据：各能力单元已掌握的知识点</span></h3>
        <RateBars :rows="unitBars" />
        <h3 class="card-title ai-title">AI 综合评语 <el-tag size="small" type="warning">AI 生成</el-tag></h3>
        <p v-for="(c, i) in comment" :key="i" class="comment">{{ c }}</p>
      </section>
    </div>

    <section class="card">
      <div class="sec-head">
        <h3 class="card-title">全量画像标签 <span class="muted">点击标签可标记"不准确"，下次更新会降低它的权重</span></h3>
        <div class="spacer" />
        <el-select v-model="level" size="small" style="width: 150px">
          <el-option value="all" label="全部置信度" />
          <el-option value="high" label="高置信度 ≥80%" />
          <el-option value="mid" label="中等 60–80%" />
          <el-option value="low" label="待确认 <60%" />
        </el-select>
        <el-checkbox v-model="onlyMarked" size="small">只看已标记</el-checkbox>
      </div>
      <div v-for="grp in PROFILE.groups" :key="grp.code" class="tag-group">
        <div class="tg-head">
          <b>{{ grp.name }}</b>
          <span class="muted">权重 {{ grp.weight }}% · 数据来源：{{ grp.dataSource }} · 得分 {{ scores[grp.code] }}</span>
        </div>
        <div class="tags">
          <button v-for="t in tagsOf(grp.code)" :key="t.name" class="ptag" :class="{ marked: g.tagMarks.includes(t.name), low: t.confidence < 0.6 }" :title="`来源：${t.source}`" @click="mark(t.name)">
            {{ t.name }} <small>{{ Math.round(t.confidence * 100) }}%</small>
          </button>
          <span v-if="!tagsOf(grp.code).length" class="muted">没有符合条件的标签</span>
        </div>
      </div>
    </section>

    <div class="grid2 bottom">
      <section class="card">
        <div class="sec-head">
          <h3 class="card-title">成长轨迹</h3>
          <div class="spacer" />
          <el-radio-group v-model="tl" size="small">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="core">综合素养</el-radio-button>
            <el-radio-button value="work">三助工作</el-radio-button>
          </el-radio-group>
        </div>
        <el-timeline>
          <el-timeline-item v-for="t in timeline" :key="t.title" :timestamp="t.date" placement="top">
            <div class="tl-item">
              <div class="tl-head"><el-tag size="small" type="info">{{ t.catName }}</el-tag><b>{{ t.title }}</b><span class="pts">{{ t.points }}</span></div>
              <div class="muted">{{ t.desc }}</div>
              <div class="tl-meta">{{ t.meta }}</div>
            </div>
          </el-timeline-item>
        </el-timeline>
      </section>
      <section class="card">
        <h3 class="card-title">学期趋势 <span class="muted">综合素养分 / 三助工作分</span></h3>
        <BarChart :rows="semesterRows" :series="[{ name: '综合素养', color: 'var(--ch-primary)' }, { name: '三助工作', color: '#c5c9ce' }]" />
      </section>
    </div>

    <el-dialog v-model="compareOpen" title="画像版本对比" width="620px">
      <el-table :data="versions" size="small">
        <el-table-column prop="version" label="版本" width="70"><template #default="{ row }">v{{ row.version }}</template></el-table-column>
        <el-table-column prop="time" label="时间" width="160" />
        <el-table-column prop="trigger" label="触发方式" />
        <el-table-column label="综合成长" width="100"><template #default="{ row }">+{{ row.growth }}</template></el-table-column>
      </el-table>
      <h4>当前版本与上一版本的维度变化</h4>
      <div class="diff">
        <div v-for="(v, k) in scores" :key="k" class="diff-row">
          <span>{{ SCORE_NAMES[k] }}</span>
          <span class="muted">{{ Math.max(0, v - 3) }} → </span><b>{{ v }}</b><span class="up">+{{ Math.min(3, v) }}</span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.sub {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 400;
  color: var(--ch-text-3);
}
.actions {
  display: flex;
  gap: 8px;
}
.note {
  margin-bottom: 14px;
}
.grid2 {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}
.grid2.bottom {
  margin-top: 16px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}
.card-title .muted {
  margin-left: 6px;
  font-weight: 400;
  font-size: 12px;
}
.radar-wrap {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}
.radar {
  width: 100%;
}
.grid-line {
  fill: none;
  stroke: var(--ch-border);
  stroke-width: 1;
}
.area {
  fill: rgba(18, 150, 156, 0.16);
  stroke: var(--ch-primary);
  stroke-width: 2;
}
.pt {
  fill: var(--ch-primary);
}
.lbl {
  font-size: 11.5px;
  fill: var(--ch-text-2);
}
.dims {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dim {
  font-size: 12.5px;
}
.d-head {
  display: flex;
  justify-content: space-between;
  font-size: 13.5px;
}
.d-head span {
  color: var(--ch-primary-text);
  font-weight: 600;
}
.d-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 3px;
}
.d-tags span {
  padding: 0 6px;
  border-radius: 3px;
  background: var(--ch-fill);
  color: var(--ch-text-2);
  font-size: 11.5px;
}
.ai-title {
  margin-top: 18px;
}
.comment {
  margin: 4px 0;
  font-size: 13.5px;
  line-height: 1.8;
}
.sec-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.sec-head .card-title {
  margin: 0;
}
.tag-group {
  padding: 10px 0;
  border-top: 1px solid var(--ch-border-light);
}
.tg-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
}
.tg-head .muted {
  font-size: 12px;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ptag {
  border: 1px solid var(--ch-border);
  background: #fff;
  border-radius: 14px;
  padding: 3px 10px;
  font-size: 12.5px;
  color: var(--ch-text);
  cursor: pointer;
}
.ptag small {
  color: var(--ch-text-3);
  margin-left: 2px;
}
.ptag.low {
  border-style: dashed;
}
.ptag.marked {
  text-decoration: line-through;
  color: var(--ch-text-3);
  background: var(--ch-fill);
}
.ptag:hover {
  border-color: var(--ch-primary);
}
.tl-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 13px;
}
.tl-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tl-head b {
  font-weight: 500;
}
.pts {
  margin-left: auto;
  color: var(--ch-success);
  font-weight: 600;
}
.tl-meta {
  font-size: 12px;
  color: var(--ch-text-3);
}
.diff {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.diff-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
}
.diff-row > span:first-child {
  width: 110px;
}
.up {
  color: var(--ch-success);
  font-size: 12px;
}
@media (max-width: 1100px) {
  .grid2,
  .grid2.bottom,
  .radar-wrap {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

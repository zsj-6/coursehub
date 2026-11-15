<script setup lang="ts">
/**
 * 能力成长（领导版"能力成长"列表 + "成长画像"收敛成的学习画像 + "今日推荐"改成的为你推荐）
 */
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import RateBars from '@/components/charts/RateBars.vue'
import { CATEGORIES, type Unit, type UnitCategory } from '@/mock/ai'
import { masteryLevel, useAiStore } from '@/stores/ai'
import { useGrowthStore } from '@/stores/growth'
import { toneVars } from '@/utils/format'

const ai = useAiStore()
const growth = useGrowthStore()
const suggestOpen = ref(false)
const suggestText = ref('')
function submitSuggest() {
  if (!suggestText.value.trim()) return ElMessage.warning('写一下你想新增的能力')
  growth.push(growth.pid, '【反馈已收到】建议新增能力', `你建议新增「${suggestText.value.trim()}」，我们会整理后反馈给课程组。`)
  ElMessage.success('感谢反馈，已记录你的需求')
  suggestOpen.value = false
  suggestText.value = ''
}
const cat = ref<'all' | UnitCategory>('all')
const kw = ref('')

const units = computed(() =>
  ai.units.filter(
    (u) => (cat.value === 'all' || u.category === cat.value) && (!kw.value || `${u.name}${u.tags.join('')}${u.desc}`.includes(kw.value.trim())),
  ),
)
const catName = (c: UnitCategory) => CATEGORIES.find((x) => x.code === c)?.name

function unitStat(u: Unit) {
  const nodes = ai.nodesOf(u, false)
  const ms = nodes.map((n) => ai.viewMastery(n.id))
  const good = ms.filter((m) => masteryLevel(m) === 'good').length
  const weak = ms.filter((m) => masteryLevel(m) === 'weak').length
  const learned = ms.filter((m): m is number => m !== null)
  return {
    total: nodes.length,
    good,
    weak,
    avg: learned.length ? Math.round(learned.reduce((a, b) => a + b, 0) / learned.length) : null,
    resources: ai.resourcesOf(u.id).length,
    levels: ai.levelsOf(u.id).filter((l) => l.diagnose.length).length,
  }
}

// ---------- 学生：学习画像
const profile = computed(() => {
  let good = 0
  let weak = 0
  for (const u of ai.units)
    for (const n of ai.nodesOf(u, false)) {
      const lv = masteryLevel(ai.mastery(n.id))
      if (lv === 'good') good++
      if (lv === 'weak') weak++
    }
  return { good, weak, passed: ai.passedList().length, asks: ai.myAsks.length }
})
const unitBars = computed(() =>
  ai.units
    .filter((u) => u.nodes.length)
    .map((u) => {
      const s = unitStat(u)
      return { key: u.id, label: u.name, percent: s.total ? (s.good / s.total) * 100 : 0, note: `已掌握 ${s.good}/${s.total}`, to: `/units/${u.id}` }
    }),
)
const recs = computed(() => ai.recommendations(3))
function recLink(r: { source: { resId: string; partId: string } }) {
  const res = ai.resource(r.source.resId)
  return `/units/${res?.unitId}/read/${r.source.resId}?part=${r.source.partId}`
}

// ---------- 教师：待处理
const pendingFeedback = computed(() => ai.state.feedback.filter((f) => f.status === 'pending').length)
const unconfirmedClusters = computed(() => ai.errorReports.filter((r) => !ai.state.clusterConfirmed.includes(r.questionId)).length)
</script>

<template>
  <div>
    <h1 class="page-title">
      <span>能力成长 <span class="sub">按能力组织课程、知识图谱、闯关和项目训练</span></span>
    </h1>

    <!-- 学生：学习画像 -->
    <template v-if="ai.isStudent">
      <div class="stat-strip">
        <div class="stat is-key">
          <div class="stat-label">已掌握知识点</div>
          <div class="stat-value">{{ profile.good }}<small>个</small></div>
          <div class="stat-note">掌握度 ≥ 80%</div>
        </div>
        <div class="stat" :class="{ 'is-warn': profile.weak }">
          <div class="stat-label">薄弱知识点</div>
          <div class="stat-value">{{ profile.weak }}<small>个</small></div>
          <div class="stat-note">掌握度 &lt; 60%，下方有推荐</div>
        </div>
        <div class="stat">
          <div class="stat-label">已通过关卡</div>
          <div class="stat-value">{{ profile.passed }}<small>关</small></div>
          <div class="stat-note">闯关不计成绩、不算学分</div>
        </div>
        <div class="stat">
          <div class="stat-label">向 AI 辅学提问</div>
          <div class="stat-value">{{ profile.asks }}<small>次</small></div>
          <div class="stat-note">右下角随时可以问</div>
        </div>
      </div>
      <div class="grid2">
        <section class="card">
          <h3 class="card-title">我的学习画像 <span class="muted">各能力单元已掌握的知识点比例</span></h3>
          <RateBars :rows="unitBars" />
        </section>
        <section class="card">
          <h3 class="card-title">为你推荐 <span class="muted">按最薄弱的知识点推送，写明理由</span></h3>
          <div v-if="!recs.length" class="empty-tip">没有薄弱的知识点，继续保持</div>
          <router-link v-for="r in recs" :key="r.node.id" :to="recLink(r)" class="rec">
            <div class="rec-main">
              <b>{{ r.source.label }}</b>
              <span class="reason">你在「{{ r.node.name }}」的掌握度只有 {{ r.m }}%，这一段讲的就是它</span>
            </div>
            <el-icon><ArrowRight /></el-icon>
          </router-link>
        </section>
      </div>
    </template>

    <!-- 教师：待处理事项 -->
    <div v-else class="stat-strip">
      <router-link to="/units/desk?tab=review" class="stat" :class="{ 'is-warn': ai.pendingNodes.length }">
        <div class="stat-label">AI 生成的知识点待审核</div>
        <div class="stat-value">{{ ai.pendingNodes.length }}<small>个</small></div>
        <div class="stat-note">采纳后学生才能看到</div>
      </router-link>
      <router-link to="/units/desk?tab=errors" class="stat" :class="{ 'is-warn': unconfirmedClusters }">
        <div class="stat-label">共性错因待确认</div>
        <div class="stat-value">{{ unconfirmedClusters }}<small>道题</small></div>
        <div class="stat-note">AI 已按错误答案归类</div>
      </router-link>
      <router-link to="/units/desk?tab=review" class="stat" :class="{ 'is-warn': pendingFeedback }">
        <div class="stat-label">学生反馈的错误回答</div>
        <div class="stat-value">{{ pendingFeedback }}<small>条</small></div>
        <div class="stat-note">更正后进入知识库</div>
      </router-link>
      <router-link to="/units/robo" class="stat">
        <div class="stat-label">机甲大师单元班级平均掌握度</div>
        <div class="stat-value">{{ unitStat(ai.unit('robo')!).avg }}<small>%</small></div>
        <div class="stat-note">28 名同学</div>
      </router-link>
    </div>

    <div class="filters">
      <el-radio-group v-model="cat">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button v-for="c in CATEGORIES" :key="c.code" :value="c.code">{{ c.name }}</el-radio-button>
      </el-radio-group>
      <div class="spacer" />
      <el-input v-model="kw" placeholder="搜索能力" clearable :prefix-icon="'Search'" style="width: 220px" />
    </div>

    <div class="units">
      <router-link v-for="(u, i) in units" :key="u.id" :to="`/units/${u.id}`" class="unit card" :class="{ featured: u.featured }">
        <div class="u-head">
          <span class="u-icon tone" :style="toneVars(i)"><el-icon><component :is="u.icon" /></el-icon></span>
          <div class="u-title">
            <b>{{ u.name }}</b>
            <span class="muted">{{ catName(u.category) }} · {{ u.college }}</span>
          </div>
          <el-tag v-if="u.featured" size="small">MVP · 课程群</el-tag>
        </div>
        <p class="u-desc">{{ u.desc }}</p>
        <div v-if="u.courses.length" class="u-courses">
          <span v-for="c in u.courses" :key="c">{{ c }}</span>
        </div>
        <div class="u-foot">
          <template v-if="u.nodes.length">
            <span>{{ unitStat(u).total }} 个知识点</span>
            <span>{{ unitStat(u).resources }} 份资源</span>
            <span v-if="unitStat(u).levels">{{ unitStat(u).levels }} 个关卡</span>
            <div class="spacer" />
            <span v-if="unitStat(u).avg !== null" class="avg">{{ ai.isStudent ? '我的' : '班级' }}平均 {{ unitStat(u).avg }}%</span>
          </template>
          <span v-else class="building">知识图谱待生成</span>
        </div>
      </router-link>
    </div>
    <div class="suggest muted">
      没有找到想要的能力？<a href="#" @click.prevent="suggestOpen = true">点此反馈，建议新增能力 →</a>
    </div>
    <el-dialog v-model="suggestOpen" title="建议新增能力" width="440px">
      <el-input v-model="suggestText" placeholder="例如：嵌入式系统开发、学术英语写作" />
      <template #footer>
        <el-button @click="suggestOpen = false">取消</el-button>
        <el-button type="primary" @click="submitSuggest">提交</el-button>
      </template>
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
.grid2 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.card-title .muted {
  margin-left: 6px;
  font-weight: 400;
  font-size: 12px;
}
.rec {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--ch-border-light);
  border-radius: 6px;
  color: var(--ch-text);
  margin-bottom: 8px;
}
.rec:hover {
  border-color: var(--ch-primary);
}
.rec-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.rec-main b {
  font-weight: 500;
}
.reason {
  font-size: 12.5px;
  color: var(--ch-warning);
}
.filters {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0 16px;
}
.units {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}
.unit {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: var(--ch-text);
  transition: border-color 0.15s;
}
.unit:hover {
  border-color: var(--ch-primary);
}
.unit.featured {
  border-color: var(--el-color-primary-light-5);
}
.u-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.u-icon {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.u-title {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.u-title b {
  font-weight: 600;
  font-size: 15px;
}
.u-title .muted {
  font-size: 12px;
}
.u-desc {
  margin: 0;
  font-size: 13px;
  color: var(--ch-text-2);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.u-courses {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.u-courses span {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 4px;
  background: var(--ch-fill);
  color: var(--ch-text-2);
}
.u-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--ch-border-light);
  font-size: 12.5px;
  color: var(--ch-text-3);
}
.avg {
  color: var(--ch-primary-text);
  font-weight: 500;
}
.building {
  color: var(--ch-text-3);
}
.suggest {
  margin-top: 20px;
  text-align: center;
}
@media (max-width: 900px) {
  .grid2 {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

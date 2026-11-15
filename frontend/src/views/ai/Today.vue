<script setup lang="ts">
/**
 * 今日推荐（领导版首页）：精选轮播、按来源 / 时间 / 排序筛选、类型页签、收藏、不感兴趣（带原因）、换一批。
 * 来源（图书馆、团委、就业中心等）是演示数据，没有真实对接这些系统。
 */
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { RESOURCE_TYPES } from '@/mock/growth'
import { useGrowthStore, type TodayItem } from '@/stores/growth'
import { toneVars } from '@/utils/format'

const g = useGrowthStore()
const router = useRouter()
const PAGE = 6

const source = ref('')
const days = ref(0)
const sort = ref<'recommend' | 'newest' | 'hot'>('recommend')
const kw = ref('')
const type = ref('ALL')
const page = ref(0)

const visible = computed(() => g.todayAll.filter((r) => !g.hidden[r.id]))
const sources = computed(() => [...new Set(g.todayAll.map((r) => r.source))])
const typeName = (code: string) => RESOURCE_TYPES.find((t) => t.code === code)?.name ?? code
const typeIndex = (code: string) => RESOURCE_TYPES.findIndex((t) => t.code === code)

const filtered = computed(() => {
  const list = visible.value.filter((r) => {
    if (type.value !== 'ALL' && r.type !== type.value) return false
    if (source.value && r.source !== source.value) return false
    if (days.value && dayjs().diff(dayjs(r.publishAt), 'day') > days.value) return false
    const k = kw.value.trim()
    if (k && !`${r.title}${r.desc}${r.tags.join('')}`.includes(k)) return false
    return true
  })
  if (sort.value === 'newest') return [...list].sort((a, b) => b.publishAt.localeCompare(a.publishAt))
  if (sort.value === 'hot') return [...list].sort((a, b) => b.tags.length - a.tags.length || b.score - a.score)
  return [...list].sort((a, b) => b.score - a.score)
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE)))
const shown = computed(() => filtered.value.slice(page.value * PAGE, page.value * PAGE + PAGE))
watch([source, days, sort, kw, type], () => (page.value = 0))
const counts = computed(() => {
  const c: Record<string, number> = { ALL: visible.value.length }
  for (const r of visible.value) c[r.type] = (c[r.type] ?? 0) + 1
  return c
})
const banner = computed(() => [...visible.value].sort((a, b) => b.score - a.score).slice(0, 3))

function next() {
  page.value = (page.value + 1) % pages.value
}
function resetFilters() {
  source.value = ''
  days.value = 0
  sort.value = 'recommend'
  kw.value = ''
  type.value = 'ALL'
}

// ---------- 查看 / 收藏 / 不感兴趣
const detail = ref<TodayItem | null>(null)
function open(r: TodayItem) {
  if (r.link) router.push(r.link)
  else detail.value = r
}
function fav(r: TodayItem) {
  ElMessage.success(g.toggleTodayFav(r.id) ? '已收藏，可在「我的 → 收藏」查看' : '已取消收藏')
}
const REASONS = ['对这个方向不感兴趣', '已经学过 / 参加过了', '推荐理由不准确', '不想看这个来源的内容']
const dislike = ref<TodayItem | null>(null)
const reason = ref(REASONS[0])
function confirmDislike() {
  if (!dislike.value) return
  g.hideToday(dislike.value.id, reason.value)
  ElMessage.success('已收到反馈，以后会少推荐这类内容')
  dislike.value = null
}
const hiddenCount = computed(() => Object.keys(g.hidden).length)
function restore() {
  g.state.hiddenToday[g.pid] = {}
}
</script>

<template>
  <div>
    <h1 class="page-title">
      <span>今日推荐 <span class="sub">按你的学习画像和薄弱知识点推荐，每条写明理由</span></span>
    </h1>

    <el-carousel v-if="banner.length" height="148px" :interval="5000" indicator-position="outside" class="banner">
      <el-carousel-item v-for="b in banner" :key="b.id">
        <div class="slide card" @click="open(b)">
          <span class="tone b-icon" :style="toneVars(typeIndex(b.type))">{{ typeName(b.type) }}</span>
          <div class="b-main">
            <div class="muted">今日精选 · {{ b.source }}</div>
            <h2>{{ b.title }}</h2>
            <div class="reason"><el-icon><Aim /></el-icon>{{ b.reason }}</div>
          </div>
          <el-button type="primary">去看看</el-button>
        </div>
      </el-carousel-item>
    </el-carousel>

    <section class="card filters">
      <el-select v-model="source" placeholder="全部来源" clearable style="width: 150px">
        <el-option v-for="s in sources" :key="s" :value="s" :label="s" />
      </el-select>
      <el-select v-model="days" style="width: 120px">
        <el-option :value="0" label="不限时间" />
        <el-option :value="7" label="本周" />
        <el-option :value="30" label="本月" />
        <el-option :value="120" label="本学期" />
      </el-select>
      <el-select v-model="sort" style="width: 120px">
        <el-option value="recommend" label="推荐优先" />
        <el-option value="newest" label="最新发布" />
        <el-option value="hot" label="最热门" />
      </el-select>
      <el-input v-model="kw" placeholder="搜索标题、标签" clearable :prefix-icon="'Search'" style="width: 240px" />
      <el-button @click="resetFilters">重置</el-button>
      <div class="spacer" />
      <span v-if="hiddenCount" class="muted">已屏蔽 {{ hiddenCount }} 条 · <a href="#" @click.prevent="restore">恢复</a></span>
    </section>

    <el-tabs v-model="type" class="types">
      <el-tab-pane :label="`全部 ${counts.ALL}`" name="ALL" />
      <el-tab-pane v-for="t in RESOURCE_TYPES.filter((x) => counts[x.code])" :key="t.code" :label="`${t.name} ${counts[t.code]}`" :name="t.code" />
    </el-tabs>

    <div v-if="!shown.length" class="card empty-tip">没有符合条件的推荐，换个筛选条件试试</div>
    <div class="list">
      <article v-for="r in shown" :key="r.id" class="item card">
        <div class="i-head">
          <span class="tone t-tag" :style="toneVars(typeIndex(r.type))">{{ typeName(r.type) }}</span>
          <span class="muted">{{ r.source }} · {{ dayjs(r.publishAt).format('MM-DD') }} 发布</span>
          <div class="spacer" />
          <button class="icon-btn" :class="{ on: g.todayFavs.includes(r.id) }" :title="g.todayFavs.includes(r.id) ? '取消收藏' : '收藏'" @click="fav(r)">
            <el-icon><StarFilled v-if="g.todayFavs.includes(r.id)" /><Star v-else /></el-icon>
          </button>
          <button class="icon-btn" title="不感兴趣" @click="dislike = r"><el-icon><CircleClose /></el-icon></button>
        </div>
        <h3 @click="open(r)">{{ r.title }}</h3>
        <p class="desc">{{ r.desc }}</p>
        <div class="reason"><el-icon><Aim /></el-icon>{{ r.reason }}</div>
        <div class="i-foot">
          <span v-for="t in r.tags" :key="t" class="tag">{{ t }}</span>
          <div class="spacer" />
          <span v-if="r.expireAt" class="muted">{{ dayjs(r.expireAt).format('MM-DD') }} 截止</span>
          <el-button size="small" @click="open(r)">查看</el-button>
        </div>
      </article>
    </div>
    <div v-if="pages > 1" class="more">
      <el-button :icon="'Refresh'" @click="next">换一批（{{ page + 1 }}/{{ pages }}）</el-button>
    </div>

    <el-dialog :model-value="!!dislike" title="不感兴趣" width="420px" @close="dislike = null">
      <p class="muted">告诉我们原因，推荐会更准（原型只在本机记录）：</p>
      <el-radio-group v-model="reason" class="reasons">
        <el-radio v-for="x in REASONS" :key="x" :value="x">{{ x }}</el-radio>
      </el-radio-group>
      <template #footer>
        <el-button @click="dislike = null">取消</el-button>
        <el-button type="primary" @click="confirmDislike">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog :model-value="!!detail" :title="detail?.title" width="560px" @close="detail = null">
      <template v-if="detail">
        <p>{{ detail.desc }}</p>
        <dl class="dl">
          <dt>类型</dt><dd>{{ typeName(detail.type) }}</dd>
          <dt>来源</dt><dd>{{ detail.source }}（演示数据，未对接该系统）</dd>
          <dt>发布时间</dt><dd>{{ detail.publishAt }}</dd>
          <dt>有效期至</dt><dd>{{ detail.expireAt ?? '长期有效' }}</dd>
          <dt>推荐理由</dt><dd>{{ detail.reason }}</dd>
        </dl>
      </template>
      <template #footer>
        <el-button @click="detail && fav(detail)">{{ detail && g.todayFavs.includes(detail.id) ? '取消收藏' : '收藏' }}</el-button>
        <el-button type="primary" @click="detail = null">知道了</el-button>
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
.banner {
  margin-bottom: 8px;
}
.slide {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 20px;
  cursor: pointer;
}
.b-icon {
  flex: none;
  width: 64px;
  height: 64px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}
.b-main {
  flex: 1;
  min-width: 0;
}
.b-main h2 {
  margin: 4px 0 8px;
  font-size: 19px;
}
.reason {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: 13px;
  color: var(--ch-primary-text);
  line-height: 1.6;
}
.reason .el-icon {
  margin-top: 3px;
  flex: none;
}
.filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 14px 16px;
  margin-bottom: 8px;
}
.list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 14px;
}
.item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px;
}
.i-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.t-tag {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 4px;
  font-weight: 500;
}
.i-head .muted {
  font-size: 12px;
}
.icon-btn {
  border: none;
  background: none;
  padding: 2px;
  cursor: pointer;
  color: var(--ch-text-3);
  font-size: 16px;
  display: flex;
}
.icon-btn:hover {
  color: var(--ch-text);
}
.icon-btn.on {
  color: var(--ch-warning);
}
.item h3 {
  margin: 0;
  font-size: 15px;
  cursor: pointer;
}
.item h3:hover {
  color: var(--ch-primary-text);
}
.desc {
  margin: 0;
  font-size: 13px;
  color: var(--ch-text-2);
  line-height: 1.6;
}
.i-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--ch-border-light);
}
.tag {
  font-size: 12px;
  padding: 0 7px;
  border-radius: 4px;
  background: var(--ch-fill);
  color: var(--ch-text-2);
}
.i-foot .muted {
  font-size: 12px;
}
.more {
  display: flex;
  justify-content: center;
  margin-top: 18px;
}
.reasons {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.dl {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 8px 12px;
  font-size: 13.5px;
}
.dl dt {
  color: var(--ch-text-2);
}
.dl dd {
  margin: 0;
}
</style>

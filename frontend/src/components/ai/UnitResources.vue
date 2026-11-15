<script setup lang="ts">
/**
 * 能力单元 · 学习资源页签（资源汇聚治理）
 * - 智能检索：按片段返回（第几页 / 第几分钟）
 * - 资源都挂在知识点上；视频按字幕切片
 * - 教师：资源体检（未关联知识点、没人看、内容重复、没有资源的知识点），AI 给出治理建议
 */
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { AI_TAG_SUGGESTIONS, RES_KIND_META, type ResKind, type Unit } from '@/mock/ai'
import { partLabel, useAiStore } from '@/stores/ai'

const props = defineProps<{ unit: Unit }>()
const ai = useAiStore()
const kw = ref('')
const kind = ref<'all' | ResKind>('all')
const nodeFilter = ref('')

const all = computed(() => ai.resourcesOf(props.unit.id))
const kinds = computed(() => [...new Set(all.value.map((r) => r.kind))])
const nodes = computed(() => ai.nodesOf(props.unit, false))
const list = computed(() =>
  all.value.filter(
    (r) =>
      (kind.value === 'all' || r.kind === kind.value) &&
      (!nodeFilter.value || ai.resourceNodeIds(r).includes(nodeFilter.value)) &&
      (ai.isStudent ? ai.resourceNodeIds(r).length > 0 : true),
  ),
)
const hits = computed(() => ai.search(props.unit.id, kw.value))
const link = (resId: string, partId?: string) => `/units/${props.unit.id}/read/${resId}${partId ? `?part=${partId}` : ''}`

// ---------- 资源体检
const health = computed(() => {
  const unlinked = all.value.filter((r) => !ai.resourceNodeIds(r).length)
  const cold = all.value.filter((r) => r.views < 10)
  const covered = new Set(all.value.flatMap((r) => ai.partsOf(r).flatMap((p) => p.nodeIds)).concat(all.value.flatMap((r) => ai.resourceNodeIds(r))))
  const bare = nodes.value.filter((n) => !covered.has(n.id))
  return { unlinked, cold, bare }
})
const toFix = computed(() => all.value.filter((r) => AI_TAG_SUGGESTIONS[r.id] && !ai.state.tagAdopted.includes(r.id)))
function adopt(id: string) {
  ai.adoptTags(id)
  ElMessage.success('已采纳 AI 建议')
}
</script>

<template>
  <div>
    <div v-if="!ai.isStudent" class="health">
      <div class="stat-strip">
        <div class="stat" :class="{ 'is-warn': health.unlinked.length }">
          <div class="stat-label">未关联知识点的资源</div>
          <div class="stat-value">{{ health.unlinked.length }}<small>份</small></div>
          <div class="stat-note">学生检索不到</div>
        </div>
        <div class="stat" :class="{ 'is-warn': health.cold.length }">
          <div class="stat-label">几乎没人看的资源</div>
          <div class="stat-value">{{ health.cold.length }}<small>份</small></div>
          <div class="stat-note">访问少于 10 次</div>
        </div>
        <div class="stat" :class="{ 'is-warn': health.bare.length }">
          <div class="stat-label">没有资源的知识点</div>
          <div class="stat-value">{{ health.bare.length }}<small>个</small></div>
          <div class="stat-note">{{ health.bare.map((n) => n.name).join('、') || '全部覆盖' }}</div>
        </div>
        <div class="stat">
          <div class="stat-label">资源总数</div>
          <div class="stat-value">{{ all.length }}<small>份</small></div>
          <div class="stat-note">{{ all.reduce((s, r) => s + ai.partsOf(r).length, 0) }} 个可定位片段</div>
        </div>
      </div>
      <section v-if="toFix.length" class="card fix">
        <h3 class="card-title">资源体检 · 待治理 <el-tag size="small" type="warning">AI 建议</el-tag></h3>
        <div v-for="r in toFix" :key="r.id" class="fix-row">
          <div class="fix-main">
            <b>{{ r.title }}</b>
            <span class="muted">{{ r.source }} · 访问 {{ r.views }} 次</span>
            <span class="note">{{ AI_TAG_SUGGESTIONS[r.id].note }}</span>
            <span class="tags">建议关联：<el-tag v-for="id in AI_TAG_SUGGESTIONS[r.id].nodeIds" :key="id" size="small" type="info">{{ ai.node(id)?.name }}</el-tag></span>
          </div>
          <el-button size="small" type="primary" @click="adopt(r.id)">采纳</el-button>
        </div>
      </section>
    </div>

    <section class="card search">
      <el-input v-model="kw" size="large" clearable :prefix-icon="'Search'" placeholder="智能检索：输入知识点或关键词，比如「旋转矩阵」「PID」「标定」" />
      <div v-if="kw.trim()" class="hits">
        <div class="muted">找到 {{ hits.length }} 个片段（按页码 / 时间点返回，不是整本书）</div>
        <router-link v-for="h in hits" :key="h.res.id + h.part.id" :to="link(h.res.id, h.part.id)" class="hit">
          <el-icon><component :is="RES_KIND_META[h.res.kind].icon" /></el-icon>
          <span class="h-title">{{ h.res.title }} · {{ h.part.title }}</span>
          <span class="loc">{{ partLabel(h.part) }}</span>
        </router-link>
      </div>
    </section>

    <div class="filters">
      <el-radio-group v-model="kind" size="small">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button v-for="k in kinds" :key="k" :value="k">{{ RES_KIND_META[k].label }}</el-radio-button>
      </el-radio-group>
      <el-select v-model="nodeFilter" placeholder="按知识点筛选" clearable filterable size="small" style="width: 200px">
        <el-option v-for="n in nodes" :key="n.id" :value="n.id" :label="n.name" />
      </el-select>
    </div>

    <div class="res-list">
      <router-link v-for="r in list" :key="r.id" :to="link(r.id)" class="res card">
        <span class="kind tone"><el-icon><component :is="RES_KIND_META[r.kind].icon" /></el-icon></span>
        <div class="r-main">
          <div class="r-title">
            <b>{{ r.title }}</b>
            <el-tag size="small" type="info">{{ RES_KIND_META[r.kind].label }}</el-tag>
            <el-tag v-if="r.kind === 'video' && r.parts.length" size="small">AI 切片 {{ r.parts.length }} 段</el-tag>
          </div>
          <div class="muted">{{ r.author }} · {{ r.source }} · 约 {{ r.minutes }} 分钟 · 访问 {{ r.views }}</div>
          <div class="reason">{{ r.reason }}</div>
          <div class="r-nodes">
            <span v-for="id in ai.resourceNodeIds(r)" :key="id" class="nchip">{{ ai.node(id)?.name }}</span>
            <span v-if="!ai.resourceNodeIds(r).length" class="warn">未关联知识点</span>
          </div>
        </div>
      </router-link>
      <div v-if="!list.length" class="empty-tip">没有符合条件的资源</div>
    </div>
  </div>
</template>

<style scoped>
.fix {
  margin-bottom: 16px;
}
.fix-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--ch-border-light);
}
.fix-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 13px;
}
.fix-main b {
  font-weight: 500;
  font-size: 14px;
}
.note {
  color: var(--ch-text);
}
.tags {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--ch-text-2);
}
.search {
  padding: 16px;
  margin-bottom: 16px;
}
.hits {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hit {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  color: var(--ch-text);
  font-size: 13.5px;
}
.hit:hover {
  background: var(--ch-fill-hover);
}
.h-title {
  flex: 1;
}
.loc {
  color: var(--ch-primary-text);
  font-size: 12.5px;
}
.filters {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.res-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 12px;
}
.res {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  color: var(--ch-text);
}
.res:hover {
  border-color: var(--ch-primary);
}
.kind {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.r-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.r-title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.r-title b {
  font-weight: 600;
}
.r-main .muted {
  font-size: 12px;
}
.reason {
  font-size: 13px;
  color: var(--ch-text-2);
}
.r-nodes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.nchip {
  font-size: 12px;
  padding: 0 7px;
  border-radius: 4px;
  background: var(--ch-primary-bg);
  color: var(--ch-primary-text);
}
.warn {
  font-size: 12px;
  color: var(--ch-warning);
}
</style>

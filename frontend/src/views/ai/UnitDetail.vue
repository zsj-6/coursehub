<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackBar from '@/components/BackBar.vue'
import UnitGraph from '@/components/ai/UnitGraph.vue'
import UnitLevels from '@/components/ai/UnitLevels.vue'
import UnitProjects from '@/components/ai/UnitProjects.vue'
import UnitResources from '@/components/ai/UnitResources.vue'
import { CATEGORIES } from '@/mock/ai'
import { masteryLevel, useAiStore } from '@/stores/ai'
import { toneVars } from '@/utils/format'

const props = defineProps<{ unitId: string }>()
const ai = useAiStore()
const route = useRoute()
const router = useRouter()
const unit = computed(() => ai.unit(props.unitId))

const tab = computed({
  get: () => (route.query.tab as string) || 'graph',
  set: (v) => router.replace({ query: { ...route.query, tab: v } }),
})
const stat = computed(() => {
  const u = unit.value!
  const nodes = ai.nodesOf(u, false)
  const ms = nodes.map((n) => ai.viewMastery(n.id))
  const learned = ms.filter((m): m is number => m !== null)
  return {
    nodes: nodes.length,
    good: ms.filter((m) => masteryLevel(m) === 'good').length,
    weak: ms.filter((m) => masteryLevel(m) === 'weak').length,
    avg: learned.length ? Math.round(learned.reduce((a, b) => a + b, 0) / learned.length) : null,
    res: ai.resourcesOf(u.id).length,
    levels: ai.levelsOf(u.id).length,
    passed: ai.levelsOf(u.id).filter((l) => ai.levelState(l) === 'passed').length,
  }
})
const idx = computed(() => ai.units.findIndex((u) => u.id === props.unitId))
</script>

<template>
  <div v-if="!unit" class="empty-tip">没有这个能力单元</div>
  <div v-else>
    <BackBar :items="[{ label: '能力成长', to: '/units' }, { label: unit.name }]" />
    <section class="card head">
      <span class="icon tone" :style="toneVars(idx)"><el-icon><component :is="unit.icon" /></el-icon></span>
      <div class="h-main">
        <div class="h-title">
          <h1>{{ unit.name }}</h1>
          <el-tag size="small" type="info">{{ CATEGORIES.find((c) => c.code === unit!.category)?.name }}</el-tag>
          <el-tag v-if="unit.featured" size="small">MVP · 课程群</el-tag>
        </div>
        <p class="muted">{{ unit.desc }}</p>
        <div v-if="unit.courses.length" class="courses">
          <span class="muted">关联课程</span>
          <span v-for="c in unit.courses" :key="c" class="course">{{ c }}</span>
        </div>
      </div>
    </section>

    <div class="stat-strip">
      <div class="stat">
        <div class="stat-label">知识点</div>
        <div class="stat-value">{{ stat.nodes }}<small>个</small></div>
        <div class="stat-note">AI 生成，教师审核后发布</div>
      </div>
      <div class="stat is-key">
        <div class="stat-label">{{ ai.isStudent ? '我已掌握' : '班级平均掌握度' }}</div>
        <div class="stat-value">
          <template v-if="ai.isStudent">{{ stat.good }}<small>/ {{ stat.nodes }}</small></template>
          <template v-else>{{ stat.avg ?? '—' }}<small>%</small></template>
        </div>
        <div class="stat-note">掌握度 = 相关题目的加权得分率</div>
      </div>
      <div class="stat" :class="{ 'is-warn': stat.weak }">
        <div class="stat-label">{{ ai.isStudent ? '我的薄弱知识点' : '班级薄弱知识点' }}</div>
        <div class="stat-value">{{ stat.weak }}<small>个</small></div>
        <div class="stat-note">掌握度低于 60%</div>
      </div>
      <div class="stat">
        <div class="stat-label">学习资源</div>
        <div class="stat-value">{{ stat.res }}<small>份</small></div>
        <div class="stat-note">都定位到页码 / 时间点</div>
      </div>
      <div class="stat">
        <div class="stat-label">关卡</div>
        <div class="stat-value">
          <template v-if="ai.isStudent">{{ stat.passed }}<small>/ {{ stat.levels }} 已通过</small></template>
          <template v-else>{{ stat.levels }}<small>关</small></template>
        </div>
        <div class="stat-note">不计成绩、不算学分</div>
      </div>
    </div>

    <el-tabs v-model="tab" class="tabs">
      <el-tab-pane label="知识图谱" name="graph" />
      <el-tab-pane label="学习资源" name="resources" />
      <el-tab-pane label="闯关" name="levels" />
      <el-tab-pane v-if="ai.projectLinksOf(unit.id).length" label="项目训练" name="projects" />
    </el-tabs>
    <UnitGraph v-if="tab === 'graph'" :unit="unit" />
    <UnitResources v-else-if="tab === 'resources'" :unit="unit" />
    <UnitLevels v-else-if="tab === 'levels'" :unit="unit" />
    <UnitProjects v-else-if="tab === 'projects'" :unit="unit" />
  </div>
</template>

<style scoped>
.head {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.icon {
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}
.h-main {
  flex: 1;
  min-width: 0;
}
.h-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.h-title h1 {
  margin: 0;
  font-size: 20px;
}
.h-main p {
  margin: 6px 0 8px;
}
.courses {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.course {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 4px;
  background: var(--ch-fill);
  color: var(--ch-text-2);
}
.tabs {
  margin-bottom: 4px;
}
</style>

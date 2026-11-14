<script setup lang="ts">
import dayjs from 'dayjs'
import { computed } from 'vue'
import type { Project } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { fmt } from '@/utils/format'

const props = defineProps<{ projects: Project[] }>()
const store = usePblStore()

const range = computed(() => {
  const all = props.projects.flatMap((p) => p.milestones)
  if (!all.length) return { start: dayjs(), days: 1 }
  const start = dayjs(all.reduce((a, m) => (m.start < a ? m.start : a), all[0].start)).startOf('day')
  const end = dayjs(all.reduce((a, m) => (m.end > a ? m.end : a), all[0].end)).endOf('day')
  return { start, days: Math.max(1, end.diff(start, 'day') + 1) }
})
const pos = (t: string) => (dayjs(t).diff(range.value.start, 'hour') / 24 / range.value.days) * 100
const today = computed(() => pos(dayjs().toISOString()))
const months = computed(() => {
  const res: { label: string; left: number }[] = []
  let m = range.value.start.startOf('month')
  const end = range.value.start.add(range.value.days, 'day')
  while (m.isBefore(end)) {
    const left = pos(m.toISOString())
    if (left >= 0) res.push({ label: m.format('M 月'), left })
    m = m.add(1, 'month')
  }
  return res
})
const COLORS = { done: '#3bb4b8', current: '#f6903d', upcoming: '#c9d2dc' }
</script>

<template>
  <div class="gantt">
    <div class="head">
      <div class="name-col" />
      <div class="axis">
        <span v-for="m in months" :key="m.left" class="month" :style="{ left: `${m.left}%` }">{{ m.label }}</span>
      </div>
    </div>
    <div v-for="p in projects" :key="p.id" class="row">
      <router-link :to="`/pbl/projects/${p.id}`" class="name-col" :title="p.title">{{ p.title }}</router-link>
      <div class="lane">
        <el-tooltip v-for="(m, i) in p.milestones" :key="m.id" placement="top"
          :content="`关卡 ${i + 1} · ${m.title}（${fmt(m.start, 'MM-DD')} ~ ${fmt(m.end, 'MM-DD')}）`">
          <div class="seg" :style="{ left: `${pos(m.start)}%`, width: `${Math.max(pos(m.end) - pos(m.start), 0.8)}%`, background: COLORS[store.milestoneState(m)] }">
            <span>{{ i + 1 }}</span>
          </div>
        </el-tooltip>
        <div class="today" :style="{ left: `${today}%` }" />
      </div>
    </div>
    <div class="legend muted">
      <span><i :style="{ background: COLORS.done }" />已完成关卡</span>
      <span><i :style="{ background: COLORS.current }" />进行中</span>
      <span><i :style="{ background: COLORS.upcoming }" />未开始</span>
      <span><i class="tl" />今天</span>
    </div>
  </div>
</template>

<style scoped>
.gantt {
  overflow-x: auto;
}
.head,
.row {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 12px;
  min-width: 640px;
}
.axis {
  position: relative;
  height: 22px;
  border-bottom: 1px solid var(--ch-border);
}
.month {
  position: absolute;
  font-size: 12px;
  color: var(--ch-text-2);
  border-left: 1px dashed var(--ch-border);
  padding-left: 4px;
}
.row {
  align-items: center;
  height: 36px;
}
.name-col {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ch-text);
}
.lane {
  position: relative;
  height: 20px;
  background: #f7f9fb;
  border-radius: 4px;
}
.seg {
  position: absolute;
  top: 0;
  height: 20px;
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  display: grid;
  place-items: center;
  border-right: 2px solid #fff;
  animation: grow 0.7s ease-out;
  transform-origin: left;
}
@keyframes grow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
.today {
  position: absolute;
  top: -6px;
  bottom: -6px;
  width: 2px;
  background: #e8684a;
}
.legend {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.legend i {
  display: inline-block;
  width: 12px;
  height: 10px;
  border-radius: 2px;
  margin-right: 4px;
}
.legend i.tl {
  width: 2px;
  background: #e8684a;
}
</style>

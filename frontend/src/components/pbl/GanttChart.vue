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
const COLORS = { done: '#12969c', current: '#e8862e', upcoming: '#dcdfe3' }
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
          <div class="seg" :class="store.milestoneState(m)" :style="{ left: `${pos(m.start)}%`, width: `${Math.max(pos(m.end) - pos(m.start), 0.8)}%`, background: COLORS[store.milestoneState(m)] }">
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
  grid-template-columns: 180px 1fr;
  gap: 16px;
  min-width: 640px;
}
.axis {
  position: relative;
  height: 24px;
  border-bottom: 1px solid var(--ch-border-light);
}
.month {
  position: absolute;
  font-size: 12px;
  color: var(--ch-text-3);
  border-left: 1px solid var(--ch-border-light);
  padding-left: 6px;
  height: 100%;
}
.row {
  align-items: center;
  height: 40px;
}
.row + .row {
  border-top: 1px solid var(--ch-border-light);
}
.name-col {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ch-text);
}
a.name-col:hover {
  color: var(--ch-primary-text);
}
.lane {
  position: relative;
  height: 16px;
}
.seg {
  position: absolute;
  top: 0;
  height: 16px;
  border-radius: 3px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  display: grid;
  place-items: center;
  box-shadow: 0 0 0 1px #fff;
}
.seg.upcoming {
  color: var(--ch-text-2);
}
.today {
  position: absolute;
  top: -12px;
  bottom: -12px;
  width: 1px;
  background: var(--ch-danger);
}
.legend {
  display: flex;
  gap: 16px;
  margin-top: 14px;
  flex-wrap: wrap;
  font-size: 12px;
}
.legend i {
  display: inline-block;
  width: 10px;
  height: 8px;
  border-radius: 2px;
  margin-right: 6px;
}
.legend i.tl {
  width: 1px;
  height: 10px;
  vertical-align: -1px;
  background: var(--ch-danger);
}
</style>

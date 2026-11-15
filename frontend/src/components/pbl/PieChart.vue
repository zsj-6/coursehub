<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ items: { label: string; value: number; color: string }[]; title?: string }>()
const total = computed(() => props.items.reduce((s, x) => s + x.value, 0))
const bg = computed(() => {
  if (!total.value) return 'var(--el-fill-color)'
  let acc = 0
  const stops = props.items.map((x) => {
    const from = (acc / total.value) * 360
    acc += x.value
    const to = (acc / total.value) * 360
    return `${x.color} ${from}deg ${to}deg`
  })
  return `conic-gradient(${stops.join(',')})`
})
</script>

<template>
  <div class="pie-wrap">
    <div class="pie" :style="{ background: bg }">
      <div class="hole">
        <b>{{ total }}</b>
        <span>{{ title }}</span>
      </div>
    </div>
    <ul class="legend">
      <li v-for="x in items" :key="x.label">
        <i :style="{ background: x.color }" />
        <span class="lb">{{ x.label }}</span>
        <b>{{ x.value }}</b>
        <span class="pct">{{ total ? Math.round((x.value / total) * 100) : 0 }}%</span>
      </li>
      <li v-if="!items.length" class="none">暂无数据</li>
    </ul>
  </div>
</template>

<style scoped>
.pie-wrap {
  display: flex;
  align-items: center;
  gap: 24px;
}
.pie {
  width: 112px;
  height: 112px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.hole {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.hole b {
  font-size: 24px;
  font-weight: 600;
  line-height: 28px;
  letter-spacing: -0.02em;
}
.hole span {
  font-size: 12px;
  color: var(--ch-text-3);
}
.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  min-width: 0;
}
.legend li {
  display: grid;
  grid-template-columns: 8px 1fr auto 40px;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  font-size: 13px;
}
.legend li + li {
  border-top: 1px solid var(--ch-border-light);
}
.legend i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.lb {
  color: var(--ch-text-2);
}
.legend b {
  font-weight: 600;
}
.pct {
  text-align: right;
  color: var(--ch-text-3);
}
.none {
  display: block !important;
  color: var(--ch-text-3);
}
</style>

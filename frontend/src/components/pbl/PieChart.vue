<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ items: { label: string; value: number; color: string }[]; title?: string }>()
const total = computed(() => props.items.reduce((s, x) => s + x.value, 0))
const bg = computed(() => {
  if (!total.value) return '#eef1f4'
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
        <span class="muted">{{ title }}</span>
      </div>
    </div>
    <ul class="legend">
      <li v-for="x in items" :key="x.label">
        <i :style="{ background: x.color }" />
        <span>{{ x.label }}</span>
        <b>{{ x.value }}</b>
        <span class="muted">{{ total ? Math.round((x.value / total) * 100) : 0 }}%</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pie-wrap {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}
.pie {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  animation: spin-in 0.8s ease-out;
}
@keyframes spin-in {
  from { transform: rotate(-90deg) scale(0.6); opacity: 0; }
  to { transform: rotate(0) scale(1); opacity: 1; }
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
  font-size: 22px;
}
.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.legend li {
  display: grid;
  grid-template-columns: 10px 64px 28px 40px;
  align-items: center;
  gap: 8px;
}
.legend i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}
</style>

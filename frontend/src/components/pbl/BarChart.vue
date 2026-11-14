<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  rows: { label: string; values: number[] }[]
  series: { name: string; color: string }[]
}>()
const max = computed(() => Math.max(1, ...props.rows.flatMap((r) => r.values)))
</script>

<template>
  <div>
    <div class="legend">
      <span v-for="s in series" :key="s.name"><i :style="{ background: s.color }" />{{ s.name }}</span>
    </div>
    <div v-for="r in rows" :key="r.label" class="row">
      <div class="label" :title="r.label">{{ r.label }}</div>
      <div class="bars">
        <div v-for="(v, i) in r.values" :key="i" class="bar-line">
          <div class="bar" :style="{ width: `${(v / max) * 100}%`, background: series[i]?.color }" />
          <span class="v">{{ v }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.legend {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--ch-text-2);
}
.legend i {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 4px;
}
.row {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}
.label {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar-line {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 14px;
  margin: 2px 0;
}
.bar {
  height: 12px;
  border-radius: 0 6px 6px 0;
  min-width: 2px;
  animation: grow 0.8s ease-out;
  transform-origin: left;
}
@keyframes grow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
.v {
  font-size: 12px;
  color: var(--ch-text-2);
}
</style>

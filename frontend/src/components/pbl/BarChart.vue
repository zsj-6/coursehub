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
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--ch-text-2);
}
.legend i {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  margin-right: 6px;
}
.row {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
}
.row + .row {
  border-top: 1px solid var(--ch-border-light);
}
.label {
  font-size: 13px;
  color: var(--ch-text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bar-line {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 14px;
  margin: 2px 0;
}
.bar {
  height: 8px;
  border-radius: 2px;
  min-width: 2px;
}
.v {
  font-size: 12px;
  font-weight: 600;
  color: var(--ch-text);
}
</style>

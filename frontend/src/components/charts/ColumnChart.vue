<script setup lang="ts">
import { computed } from 'vue'

/**
 * 竖向柱状图（单系列）：用于分数段分布这类"按区间计数"的数据。
 * 单系列不需要图例，标题说明是什么；每根柱子顶上标数值，悬停给完整说明。
 */
const props = defineProps<{
  items: { label: string; value: number; tip?: string }[]
  unit?: string
  height?: number
}>()

const max = computed(() => Math.max(1, ...props.items.map((x) => x.value)))
/** 纵轴刻度：0、一半、最大值取整，网格线做得很淡。 */
const ticks = computed(() => {
  const top = Math.max(1, Math.ceil(max.value / 2) * 2)
  return [top, top / 2, 0]
})
const pct = (v: number) => `${(v / ticks.value[0]) * 100}%`
</script>

<template>
  <div class="col-chart" :style="{ '--h': `${height ?? 180}px` }">
    <div class="plot">
      <div class="grid">
        <div v-for="t in ticks" :key="t" class="tick"><span>{{ t }}</span></div>
      </div>
      <div class="bars">
        <el-tooltip v-for="x in items" :key="x.label" placement="top" :content="x.tip || `${x.label}：${x.value}${unit ?? ''}`">
          <div class="slot">
            <span class="val" :style="{ bottom: pct(x.value) }">{{ x.value }}</span>
            <div class="bar" :style="{ height: pct(x.value) }" />
          </div>
        </el-tooltip>
      </div>
    </div>
    <div class="labels">
      <span v-for="x in items" :key="x.label">{{ x.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.col-chart {
  --axis-w: 28px;
}
.plot {
  position: relative;
  height: var(--h);
  margin-left: var(--axis-w);
}
.grid {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.tick {
  position: relative;
  height: 0;
  border-top: 1px solid var(--ch-border-light);
}
.tick:last-child {
  border-top-color: var(--ch-border);
}
.tick span {
  position: absolute;
  right: calc(100% + 8px);
  top: -8px;
  font-size: 11px;
  line-height: 16px;
  color: var(--ch-text-3);
}
.bars {
  position: absolute;
  inset: 0;
  display: flex;
  gap: 12px;
  padding: 0 8px;
}
.slot {
  position: relative;
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  cursor: default;
}
.slot:hover {
  background: var(--ch-fill);
}
.bar {
  width: min(48px, 70%);
  min-height: 2px;
  border-radius: 4px 4px 0 0;
  background: var(--ch-primary);
  transition: height 0.3s;
}
.slot:hover .bar {
  background: var(--el-color-primary-dark-2);
}
.val {
  position: absolute;
  left: 0;
  right: 0;
  margin-bottom: 4px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--ch-text);
}
.labels {
  display: flex;
  gap: 12px;
  margin-left: var(--axis-w);
  padding: 8px 8px 0;
}
.labels span {
  flex: 1;
  text-align: center;
  font-size: 12px;
  color: var(--ch-text-2);
  white-space: nowrap;
}
</style>

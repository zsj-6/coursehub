<script setup lang="ts">
/**
 * 横向百分比条（单系列，0–100%）：每行一个对象，条后面是数值，右侧一列放补充说明。
 * 用于"各活动平均得分率"这类可以直接比长短的数据。
 */
defineProps<{
  rows: { key: string | number; label: string; percent: number | null; note?: string; tip?: string; to?: string }[]
  empty?: string
}>()
</script>

<template>
  <div class="rate-bars">
    <div v-if="!rows.length" class="none">{{ empty || '暂无数据' }}</div>
    <el-tooltip v-for="r in rows" :key="r.key" placement="top" :disabled="!r.tip" :content="r.tip">
      <div class="row">
        <router-link v-if="r.to" :to="r.to" class="label" :title="r.label">{{ r.label }}</router-link>
        <span v-else class="label" :title="r.label">{{ r.label }}</span>
        <div class="track">
          <div v-if="r.percent !== null" class="bar" :style="{ width: `${Math.min(100, r.percent)}%` }" />
        </div>
        <b class="val">{{ r.percent === null ? '—' : `${Math.round(r.percent)}%` }}</b>
        <span class="note">{{ r.note }}</span>
      </div>
    </el-tooltip>
    <div class="axis">
      <span />
      <div class="scale"><span>0</span><span>50%</span><span>100%</span></div>
      <span />
      <span />
    </div>
  </div>
</template>

<style scoped>
.rate-bars {
  --cols: minmax(96px, 180px) 1fr 44px 88px;
}
.row,
.axis {
  display: grid;
  grid-template-columns: var(--cols);
  gap: 12px;
  align-items: center;
}
.row {
  padding: 7px 0;
  border-radius: 4px;
}
.row:hover {
  background: var(--ch-fill);
}
.label {
  font-size: 13px;
  color: var(--ch-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
a.label:hover {
  color: var(--ch-primary-text);
}
.track {
  position: relative;
  height: 10px;
  background-image: linear-gradient(90deg, var(--ch-border-light) 1px, transparent 1px);
  background-size: 50% 100%;
  border-left: 1px solid var(--ch-border);
}
.bar {
  height: 100%;
  min-width: 2px;
  border-radius: 0 4px 4px 0;
  background: var(--ch-primary);
}
.row:hover .bar {
  background: var(--el-color-primary-dark-2);
}
.val {
  font-size: 13px;
  font-weight: 600;
  text-align: right;
}
.note {
  font-size: 12px;
  color: var(--ch-text-3);
  white-space: nowrap;
}
.axis {
  margin-top: 4px;
}
.scale {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--ch-text-3);
}
.none {
  padding: 32px 0;
  text-align: center;
  color: var(--ch-text-3);
  font-size: 13px;
}
@media (max-width: 640px) {
  .rate-bars {
    --cols: 88px 1fr 40px;
  }
  .note,
  .axis span:last-child {
    display: none;
  }
}
</style>

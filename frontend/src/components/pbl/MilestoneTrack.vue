<script setup lang="ts">
import type { Milestone } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { fmt } from '@/utils/format'

defineProps<{ milestones: Milestone[]; compact?: boolean }>()
const store = usePblStore()
</script>

<template>
  <div class="track" :class="{ compact }">
    <div v-for="(m, i) in milestones" :key="m.id" class="stage" :class="store.milestoneState(m)">
      <div class="line" v-if="i > 0" />
      <div class="node">
        <el-icon v-if="store.milestoneState(m) === 'done'"><Check /></el-icon>
        <el-icon v-else-if="store.milestoneState(m) === 'upcoming'"><Lock /></el-icon>
        <span v-else>{{ i + 1 }}</span>
      </div>
      <div class="label">
        <div class="t">关卡 {{ i + 1 }} · {{ m.title }}</div>
        <div v-if="!compact" class="muted">{{ fmt(m.start, 'MM-DD') }} ~ {{ fmt(m.end, 'MM-DD') }}</div>
        <div v-if="!compact && store.milestoneState(m) === 'current'" class="now">进行中</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.track {
  display: flex;
  overflow-x: auto;
  padding: 8px 0 4px;
}
.stage {
  flex: 1;
  min-width: 120px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.line {
  position: absolute;
  top: 13px;
  right: 50%;
  width: 100%;
  height: 2px;
  background: var(--ch-border);
  z-index: 0;
}
.stage.done .line,
.stage.current .line {
  background: var(--ch-primary);
}
.node {
  position: relative;
  z-index: 1;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 600;
  background: #fff;
  color: var(--ch-text-3);
  border: 1px solid var(--ch-border);
}
.stage.done .node {
  background: var(--ch-primary);
  border-color: var(--ch-primary);
  color: #fff;
}
.stage.current .node {
  color: var(--ch-primary-text);
  border-color: var(--ch-primary);
  box-shadow: 0 0 0 3px var(--ch-primary-bg);
}
.label {
  margin-top: 8px;
  padding: 0 6px;
}
.t {
  font-size: 13px;
  font-weight: 600;
}
.stage.upcoming .t {
  color: var(--ch-text-2);
}
.compact .t {
  font-size: 12px;
  font-weight: 500;
}
.now {
  display: inline-block;
  margin-top: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ch-primary-text);
  background: var(--ch-primary-bg);
  border-radius: 4px;
  padding: 0 6px;
}
</style>

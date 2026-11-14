<script setup lang="ts">
import type { ActivityType } from '@/api/types'
import { TYPE_COLOR } from '@/utils/format'

defineProps<{ type: ActivityType; size?: number }>()
const ICON: Record<ActivityType, string> = {
  material: 'Document',
  video: 'VideoPlay',
  homework: 'EditPen',
  exam: 'Tickets',
}
</script>

<template>
  <span class="ai" :style="{ background: TYPE_COLOR[type], width: `${size || 28}px`, height: `${size || 28}px` }">
    <el-icon :size="(size || 28) * 0.55" color="#fff"><component :is="ICON[type]" /></el-icon>
  </span>
</template>

<style scoped>
.ai {
  display: inline-grid;
  place-items: center;
  border-radius: 6px;
  flex-shrink: 0;
}
</style>

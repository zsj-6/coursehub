<script setup lang="ts">
import { computed } from 'vue'
import { usePblStore } from '@/stores/pbl'
import { avatarColor } from '@/utils/pbl'

const props = withDefaults(defineProps<{ id: string; size?: number; showName?: boolean; leader?: boolean }>(), {
  size: 28,
  showName: false,
  leader: false,
})
const store = usePblStore()
const p = computed(() => store.person(props.id))
</script>

<template>
  <span class="pa">
    <el-tooltip :content="p ? `${p.name}${p.major ? ' · ' + p.major : ''}${p.title ? ' · ' + p.title : ''}` : ''" :disabled="showName" placement="top">
      <span class="av" :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.42)}px`, background: avatarColor(id).bg, color: avatarColor(id).fg }">
        {{ p?.name.slice(-2) }}
        <span v-if="leader" class="crown" title="组长">★</span>
      </span>
    </el-tooltip>
    <span v-if="showName" class="nm">{{ p?.name }}</span>
  </span>
</template>

<style scoped>
.pa {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.av {
  position: relative;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  font-weight: 600;
}
.crown {
  position: absolute;
  top: -6px;
  right: -4px;
  color: #e8a317;
  font-size: 12px;
  text-shadow: 0 0 2px #fff;
}
.nm {
  white-space: nowrap;
}
</style>

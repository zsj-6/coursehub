<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { Project } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'

const props = defineProps<{ project: Project }>()
const store = usePblStore()
const saved = computed(() => props.project.interestedIds.includes(store.personaId))

function toggle() {
  store.toggleInterest(props.project)
  ElMessage.success(saved.value ? '已收藏，可在「我的项目 → 我的收藏」查看' : '已取消收藏')
}
</script>

<template>
  <el-button
    v-if="store.isStudent && store.canSee(project)"
    :type="saved ? 'warning' : 'default'"
    :icon="saved ? 'StarFilled' : 'Star'"
    :aria-pressed="saved"
    :title="saved ? '取消收藏' : '收藏项目'"
    @click="toggle"
  >{{ saved ? '已收藏' : '收藏' }}</el-button>
</template>

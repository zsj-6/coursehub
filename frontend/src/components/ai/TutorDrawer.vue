<script setup lang="ts">
/** 右下角 AI 辅学抽屉：带着"你在看什么"的上下文提问 */
import { computed, ref, watch } from 'vue'
import ChatPanel from '@/components/ai/ChatPanel.vue'
import { useAiStore } from '@/stores/ai'

const ai = useAiStore()
const sessionKey = ref(0)
const initial = ref('')
watch(
  () => ai.tutorOpen,
  (open) => {
    if (open) {
      initial.value = ai.tutorPrefill
      ai.tutorPrefill = ''
      sessionKey.value++
    }
  },
)
const ctxLabel = computed(() => {
  const c = ai.tutorCtx
  const parts: string[] = []
  if (c.unitId) parts.push(ai.unit(c.unitId)?.name ?? '')
  if (c.nodeId) parts.push(`知识点：${ai.node(c.nodeId)?.name}`)
  if (c.resId) parts.push(`资料：${ai.resource(c.resId)?.title}`)
  if (c.projectId) parts.push('项目教练')
  return parts.filter(Boolean).join(' · ')
})
</script>

<template>
  <el-drawer v-model="ai.tutorOpen" :size="440" :with-header="false" class="tutor-drawer">
    <div class="wrap">
      <div class="head">
        <b>AI 辅学</b>
        <el-radio-group v-model="ai.tutorMode" size="small">
          <el-radio-button value="chat">答疑</el-radio-button>
          <el-radio-button value="feynman">费曼模式</el-radio-button>
        </el-radio-group>
        <div class="spacer" />
        <el-button text :icon="'Close'" @click="ai.tutorOpen = false" />
      </div>
      <div v-if="ctxLabel" class="ctx"><el-icon><Location /></el-icon>{{ ctxLabel }}</div>
      <ChatPanel :key="`${sessionKey}-${ai.tutorMode}`" :ctx="ai.tutorCtx" :mode="ai.tutorMode" :initial="ai.tutorMode === 'chat' ? initial : ''" class="panel" />
    </div>
  </el-drawer>
</template>

<style scoped>
.wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.head b {
  font-size: 16px;
}
.ctx {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--ch-text-2);
  background: var(--ch-fill);
  border-radius: 4px;
  padding: 4px 8px;
  margin-bottom: 10px;
}
.panel {
  flex: 1;
  min-height: 0;
}
</style>

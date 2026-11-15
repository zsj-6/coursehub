<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import TutorDrawer from '@/components/ai/TutorDrawer.vue'
import PersonAvatar from '@/components/pbl/PersonAvatar.vue'
import { PERSONAS } from '@/mock/pbl'
import { useAiStore } from '@/stores/ai'
import { usePblStore } from '@/stores/pbl'
import { useUserStore } from '@/stores/user'

const pbl = usePblStore()
const ai = useAiStore()
const user = useUserStore()
const route = useRoute()
const router = useRouter()
pbl.ensurePersona(user.user?.role)

const tabs = computed(() => {
  const t = [{ path: '/units', label: '能力成长', icon: 'Aim' }]
  if (!pbl.isStudent) t.push({ path: '/units/desk', label: 'AI 助教', icon: 'Monitor' })
  if (!pbl.isStudent) t.push({ path: '/insight', label: 'AI 办学', icon: 'DataAnalysis' })
  return t
})
const active = computed(() => {
  if (route.path.startsWith('/insight')) return '/insight'
  if (route.path.startsWith('/units/desk')) return '/units/desk'
  return '/units'
})

function switchPersona(id: string) {
  pbl.personaId = id
  const p = PERSONAS.find((x) => x.id === id)
  ElMessage.success(`已切换到「${p?.label}」视角`)
  if (pbl.isStudent && (route.path.startsWith('/units/desk') || route.path.startsWith('/insight'))) router.push('/units')
}
async function reset() {
  await ElMessageBox.confirm('恢复到初始演示数据？作答记录、审核结果等修改会被清掉。', '重置演示数据', { type: 'warning' })
  ai.reset()
  ElMessage.success('已重置')
}
</script>

<template>
  <AppHeader />
  <div class="ai-bar">
    <div class="inner page-container">
      <nav class="tabs">
        <router-link v-for="t in tabs" :key="t.path" :to="t.path" :class="{ on: active === t.path }">
          <el-icon><component :is="t.icon" /></el-icon>{{ t.label }}
        </router-link>
      </nav>
      <div class="spacer" />
      <span class="proto">原型演示 · AI 为预置剧本</span>
      <el-dropdown trigger="click" @command="switchPersona">
        <span class="persona">
          <span class="muted">演示视角</span>
          <PersonAvatar :id="pbl.personaId" :size="24" />
          <b>{{ pbl.me?.name }}</b>
          <el-icon><ArrowDown /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="p in PERSONAS" :key="p.id" :command="p.id" :class="{ cur: p.id === pbl.personaId }">
              <div class="pi">
                <b>{{ p.label }}</b>
              </div>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-tooltip content="重置演示数据"><el-button circle size="small" :icon="'RefreshLeft'" @click="reset" /></el-tooltip>
    </div>
  </div>
  <main class="ai-main page-container">
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" :key="`${route.path}|${pbl.personaId}`" />
      </transition>
    </router-view>
  </main>

  <button v-if="pbl.isStudent && !ai.tutorBlocked && !ai.tutorOpen && route.name !== 'ai-read'" class="tutor-fab" @click="ai.openTutor({})">
    <el-icon><ChatDotRound /></el-icon>
    <span>AI 辅学</span>
  </button>
  <TutorDrawer />
</template>

<style scoped>
.ai-bar {
  background: #fff;
  border-bottom: 1px solid var(--ch-border);
  position: sticky;
  top: var(--ch-header-h);
  z-index: 9;
}
.inner {
  height: 48px;
  display: flex;
  align-items: center;
  gap: 24px;
}
.proto {
  font-size: 12px;
  color: var(--ch-text-3);
  border: 1px solid var(--ch-border);
  border-radius: 4px;
  padding: 0 5px;
  line-height: 18px;
}
.tabs {
  display: flex;
  gap: 4px;
  height: 100%;
  margin-left: -12px;
}
.tabs a {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  color: var(--ch-text-2);
}
.tabs a:hover,
.tabs a.on {
  color: var(--ch-text);
}
.tabs a.on {
  font-weight: 600;
}
.tabs a.on::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: -1px;
  height: 2px;
  background: var(--ch-primary);
}
.persona {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid var(--ch-border);
  color: var(--ch-text);
}
.persona:hover {
  border-color: var(--el-border-color-hover);
}
.persona b {
  font-weight: 500;
}
.persona .el-icon {
  color: var(--ch-text-3);
  font-size: 12px;
}
.pi b {
  font-weight: 500;
}
.cur {
  background: var(--ch-primary-bg);
}
.ai-main {
  padding-top: 24px;
  padding-bottom: 64px;
}
.tutor-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 16px;
  border: none;
  border-radius: 20px;
  background: var(--ch-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(18, 150, 156, 0.3);
}
.tutor-fab:hover {
  background: var(--el-color-primary-dark-2);
}
.page-enter-active,
.page-leave-active {
  transition: opacity 0.12s;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}
@media (max-width: 760px) {
  .inner {
    gap: 8px;
    overflow-x: auto;
  }
  .proto,
  .persona .muted {
    display: none;
  }
}
</style>

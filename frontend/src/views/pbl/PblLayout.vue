<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PersonalLayout from '@/layouts/PersonalLayout.vue'
import PersonAvatar from '@/components/pbl/PersonAvatar.vue'
import { PERSONAS } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { useUserStore } from '@/stores/user'

const store = usePblStore()
const user = useUserStore()
const route = useRoute()
const router = useRouter()
store.ensurePersona(user.user?.role)

const tabs = computed(() => {
  const t = [
    { path: '/pbl', label: '项目大厅', icon: 'Grid' },
    { path: '/pbl/mine', label: store.isStudent ? '我的项目' : '我指导的', icon: 'Flag' },
    { path: '/pbl/showcase', label: '成果展示', icon: 'Trophy' },
  ]
  if (!store.isStudent) t.push({ path: '/pbl/stats', label: '统计看板', icon: 'DataAnalysis' })
  return t
})
const active = computed(() => {
  const hit = tabs.value.slice(1).find((t) => route.path.startsWith(t.path))
  return hit ? hit.path : '/pbl'
})

function switchPersona(id: string) {
  store.personaId = id
  const p = PERSONAS.find((x) => x.id === id)
  ElMessage.success(`已切换到「${p?.label}」视角`)
  // 当前页对新视角不可见时回到大厅
  const pid = route.params.projectId as string | undefined
  if (pid) {
    const proj = store.project(pid)
    if (!proj || !store.canSee(proj)) router.push('/pbl')
  }
  if (route.path.startsWith('/pbl/stats') && store.isStudent) router.push('/pbl')
}
async function reset() {
  await ElMessageBox.confirm('恢复到初始演示数据？你在原型里做的修改会被清掉。', '重置演示数据', { type: 'warning' })
  store.reset()
  ElMessage.success('已重置')
  router.push('/pbl')
}
</script>

<template>
  <PersonalLayout>
    <div class="pbl-bar">
      <div class="inner">
        <div class="brand">
          <el-icon size="20"><Opportunity /></el-icon>
          <b>项目训练</b>
          <el-tag size="small" type="warning" effect="dark" round>原型</el-tag>
        </div>
        <nav class="tabs">
          <router-link v-for="t in tabs" :key="t.path" :to="t.path" :class="{ on: active === t.path }">
            <el-icon><component :is="t.icon" /></el-icon>{{ t.label }}
          </router-link>
        </nav>
        <div class="spacer" />
        <el-dropdown trigger="click" @command="switchPersona">
          <span class="persona">
            <span class="muted">演示视角</span>
            <PersonAvatar :id="store.personaId" :size="24" />
            <b>{{ store.me?.name }}</b>
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="p in PERSONAS" :key="p.id" :command="p.id" :class="{ cur: p.id === store.personaId }">
                <div class="pi">
                  <b>{{ p.label }}</b>
                  <span class="muted">{{ p.desc }}</span>
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-tooltip content="重置演示数据"><el-button circle size="small" :icon="'RefreshLeft'" @click="reset" /></el-tooltip>
      </div>
    </div>
    <main class="pbl-main">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" :key="`${route.path}|${store.personaId}`" />
        </transition>
      </router-view>
    </main>
  </PersonalLayout>
</template>

<style scoped>
.pbl-bar {
  background: #fff;
  border-bottom: 1px solid var(--ch-border);
  position: sticky;
  top: var(--ch-header-h);
  z-index: 9;
}
.inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
  height: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ch-primary);
}
.brand b {
  color: var(--ch-text);
  font-size: 15px;
}
.tabs {
  display: flex;
  gap: 4px;
  height: 100%;
}
.tabs a {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  color: var(--ch-text-2);
  border-bottom: 2px solid transparent;
}
.tabs a.on {
  color: var(--ch-primary);
  border-bottom-color: var(--ch-primary);
  font-weight: 600;
}
.persona {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 16px;
  background: #fff7ea;
  border: 1px solid #f6d7a7;
}
.pi {
  display: flex;
  flex-direction: column;
  line-height: 1.5;
  padding: 2px 0;
}
.cur {
  background: var(--el-color-primary-light-9);
}
.pbl-main {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 0 0;
}
.page-enter-active,
.page-leave-active {
  transition: all 0.18s;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
}
@media (max-width: 760px) {
  .inner {
    padding: 0 16px;
    gap: 8px;
    overflow-x: auto;
  }
  .brand .el-tag,
  .persona .muted {
    display: none;
  }
  .pbl-main {
    padding: 16px;
  }
}
</style>

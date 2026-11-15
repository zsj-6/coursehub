<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { ROLE_LABEL } from '@/utils/format'

const store = useUserStore()
const router = useRouter()

function onCommand(cmd: string) {
  if (cmd === 'logout') {
    store.logout()
    router.push('/login')
  } else {
    router.push(cmd)
  }
}
</script>

<template>
  <header class="app-header">
    <div class="page-container bar">
    <router-link to="/" class="logo">
      <span class="logo-mark">C</span>
      <span>CourseHub</span>
    </router-link>
    <nav class="nav">
      <router-link to="/" exact-active-class="active">首页</router-link>
      <router-link to="/courses" active-class="active">我的课程</router-link>
      <router-link to="/pbl" active-class="active">项目训练</router-link>
      <router-link to="/units" :class="{ active: $route.path.startsWith('/units') || $route.path.startsWith('/insight') }">能力成长</router-link>
      <router-link v-if="store.isAdmin" to="/admin/users" active-class="active">用户管理</router-link>
    </nav>
    <div class="spacer" />
    <el-dropdown v-if="store.user" trigger="click" @command="onCommand">
      <span class="user">
        <el-avatar :size="28" :src="store.user.avatar || undefined">{{ store.user.name.slice(-2) }}</el-avatar>
        <span class="name">{{ store.user.name }}</span>
        <span class="role">{{ ROLE_LABEL[store.user.role] }}</span>
        <el-icon class="caret"><ArrowDown /></el-icon>
      </span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="/profile" :icon="'User'">个人资料</el-dropdown-item>
          <el-dropdown-item command="logout" divided :icon="'SwitchButton'">退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: var(--ch-header-h);
  background: #fff;
  border-bottom: 1px solid var(--ch-border);
  position: sticky;
  top: 0;
  z-index: 10;
}
.bar {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 40px;
}
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ch-text);
}
.logo-mark {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--ch-primary);
  color: #fff;
  font-size: 15px;
  display: grid;
  place-items: center;
}
.nav {
  display: flex;
  gap: 28px;
  height: 100%;
}
.nav a {
  position: relative;
  color: var(--ch-text-2);
  display: flex;
  align-items: center;
  transition: color 0.15s;
}
.nav a:hover {
  color: var(--ch-text);
}
.nav a.active {
  color: var(--ch-text);
  font-weight: 600;
}
.nav a.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--ch-primary);
}
.user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  margin-right: -8px;
  border-radius: 6px;
  color: var(--ch-text);
}
.user:hover {
  background: var(--ch-fill-hover);
}
.name {
  font-weight: 500;
}
.role {
  font-size: 12px;
  color: var(--ch-text-3);
}
.caret {
  color: var(--ch-text-3);
  font-size: 12px;
}
@media (max-width: 640px) {
  .bar {
    gap: 16px;
  }
  .nav {
    gap: 16px;
  }
  .logo > span:last-child,
  .name,
  .role,
  .caret {
    display: none;
  }
}
</style>

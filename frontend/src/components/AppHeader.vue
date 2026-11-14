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
    <router-link to="/" class="logo">
      <span class="logo-mark">C</span>
      <span>CourseHub</span>
    </router-link>
    <nav class="nav">
      <router-link to="/" exact-active-class="active">首页</router-link>
      <router-link to="/courses" active-class="active">我的课程</router-link>
      <router-link to="/pbl" active-class="active">项目训练</router-link>
      <router-link v-if="store.isAdmin" to="/admin/users" active-class="active">用户管理</router-link>
    </nav>
    <div class="spacer" />
    <el-dropdown v-if="store.user" trigger="click" @command="onCommand">
      <span class="user">
        <el-avatar :size="30" :src="store.user.avatar || undefined">{{ store.user.name.slice(-2) }}</el-avatar>
        <span>{{ store.user.name }}</span>
        <el-tag size="small" effect="plain" round>{{ ROLE_LABEL[store.user.role] }}</el-tag>
        <el-icon><ArrowDown /></el-icon>
      </span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="/profile" :icon="'User'">个人资料</el-dropdown-item>
          <el-dropdown-item command="logout" divided :icon="'SwitchButton'">退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </header>
</template>

<style scoped>
.app-header {
  height: var(--ch-header-h);
  background: #fff;
  border-bottom: 1px solid var(--ch-border);
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 10;
}
.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--ch-text);
}
.logo-mark {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--ch-primary);
  color: #fff;
  display: grid;
  place-items: center;
}
.nav {
  display: flex;
  gap: 24px;
  height: 100%;
}
.nav a {
  color: var(--ch-text-2);
  display: flex;
  align-items: center;
  border-bottom: 2px solid transparent;
}
.nav a.active {
  color: var(--ch-primary);
  border-bottom-color: var(--ch-primary);
  font-weight: 600;
}
.user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
@media (max-width: 640px) {
  .app-header {
    gap: 12px;
    padding: 0 16px;
  }
  .user > span:not(.el-avatar),
  .user .el-tag {
    display: none;
  }
}
</style>

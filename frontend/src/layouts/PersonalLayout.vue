<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import { useUserStore } from '@/stores/user'
import { ROLE_LABEL } from '@/utils/format'

defineProps<{ demoProfile?: { name: string; role: string } }>()

const user = useUserStore()
</script>

<template>
  <AppHeader sidebar-navigation :show-account-label="!!demoProfile" />
  <div class="personal-layout">
    <aside class="personal-sidebar" aria-label="个人导航">
      <div class="identity">
        <el-avatar :size="88" :src="demoProfile ? undefined : user.user?.avatar || undefined" class="portrait">
          <el-icon :size="60"><UserFilled /></el-icon>
        </el-avatar>
        <div class="name">{{ demoProfile?.name ?? user.user?.name }}</div>
        <div class="role">
          {{ demoProfile ? `${demoProfile.role} · 演示身份` : ROLE_LABEL[user.user?.role || 'student'] }}
        </div>
      </div>
      <nav class="navigation" aria-label="个人空间">
        <div class="group-label">{{ user.canCreateCourse ? '我的教学' : '我的学习' }}</div>
        <router-link to="/" exact-active-class="selected"><el-icon><House /></el-icon>首页</router-link>
        <router-link to="/courses" active-class="selected"><el-icon><Reading /></el-icon>我的课程</router-link>
        <router-link to="/pbl" active-class="selected"><el-icon><Opportunity /></el-icon>项目训练</router-link>
        <div class="group-label account-label">个人设置</div>
        <router-link to="/profile" active-class="selected"><el-icon><User /></el-icon>个人资料</router-link>
        <router-link v-if="user.isAdmin" to="/admin/users" active-class="selected"><el-icon><UserFilled /></el-icon>用户管理</router-link>
      </nav>
    </aside>
    <div class="personal-content"><slot /></div>
  </div>
</template>

<style scoped>
.personal-layout {
  max-width: 1600px;
  margin: 0 auto;
  padding: 24px 32px 40px;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.personal-sidebar {
  background: #fff;
  border: 1px solid var(--ch-border);
  position: sticky;
  top: calc(var(--ch-header-h) + 24px);
  min-height: calc(100vh - var(--ch-header-h) - 64px);
  max-height: calc(100vh - var(--ch-header-h) - 48px);
  overflow-y: auto;
}
.identity {
  padding: 28px 20px 24px;
  text-align: center;
  border-bottom: 1px solid var(--ch-border);
}
.portrait {
  background: #fff;
  color: #1bb7c2;
  border: 2px solid #1bb7c2;
}
.name {
  font-size: 19px;
  margin: 14px 0 8px;
  overflow-wrap: anywhere;
}
.role, .group-label {
  color: var(--ch-text-2);
  font-size: 14px;
}
.navigation {
  padding: 24px 18px;
}
.group-label {
  padding: 0 12px;
  margin-bottom: 14px;
}
.account-label {
  margin-top: 32px;
}
.navigation a {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 10px 16px;
  margin-bottom: 10px;
  border-radius: 24px;
  color: #66737d;
  font-size: 17px;
  transition: background-color 0.15s, color 0.15s;
}
.navigation .el-icon {
  font-size: 21px;
  color: #9aa5ad;
}
.navigation a:hover {
  background: #edf8f8;
  color: #147e85;
}
.navigation a.selected {
  background: #1bb7c2;
  color: #fff;
}
.navigation a.selected .el-icon {
  color: #fff;
}
.navigation a:focus-visible {
  outline: 2px solid #147e85;
  outline-offset: 3px;
}
.personal-content {
  min-width: 0;
}
@media (max-width: 999px) {
  .personal-layout {
    display: block;
    padding: 20px 24px 40px;
  }
  .personal-sidebar {
    display: none;
  }
}
</style>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const router = useRouter()
const route = useRoute()
const form = reactive({ username: '', password: '' })
const loading = ref(false)

async function submit() {
  if (!form.username || !form.password) return
  loading.value = true
  try {
    await store.login(form.username.trim(), form.password)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect.startsWith('/') ? redirect : '/')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="panel">
      <div class="brand">
        <span class="logo-mark">C</span>
        <div>
          <h1>CourseHub</h1>
          <p class="muted">混合式教学课程平台</p>
        </div>
      </div>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="账号">
          <el-input v-model="form.username" placeholder="请输入账号" size="large" autofocus />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" size="large" show-password />
        </el-form-item>
        <el-button type="primary" size="large" native-type="submit" :loading="loading" style="width: 100%">
          登录
        </el-button>
      </el-form>
      <p class="muted hint">演示账号：teacher1 / 123456，student2 / 123456，admin / admin123</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: 16px;
  background: linear-gradient(135deg, #e6f6f7 0%, #f4f6f8 60%);
}
.panel {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);
}
.brand {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 24px;
}
.brand h1 {
  margin: 0;
  font-size: 22px;
}
.brand p {
  margin: 2px 0 0;
}
.logo-mark {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--ch-primary);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 22px;
  font-weight: 700;
}
.hint {
  margin-top: 16px;
  text-align: center;
}
</style>

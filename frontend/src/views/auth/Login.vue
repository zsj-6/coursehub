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
        <span>CourseHub</span>
      </div>
      <h1>登录</h1>
      <p class="muted sub">课程、作业、测试、成绩，在一个地方完成</p>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="账号">
          <el-input v-model="form.username" placeholder="请输入账号" size="large" autofocus />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" size="large" show-password />
        </el-form-item>
        <el-button type="primary" size="large" native-type="submit" :loading="loading" class="submit">登录</el-button>
      </el-form>
      <div class="hint">
        <div class="hint-title">演示账号</div>
        <dl>
          <div><dt>教师</dt><dd>teacher1 / 123456</dd></div>
          <div><dt>学生</dt><dd>student2 / 123456</dd></div>
          <div><dt>管理员</dt><dd>admin / admin123</dd></div>
        </dl>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: 24px 16px;
  background: var(--ch-bg);
}
.panel {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border: 1px solid var(--ch-border);
  border-radius: 12px;
  padding: 36px 36px 28px;
}
.brand {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 28px;
}
.logo-mark {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--ch-primary);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 16px;
}
h1 {
  margin: 0;
  font-size: 24px;
  line-height: 32px;
  letter-spacing: -0.01em;
}
.sub {
  margin: 4px 0 24px;
}
.submit {
  width: 100%;
  margin-top: 4px;
}
.hint {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--ch-border-light);
  font-size: 13px;
}
.hint-title {
  color: var(--ch-text-3);
  margin-bottom: 6px;
}
.hint dl {
  margin: 0;
  display: grid;
  gap: 2px;
}
.hint dl div {
  display: flex;
  justify-content: space-between;
}
.hint dt {
  color: var(--ch-text-2);
}
.hint dd {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--ch-text);
}
</style>

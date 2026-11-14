<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { reactive, ref } from 'vue'
import { authApi } from '@/api/auth'
import { filesApi } from '@/api/files'
import { useUserStore } from '@/stores/user'
import { ROLE_LABEL } from '@/utils/format'

const store = useUserStore()
const name = ref(store.user?.name || '')
const saving = ref(false)
const avatarInput = ref<HTMLInputElement>()

async function saveName() {
  if (!name.value.trim()) return ElMessage.warning('姓名不能为空')
  saving.value = true
  try {
    store.user = await authApi.updateMe({ name: name.value.trim() })
    ElMessage.success('已保存')
  } finally {
    saving.value = false
  }
}

async function onAvatar(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  if (!f.type.startsWith('image/')) return ElMessage.warning('请选择图片')
  const info = await filesApi.upload(f)
  store.user = await authApi.updateMe({ avatar: info.url })
  ElMessage.success('头像已更新')
}

const pw = reactive({ old: '', next: '', confirm: '' })
const changing = ref(false)
async function changePassword() {
  if (pw.next.length < 6) return ElMessage.warning('新密码至少 6 位')
  if (pw.next !== pw.confirm) return ElMessage.warning('两次输入的新密码不一致')
  changing.value = true
  try {
    await authApi.changePassword(pw.old, pw.next)
    ElMessage.success('密码已修改')
    Object.assign(pw, { old: '', next: '', confirm: '' })
  } finally {
    changing.value = false
  }
}
</script>

<template>
  <div v-if="store.user" class="wrap">
    <div class="page-title">个人资料</div>
    <section class="card">
      <div class="flex" style="gap: 20px">
        <el-avatar :size="80" :src="store.user.avatar || undefined">{{ store.user.name.slice(-2) }}</el-avatar>
        <div>
          <input ref="avatarInput" type="file" accept="image/*" hidden @change="onAvatar" />
          <el-button size="small" @click="avatarInput?.click()">更换头像</el-button>
          <div class="muted" style="margin-top: 8px">
            账号 {{ store.user.username }} · {{ ROLE_LABEL[store.user.role] }}
            <template v-if="store.user.student_no"> · 学号 {{ store.user.student_no }}</template>
          </div>
        </div>
      </div>
      <el-form label-width="80px" style="margin-top: 20px; max-width: 420px">
        <el-form-item label="姓名">
          <el-input v-model="name" maxlength="64">
            <template #append><el-button :loading="saving" @click="saveName">保存</el-button></template>
          </el-input>
        </el-form-item>
      </el-form>
    </section>
    <section class="card" style="margin-top: 16px">
      <h3 style="margin-top: 0">修改密码</h3>
      <el-form label-width="80px" style="max-width: 420px" @submit.prevent="changePassword">
        <el-form-item label="原密码"><el-input v-model="pw.old" type="password" show-password /></el-form-item>
        <el-form-item label="新密码"><el-input v-model="pw.next" type="password" show-password /></el-form-item>
        <el-form-item label="确认密码"><el-input v-model="pw.confirm" type="password" show-password /></el-form-item>
        <el-form-item><el-button type="primary" native-type="submit" :loading="changing">修改密码</el-button></el-form-item>
      </el-form>
    </section>
  </div>
</template>

<style scoped>
.wrap {
  max-width: 720px;
}
</style>

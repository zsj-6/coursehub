<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import { adminApi } from '@/api/admin'
import type { Role, User } from '@/api/types'
import { useUserStore } from '@/stores/user'
import { ROLE_LABEL } from '@/utils/format'

const me = useUserStore()
const items = ref<User[]>([])
const total = ref(0)
const loading = ref(false)
const query = reactive({ q: '', role: '', page: 1, size: 20 })

async function load() {
  loading.value = true
  try {
    const res = await adminApi.users({ ...query, q: query.q || undefined, role: query.role || undefined })
    items.value = res.items
    total.value = res.total
  } finally {
    loading.value = false
  }
}
onMounted(load)

// 新建 / 编辑
const dialog = ref(false)
const editing = ref<User | null>(null)
const form = reactive({ username: '', name: '', role: 'student' as Role, student_no: '', password: '' })
function openCreate() {
  editing.value = null
  Object.assign(form, { username: '', name: '', role: 'student', student_no: '', password: '123456' })
  dialog.value = true
}
function openEdit(u: User) {
  editing.value = u
  Object.assign(form, { username: u.username, name: u.name, role: u.role, student_no: u.student_no || '', password: '' })
  dialog.value = true
}
async function save() {
  if (!form.name.trim() || (!editing.value && !form.username.trim())) return ElMessage.warning('请填写账号和姓名')
  if (editing.value) {
    await adminApi.updateUser(editing.value.id, {
      name: form.name.trim(),
      role: form.role,
      student_no: form.student_no || null,
      ...(form.password ? { password: form.password } : {}),
    })
  } else {
    await adminApi.createUser({
      username: form.username.trim(),
      name: form.name.trim(),
      role: form.role,
      student_no: form.student_no || null,
      password: form.password || '123456',
    })
  }
  ElMessage.success('已保存')
  dialog.value = false
  load()
}

async function remove(u: User) {
  await ElMessageBox.confirm(`删除用户「${u.name}」后，其提交记录也会一起删除，且不能恢复。确定删除吗？`, '删除用户', {
    type: 'warning',
    confirmButtonText: '删除',
  })
  await adminApi.deleteUser(u.id)
  ElMessage.success('已删除')
  load()
}

// CSV 导入
const csvInput = ref<HTMLInputElement>()
async function onCsv(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  const res = await adminApi.importUsers(f)
  const lines = [`新建 ${res.created} 个用户`]
  if (res.skipped.length) lines.push(`已存在跳过 ${res.skipped.length} 个：${res.skipped.slice(0, 10).join('、')}`)
  if (res.errors.length) lines.push(...res.errors.slice(0, 10))
  ElMessageBox.alert(lines.join('<br>'), '导入结果', { dangerouslyUseHTMLString: true })
  load()
}
</script>

<template>
  <div>
    <div class="page-title">
      <span>用户管理</span>
      <div class="flex">
        <input ref="csvInput" type="file" accept=".csv" hidden @change="onCsv" />
        <el-tooltip content="CSV 表头：username,name,role,student_no,password（后三列可省略）">
          <el-button @click="csvInput?.click()"><el-icon><Upload /></el-icon>&nbsp;CSV 导入</el-button>
        </el-tooltip>
        <el-button type="primary" @click="openCreate"><el-icon><Plus /></el-icon>&nbsp;新建用户</el-button>
      </div>
    </div>
    <section class="card">
      <div class="flex" style="margin-bottom: 12px">
        <el-input v-model="query.q" placeholder="账号 / 姓名 / 学号" clearable style="width: 240px" @change="(query.page = 1), load()" />
        <el-select v-model="query.role" placeholder="全部角色" clearable style="width: 140px" @change="(query.page = 1), load()">
          <el-option v-for="r in ['admin', 'teacher', 'student'] as Role[]" :key="r" :label="ROLE_LABEL[r]" :value="r" />
        </el-select>
        <span class="spacer" />
        <span class="muted">共 {{ total }} 人</span>
      </div>
      <el-table v-loading="loading" :data="items" stripe>
        <el-table-column prop="username" label="账号" min-width="120" />
        <el-table-column prop="name" label="姓名" min-width="100" />
        <el-table-column prop="student_no" label="学号" min-width="110" />
        <el-table-column label="角色" width="100">
          <template #default="{ row }"><el-tag size="small" effect="plain">{{ ROLE_LABEL[row.role as Role] }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row as User)">编辑</el-button>
            <el-button link type="danger" :disabled="row.id === me.user?.id" @click="remove(row as User)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="query.page"
        :page-size="query.size"
        :total="total"
        layout="prev, pager, next"
        style="margin-top: 12px; justify-content: flex-end"
        @current-change="load"
      />
    </section>

    <el-dialog v-model="dialog" :title="editing ? '编辑用户' : '新建用户'" width="440px">
      <el-form label-width="70px">
        <el-form-item label="账号" required><el-input v-model="form.username" :disabled="!!editing" /></el-form-item>
        <el-form-item label="姓名" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="角色">
          <el-radio-group v-model="form.role">
            <el-radio-button v-for="r in ['student', 'teacher', 'admin'] as Role[]" :key="r" :value="r">{{ ROLE_LABEL[r] }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="学号"><el-input v-model="form.student_no" /></el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" :placeholder="editing ? '不修改请留空' : '默认 123456'" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

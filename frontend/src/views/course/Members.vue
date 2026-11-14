<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { coursesApi } from '@/api/courses'
import type { MemberRole, UserBrief } from '@/api/types'
import { useCourseStore } from '@/stores/course'
import { useUserStore } from '@/stores/user'
import { ROLE_LABEL, fmt } from '@/utils/format'

const cs = useCourseStore()
const me = useUserStore()
const members = ref<{ role: MemberRole; joined_at: string; user: UserBrief }[]>([])
const loading = ref(false)
const roleFilter = ref<'' | MemberRole>('')

async function load() {
  loading.value = true
  try {
    members.value = await coursesApi.members(cs.course!.id)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const filtered = computed(() => members.value.filter((m) => !roleFilter.value || m.role === roleFilter.value))
const count = (r: MemberRole) => members.value.filter((m) => m.role === r).length

// 添加成员
const addVisible = ref(false)
const addText = ref('')
const addRole = ref<MemberRole>('student')
async function add() {
  const usernames = addText.value.split(/[\s,，;；]+/).filter(Boolean)
  if (!usernames.length) return ElMessage.warning('请输入账号')
  const res = await coursesApi.addMembers(cs.course!.id, usernames, addRole.value)
  const parts = [`成功添加 ${res.added.length} 人`]
  if (res.existed.length) parts.push(`已在课程中：${res.existed.join('、')}`)
  if (res.not_found.length) parts.push(`账号不存在：${res.not_found.join('、')}`)
  ElMessageBox.alert(parts.join('<br>'), '添加结果', { dangerouslyUseHTMLString: true })
  addVisible.value = false
  addText.value = ''
  load()
}

async function changeRole(userId: number, role: MemberRole) {
  await coursesApi.setMemberRole(cs.course!.id, userId, role)
  ElMessage.success('已修改')
  load()
}

async function remove(m: { user: UserBrief; role: MemberRole }) {
  await ElMessageBox.confirm(`将「${m.user.name}」移出课程？该学生的提交记录会保留，重新加入后可以看到。`, '移除成员', {
    type: 'warning',
    confirmButtonText: '移除',
  })
  await coursesApi.removeMember(cs.course!.id, m.user.id)
  ElMessage.success('已移除')
  load()
}
</script>

<template>
  <div>
    <div class="page-title">
      <span>成员</span>
      <div class="flex">
        <span class="muted">访问码 <b>{{ cs.course?.code }}</b>，学生可凭此码加入</span>
        <el-button v-if="cs.isManager" type="primary" @click="addVisible = true"><el-icon><Plus /></el-icon>&nbsp;添加成员</el-button>
      </div>
    </div>
    <section class="card">
      <el-radio-group v-model="roleFilter" size="small" style="margin-bottom: 12px">
        <el-radio-button value="">全部 {{ members.length }}</el-radio-button>
        <el-radio-button value="teacher">教师 {{ count('teacher') }}</el-radio-button>
        <el-radio-button value="ta">助教 {{ count('ta') }}</el-radio-button>
        <el-radio-button value="student">学生 {{ count('student') }}</el-radio-button>
      </el-radio-group>
      <el-table v-loading="loading" :data="filtered" stripe size="small">
        <el-table-column label="姓名" min-width="140">
          <template #default="{ row }">
            <div class="flex">
              <el-avatar :size="26" :src="row.user.avatar || undefined">{{ row.user.name.slice(-1) }}</el-avatar>
              {{ row.user.name }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="账号" min-width="110"><template #default="{ row }">{{ row.user.username }}</template></el-table-column>
        <el-table-column label="学号" min-width="110"><template #default="{ row }">{{ row.user.student_no || '—' }}</template></el-table-column>
        <el-table-column label="角色" width="140">
          <template #default="{ row }">
            <el-select
              v-if="cs.isManager && row.user.id !== me.user?.id"
              :model-value="row.role"
              size="small"
              @change="(r: MemberRole) => changeRole(row.user.id, r)"
            >
              <el-option v-for="r in ['teacher', 'ta', 'student'] as MemberRole[]" :key="r" :label="ROLE_LABEL[r]" :value="r" />
            </el-select>
            <el-tag v-else size="small" effect="plain">{{ ROLE_LABEL[row.role as MemberRole] }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="加入时间" width="150"><template #default="{ row }">{{ fmt(row.joined_at) }}</template></el-table-column>
        <el-table-column v-if="cs.isManager" label="" width="70">
          <template #default="{ row }">
            <el-button v-if="row.user.id !== me.user?.id" link type="danger" @click="remove(row as any)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="addVisible" title="添加成员" width="460px">
      <el-form label-width="60px">
        <el-form-item label="账号">
          <el-input v-model="addText" type="textarea" :rows="5" placeholder="输入用户账号，多个账号用空格、逗号或换行分隔" />
        </el-form-item>
        <el-form-item label="角色">
          <el-radio-group v-model="addRole">
            <el-radio-button v-for="r in ['student', 'ta', 'teacher'] as MemberRole[]" :key="r" :value="r">{{ ROLE_LABEL[r] }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" @click="add">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

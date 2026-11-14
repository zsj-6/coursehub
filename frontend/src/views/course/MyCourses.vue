<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { coursesApi } from '@/api/courses'
import type { Course } from '@/api/types'
import { useUserStore } from '@/stores/user'
import { ROLE_LABEL, coverStyle } from '@/utils/format'

const store = useUserStore()
const router = useRouter()
const courses = ref<Course[]>([])
const loading = ref(false)
const q = ref('')
const archived = ref(false)

async function load() {
  loading.value = true
  try {
    courses.value = await coursesApi.list({ q: q.value || undefined, archived: archived.value })
  } finally {
    loading.value = false
  }
}
onMounted(load)

// 新建课程
const createVisible = ref(false)
const createForm = reactive({ name: '', semester: '', description: '' })
const creating = ref(false)
async function create() {
  if (!createForm.name.trim()) return ElMessage.warning('请输入课程名称')
  creating.value = true
  try {
    const c = await coursesApi.create({ ...createForm, name: createForm.name.trim() })
    ElMessage.success('开课成功')
    createVisible.value = false
    router.push(`/courses/${c.id}`)
  } finally {
    creating.value = false
  }
}

// 加入课程
const joinVisible = ref(false)
const joinCode = ref('')
const joining = ref(false)
async function join() {
  const code = joinCode.value.trim().toUpperCase()
  if (code.length !== 6) return ElMessage.warning('访问码是 6 位')
  joining.value = true
  try {
    const c = await coursesApi.join(code)
    ElMessage.success(`已加入「${c.name}」`)
    joinVisible.value = false
    router.push(`/courses/${c.id}`)
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <div>
    <div class="page-title">
      <span>我的课程</span>
      <div class="flex">
        <el-input v-model="q" placeholder="课程名称或访问码" clearable style="width: 220px" @change="load">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-switch v-model="archived" active-text="已归档" @change="load" />
        <el-button @click="joinVisible = true"><el-icon><Key /></el-icon>&nbsp;访问码加入</el-button>
        <el-button v-if="store.canCreateCourse" type="primary" @click="createVisible = true">
          <el-icon><Plus /></el-icon>&nbsp;新建课程
        </el-button>
      </div>
    </div>

    <div v-loading="loading" class="grid">
      <router-link v-for="c in courses" :key="c.id" :to="`/courses/${c.id}`" class="course-card">
        <div class="cover" :style="coverStyle(c.id, c.cover)">
          <el-tag size="small" effect="dark" class="role">{{ ROLE_LABEL[c.my_role || 'student'] }}</el-tag>
        </div>
        <div class="body">
          <div class="name">{{ c.name }}</div>
          <div class="muted">{{ c.owner?.name || '—' }} · {{ c.semester || '未设置学期' }}</div>
          <div class="muted foot">
            <span><el-icon><User /></el-icon> {{ c.student_count ?? 0 }} 名学生</span>
            <span>访问码 {{ c.code }}</span>
          </div>
        </div>
      </router-link>
      <div v-if="!loading && !courses.length" class="empty-tip card" style="grid-column: 1 / -1">
        {{ q ? '没有找到匹配的课程' : archived ? '没有已归档的课程' : '还没有课程，可以用访问码加入，或者新建一门课程' }}
      </div>
    </div>

    <el-dialog v-model="createVisible" title="新建课程" width="460px">
      <el-form label-width="80px" @submit.prevent="create">
        <el-form-item label="课程名称" required><el-input v-model="createForm.name" maxlength="128" /></el-form-item>
        <el-form-item label="学期"><el-input v-model="createForm.semester" placeholder="如 2025-2026 第一学期" /></el-form-item>
        <el-form-item label="简介"><el-input v-model="createForm.description" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="create">开课</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="joinVisible" title="用访问码加入课程" width="400px">
      <el-input v-model="joinCode" placeholder="请输入 6 位访问码" maxlength="6" size="large" @keyup.enter="join" />
      <template #footer>
        <el-button @click="joinVisible = false">取消</el-button>
        <el-button type="primary" :loading="joining" @click="join">加入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  min-height: 120px;
}
.course-card {
  background: #fff;
  border: 1px solid var(--ch-border);
  border-radius: 8px;
  overflow: hidden;
  color: inherit;
  transition: box-shadow 0.2s, transform 0.2s;
}
.course-card:hover {
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}
.cover {
  height: 110px;
  position: relative;
}
.role {
  position: absolute;
  top: 10px;
  right: 10px;
}
.body {
  padding: 12px 14px;
}
.name {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 4px;
}
.foot {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
}
.foot span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
@media (max-width: 640px) {
  .page-title {
    flex-direction: column;
    align-items: flex-start;
  }
  .page-title .flex {
    flex-wrap: wrap;
  }
}
</style>

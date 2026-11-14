<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { coursesApi } from '@/api/courses'
import { filesApi } from '@/api/files'
import { useCourseStore } from '@/stores/course'
import { useUserStore } from '@/stores/user'
import { coverStyle } from '@/utils/format'

const cs = useCourseStore()
const me = useUserStore()
const router = useRouter()
const c = cs.course!
const form = reactive({ name: c.name, semester: c.semester, description: c.description, cover: c.cover })
const saving = ref(false)
const coverInput = ref<HTMLInputElement>()

async function save() {
  if (!form.name.trim()) return ElMessage.warning('课程名称不能为空')
  saving.value = true
  try {
    cs.course = { ...cs.course!, ...(await coursesApi.update(c.id, { ...form, name: form.name.trim() })), my_role: cs.role }
    ElMessage.success('已保存')
  } finally {
    saving.value = false
  }
}

async function onCover(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  if (!f.type.startsWith('image/')) return ElMessage.warning('请选择图片')
  form.cover = (await filesApi.upload(f)).url
}

async function regenerate() {
  await ElMessageBox.confirm('重新生成后，旧的访问码立即失效。', '重新生成访问码', { type: 'warning' })
  const { code } = await coursesApi.regenerateCode(c.id)
  cs.course = { ...cs.course!, code }
  ElMessage.success(`新的访问码：${code}`)
}

async function toggleArchive() {
  const archived = !cs.course!.archived
  await ElMessageBox.confirm(
    archived ? '归档后课程不再出现在「我的课程」默认列表中，学生也不能再用访问码加入。' : '恢复后课程重新出现在课程列表中。',
    archived ? '归档课程' : '取消归档',
  )
  await coursesApi.update(c.id, { archived })
  cs.course = { ...cs.course!, archived }
  ElMessage.success(archived ? '已归档' : '已恢复')
}

async function remove() {
  const { value } = await ElMessageBox.prompt(
    `删除后课程的所有内容、提交和成绩都会被永久删除，不能恢复。请输入课程名称「${c.name}」确认。`,
    '删除课程',
    { type: 'error', confirmButtonText: '永久删除', confirmButtonClass: 'el-button--danger' },
  )
  if (value !== c.name) return ElMessage.error('课程名称不一致，未删除')
  await coursesApi.remove(c.id)
  ElMessage.success('课程已删除')
  router.replace('/courses')
}
</script>

<template>
  <div>
    <div class="page-title">课程设置</div>
    <section class="card">
      <el-form label-width="90px" style="max-width: 560px">
        <el-form-item label="封面">
          <div class="cover" :style="coverStyle(c.id, form.cover)" />
          <input ref="coverInput" type="file" accept="image/*" hidden @change="onCover" />
          <div class="flex" style="margin-left: 12px">
            <el-button size="small" @click="coverInput?.click()">上传封面</el-button>
            <el-button v-if="form.cover" size="small" link @click="form.cover = null">使用默认</el-button>
          </div>
        </el-form-item>
        <el-form-item label="课程名称" required><el-input v-model="form.name" maxlength="128" /></el-form-item>
        <el-form-item label="学期"><el-input v-model="form.semester" /></el-form-item>
        <el-form-item label="简介"><el-input v-model="form.description" type="textarea" :rows="4" /></el-form-item>
        <el-form-item><el-button type="primary" :loading="saving" @click="save">保存</el-button></el-form-item>
      </el-form>
    </section>

    <section class="card" style="margin-top: 16px">
      <h3 style="margin-top: 0">访问码</h3>
      <div class="flex">
        <span class="code">{{ cs.course?.code }}</span>
        <el-button size="small" @click="regenerate">重新生成</el-button>
      </div>
    </section>

    <section class="card danger" style="margin-top: 16px">
      <h3 style="margin-top: 0">危险操作</h3>
      <div class="flex">
        <el-button @click="toggleArchive">{{ cs.course?.archived ? '取消归档' : '归档课程' }}</el-button>
        <el-button v-if="me.isAdmin || c.owner?.id === me.user?.id" type="danger" plain @click="remove">删除课程</el-button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cover {
  width: 160px;
  height: 90px;
  border-radius: 6px;
}
.code {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 4px;
  margin-right: 12px;
}
.danger {
  border-color: var(--el-color-danger-light-5);
}
</style>

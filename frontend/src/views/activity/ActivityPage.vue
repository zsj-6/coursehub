<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { activitiesApi } from '@/api/activities'
import { coursesApi } from '@/api/courses'
import type { Activity } from '@/api/types'
import ActivityFormDialog from '@/components/ActivityFormDialog.vue'
import ActivityIcon from '@/components/ActivityIcon.vue'
import FilePreview from '@/components/FilePreview.vue'
import PublishDialog from '@/components/PublishDialog.vue'
import { useCourseStore } from '@/stores/course'
import { TYPE_LABEL, fmt, publishState } from '@/utils/format'
import ExamPanel from './ExamPanel.vue'
import HomeworkPanel from './HomeworkPanel.vue'
import VideoPlayer from './VideoPlayer.vue'

const props = defineProps<{ activityId: number }>()
const cs = useCourseStore()
const act = ref<Activity | null>(null)
const error = ref('')
const role = computed(() => act.value?.my_role || cs.role || 'student')
const isStudent = computed(() => role.value === 'student')

async function load() {
  try {
    act.value = await activitiesApi.get(props.activityId)
    if (isStudent.value && act.value.type === 'material' && !act.value.progress?.completed) {
      activitiesApi.progress(act.value.id, { completed: true }).catch(() => null)
    }
  } catch (e: any) {
    error.value = e?.response?.data?.detail || '加载失败'
  }
}
onMounted(load)

// 编辑 / 发布
const formVisible = ref(false)
const chapters = ref<{ id: number; label: string }[]>([])
async function openEdit() {
  const tree = await coursesApi.outline(cs.course!.id)
  chapters.value = tree.flatMap((c) => [
    { id: c.id, label: c.title },
    ...(c.units || []).map((u) => ({ id: u.id, label: `　${c.title} / ${u.title}` })),
  ])
  formVisible.value = true
}
const publishVisible = ref(false)
async function unpublish() {
  await activitiesApi.batchPublish(cs.course!.id, { ids: [props.activityId], publish: false })
  ElMessage.success('已取消发布')
  load()
}
</script>

<template>
  <el-result v-if="error" icon="warning" :title="error">
    <template #extra><el-button @click="$router.push(`/courses/${cs.course?.id}`)">返回课程内容</el-button></template>
  </el-result>
  <div v-else-if="act">
    <el-breadcrumb separator="/" style="margin-bottom: 12px">
      <el-breadcrumb-item :to="`/courses/${act.course_id}`">课程内容</el-breadcrumb-item>
      <el-breadcrumb-item>{{ act.title }}</el-breadcrumb-item>
    </el-breadcrumb>

    <section class="card head">
      <ActivityIcon :type="act.type" :size="40" />
      <div class="head-main">
        <div class="title">{{ act.title }}</div>
        <div class="muted meta">
          <span>{{ TYPE_LABEL[act.type] }}</span>
          <span v-if="act.type === 'homework'">截止 {{ act.due_at ? fmt(act.due_at) : '不限' }}</span>
          <span v-if="act.type === 'homework' || act.type === 'exam'">满分 {{ act.full_score }} · 占总评 {{ act.score_ratio }}%</span>
          <span v-if="act.open_at || act.close_at">开放 {{ fmt(act.open_at) }} ~ {{ fmt(act.close_at) }}</span>
          <el-tag v-if="!isStudent" size="small" :type="publishState(act).type">{{ publishState(act).text }}</el-tag>
          <el-tag v-if="isStudent && act.progress?.completed" size="small" type="success">已完成</el-tag>
        </div>
      </div>
      <div v-if="cs.isManager" class="flex">
        <el-button @click="openEdit"><el-icon><Edit /></el-icon>&nbsp;编辑</el-button>
        <el-button v-if="!act.is_published" type="primary" @click="publishVisible = true">发布</el-button>
        <el-button v-else @click="unpublish">取消发布</el-button>
      </div>
    </section>

    <section v-if="act.description" class="card desc rich-text">{{ act.description }}</section>

    <section v-if="act.type === 'material'" class="card body">
      <FilePreview :files="act.files || []" :allow-download="!isStudent || act.settings.allow_download !== false" />
    </section>
    <section v-else-if="act.type === 'video'" class="card body">
      <VideoPlayer :activity="act" :report="isStudent" @completed="act.progress = { ...(act.progress || { watched_seconds: 0, last_pos: 0 }), completed: true }" />
    </section>
    <HomeworkPanel v-else-if="act.type === 'homework'" :activity="act" :role="role" />
    <ExamPanel v-else-if="act.type === 'exam'" :activity="act" :role="role" />

    <ActivityFormDialog
      v-if="cs.isManager"
      v-model="formVisible"
      :course-id="act.course_id"
      :chapters="chapters"
      :activity="act"
      @saved="load"
    />
    <PublishDialog v-if="cs.isManager" v-model="publishVisible" :course-id="act.course_id" :ids="[act.id]" @done="load" />
  </div>
  <div v-else v-loading="true" style="height: 300px" />
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 16px;
}
.head-main {
  flex: 1;
  min-width: 0;
}
.title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 6px;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
}
.desc,
.body {
  margin-top: 16px;
}
@media (max-width: 640px) {
  .head {
    flex-wrap: wrap;
  }
}
</style>

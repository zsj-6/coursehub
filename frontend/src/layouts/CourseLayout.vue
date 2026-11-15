<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { useCourseStore } from '@/stores/course'
import { ROLE_LABEL, coverStyle } from '@/utils/format'

const props = defineProps<{ courseId: number }>()
const store = useCourseStore()
const route = useRoute()
const error = ref('')

watch(
  () => props.courseId,
  async (id) => {
    error.value = ''
    try {
      await store.load(id)
    } catch (e: any) {
      error.value = e?.response?.data?.detail || '课程加载失败'
    }
  },
  { immediate: true },
)

const menu = computed(() => {
  const base = `/courses/${props.courseId}`
  const items = [
    { path: base, label: '课程内容', icon: 'Reading' },
    { path: `${base}/announcements`, label: '公告', icon: 'Bell' },
    { path: `${base}/homework`, label: '作业', icon: 'EditPen' },
    { path: `${base}/exams`, label: '测试', icon: 'Document' },
    { path: `${base}/grades`, label: '成绩', icon: 'TrendCharts' },
    { path: `${base}/members`, label: '成员', icon: 'User' },
  ]
  if (store.canGrade) items.push({ path: `${base}/analytics`, label: '学习分析', icon: 'DataAnalysis' })
  if (store.isManager) items.push({ path: `${base}/settings`, label: '课程设置', icon: 'Setting' })
  return items
})

// 活动详情页等子页面也高亮“课程内容”
const activeMenu = computed(() => {
  const p = route.path.replace(/\/$/, '')
  const hit = menu.value.slice(1).find((m) => p.startsWith(m.path))
  return hit ? hit.path : menu.value[0].path
})
</script>

<template>
  <AppHeader />
  <div v-if="error" class="error card">
    <el-result icon="warning" :title="error">
      <template #extra><el-button type="primary" @click="$router.push('/courses')">返回我的课程</el-button></template>
    </el-result>
  </div>
  <div v-else-if="store.course && store.course.id === courseId" class="course-wrap page-container">
    <aside class="side">
      <div class="course-head">
        <div class="cover tone" :style="coverStyle(store.course.id, store.course.cover)">
          <span v-if="!store.course.cover">{{ store.course.name.slice(0, 1) }}</span>
        </div>
        <div class="course-info">
          <div class="course-name" :title="store.course.name">{{ store.course.name }}</div>
          <div class="muted">{{ store.course.semester || '未设置学期' }}</div>
        </div>
      </div>
      <dl class="meta">
        <div><dt>我的身份</dt><dd>{{ ROLE_LABEL[store.course.my_role || 'student'] }}</dd></div>
        <div><dt>访问码</dt><dd class="code">{{ store.course.code }}</dd></div>
      </dl>
      <el-menu :default-active="activeMenu" router class="menu">
        <el-menu-item v-for="m in menu" :key="m.path" :index="m.path">
          <el-icon><component :is="m.icon" /></el-icon>
          <span>{{ m.label }}</span>
        </el-menu-item>
      </el-menu>
    </aside>
    <main class="content">
      <router-view :key="route.fullPath" />
    </main>
  </div>
  <div v-else v-loading="true" style="height: 60vh" />
</template>

<style scoped>
.course-wrap {
  display: flex;
  gap: 24px;
  padding-top: 24px;
  padding-bottom: 48px;
  align-items: flex-start;
}
.side {
  width: 224px;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid var(--ch-border);
  border-radius: var(--ch-radius);
  position: sticky;
  top: calc(var(--ch-header-h) + 24px);
}
.course-head {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 16px 16px 12px;
}
.cover {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 600;
}
.course-info {
  min-width: 0;
}
.course-name {
  font-weight: 600;
  font-size: 15px;
  line-height: 22px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.meta {
  margin: 0;
  padding: 0 16px 14px;
  display: grid;
  gap: 4px;
  border-bottom: 1px solid var(--ch-border-light);
  font-size: 13px;
}
.meta div {
  display: flex;
  justify-content: space-between;
}
.meta dt {
  color: var(--ch-text-3);
}
.meta dd {
  margin: 0;
  color: var(--ch-text);
}
.code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 1px;
  font-weight: 600;
}
.menu {
  border-right: none;
  padding: 8px;
  background: transparent;
}
.menu :deep(.el-menu-item) {
  border-radius: 6px;
  margin-bottom: 2px;
  padding: 0 12px !important;
}
.menu :deep(.el-menu-item.is-active) {
  background: var(--ch-primary-bg);
  font-weight: 600;
}
.content {
  flex: 1;
  min-width: 0;
}
.error {
  max-width: 600px;
  margin: 40px auto;
}
@media (max-width: 900px) {
  .course-wrap {
    flex-direction: column;
    gap: 16px;
    padding-top: 16px;
  }
  .side {
    width: 100%;
    position: static;
  }
  .menu {
    display: flex;
    overflow-x: auto;
  }
  .menu :deep(.el-menu-item) {
    margin-bottom: 0;
  }
}
</style>

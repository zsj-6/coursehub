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
    { path: `${base}/homework`, label: '作业', icon: 'EditPen' },
    { path: `${base}/exams`, label: '测试', icon: 'Document' },
    { path: `${base}/grades`, label: '成绩', icon: 'TrendCharts' },
    { path: `${base}/members`, label: '成员', icon: 'User' },
  ]
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
  <div v-else-if="store.course && store.course.id === courseId" class="course-wrap">
    <aside class="side">
      <div class="cover" :style="coverStyle(store.course.id, store.course.cover)">
        <div class="cover-name">{{ store.course.name }}</div>
      </div>
      <div class="meta">
        <div class="muted">{{ store.course.semester || '未设置学期' }}</div>
        <div class="flex" style="margin-top: 6px">
          <el-tag size="small" effect="plain">{{ ROLE_LABEL[store.course.my_role || 'student'] }}</el-tag>
          <span class="muted">访问码 <b class="code">{{ store.course.code }}</b></span>
        </div>
      </div>
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
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px 24px 40px;
  align-items: flex-start;
}
.side {
  width: 220px;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid var(--ch-border);
  border-radius: 8px;
  overflow: hidden;
  position: sticky;
  top: calc(var(--ch-header-h) + 20px);
}
.cover {
  height: 96px;
  display: flex;
  align-items: flex-end;
  padding: 12px;
}
.cover-name {
  color: #fff;
  font-weight: 700;
  font-size: 16px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.meta {
  padding: 10px 12px;
  border-bottom: 1px solid var(--ch-border);
}
.code {
  color: var(--ch-text);
  letter-spacing: 1px;
}
.menu {
  border-right: none;
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
    padding: 16px;
  }
  .side {
    width: 100%;
    position: static;
  }
  .menu {
    display: flex;
    overflow-x: auto;
  }
}
</style>

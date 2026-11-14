<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, onMounted, ref } from 'vue'
import { authApi } from '@/api/auth'
import type { ActivityType, Course } from '@/api/types'
import { useUserStore } from '@/stores/user'
import { ROLE_LABEL, TYPE_COLOR, TYPE_LABEL, coverStyle, fmt, fmtScore, fromNow } from '@/utils/format'

interface Ref {
  activity: { id: number; type: ActivityType; title: string; due_at: string | null; start_at: string | null }
  course: { id: number; name: string }
}
interface FeedItem extends Ref {
  kind: 'opened' | 'graded' | 'submissions' | 'missing'
  time: string
  score?: number
  count?: number
  missing?: number
}
interface TodoItem extends Ref {
  kind: 'todo' | 'to_grade'
  time: string | null
  pending?: number
}

const store = useUserStore()
const loading = ref(true)
const data = ref<{
  stats: { teaching_courses: number; learning_courses: number }
  recent_courses: Course[]
  announcements?: { id: number; title: string; pinned: boolean; time: string; course: { id: number; name: string } }[]
  todos: TodoItem[]
  feed: FeedItem[]
} | null>(null)
const tab = ref<'feed' | 'todo'>('todo')

onMounted(async () => {
  try {
    data.value = await authApi.dashboard()
    if (!data.value?.todos.length) tab.value = 'feed'
  } finally {
    loading.value = false
  }
})

const link = (r: Ref) => `/courses/${r.course.id}/activities/${r.activity.id}`

const todoGroups = computed(() => {
  const groups: { label: string; items: TodoItem[] }[] = [
    { label: '待批改', items: [] },
    { label: '今天截止', items: [] },
    { label: '未来七天', items: [] },
    { label: '以后', items: [] },
  ]
  const endOfToday = dayjs().endOf('day')
  const week = dayjs().add(7, 'day').endOf('day')
  for (const t of data.value?.todos ?? []) {
    if (t.kind === 'to_grade') groups[0].items.push(t)
    else if (t.time && dayjs(t.time).isBefore(endOfToday)) groups[1].items.push(t)
    else if (t.time && dayjs(t.time).isBefore(week)) groups[2].items.push(t)
    else groups[3].items.push(t)
  }
  return groups.filter((g) => g.items.length)
})

function feedText(f: FeedItem) {
  const t = TYPE_LABEL[f.activity.type]
  switch (f.kind) {
    case 'opened':
      return `开放了新的${t}`
    case 'graded':
      return `你的${t}已出分：${fmtScore(f.score)} 分`
    case 'submissions':
      return `${t}新增 ${f.count} 份提交`
    case 'missing':
      return `${t}已截止，还有 ${f.missing} 人未提交`
  }
}

const feedIcon: Record<FeedItem['kind'], { icon: string; color: string }> = {
  opened: { icon: 'Bell', color: '#5b8ff9' },
  graded: { icon: 'CircleCheck', color: '#3bb4b8' },
  submissions: { icon: 'Upload', color: '#9270ca' },
  missing: { icon: 'Warning', color: '#e8684a' },
}

const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'
})
</script>

<template>
  <div v-loading="loading" class="dash">
    <section class="card hello">
      <el-avatar :size="56" :src="store.user?.avatar || undefined">{{ store.user?.name.slice(-2) }}</el-avatar>
      <div>
        <div class="hello-title">{{ greeting }}，{{ store.user?.name }}</div>
        <div v-if="data" class="muted">
          <template v-if="data.stats.teaching_courses">正在 {{ data.stats.teaching_courses }} 门课程中进行教学</template>
          <template v-if="data.stats.teaching_courses && data.stats.learning_courses">，</template>
          <template v-if="data.stats.learning_courses">正在学习 {{ data.stats.learning_courses }} 门课程</template>
          <template v-if="!data.stats.teaching_courses && !data.stats.learning_courses">还没有加入任何课程</template>
          <router-link to="/courses" style="margin-left: 8px">查看课程 ›</router-link>
        </div>
      </div>
      <div class="spacer" />
      <el-tag effect="plain" round>{{ ROLE_LABEL[store.user?.role || 'student'] }}</el-tag>
    </section>

    <div v-if="data" class="cols">
      <section class="card main-col">
        <el-tabs v-model="tab">
          <el-tab-pane :label="`待办 ${data.todos.length || ''}`" name="todo">
            <div v-if="!todoGroups.length" class="empty-tip">没有待办事项</div>
            <div v-for="g in todoGroups" :key="g.label" class="group">
              <div class="group-label">{{ g.label }}</div>
              <router-link v-for="t in g.items" :key="t.activity.id" :to="link(t)" class="item">
                <span class="dot" :style="{ background: TYPE_COLOR[t.activity.type] }" />
                <div class="item-body">
                  <div class="item-title">
                    <el-tag size="small" effect="plain">{{ TYPE_LABEL[t.activity.type] }}</el-tag>
                    {{ t.activity.title }}
                  </div>
                  <div class="muted">
                    {{ t.course.name }}
                    <template v-if="t.kind === 'to_grade'"> · 待批改 {{ t.pending }} 人</template>
                    <template v-else> · 截止 {{ fmt(t.time) }}（{{ fromNow(t.time) }}）</template>
                  </div>
                </div>
                <el-icon><ArrowRight /></el-icon>
              </router-link>
            </div>
          </el-tab-pane>
          <el-tab-pane label="动态" name="feed">
            <div v-if="!data.feed.length" class="empty-tip">近两周没有新动态</div>
            <router-link v-for="(f, i) in data.feed" :key="i" :to="link(f)" class="item">
              <el-icon :size="22" :color="feedIcon[f.kind].color"><component :is="feedIcon[f.kind].icon" /></el-icon>
              <div class="item-body">
                <div class="item-title">{{ f.course.name }} · {{ feedText(f) }}</div>
                <div class="muted">「{{ f.activity.title }}」 · {{ fromNow(f.time) }}</div>
              </div>
            </router-link>
          </el-tab-pane>
        </el-tabs>
      </section>

      <div class="side-stack">
      <aside class="card side-col">
        <div class="side-title"><el-icon><Bell /></el-icon> 最新公告</div>
        <div v-if="!data.announcements?.length" class="empty-tip">暂无公告</div>
        <router-link v-for="a in data.announcements" :key="a.id" :to="`/courses/${a.course.id}/announcements`" class="ann">
          <div class="item-title ellipsis">
            <el-tag v-if="a.pinned" size="small" type="danger" effect="plain">置顶</el-tag>
            {{ a.title }}
          </div>
          <div class="muted ellipsis">{{ a.course.name }} · {{ fromNow(a.time) }}</div>
        </router-link>
      </aside>
      <aside class="card side-col">
        <div class="side-title"><el-icon><Clock /></el-icon> 最近访问</div>
        <div v-if="!data.recent_courses.length" class="empty-tip">还没有访问过课程</div>
        <router-link v-for="c in data.recent_courses" :key="c.id" :to="`/courses/${c.id}`" class="recent">
          <div class="thumb" :style="coverStyle(c.id, c.cover)">{{ c.name.slice(0, 2) }}</div>
          <div class="item-body">
            <div class="item-title ellipsis">{{ c.name }}</div>
            <div class="muted">{{ c.owner?.name }} · {{ c.semester }}</div>
          </div>
        </router-link>
      </aside>
      <router-link to="/pbl" class="card pbl-entry">
        <el-icon size="26"><Opportunity /></el-icon>
        <div>
          <b>项目训练（原型）</b>
          <div class="muted">组队完成真实项目，按关卡推进</div>
        </div>
      </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.side-stack {
  display: grid;
  gap: 16px;
}
.ann {
  display: block;
  padding: 8px 4px;
  border-bottom: 1px solid #f0f2f5;
  color: inherit;
}
.ann:hover {
  background: var(--el-color-primary-light-9);
}
.pbl-entry {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--ch-primary);
  background: linear-gradient(120deg, #e9f7f7, #fff);
}
.pbl-entry b {
  color: var(--ch-text);
}
.dash {
  min-height: 300px;
}
.hello {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.hello-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
}
.group {
  margin-bottom: 12px;
}
.group-label {
  font-weight: 600;
  margin: 8px 0;
}
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  color: inherit;
}
.item:hover {
  background: var(--el-color-primary-light-9);
}
.item-body {
  flex: 1;
  min-width: 0;
}
.item-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.side-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  margin-bottom: 8px;
}
.recent {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
  color: inherit;
}
.thumb {
  width: 64px;
  height: 44px;
  border-radius: 6px;
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 600;
  flex-shrink: 0;
}
.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
@media (max-width: 900px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
</style>

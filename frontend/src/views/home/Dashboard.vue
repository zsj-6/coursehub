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

const FEED_COLOR: Record<FeedItem['kind'], string> = {
  opened: 'var(--ch-blue)',
  graded: 'var(--ch-primary)',
  submissions: 'var(--ch-purple)',
  missing: 'var(--ch-danger)',
}

const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好'
})
const today = dayjs().format('M 月 D 日 dddd')
const isStudent = computed(() => store.user?.role === 'student')

/** 顶部一行关键数字：只有"需要你处理"的那一项上色。 */
const stats = computed((): { label: string; value: number; unit: string; note: string; tone: string; to?: string }[] => {
  const todos = data.value?.todos ?? []
  const endOfToday = dayjs().endOf('day')
  const week = dayjs().add(7, 'day').endOf('day')
  const due = todos.filter((t) => t.kind === 'todo' && t.time)
  const toGrade = todos.filter((t) => t.kind === 'to_grade')
  const dueToday = due.filter((t) => dayjs(t.time).isBefore(endOfToday)).length
  const first = isStudent.value
    ? { label: '待完成', value: todos.filter((t) => t.kind === 'todo').length, unit: '项', note: '已开放、还没提交的作业和测试', tone: 'is-key' }
    : {
        label: '待批改',
        value: toGrade.reduce((n, t) => n + (t.pending || 0), 0),
        unit: '份',
        note: toGrade.length ? `分布在 ${toGrade.length} 个作业和测试里` : '都批完了',
        tone: 'is-key',
      }
  const s = data.value?.stats
  return [
    first,
    { label: '今天截止', value: dueToday, unit: '项', note: dueToday ? '今天 24:00 前' : '今天没有截止的活动', tone: 'is-warn' },
    { label: '未来七天截止', value: due.filter((t) => dayjs(t.time).isBefore(week)).length, unit: '项', note: `到 ${week.format('M 月 D 日')}`, tone: '' },
    {
      label: isStudent.value ? '在学课程' : '我的课程',
      value: (s?.teaching_courses ?? 0) + (s?.learning_courses ?? 0),
      unit: '门',
      note: s?.teaching_courses && s?.learning_courses ? `教学 ${s.teaching_courses} 门，学习 ${s.learning_courses} 门` : '点击查看全部',
      tone: '',
      to: '/courses',
    },
  ]
})
</script>

<template>
  <div v-loading="loading" class="dash">
    <header class="hello">
      <div>
        <h1>{{ greeting }}，{{ store.user?.name }}</h1>
        <div class="muted">{{ today }} · {{ ROLE_LABEL[store.user?.role || 'student'] }}</div>
      </div>
      <el-button @click="$router.push('/courses')">进入我的课程</el-button>
    </header>

    <template v-if="data">
      <section class="stat-strip">
        <component :is="s.to ? 'router-link' : 'div'" v-for="s in stats" :key="s.label" :to="s.to" class="stat" :class="s.value ? s.tone : ''">
          <div class="stat-label">{{ s.label }}</div>
          <div class="stat-value">{{ s.value }}<small>{{ s.unit }}</small></div>
          <div class="stat-note">{{ s.note }}</div>
        </component>
      </section>

      <div class="cols">
        <section class="card main-col">
          <el-tabs v-model="tab">
            <el-tab-pane :label="data.todos.length ? `待办 ${data.todos.length}` : '待办'" name="todo">
              <div v-if="!todoGroups.length" class="empty-tip">没有待办事项</div>
              <div v-for="g in todoGroups" :key="g.label" class="group">
                <div class="group-label">{{ g.label }}<span>{{ g.items.length }}</span></div>
                <router-link v-for="t in g.items" :key="t.activity.id" :to="link(t)" class="item">
                  <span class="type" :style="{ color: TYPE_COLOR[t.activity.type] }">{{ TYPE_LABEL[t.activity.type] }}</span>
                  <div class="item-body">
                    <div class="item-title ellipsis">{{ t.activity.title }}</div>
                    <div class="muted ellipsis">{{ t.course.name }}</div>
                  </div>
                  <div v-if="t.kind === 'to_grade'" class="item-side">
                    <b>{{ t.pending }}</b> 人待批改
                  </div>
                  <div v-else class="item-side" :class="{ urgent: g.label === '今天截止' }">
                    <b>{{ fromNow(t.time) }}</b>截止
                    <div class="muted">{{ fmt(t.time, 'MM-DD HH:mm') }}</div>
                  </div>
                  <el-icon class="arrow"><ArrowRight /></el-icon>
                </router-link>
              </div>
            </el-tab-pane>
            <el-tab-pane label="动态" name="feed">
              <div v-if="!data.feed.length" class="empty-tip">近两周没有新动态</div>
              <router-link v-for="(f, i) in data.feed" :key="i" :to="link(f)" class="item">
                <span class="dot" :style="{ background: FEED_COLOR[f.kind] }" />
                <div class="item-body">
                  <div class="item-title ellipsis">{{ feedText(f) }}</div>
                  <div class="muted ellipsis">{{ f.course.name }} ·「{{ f.activity.title }}」</div>
                </div>
                <div class="item-side muted">{{ fromNow(f.time) }}</div>
              </router-link>
            </el-tab-pane>
          </el-tabs>
        </section>

        <div class="side-stack">
          <aside class="card side-col">
            <h3 class="card-title">最新公告</h3>
            <div v-if="!data.announcements?.length" class="empty-tip">暂无公告</div>
            <router-link v-for="a in data.announcements" :key="a.id" :to="`/courses/${a.course.id}/announcements`" class="line">
              <div class="item-title">
                <span class="ellipsis">{{ a.title }}</span>
                <span v-if="a.pinned" class="pin">置顶</span>
              </div>
              <div class="muted ellipsis">{{ a.course.name }} · {{ fromNow(a.time) }}</div>
            </router-link>
          </aside>
          <aside class="card side-col">
            <h3 class="card-title">最近访问</h3>
            <div v-if="!data.recent_courses.length" class="empty-tip">还没有访问过课程</div>
            <router-link v-for="c in data.recent_courses" :key="c.id" :to="`/courses/${c.id}`" class="line recent">
              <div class="thumb tone" :style="coverStyle(c.id, c.cover)">{{ c.cover ? '' : c.name.slice(0, 1) }}</div>
              <div class="item-body">
                <div class="item-title"><span class="ellipsis">{{ c.name }}</span></div>
                <div class="muted ellipsis">{{ c.owner?.name }} · {{ c.semester || '未设置学期' }}</div>
              </div>
            </router-link>
          </aside>
          <router-link to="/pbl" class="card pbl-entry">
            <div class="item-body">
              <div class="item-title">项目训练<span class="proto">原型</span></div>
              <div class="muted">组队完成真实项目，按关卡推进</div>
            </div>
            <el-icon class="arrow"><ArrowRight /></el-icon>
          </router-link>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dash {
  min-height: 300px;
}
.hello {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.hello h1 {
  margin: 0 0 2px;
  font-size: 22px;
  line-height: 32px;
  letter-spacing: -0.01em;
}
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
}
.main-col {
  padding-top: 8px;
}
.side-stack {
  display: grid;
  gap: 16px;
}
.group + .group {
  margin-top: 16px;
}
.group-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ch-text-2);
  margin: 4px 0 4px;
}
.group-label span {
  margin-left: 6px;
  font-weight: 400;
  color: var(--ch-text-3);
}
.item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 8px;
  margin: 0 -8px;
  border-radius: 6px;
  color: inherit;
}
.item + .item {
  box-shadow: 0 -1px 0 var(--ch-border-light);
}
.item:hover {
  background: var(--ch-fill-hover);
  box-shadow: none;
}
.item:hover + .item {
  box-shadow: none;
}
.type {
  width: 56px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin: 0 4px;
}
.item-body {
  flex: 1;
  min-width: 0;
}
.item-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  line-height: 22px;
}
.item-side {
  flex-shrink: 0;
  text-align: right;
  font-size: 13px;
  color: var(--ch-text-2);
  white-space: nowrap;
}
.item-side b {
  font-weight: 600;
  color: var(--ch-text);
}
.item-side.urgent b {
  color: var(--ch-danger);
}
.arrow {
  color: var(--ch-text-3);
  flex-shrink: 0;
}
.item .arrow {
  opacity: 0;
}
.item:hover .arrow {
  opacity: 1;
}
.line {
  display: block;
  padding: 10px 0;
  color: inherit;
  border-top: 1px solid var(--ch-border-light);
}
.card-title + .line {
  border-top: none;
  padding-top: 0;
}
.line:last-child {
  padding-bottom: 0;
}
.line:hover .item-title {
  color: var(--ch-primary-text);
}
.pin {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--ch-danger);
}
.recent {
  display: flex;
  gap: 12px;
  align-items: center;
}
.thumb {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-weight: 600;
  flex-shrink: 0;
}
.pbl-entry {
  display: flex;
  align-items: center;
  gap: 12px;
  color: inherit;
  padding: 16px 20px;
}
.pbl-entry:hover {
  border-color: var(--ch-primary);
}
.proto {
  font-size: 12px;
  font-weight: 500;
  color: var(--ch-text-3);
  border: 1px solid var(--ch-border);
  border-radius: 4px;
  padding: 0 5px;
  line-height: 18px;
}
.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
@media (max-width: 900px) {
  .cols {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 640px) {
  .item-side .muted {
    display: none;
  }
}
</style>

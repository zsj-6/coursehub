<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import ProjectCard from '@/components/pbl/ProjectCard.vue'
import type { Project } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { fmt, fromNow } from '@/utils/format'

const store = usePblStore()
const status = ref<'all' | 'notstarted' | 'running' | 'finished' | 'fav'>('all')
const favProjects = computed(() => store.myFavoriteIds.map((id) => store.project(id)).filter((p) => p && store.canSee(p)) as Project[])
const list = computed(() =>
  status.value === 'fav' ? favProjects.value : store.myProjects.filter((p) => {
    if (status.value === 'notstarted') return p.status === 'recruiting' || p.status === 'draft'
    if (status.value === 'running') return p.status === 'running'
    if (status.value === 'finished') return p.status === 'finished'
    return true
  }),
)
const count = (s: string[]) => store.myProjects.filter((p) => s.includes(p.status)).length
const KIND_COLOR: Record<string, string> = { 待提交: 'var(--ch-warning)', 待参与讨论: 'var(--ch-blue)', 待评阅: 'var(--ch-primary)', 关卡即将截止: 'var(--ch-danger)' }
const urgent = (t: string) => dayjs(t).diff(dayjs(), 'hour') < 48
</script>

<template>
  <div class="mine">
    <section>
      <div class="stat-strip">
        <div class="stat" :class="{ on: status === 'all' }" @click="status = 'all'"><div class="stat-label">全部</div><div class="stat-value">{{ store.myProjects.length }}<small>个</small></div></div>
        <div class="stat" :class="{ on: status === 'notstarted' }" @click="status = 'notstarted'"><div class="stat-label">未开始</div><div class="stat-value">{{ count(['recruiting', 'draft']) }}<small>个</small></div></div>
        <div class="stat" :class="{ on: status === 'running' }" @click="status = 'running'"><div class="stat-label">进行中</div><div class="stat-value">{{ count(['running']) }}<small>个</small></div></div>
        <div class="stat" :class="{ on: status === 'finished' }" @click="status = 'finished'"><div class="stat-label">已结束</div><div class="stat-value">{{ count(['finished']) }}<small>个</small></div></div>
        <div class="stat" :class="{ on: status === 'fav' }" @click="status = 'fav'"><div class="stat-label">我的收藏</div><div class="stat-value">{{ favProjects.length }}<small>个</small></div></div>
      </div>
      <div v-if="!list.length" class="empty-tip card">
        {{ status === 'fav' ? '还没有收藏课题，在项目大厅点课题卡片右上角的 ☆ 即可收藏' : store.isStudent ? '还没有参与项目，去项目大厅看看感兴趣的课题吧' : '没有项目' }}
        <div style="margin-top: 10px"><el-button type="primary" @click="$router.push('/pbl')">去项目大厅</el-button></div>
      </div>
      <div class="grid">
        <ProjectCard v-for="p in list" :key="p.id" :project="p" />
      </div>
    </section>
    <aside class="card todo">
      <h3 class="card-title">待办提醒</h3>
      <div v-if="!store.todos.length" class="empty-tip">没有待办</div>
      <router-link v-for="(t, i) in store.todos" :key="i" :to="t.link" class="todo-item">
        <div class="body">
          <div class="kind" :style="{ color: KIND_COLOR[t.kind] }">{{ t.kind }}</div>
          <b class="ell">{{ t.title }}</b>
          <div class="muted">{{ t.sub }}</div>
          <div class="muted" :class="{ hot: urgent(t.time) }">截止 {{ fmt(t.time, 'MM-DD HH:mm') }}（{{ fromNow(t.time) }}）</div>
        </div>
      </router-link>
    </aside>
  </div>
</template>

<style scoped>
.mine {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 16px;
  align-items: start;
}
.stat {
  position: relative;
  cursor: pointer;
}
.stat:hover {
  background: var(--ch-fill-hover);
}
.stat:first-child {
  border-radius: var(--ch-radius) 0 0 var(--ch-radius);
}
.stat:last-child {
  border-radius: 0 var(--ch-radius) var(--ch-radius) 0;
}
.stat.on .stat-value {
  color: var(--ch-primary-text);
}
.stat.on::after {
  content: '';
  position: absolute;
  left: 20px;
  right: 20px;
  bottom: -1px;
  height: 2px;
  background: var(--ch-primary);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.todo {
  position: sticky;
  top: 120px;
}
.todo-item {
  display: block;
  padding: 10px 0;
  border-top: 1px solid var(--ch-border-light);
  color: var(--ch-text);
}
.card-title + .todo-item {
  border-top: none;
  padding-top: 0;
}
.todo-item:hover b {
  color: var(--ch-primary-text);
}
.kind {
  font-size: 12px;
  font-weight: 600;
}
.body {
  min-width: 0;
  display: grid;
  gap: 2px;
}
.body b {
  font-weight: 500;
}
.ell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hot {
  color: var(--ch-danger);
}
@media (max-width: 900px) {
  .mine {
    grid-template-columns: 1fr;
  }
}
</style>

<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProjectCard from '@/components/pbl/ProjectCard.vue'
import type { Project } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { fmt, fromNow } from '@/utils/format'

const store = usePblStore()
const route = useRoute()
const router = useRouter()
const tab = computed({
  get: () => store.isStudent && route.query.tab === 'favorites' ? 'favorites' : 'participating',
  set: (value: string) => {
    status.value = 'all'
    router.replace({ query: { ...route.query, tab: value } })
  },
})
const source = computed(() => tab.value === 'favorites' ? store.favoriteProjects : store.myProjects)
const status = ref<'all' | 'notstarted' | 'running' | 'finished'>('all')
const list = computed(() =>
  source.value.filter((p) => {
    if (status.value === 'notstarted') return p.status === 'recruiting' || p.status === 'draft'
    if (status.value === 'running') return p.status === 'running'
    if (status.value === 'finished') return p.status === 'finished'
    return true
  }),
)
const count = (s: string[]) => source.value.filter((p) => s.includes(p.status)).length
const KIND_COLOR: Record<string, string> = { 待提交: '#f6903d', 待参与讨论: '#5b8ff9', 待评阅: '#3bb4b8', 关卡即将截止: '#e8684a' }
const urgent = (t: string) => dayjs(t).diff(dayjs(), 'hour') < 48
</script>

<template>
  <div class="mine">
    <section>
      <el-tabs v-if="store.isStudent" v-model="tab">
        <el-tab-pane :label="`我参与的 ${store.myProjects.length}`" name="participating" />
        <el-tab-pane :label="`我的收藏 ${store.favoriteProjects.length}`" name="favorites" />
      </el-tabs>
      <div class="stats">
        <div class="stat" :class="{ on: status === 'all' }" @click="status = 'all'"><b>{{ source.length }}</b><span>全部</span></div>
        <div class="stat" :class="{ on: status === 'notstarted' }" @click="status = 'notstarted'"><b>{{ count(['recruiting', 'draft']) }}</b><span>未开始</span></div>
        <div class="stat" :class="{ on: status === 'running' }" @click="status = 'running'"><b>{{ count(['running']) }}</b><span>进行中</span></div>
        <div class="stat" :class="{ on: status === 'finished' }" @click="status = 'finished'"><b>{{ count(['finished']) }}</b><span>已结束</span></div>
      </div>
      <div v-if="!list.length" class="empty-tip card">
        <template v-if="status !== 'all'">该状态下暂无项目</template>
        <template v-else-if="tab === 'favorites'">还没有收藏项目，去项目大厅收藏感兴趣的课题吧</template>
        <template v-else>{{ store.isStudent ? '还没有参与项目，去项目大厅看看感兴趣的课题吧' : '没有项目' }}</template>
        <div style="margin-top: 10px"><el-button type="primary" @click="$router.push('/pbl')">去项目大厅</el-button></div>
      </div>
      <div class="grid">
        <ProjectCard v-for="p in list" :key="p.id" :project="p" :quiet="tab === 'favorites'" />
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

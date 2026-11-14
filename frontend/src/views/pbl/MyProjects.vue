<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import ProjectCard from '@/components/pbl/ProjectCard.vue'
import { usePblStore } from '@/stores/pbl'
import { fmt, fromNow } from '@/utils/format'

const store = usePblStore()
const status = ref<'all' | 'notstarted' | 'running' | 'finished'>('all')
const list = computed(() =>
  store.myProjects.filter((p) => {
    if (status.value === 'notstarted') return p.status === 'recruiting' || p.status === 'draft'
    if (status.value === 'running') return p.status === 'running'
    if (status.value === 'finished') return p.status === 'finished'
    return true
  }),
)
const count = (s: string[]) => store.myProjects.filter((p) => s.includes(p.status)).length
const KIND_COLOR: Record<string, string> = { 待提交: '#f6903d', 待参与讨论: '#5b8ff9', 待评阅: '#3bb4b8', 关卡即将截止: '#e8684a' }
const urgent = (t: string) => dayjs(t).diff(dayjs(), 'hour') < 48
</script>

<template>
  <div class="mine">
    <section>
      <div class="stats">
        <div class="stat" :class="{ on: status === 'all' }" @click="status = 'all'"><b>{{ store.myProjects.length }}</b><span>全部</span></div>
        <div class="stat" :class="{ on: status === 'notstarted' }" @click="status = 'notstarted'"><b>{{ count(['recruiting', 'draft']) }}</b><span>未开始</span></div>
        <div class="stat" :class="{ on: status === 'running' }" @click="status = 'running'"><b>{{ count(['running']) }}</b><span>进行中</span></div>
        <div class="stat" :class="{ on: status === 'finished' }" @click="status = 'finished'"><b>{{ count(['finished']) }}</b><span>已结束</span></div>
      </div>
      <div v-if="!list.length" class="empty-tip card">
        {{ store.isStudent ? '还没有参与项目，去项目大厅看看感兴趣的课题吧' : '没有项目' }}
        <div style="margin-top: 10px"><el-button type="primary" @click="$router.push('/pbl')">去项目大厅</el-button></div>
      </div>
      <div class="grid">
        <ProjectCard v-for="p in list" :key="p.id" :project="p" />
      </div>
    </section>
    <aside class="card todo">
      <div class="todo-title"><el-icon><Bell /></el-icon> 待办提醒</div>
      <div v-if="!store.todos.length" class="empty-tip">没有待办</div>
      <router-link v-for="(t, i) in store.todos" :key="i" :to="t.link" class="todo-item">
        <span class="dot" :style="{ background: KIND_COLOR[t.kind] || '#999' }" />
        <div class="body">
          <div class="flex"><el-tag size="small" effect="plain">{{ t.kind }}</el-tag><b class="ell">{{ t.title }}</b></div>
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
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.stat {
  background: #fff;
  border: 1px solid var(--ch-border);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
}
.stat.on {
  border-color: var(--ch-primary);
  background: var(--el-color-primary-light-9);
}
.stat b {
  font-size: 24px;
  color: var(--ch-primary);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.todo {
  position: sticky;
  top: 120px;
}
.todo-title {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.todo-item {
  display: flex;
  gap: 10px;
  padding: 10px 6px;
  border-bottom: 1px solid #f0f2f5;
  color: var(--ch-text);
}
.todo-item:hover {
  background: #f7f9fb;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 8px;
  flex-shrink: 0;
}
.body {
  min-width: 0;
  display: grid;
  gap: 2px;
}
.ell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hot {
  color: #e8684a;
}
@media (max-width: 900px) {
  .mine {
    grid-template-columns: 1fr;
  }
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

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
const count = (statuses: Project['status'][]) => source.value.filter((p) => statuses.includes(p.status)).length
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
      <el-radio-group v-model="status" class="status-filters" aria-label="项目状态">
        <el-radio-button value="all"><span>全部</span> {{ source.length }}</el-radio-button>
        <el-radio-button value="notstarted"><span>未开始</span> {{ count(['recruiting', 'draft']) }}</el-radio-button>
        <el-radio-button value="running"><span>进行中</span> {{ count(['running']) }}</el-radio-button>
        <el-radio-button value="finished"><span>已结束</span> {{ count(['finished']) }}</el-radio-button>
      </el-radio-group>
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
.status-filters {
  margin-bottom: 16px;
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

<script setup lang="ts">
import { useRouter } from 'vue-router'

/**
 * 详情页顶部：「← 返回」+ 面包屑。
 * 有站内上一页就后退；直接打开链接时没有上一页，就去面包屑里的上一级。
 */
const props = defineProps<{ items: { label: string; to?: string }[] }>()
const router = useRouter()

function back() {
  if (window.history.state?.back) {
    router.back()
    return
  }
  const parent = [...props.items].reverse().find((x) => x.to)
  router.push(parent?.to || '/')
}
</script>

<template>
  <nav class="back-bar">
    <button type="button" class="back" @click="back">
      <el-icon><ArrowLeft /></el-icon>
      <span>返回</span>
    </button>
    <span class="sep" />
    <ol class="crumbs">
      <li v-for="(x, i) in items" :key="i">
        <router-link v-if="x.to && i < items.length - 1" :to="x.to">{{ x.label }}</router-link>
        <span v-else class="cur">{{ x.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.back-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  margin-bottom: 16px;
  font-size: 13px;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px 0 6px;
  border: 1px solid var(--ch-border);
  border-radius: 6px;
  background: #fff;
  color: var(--ch-text);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s, background 0.15s;
}
.back:hover {
  border-color: var(--el-border-color-hover);
  background: var(--ch-fill-hover);
}
.sep {
  width: 1px;
  height: 14px;
  background: var(--ch-border);
  flex-shrink: 0;
}
.crumbs {
  display: flex;
  align-items: center;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--ch-text-3);
}
.crumbs li {
  display: flex;
  align-items: center;
  min-width: 0;
  white-space: nowrap;
}
.crumbs li + li::before {
  content: '/';
  margin: 0 8px;
  color: var(--el-border-color);
}
.crumbs a {
  color: var(--ch-text-2);
}
.crumbs a:hover {
  color: var(--ch-primary-text);
}
.cur {
  color: var(--ch-text);
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

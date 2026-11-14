<script setup lang="ts">
import type { ActivityBrief } from '@/api/types'
import ActivityIcon from '@/components/ActivityIcon.vue'
import { TYPE_LABEL, fmt, publishState } from '@/utils/format'

const props = defineProps<{ act: ActivityBrief; courseId: number; manage: boolean; studentView: boolean }>()
const selected = defineModel<boolean>('selected', { default: false })
const emit = defineEmits<{ command: [cmd: string, act: ActivityBrief] }>()

function timeInfo() {
  const a = props.act
  if (a.type === 'exam') {
    if (a.start_at && a.due_at) return `${fmt(a.start_at, 'MM-DD HH:mm')} ~ ${fmt(a.due_at, 'MM-DD HH:mm')}`
    if (a.due_at) return `${fmt(a.due_at, 'MM-DD HH:mm')} 结束`
  }
  if (a.type === 'homework' && a.due_at) return `截止 ${fmt(a.due_at, 'MM-DD HH:mm')}`
  return ''
}
</script>

<template>
  <div class="row">
    <el-checkbox v-if="manage && !studentView" v-model="selected" />
    <ActivityIcon :type="act.type" />
    <router-link :to="`/courses/${courseId}/activities/${act.id}`" class="title">
      <span class="type">{{ TYPE_LABEL[act.type] }}</span>
      {{ act.title }}
    </router-link>
    <span class="muted time">{{ timeInfo() }}</span>
    <template v-if="!studentView">
      <el-tag size="small" :type="publishState(act).type" effect="light">{{ publishState(act).text }}</el-tag>
    </template>
    <template v-else-if="act.completed !== undefined">
      <el-tag v-if="act.completed" size="small" type="success" effect="plain">已完成</el-tag>
      <el-tag v-else size="small" type="info" effect="plain">未完成</el-tag>
    </template>
    <el-dropdown v-if="manage && !studentView" trigger="click" @command="(c: string) => emit('command', c, act)">
      <el-button link><el-icon><MoreFilled /></el-icon></el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="edit" icon="Edit">编辑</el-dropdown-item>
          <el-dropdown-item v-if="act.type === 'exam'" command="questions" icon="List">管理题目</el-dropdown-item>
          <el-dropdown-item v-if="!act.is_published" command="publish" icon="Promotion">发布</el-dropdown-item>
          <el-dropdown-item v-else command="unpublish" icon="Hide">取消发布</el-dropdown-item>
          <el-dropdown-item command="up" icon="Top" divided>上移</el-dropdown-item>
          <el-dropdown-item command="down" icon="Bottom">下移</el-dropdown-item>
          <el-dropdown-item command="delete" icon="Delete" divided>删除</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
}
.row:hover {
  background: #f7f9fa;
}
.title {
  flex: 1;
  min-width: 0;
  color: var(--ch-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.title:hover {
  color: var(--ch-primary);
}
.type {
  color: var(--ch-text-2);
  font-size: 12px;
  margin-right: 4px;
}
.time {
  white-space: nowrap;
}
@media (max-width: 640px) {
  .time {
    display: none;
  }
}
</style>

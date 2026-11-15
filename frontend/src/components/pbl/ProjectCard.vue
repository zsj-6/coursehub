<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import type { Project } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { PROJECT_STATUS, programCover } from '@/utils/pbl'
import PersonAvatar from './PersonAvatar.vue'

const props = defineProps<{ project: Project }>()
const store = usePblStore()
const program = computed(() => store.program(props.project.programId))
const fav = computed(() => store.isFavorite(props.project.id))
function toggleFav() {
  ElMessage.success(store.toggleFavorite(props.project.id) ? '已收藏，可在「我的收藏」里找到' : '已取消收藏')
}
const teams = computed(() => store.teamsOf(props.project.id))
const current = computed(() => store.currentMilestone(props.project))
const mine = computed(() => store.myTeam(props.project.id))
</script>

<template>
  <router-link :to="`/pbl/projects/${project.id}`" class="pc">
    <div class="body" :style="programCover(program?.color ?? 0)">
      <div class="top">
        <span class="prog"><i />{{ program?.title }}</span>
        <el-tag size="small" :type="PROJECT_STATUS[project.status].type">{{ PROJECT_STATUS[project.status].text }}</el-tag>
        <button type="button" class="fav" :class="{ on: fav }" :title="fav ? '取消收藏' : '收藏'" @click.prevent.stop="toggleFav">
          <el-icon><StarFilled v-if="fav" /><Star v-else /></el-icon>
        </button>
      </div>
      <div class="title">{{ project.title }}<span v-if="mine" class="mine-flag">我在 {{ mine.name }}</span></div>
      <div class="summary">{{ project.summary }}</div>
      <div class="tags">
        <span v-for="t in project.tags" :key="t" class="tag">{{ t }}</span>
      </div>
      <div v-if="project.status === 'running'" class="prog-line">
        <el-progress :percentage="store.progressPercent(project)" :stroke-width="4" :show-text="false" />
        <span class="muted">{{ current ? `当前：${current.title}` : '' }}</span>
      </div>
      <div class="foot">
        <span class="mentors">
          <PersonAvatar v-for="m in project.mentorIds" :id="m" :key="m" :size="22" />
          <span class="muted">{{ project.mentorIds.map((m) => store.person(m)?.name).join('、') }}</span>
        </span>
        <div class="spacer" />
        <span class="nums">
          <span><b>{{ teams.length }}</b> 队</span>
          <span><b>{{ project.interestedIds.length }}</b> 人感兴趣</span>
          <span><b>{{ project.views }}</b> 浏览</span>
        </span>
      </div>
    </div>
  </router-link>
</template>

<style scoped>
.pc {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--ch-border);
  border-radius: var(--ch-radius);
  color: var(--ch-text);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.pc:hover {
  border-color: var(--el-border-color-hover);
  box-shadow: var(--el-box-shadow-lighter);
}
.body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}
.top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.top .el-tag {
  margin-left: auto;
}
.fav {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  margin: -4px -6px -4px 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ch-text-3);
  font-size: 16px;
  cursor: pointer;
}
.fav:hover {
  background: var(--ch-fill-hover);
  color: var(--ch-text);
}
.fav.on {
  color: #e8a317;
}
.prog {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--tone);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.prog i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tone);
  flex-shrink: 0;
}
.title {
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}
.mine-flag {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ch-primary-text);
  background: var(--ch-primary-bg);
  border-radius: 4px;
  padding: 2px 6px;
  vertical-align: 2px;
  white-space: nowrap;
}
.summary {
  color: var(--ch-text-2);
  font-size: 13px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 42px;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag {
  font-size: 12px;
  line-height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--ch-fill);
  color: var(--ch-text-2);
}
.prog-line {
  display: grid;
  gap: 4px;
}
.foot {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--ch-border-light);
}
.mentors {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.mentors .muted {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nums {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--ch-text-3);
  white-space: nowrap;
}
.nums b {
  font-weight: 600;
  color: var(--ch-text-2);
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import type { Project } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { PROJECT_STATUS, programCover } from '@/utils/pbl'
import PersonAvatar from './PersonAvatar.vue'
import FavoriteButton from './FavoriteButton.vue'

const props = defineProps<{ project: Project; quiet?: boolean }>()
const store = usePblStore()
const program = computed(() => store.program(props.project.programId))
const teams = computed(() => store.teamsOf(props.project.id))
const current = computed(() => store.currentMilestone(props.project))
const mine = computed(() => store.myTeam(props.project.id))
</script>

<template>
  <article class="pc" :class="{ quiet }">
    <router-link :to="`/pbl/projects/${project.id}`" class="card-link">
      <div class="top" :style="quiet ? undefined : programCover(program?.color ?? 0)">
        <span class="prog">{{ program?.title }}</span>
        <el-tag class="st" size="small" :type="PROJECT_STATUS[project.status].type" :effect="quiet ? 'light' : 'dark'">{{ PROJECT_STATUS[project.status].text }}</el-tag>
        <span v-if="mine" class="mine-flag">我在 {{ mine.name }}</span>
      </div>
      <div class="body">
        <div class="title">{{ project.title }}</div>
        <div class="summary">{{ project.summary }}</div>
        <div class="tags">
          <el-tag v-for="t in project.tags" :key="t" size="small" effect="plain" round>{{ t }}</el-tag>
        </div>
        <div v-if="project.status === 'running'" class="prog-line">
          <el-progress :percentage="store.progressPercent(project)" :stroke-width="6" :show-text="false" />
          <span class="muted">{{ current ? `当前：${current.title}` : '' }}</span>
        </div>
      </div>
    </router-link>
    <div class="card-footer">
      <div class="foot">
        <span class="mentors">
          <PersonAvatar v-for="m in project.mentorIds" :id="m" :key="m" :size="22" />
          <span class="muted">{{ project.mentorIds.map((m) => store.person(m)?.name).join('、') }}</span>
        </span>
        <div class="spacer" />
        <span class="muted stat"><el-icon><View /></el-icon>{{ project.views }}</span>
        <span class="muted stat"><el-icon><UserFilled /></el-icon>{{ teams.length }} 队</span>
        <span class="muted stat" title="收藏人数"><el-icon><Star /></el-icon>{{ project.interestedIds.length }}</span>
      </div>
      <div class="actions" v-if="store.isStudent || quiet">
        <FavoriteButton :project="project" size="small" />
        <router-link v-if="quiet" :to="`/pbl/projects/${project.id}`" class="card-action">查看课题<el-icon><ArrowRight /></el-icon></router-link>
      </div>
    </div>
  </article>
</template>

<style scoped>
.card-link {
  display: flex;
  flex-direction: column;
  flex: 1;
  color: inherit;
}
.card-link:focus-visible {
  outline: 2px solid #237c81;
  outline-offset: -2px;
}
.card-footer {
  padding: 0 14px 14px;
}
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}
.actions .card-action {
  margin-left: auto;
}

.pc {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--ch-border);
  border-radius: 10px;
  overflow: hidden;
  color: var(--ch-text);
  transition: transform 0.2s, box-shadow 0.2s;
}
.pc:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.08);
}
.top {
  position: relative;
  height: 56px;
  padding: 10px 12px;
  color: #fff;
}
.prog {
  font-size: 12px;
  opacity: 0.9;
}
.st {
  position: absolute;
  right: 10px;
  top: 10px;
}
.mine-flag {
  position: absolute;
  left: 12px;
  bottom: 6px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 10px;
  padding: 0 8px;
}
.body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}
.title {
  font-size: 16px;
  font-weight: 600;
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
  gap: 4px;
}
.prog-line {
  display: grid;
  gap: 2px;
}
.foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid #f0f2f5;
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
.stat {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.quiet:hover {
  transform: none;
  border-color: #8fbfc1;
  box-shadow: 0 4px 14px rgba(44, 62, 80, 0.05);
}
.quiet .top {
  height: auto;
  min-height: 42px;
  padding: 14px 16px 0;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 6px 8px;
  color: var(--ch-text-2);
}
.quiet .prog {
  flex: 1;
  min-width: 0;
  line-height: 20px;
}
.quiet .st, .quiet .mine-flag {
  position: static;
  flex-shrink: 0;
}
.quiet .mine-flag {
  width: 100%;
  color: #237c81;
  padding: 0;
}
.quiet .body {
  padding: 10px 16px 14px;
  gap: 10px;
}
.quiet .title {
  font-size: 18px;
  line-height: 1.5;
}
.quiet .tags :deep(.el-tag) {
  background: #f5f7f8;
  border-color: #e8ecef;
  color: #65737f;
}
.quiet .foot {
  flex-wrap: wrap;
  gap: 8px;
}
.card-action {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  color: #237c81;
  font-size: 13px;
  font-weight: 600;
}
</style>

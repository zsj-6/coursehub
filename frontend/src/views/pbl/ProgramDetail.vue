<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import ProjectCard from '@/components/pbl/ProjectCard.vue'
import ProjectFormDialog from '@/components/pbl/ProjectFormDialog.vue'
import { usePblStore } from '@/stores/pbl'
import { programCover } from '@/utils/pbl'
import BackBar from '@/components/BackBar.vue'

const props = defineProps<{ programId: string }>()
const store = usePblStore()
const router = useRouter()
const program = computed(() => store.program(props.programId))
const projects = computed(() => store.projectsOf(props.programId))
const formRef = ref<InstanceType<typeof ProjectFormDialog>>()
const stats = computed(() => {
  const teams = projects.value.flatMap((p) => store.teamsOf(p.id))
  return {
    teams: teams.length,
    students: new Set(teams.flatMap((t) => t.memberIds)).size,
    mentors: new Set(projects.value.flatMap((p) => p.mentorIds)).size,
  }
})
</script>

<template>
  <div v-if="program">
    <BackBar :items="[{ label: '项目大厅', to: '/pbl' }, { label: program.title }]" />
    <section class="head card" :style="programCover(program.color)">
      <div class="mark tone">{{ program.title.slice(0, 1) }}</div>
      <div class="info">
        <h1>{{ program.title }}</h1>
        <div class="meta">{{ program.source }} · {{ program.level }} · {{ program.college }} · 合作方：{{ program.partner }}</div>
        <p>{{ program.description }}</p>
      </div>
    </section>
    <section class="stat-strip">
      <div class="stat is-key"><div class="stat-label">课题</div><div class="stat-value">{{ projects.length }}<small>个</small></div></div>
      <div class="stat"><div class="stat-label">团队</div><div class="stat-value">{{ stats.teams }}<small>支</small></div></div>
      <div class="stat"><div class="stat-label">学生</div><div class="stat-value">{{ stats.students }}<small>人</small></div></div>
      <div class="stat"><div class="stat-label">指导教师</div><div class="stat-value">{{ stats.mentors }}<small>人</small></div></div>
    </section>

    <div class="page-title sub">
      <span>拆解出的课题</span>
      <el-button v-if="!store.isStudent" type="primary" :icon="'Plus'" @click="formRef?.open(undefined, programId)">拆解新课题</el-button>
    </div>
    <div v-if="!projects.length" class="empty-tip card">还没有课题。点「拆解新课题」把大项目拆成适合学生完成的课题。</div>
    <div class="grid">
      <ProjectCard v-for="p in projects" :key="p.id" :project="p" />
    </div>
    <ProjectFormDialog ref="formRef" @saved="(id) => router.push(`/pbl/projects/${id}`)" />
  </div>
  <el-result v-else icon="warning" title="项目不存在" />
</template>

<style scoped>
.head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 16px;
}
.mark {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-size: 22px;
  font-weight: 600;
  flex-shrink: 0;
}
.info {
  flex: 1;
  min-width: 0;
}
h1 {
  margin: 0 0 2px;
  font-size: 20px;
  line-height: 28px;
  letter-spacing: -0.01em;
}
.meta {
  font-size: 13px;
  color: var(--ch-text-2);
}
p {
  margin: 10px 0 0;
  line-height: 1.7;
  color: var(--ch-text);
  max-width: 820px;
}
.page-title.sub {
  font-size: 16px;
  margin: 28px 0 12px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}
</style>

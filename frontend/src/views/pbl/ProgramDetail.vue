<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import ProjectCard from '@/components/pbl/ProjectCard.vue'
import ProjectFormDialog from '@/components/pbl/ProjectFormDialog.vue'
import { usePblStore } from '@/stores/pbl'
import { programCover } from '@/utils/pbl'

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
    <el-breadcrumb separator="/" class="crumb">
      <el-breadcrumb-item :to="'/pbl'">项目大厅</el-breadcrumb-item>
      <el-breadcrumb-item>{{ program.title }}</el-breadcrumb-item>
    </el-breadcrumb>
    <section class="head" :style="programCover(program.color)">
      <div class="info">
        <div class="flex">
          <el-tag effect="light">{{ program.source }}</el-tag>
          <el-tag effect="plain" class="light">{{ program.level }}</el-tag>
        </div>
        <h2>{{ program.title }}</h2>
        <p>{{ program.description }}</p>
        <div class="meta">关联学院：{{ program.college }}　·　合作方：{{ program.partner }}</div>
      </div>
      <div class="nums">
        <div><b>{{ projects.length }}</b><span>课题</span></div>
        <div><b>{{ stats.teams }}</b><span>团队</span></div>
        <div><b>{{ stats.students }}</b><span>学生</span></div>
        <div><b>{{ stats.mentors }}</b><span>指导教师</span></div>
      </div>
    </section>

    <div class="page-title">
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
.crumb {
  margin-bottom: 14px;
}
.head {
  color: #fff;
  border-radius: 12px;
  padding: 22px 26px;
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 20px;
}
.info {
  flex: 1;
  min-width: 280px;
}
.light {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.6);
  background: transparent;
}
h2 {
  margin: 10px 0 6px;
}
p {
  margin: 0 0 8px;
  line-height: 1.7;
  opacity: 0.95;
}
.meta {
  font-size: 13px;
  opacity: 0.85;
}
.nums {
  display: flex;
  gap: 24px;
}
.nums div {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.nums b {
  font-size: 26px;
}
.nums span {
  font-size: 12px;
  opacity: 0.85;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}
</style>

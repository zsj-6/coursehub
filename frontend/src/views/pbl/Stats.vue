<script setup lang="ts">
import { computed, ref } from 'vue'
import BarChart from '@/components/pbl/BarChart.vue'
import GanttChart from '@/components/pbl/GanttChart.vue'
import PieChart from '@/components/pbl/PieChart.vue'
import type { ProjectStatus } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { PROJECT_STATUS, STATUS_COLOR } from '@/utils/pbl'

const store = usePblStore()
/** 管理员看全校（学院）数据；指导教师看自己指导的项目。 */
const scope = computed(() => (store.isAdmin ? store.data.projects : store.myProjects))
const teams = computed(() => store.data.teams.filter((t) => scope.value.some((p) => p.id === t.projectId)))

const overview = computed(() => ({
  programs: new Set(scope.value.map((p) => p.programId)).size,
  projects: scope.value.length,
  partners: new Set(scope.value.map((p) => store.program(p.programId)?.partner)).size,
  mentors: new Set(scope.value.flatMap((p) => p.mentorIds)).size,
  students: new Set(teams.value.flatMap((t) => t.memberIds)).size,
}))

const statusPie = computed(() =>
  (Object.keys(PROJECT_STATUS) as ProjectStatus[]).map((s) => ({
    label: PROJECT_STATUS[s].text, value: scope.value.filter((p) => p.status === s).length, color: STATUS_COLOR[s],
  })).filter((x) => x.value),
)
const levelPie = computed(() => {
  const colors: Record<string, string> = { 本科: '#3bb4b8', 研究生: '#9270ca', 本研: '#5b8ff9' }
  return ['本科', '研究生', '本研']
    .map((l) => ({ label: l, value: scope.value.filter((p) => store.program(p.programId)?.level === l).length, color: colors[l] }))
    .filter((x) => x.value)
})
const byCollege = computed(() => {
  const colleges = [...new Set(store.data.programs.map((g) => g.college))]
  return colleges.map((c) => {
    const progs = store.data.programs.filter((g) => g.college === c)
    return { label: c, values: [progs.length, scope.value.filter((p) => progs.some((g) => g.id === p.programId)).length] }
  })
})

const view = ref<'gantt' | 'table'>('gantt')
const ganttProjects = computed(() => scope.value.filter((p) => p.status === 'running' || p.status === 'recruiting'))
const rows = computed(() =>
  scope.value
    .map((p) => ({
      p,
      mentors: p.mentorIds.map((m) => store.person(m)?.name).join('、'),
      teams: store.teamsOf(p.id).length,
      resources: store.data.resources.filter((r) => r.projectId === p.id).length,
      tasks: store.tasksOf(p.id).length,
      posts: store.data.posts.filter((x) => store.topicsOf(p.id).some((c) => c.id === x.topicId)).length,
      views: p.views,
      interested: p.interestedIds.length,
    }))
    .sort((a, b) => b.views + b.interested * 20 - (a.views + a.interested * 20)),
)
</script>

<template>
  <div>
    <div class="page-title">
      <span>{{ store.isAdmin ? '学院项目统计' : '我指导的项目统计' }}</span>
      <span class="muted">数据为原型演示数据</span>
    </div>
    <div class="ov">
      <div><el-icon><Collection /></el-icon><b>{{ overview.programs }}</b><span>大项目</span></div>
      <div><el-icon><Tickets /></el-icon><b>{{ overview.projects }}</b><span>课题</span></div>
      <div><el-icon><OfficeBuilding /></el-icon><b>{{ overview.partners }}</b><span>合作方</span></div>
      <div><el-icon><Avatar /></el-icon><b>{{ overview.mentors }}</b><span>参与教师</span></div>
      <div><el-icon><User /></el-icon><b>{{ overview.students }}</b><span>参与学生</span></div>
    </div>

    <div class="charts">
      <div class="card"><h4>按项目状态</h4><PieChart :items="statusPie" title="课题" /></div>
      <div class="card"><h4>按本研</h4><PieChart :items="levelPie" title="课题" /></div>
      <div class="card"><h4>各学院建设数量</h4>
        <BarChart :rows="byCollege" :series="[{ name: '大项目', color: '#5b8ff9' }, { name: '课题', color: '#3bb4b8' }]" />
      </div>
    </div>

    <div class="card">
      <div class="flex" style="margin-bottom: 12px">
        <h4 style="margin: 0">项目运行</h4>
        <div class="spacer" />
        <el-radio-group v-model="view" size="small">
          <el-radio-button value="gantt">进度甘特图</el-radio-button>
          <el-radio-button value="table">关键数据</el-radio-button>
        </el-radio-group>
      </div>
      <GanttChart v-if="view === 'gantt'" :projects="ganttProjects" />
      <el-table v-else :data="rows" size="small">
        <el-table-column label="课题" min-width="180">
          <template #default="{ row }"><router-link :to="`/pbl/projects/${row.p.id}`">{{ row.p.title }}</router-link></template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }"><el-tag size="small" :type="PROJECT_STATUS[row.p.status as ProjectStatus].type">{{ PROJECT_STATUS[row.p.status as ProjectStatus].text }}</el-tag></template>
        </el-table-column>
        <el-table-column label="指导教师" prop="mentors" width="140" />
        <el-table-column label="团队" prop="teams" width="70" sortable />
        <el-table-column label="资源" prop="resources" width="70" sortable />
        <el-table-column label="任务" prop="tasks" width="70" sortable />
        <el-table-column label="讨论" prop="posts" width="70" sortable />
        <el-table-column label="浏览" prop="views" width="80" sortable />
        <el-table-column label="收藏" prop="interested" width="90" sortable />
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.ov {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.ov div {
  background: #fff;
  border: 1px solid var(--ch-border);
  border-radius: 10px;
  padding: 14px;
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 10px;
  align-items: center;
}
.ov .el-icon {
  grid-row: span 2;
  font-size: 28px;
  color: var(--ch-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 10px;
  padding: 8px;
  width: 44px;
  height: 44px;
}
.ov b {
  font-size: 22px;
}
.ov span {
  font-size: 12px;
  color: var(--ch-text-2);
}
.charts {
  display: grid;
  grid-template-columns: 1fr 1fr 1.2fr;
  gap: 12px;
  margin-bottom: 14px;
}
h4 {
  margin: 0 0 12px;
}
@media (max-width: 1000px) {
  .charts {
    grid-template-columns: 1fr;
  }
  .ov {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

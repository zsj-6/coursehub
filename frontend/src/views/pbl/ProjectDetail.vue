<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BarChart from '@/components/pbl/BarChart.vue'
import DiscussionBoard from '@/components/pbl/DiscussionBoard.vue'
import MilestoneTrack from '@/components/pbl/MilestoneTrack.vue'
import PersonAvatar from '@/components/pbl/PersonAvatar.vue'
import PieChart from '@/components/pbl/PieChart.vue'
import ProjectFormDialog from '@/components/pbl/ProjectFormDialog.vue'
import ResourcePanel from '@/components/pbl/ResourcePanel.vue'
import TaskFormDialog from '@/components/pbl/TaskFormDialog.vue'
import TeamingPanel from '@/components/pbl/TeamingPanel.vue'
import type { ResourceKind, Task, Team } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { fmt } from '@/utils/format'
import { KIND_ICON, PROJECT_STATUS, TASK_STATE, programCover } from '@/utils/pbl'

const props = defineProps<{ projectId: string }>()
const store = usePblStore()
const route = useRoute()
const router = useRouter()

const project = computed(() => store.project(props.projectId))
const program = computed(() => (project.value ? store.program(project.value.programId) : undefined))
const manage = computed(() => !!project.value && store.canManage(project.value))
const teams = computed(() => store.teamsOf(props.projectId))
const mine = computed(() => store.myTeam(props.projectId))
const tasks = computed(() => store.tasksOf(props.projectId))

const tab = computed({
  get: () => (route.query.tab as string) || 'overview',
  set: (v) => router.replace({ query: { ...route.query, tab: v } }),
})

onMounted(() => {
  if (project.value && store.isStudent) store.view(project.value)
})

const formRef = ref<InstanceType<typeof ProjectFormDialog>>()
const taskRef = ref<InstanceType<typeof TaskFormDialog>>()

async function togglePublish() {
  const p = project.value!
  if (p.published) {
    await ElMessageBox.confirm('取消发布后学生将看不到这个课题。', '取消发布', { type: 'warning' })
    store.setPublished(p, false)
    ElMessage.success('已取消发布')
  } else {
    store.setPublished(p, true)
    ElMessage.success('已发布，学生可以浏览和报名了')
  }
}
async function finish() {
  await ElMessageBox.confirm('确认结项？结项后可以对各团队进行项目评价并展示优秀成果。', '结项')
  store.finishProject(project.value!)
  tab.value = 'results'
}

// ---- 任务 ----
const tasksByMs = computed(() =>
  (project.value?.milestones ?? []).map((m, i) => ({ m, i, tasks: tasks.value.filter((k) => k.milestoneId === m.id) })),
)
function taskStats(k: Task) {
  const subs = teams.value.map((t) => store.latestSub(k.id, t.id))
  return {
    submitted: subs.filter(Boolean).length,
    graded: subs.filter((s) => s && s.score !== null).length,
    total: teams.value.length,
  }
}
async function delTask(k: Task) {
  await ElMessageBox.confirm(`删除任务「${k.title}」及其所有提交？`, '提示', { type: 'warning' })
  store.removeTask(k)
}

const recommended = computed(() => store.recommended(props.projectId))

// ---- 评价与成果 ----
const evalDlg = reactive({ show: false, team: null as Team | null, score: 80, comment: '' })
function openEval(t: Team) {
  Object.assign(evalDlg, { show: true, team: t, score: t.evaluation?.score ?? store.suggestedScore(t), comment: t.evaluation?.comment ?? '' })
}
function saveEval() {
  if (!evalDlg.team) return
  store.evaluate(evalDlg.team, evalDlg.score, evalDlg.comment)
  evalDlg.show = false
  ElMessage.success('评价已保存')
}
const showDlg = reactive({ show: false, team: null as Team | null, title: '', summary: '', highlights: '' })
function openShowcase(t: Team) {
  Object.assign(showDlg, {
    show: true, team: t,
    title: t.showcase?.title ?? `${t.name}：${project.value?.title}成果`,
    summary: t.showcase?.summary ?? '',
    highlights: t.showcase?.highlights.join('\n') ?? '',
  })
}
function saveShowcase() {
  if (!showDlg.team || !showDlg.title.trim()) return ElMessage.warning('请填写成果标题')
  store.publishShowcase(showDlg.team, { title: showDlg.title.trim(), summary: showDlg.summary, highlights: showDlg.highlights.split('\n').map((s) => s.trim()).filter(Boolean) })
  showDlg.show = false
  ElMessage.success('已发布到成果展示区')
}
const visibleEvalTeams = computed(() => (manage.value ? teams.value : teams.value.filter((t) => t.id === mine.value?.id)))
const showcased = computed(() => teams.value.filter((t) => t.showcase))

// ---- 统计 ----
const kindPie = computed(() => {
  const rs = store.resourcesOf(props.projectId)
  const label: Record<ResourceKind, string> = { pdf: 'PDF', video: '视频', doc: '文档', ppt: '演示文稿', code: '代码/数据', image: '图片' }
  return (Object.keys(label) as ResourceKind[])
    .map((k) => ({ label: label[k], value: rs.filter((r) => r.kind === k).length, color: KIND_ICON[k].color }))
    .filter((x) => x.value)
})
const activity = computed(() =>
  teams.value.map((t) => {
    const m = store.teamMetrics(t)
    const subs = store.data.submissions.filter((s) => s.teamId === t.id).length
    return { label: t.name, values: [subs, m.posts, m.resources] }
  }),
)
const overview = computed(() => ({
  teams: teams.value.length,
  resources: store.resourcesOf(props.projectId).length,
  tasks: tasks.value.length,
  posts: store.data.posts.filter((x) => store.topicsOf(props.projectId).some((c) => c.id === x.topicId)).length,
}))
</script>

<template>
  <div v-if="project && store.canSee(project)">
    <el-breadcrumb separator="/" class="crumb">
      <el-breadcrumb-item :to="'/pbl'">项目大厅</el-breadcrumb-item>
      <el-breadcrumb-item :to="`/pbl/programs/${project.programId}`">{{ program?.title }}</el-breadcrumb-item>
      <el-breadcrumb-item>{{ project.title }}</el-breadcrumb-item>
    </el-breadcrumb>

    <section class="head card">
      <div class="cover" :style="programCover(program?.color ?? 0)">{{ project.title.slice(0, 4) }}</div>
      <div class="info">
        <div class="flex wrap">
          <h2>{{ project.title }}</h2>
          <el-tag :type="PROJECT_STATUS[project.status].type" effect="dark">{{ PROJECT_STATUS[project.status].text }}</el-tag>
          <el-tag v-if="!project.published" type="info">未发布（学生不可见）</el-tag>
        </div>
        <div class="muted">{{ program?.title }} · {{ program?.source }} · {{ program?.partner }}</div>
        <div class="flex wrap meta">
          <span class="flex">指导教师
            <PersonAvatar v-for="m in project.mentorIds" :id="m" :key="m" :size="24" show-name />
          </span>
          <el-tag v-for="t in project.tags" :key="t" size="small" effect="plain" round>{{ t }}</el-tag>
          <span class="muted"><el-icon><View /></el-icon> {{ project.views }} 次浏览</span>
          <span class="muted"><el-icon><Star /></el-icon> {{ project.interestedIds.length }} 人感兴趣</span>
        </div>
      </div>
      <div class="ops">
        <template v-if="store.isStudent">
          <el-button :type="project.interestedIds.includes(store.personaId) ? 'warning' : 'default'" :icon="project.interestedIds.includes(store.personaId) ? 'StarFilled' : 'Star'" @click="store.toggleInterest(project)">
            {{ project.interestedIds.includes(store.personaId) ? '已感兴趣' : '感兴趣' }}
          </el-button>
          <el-button v-if="mine && project.status !== 'recruiting'" type="primary" :icon="'Right'" @click="router.push(`/pbl/projects/${project.id}/teams/${mine.id}`)">进入团队空间</el-button>
          <el-button v-else-if="!mine && project.status === 'recruiting'" type="primary" @click="tab = 'teaming'">报名 / 组队</el-button>
        </template>
        <template v-if="manage">
          <el-button :icon="'Edit'" @click="formRef?.open(project)">编辑</el-button>
          <el-button :type="project.published ? 'default' : 'primary'" @click="togglePublish">{{ project.published ? '取消发布' : '发布' }}</el-button>
          <el-button v-if="project.status === 'running'" type="success" plain @click="finish">结项</el-button>
        </template>
      </div>
    </section>

    <section class="card track-card">
      <MilestoneTrack :milestones="project.milestones" />
    </section>

    <el-tabs v-model="tab" class="card tabs">
      <el-tab-pane label="概览" name="overview">
        <div class="two">
          <div>
            <h4>课题简介</h4>
            <p class="rich-text">{{ project.summary }}</p>
            <h4>项目目标</h4>
            <ol class="goals">
              <li v-for="g in project.goals" :key="g">{{ g }}</li>
            </ol>
            <h4>关卡与任务</h4>
            <el-timeline>
              <el-timeline-item v-for="x in tasksByMs" :key="x.m.id" :type="store.milestoneState(x.m) === 'done' ? 'primary' : store.milestoneState(x.m) === 'current' ? 'warning' : 'info'" :hollow="store.milestoneState(x.m) === 'upcoming'" :timestamp="`${fmt(x.m.start, 'MM-DD')} ~ ${fmt(x.m.end, 'MM-DD')}`" placement="top">
                <b>关卡 {{ x.i + 1 }} · {{ x.m.title }}</b>
                <div class="muted">{{ x.m.description }}</div>
                <div v-for="k in x.tasks" :key="k.id" class="ms-task">
                  <el-icon><Document /></el-icon> {{ k.title }} <span class="muted">截止 {{ fmt(k.dueAt, 'MM-DD HH:mm') }}</span>
                  <el-tag v-if="mine" size="small" :type="TASK_STATE[store.taskState(k, mine.id)].type">{{ TASK_STATE[store.taskState(k, mine.id)].text }}</el-tag>
                </div>
              </el-timeline-item>
            </el-timeline>
          </div>
          <aside>
            <h4>指导教师</h4>
            <div v-for="m in project.mentorIds" :key="m" class="mentor">
              <PersonAvatar :id="m" :size="40" />
              <div>
                <b>{{ store.person(m)?.name }}</b> <span class="muted">{{ store.person(m)?.title }} · {{ store.person(m)?.college }}</span>
                <div class="muted">{{ store.person(m)?.bio }}</div>
              </div>
            </div>
            <h4>推荐内容 <span class="muted">（老师推荐的优秀提交）</span></h4>
            <div v-if="!recommended.length" class="muted">暂无</div>
            <div v-for="s in recommended" :key="s.id" class="rec">
              <div class="flex"><el-icon color="#f6b93b"><Medal /></el-icon><b>{{ store.team(s.teamId)?.name }}</b> · {{ store.task(s.taskId)?.title }}</div>
              <div class="muted">{{ s.content }}</div>
              <div class="files"><el-tag v-for="f in s.files" :key="f" size="small" effect="plain">{{ f }}</el-tag></div>
            </div>
          </aside>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="`组队（${teams.length}）`" name="teaming">
        <TeamingPanel :project-id="project.id" />
      </el-tab-pane>

      <el-tab-pane :label="`任务（${tasks.length}）`" name="tasks">
        <div class="flex" style="margin-bottom: 12px">
          <span class="muted">任务以团队为单位提交。{{ store.isStudent ? '在团队空间里提交。' : '' }}</span>
          <div class="spacer" />
          <el-button v-if="manage" type="primary" :icon="'Plus'" @click="taskRef?.open()">布置任务</el-button>
        </div>
        <div v-for="x in tasksByMs" :key="x.m.id" class="ms-block">
          <div class="ms-title">关卡 {{ x.i + 1 }} · {{ x.m.title }}
            <el-button v-if="manage" link type="primary" size="small" :icon="'Plus'" @click="taskRef?.open(undefined, x.m.id)">本关卡加任务</el-button>
          </div>
          <div v-if="!x.tasks.length" class="muted pad">本关卡暂无任务</div>
          <div v-for="k in x.tasks" :key="k.id" class="task-row">
            <div class="tr-main">
              <b>{{ k.title }}</b>
              <div class="muted">{{ fmt(k.openAt, 'MM-DD HH:mm') }} 开放 · {{ fmt(k.dueAt, 'MM-DD HH:mm') }} 截止 · {{ k.maxAttempts ? `最多提交 ${k.maxAttempts} 次` : '提交次数不限' }} · 满分 {{ k.fullScore }}</div>
            </div>
            <template v-if="manage">
              <div class="tr-stat">
                <span>已交 <b>{{ taskStats(k).submitted }}</b>/{{ taskStats(k).total }}</span>
                <span>已评 <b>{{ taskStats(k).graded }}</b></span>
              </div>
              <el-button size="small" type="primary" plain @click="router.push(`/pbl/projects/${project.id}/tasks/${k.id}`)">评阅</el-button>
              <el-button size="small" link :icon="'Edit'" @click="taskRef?.open(k)" />
              <el-button size="small" link type="danger" :icon="'Delete'" @click="delTask(k)" />
            </template>
            <template v-else-if="mine">
              <el-tag :type="TASK_STATE[store.taskState(k, mine.id)].type">{{ TASK_STATE[store.taskState(k, mine.id)].text }}</el-tag>
              <el-button size="small" link type="primary" @click="router.push(`/pbl/projects/${project.id}/teams/${mine.id}`)">去团队空间</el-button>
            </template>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="资源" name="resources">
        <ResourcePanel :project-id="project.id" />
      </el-tab-pane>

      <el-tab-pane label="讨论" name="discuss">
        <DiscussionBoard :project-id="project.id" />
      </el-tab-pane>

      <el-tab-pane label="评价与成果" name="results">
        <el-alert v-if="manage && project.status !== 'finished'" type="info" :closable="false" show-icon style="margin-bottom: 12px"
          title="评价参考分按规则自动计算：任务 60%（提交率与得分）、讨论参与 15%、资源贡献 15%、获赞 10%。最终分数由指导教师决定。" />
        <el-table :data="visibleEvalTeams" empty-text="还没有团队">
          <el-table-column label="团队" width="120">
            <template #default="{ row }"><b>{{ row.name }}</b></template>
          </el-table-column>
          <el-table-column label="成员" min-width="160">
            <template #default="{ row }">
              <span class="avs"><PersonAvatar v-for="sid in row.memberIds" :id="sid" :key="sid" :size="24" :leader="row.leaderId === sid" /></span>
            </template>
          </el-table-column>
          <el-table-column label="任务提交" width="90">
            <template #default="{ row }">{{ store.teamMetrics(row as Team).submitted }}/{{ store.teamMetrics(row as Team).taskTotal }}</template>
          </el-table-column>
          <el-table-column label="任务均分" width="90">
            <template #default="{ row }">{{ store.teamMetrics(row as Team).avgScore }}</template>
          </el-table-column>
          <el-table-column label="发帖" width="70">
            <template #default="{ row }">{{ store.teamMetrics(row as Team).posts }}</template>
          </el-table-column>
          <el-table-column label="资源" width="70">
            <template #default="{ row }">{{ store.teamMetrics(row as Team).resources }}</template>
          </el-table-column>
          <el-table-column label="参考分" width="80">
            <template #default="{ row }"><span class="muted">{{ store.suggestedScore(row as Team) }}</span></template>
          </el-table-column>
          <el-table-column label="项目评价" min-width="200">
            <template #default="{ row }">
              <template v-if="row.evaluation">
                <b class="score">{{ row.evaluation.score }}</b>
                <span class="muted">{{ row.evaluation.comment }}</span>
              </template>
              <span v-else class="muted">未评价</span>
            </template>
          </el-table-column>
          <el-table-column v-if="manage" label="" width="170" align="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openEval(row as Team)">{{ row.evaluation ? '修改评价' : '评价' }}</el-button>
              <el-button size="small" link type="warning" @click="openShowcase(row as Team)">{{ row.showcase ? '编辑成果' : '设为优秀成果' }}</el-button>
            </template>
          </el-table-column>
        </el-table>

        <h4 style="margin-top: 20px">成果展示</h4>
        <div v-if="!showcased.length" class="muted">还没有展示的成果</div>
        <div class="showcases">
          <div v-for="t in showcased" :key="t.id" class="sc">
            <div class="flex"><el-icon color="#f6b93b" size="20"><Trophy /></el-icon><b>{{ t.showcase!.title }}</b></div>
            <div class="muted">{{ t.name }} · {{ fmt(t.showcase!.at, 'YYYY-MM-DD') }}</div>
            <p>{{ t.showcase!.summary }}</p>
            <ul><li v-for="h in t.showcase!.highlights" :key="h">{{ h }}</li></ul>
            <el-button v-if="manage" size="small" link type="danger" @click="store.withdrawShowcase(t)">撤下</el-button>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane v-if="manage" label="统计" name="stats">
        <div class="ov">
          <div><b>{{ overview.teams }}</b><span>团队</span></div>
          <div><b>{{ overview.resources }}</b><span>资源</span></div>
          <div><b>{{ overview.tasks }}</b><span>任务</span></div>
          <div><b>{{ overview.posts }}</b><span>讨论帖</span></div>
        </div>
        <div class="two">
          <div class="card">
            <h4>项目资源建设</h4>
            <PieChart :items="kindPie" title="资源" />
          </div>
          <div class="card">
            <h4>团队活跃度</h4>
            <BarChart :rows="activity" :series="[{ name: '任务提交', color: '#3bb4b8' }, { name: '讨论发帖', color: '#5b8ff9' }, { name: '上传资源', color: '#f6903d' }]" />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <ProjectFormDialog ref="formRef" />
    <TaskFormDialog ref="taskRef" :project-id="project.id" />

    <el-dialog v-model="evalDlg.show" :title="`项目评价 · ${evalDlg.team?.name}`" width="500px">
      <template v-if="evalDlg.team">
        <div class="metrics">
          <span>任务提交 {{ store.teamMetrics(evalDlg.team).submitted }}/{{ store.teamMetrics(evalDlg.team).taskTotal }}</span>
          <span>任务均分 {{ store.teamMetrics(evalDlg.team).avgScore }}</span>
          <span>发帖 {{ store.teamMetrics(evalDlg.team).posts }}</span>
          <span>资源 {{ store.teamMetrics(evalDlg.team).resources }}</span>
          <span>获赞 {{ store.teamMetrics(evalDlg.team).likes }}</span>
        </div>
        <el-form label-width="70px">
          <el-form-item label="评分">
            <el-slider v-model="evalDlg.score" :max="100" show-input style="width: 100%" />
            <span class="muted">规则参考分 {{ store.suggestedScore(evalDlg.team) }}</span>
          </el-form-item>
          <el-form-item label="评语"><el-input v-model="evalDlg.comment" type="textarea" :rows="4" /></el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="evalDlg.show = false">取消</el-button>
        <el-button type="primary" @click="saveEval">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showDlg.show" :title="`发布优秀成果 · ${showDlg.team?.name}`" width="560px">
      <el-form label-width="70px">
        <el-form-item label="标题"><el-input v-model="showDlg.title" /></el-form-item>
        <el-form-item label="简介"><el-input v-model="showDlg.summary" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="亮点"><el-input v-model="showDlg.highlights" type="textarea" :rows="4" placeholder="每行一条" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDlg.show = false">取消</el-button>
        <el-button type="primary" @click="saveShowcase">发布到成果展示</el-button>
      </template>
    </el-dialog>
  </div>
  <el-result v-else icon="warning" title="课题不存在或未发布">
    <template #extra><el-button type="primary" @click="router.push('/pbl')">回到项目大厅</el-button></template>
  </el-result>
</template>

<style scoped>
.crumb {
  margin-bottom: 14px;
}
.head {
  display: flex;
  gap: 18px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.cover {
  width: 84px;
  height: 84px;
  border-radius: 12px;
  color: #fff;
  font-weight: 700;
  display: grid;
  place-items: center;
  font-size: 15px;
  text-align: center;
  padding: 8px;
}
.info {
  flex: 1;
  min-width: 260px;
  display: grid;
  gap: 6px;
}
.info h2 {
  margin: 0;
  font-size: 20px;
}
.wrap {
  flex-wrap: wrap;
}
.meta {
  gap: 12px;
}
.ops {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.track-card {
  margin-bottom: 12px;
}
.tabs {
  padding-top: 4px;
}
.two {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 24px;
}
h4 {
  margin: 12px 0 8px;
}
.goals {
  padding-left: 20px;
  line-height: 1.9;
}
.ms-task {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 13px;
}
.mentor {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.rec {
  border: 1px solid #f6e3b5;
  background: #fffcf3;
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 8px;
  display: grid;
  gap: 4px;
}
.files {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.ms-block {
  margin-bottom: 16px;
}
.ms-title {
  font-weight: 600;
  padding: 6px 10px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-bottom: 6px;
}
.pad {
  padding: 6px 10px;
}
.task-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-bottom: 1px solid #f0f2f5;
  flex-wrap: wrap;
}
.tr-main {
  flex: 1;
  min-width: 240px;
}
.tr-stat {
  display: flex;
  gap: 12px;
  font-size: 13px;
}
.avs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.score {
  font-size: 18px;
  color: var(--ch-primary);
  margin-right: 8px;
}
.showcases {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}
.sc {
  border: 1px solid #f6e3b5;
  background: linear-gradient(135deg, #fffcf3, #fff);
  border-radius: 10px;
  padding: 14px;
}
.sc p {
  line-height: 1.7;
}
.ov {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.ov div {
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ov b {
  font-size: 24px;
  color: var(--ch-primary);
}
.metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  background: #f7f9fb;
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 14px;
  font-size: 13px;
}
@media (max-width: 860px) {
  .two {
    grid-template-columns: 1fr;
  }
  .ov {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

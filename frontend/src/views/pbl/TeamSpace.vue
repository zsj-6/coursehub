<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import DiscussionBoard from '@/components/pbl/DiscussionBoard.vue'
import MilestoneTrack from '@/components/pbl/MilestoneTrack.vue'
import PersonAvatar from '@/components/pbl/PersonAvatar.vue'
import ResourcePanel from '@/components/pbl/ResourcePanel.vue'
import type { Task } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { fmt, fromNow } from '@/utils/format'
import { TASK_STATE } from '@/utils/pbl'

const props = defineProps<{ projectId: string; teamId: string }>()
const store = usePblStore()
const router = useRouter()

const project = computed(() => store.project(props.projectId))
const team = computed(() => store.team(props.teamId))
const manage = computed(() => !!project.value && store.canManage(project.value))
const isMember = computed(() => !!team.value?.memberIds.includes(store.personaId))
const allowed = computed(() => !!project.value && !!team.value && (manage.value || isMember.value))
const teams = computed(() => store.teamsOf(props.projectId))
const tab = ref('tasks')

const tasksByMs = computed(() =>
  (project.value?.milestones ?? []).map((m, i) => ({
    m, i, state: store.milestoneState(m), tasks: store.tasksOf(props.projectId).filter((k) => k.milestoneId === m.id),
  })),
)
const doneTasks = computed(() => {
  const ks = store.tasksOf(props.projectId)
  return { done: ks.filter((k) => store.latestSub(k.id, props.teamId)).length, total: ks.length }
})

// 提交
const subDlg = reactive({ show: false, task: null as Task | null, content: '', files: [] as string[] })
const fileInput = ref<HTMLInputElement>()
function openSubmit(k: Task) {
  const used = store.subsOf(k.id, props.teamId).length
  if (k.maxAttempts && used >= k.maxAttempts) return ElMessage.warning('提交次数已用完')
  Object.assign(subDlg, { show: true, task: k, content: '', files: [] })
}
function onPick(e: Event) {
  subDlg.files.push(...Array.from((e.target as HTMLInputElement).files || []).map((f) => f.name))
}
function submit() {
  if (!subDlg.task || (!subDlg.content.trim() && !subDlg.files.length)) return ElMessage.warning('请填写内容或添加附件')
  store.submitTask(subDlg.task, props.teamId, subDlg.content.trim(), subDlg.files)
  subDlg.show = false
  ElMessage.success('提交成功，指导老师会收到提醒')
}
const expanded = ref<string[]>([])
const urgesOf = (k: Task) => k.urges.filter((u) => u.teamId === props.teamId)

async function setLeader(sid: string) {
  if (!team.value) return
  await ElMessageBox.confirm(`把组长设为 ${store.person(sid)?.name}？`, '设组长')
  team.value.leaderId = sid
}
</script>

<template>
  <div v-if="allowed && project && team">
    <el-breadcrumb separator="/" class="crumb">
      <el-breadcrumb-item :to="'/pbl'">项目大厅</el-breadcrumb-item>
      <el-breadcrumb-item :to="`/pbl/projects/${project.id}`">{{ project.title }}</el-breadcrumb-item>
      <el-breadcrumb-item>{{ team.name }}</el-breadcrumb-item>
    </el-breadcrumb>

    <section class="head">
      <div class="badge">{{ team.name.slice(0, 2) }}</div>
      <div class="info">
        <div class="flex">
          <h2>{{ team.name }}</h2>
          <el-tag v-if="isMember" type="success" effect="dark" size="small">我的团队</el-tag>
        </div>
        <div class="muted">{{ project.title }} · 指导教师 {{ project.mentorIds.map((m) => store.person(m)?.name).join('、') }}</div>
        <div class="members">
          <PersonAvatar v-for="sid in team.memberIds" :id="sid" :key="sid" :size="30" show-name :leader="project.teaming.hasLeader && team.leaderId === sid" />
        </div>
      </div>
      <div class="side-stat">
        <el-progress type="circle" :width="78" :percentage="doneTasks.total ? Math.round((doneTasks.done / doneTasks.total) * 100) : 0" />
        <span class="muted">任务完成 {{ doneTasks.done }}/{{ doneTasks.total }}</span>
      </div>
      <el-select v-if="manage" :model-value="teamId" style="width: 140px" @change="(v: string) => router.push(`/pbl/projects/${projectId}/teams/${v}`)">
        <el-option v-for="t in teams" :key="t.id" :label="`切换：${t.name}`" :value="t.id" />
      </el-select>
    </section>

    <section class="card track">
      <MilestoneTrack :milestones="project.milestones" />
    </section>

    <el-tabs v-model="tab" class="card">
      <el-tab-pane label="关卡任务" name="tasks">
        <div v-for="x in tasksByMs" :key="x.m.id" class="level" :class="x.state">
          <div class="level-head">
            <span class="lv-no">{{ x.i + 1 }}</span>
            <b>{{ x.m.title }}</b>
            <span class="muted">{{ fmt(x.m.start, 'MM-DD') }} ~ {{ fmt(x.m.end, 'MM-DD') }}</span>
            <el-tag v-if="x.state === 'current'" size="small" type="warning" effect="dark">当前关卡</el-tag>
            <el-tag v-else-if="x.state === 'done'" size="small" type="success">已通关</el-tag>
            <el-tag v-else size="small" type="info"><el-icon><Lock /></el-icon> 未解锁</el-tag>
          </div>
          <div v-if="!x.tasks.length" class="muted pad">本关卡没有任务</div>
          <div v-for="k in x.tasks" :key="k.id" class="task">
            <div class="task-top">
              <div class="t-main">
                <div class="flex">
                  <b>{{ k.title }}</b>
                  <el-tag size="small" :type="TASK_STATE[store.taskState(k, teamId)].type">{{ TASK_STATE[store.taskState(k, teamId)].text }}</el-tag>
                  <el-tag v-if="urgesOf(k).length && !store.latestSub(k.id, teamId)" size="small" type="danger" effect="plain">老师催交 {{ fromNow(urgesOf(k).at(-1)!.at) }}</el-tag>
                </div>
                <div class="muted">截止 {{ fmt(k.dueAt) }}（{{ fromNow(k.dueAt) }}） · {{ k.maxAttempts ? `已交 ${store.subsOf(k.id, teamId).length}/${k.maxAttempts} 次` : `已交 ${store.subsOf(k.id, teamId).length} 次` }}</div>
              </div>
              <el-button v-if="isMember && ['todo', 'submitted', 'graded'].includes(store.taskState(k, teamId)) && x.state !== 'upcoming'" size="small" type="primary" @click="openSubmit(k)">
                {{ store.latestSub(k.id, teamId) ? '再次提交' : '提交' }}
              </el-button>
              <el-button v-if="manage" size="small" plain @click="router.push(`/pbl/projects/${projectId}/tasks/${k.id}?team=${teamId}`)">评阅</el-button>
              <el-button size="small" link @click="expanded.includes(k.id) ? expanded.splice(expanded.indexOf(k.id), 1) : expanded.push(k.id)">
                {{ expanded.includes(k.id) ? '收起' : '详情' }}
              </el-button>
            </div>
            <el-collapse-transition>
              <div v-show="expanded.includes(k.id)" class="task-detail">
                <div class="req rich-text">{{ k.description }}</div>
                <div v-if="!store.subsOf(k.id, teamId).length" class="muted">还没有提交</div>
                <div v-for="s in store.subsOf(k.id, teamId)" :key="s.id" class="sub">
                  <div class="flex">
                    <el-tag size="small" effect="plain">第 {{ s.attempt }} 次</el-tag>
                    <span>{{ store.person(s.byId)?.name }} 提交于 {{ fmt(s.at) }}</span>
                    <el-tag v-if="s.recommended" size="small" type="warning" effect="dark">老师推荐</el-tag>
                    <div class="spacer" />
                    <b v-if="s.score !== null" class="score">{{ s.score }}<small>/{{ k.fullScore }}</small></b>
                    <span v-else class="muted">待评阅</span>
                  </div>
                  <div v-if="s.content" class="rich-text">{{ s.content }}</div>
                  <div class="files"><el-tag v-for="f in s.files" :key="f" size="small"><el-icon><Paperclip /></el-icon> {{ f }}</el-tag></div>
                  <div v-if="s.comment" class="comment"><b>老师评语：</b>{{ s.comment }}</div>
                </div>
              </div>
            </el-collapse-transition>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="团队资料" name="resources">
        <ResourcePanel :project-id="projectId" :team-id="teamId" />
      </el-tab-pane>
      <el-tab-pane label="组内讨论" name="discuss">
        <DiscussionBoard :project-id="projectId" :team-id="teamId" />
      </el-tab-pane>
      <el-tab-pane label="成员" name="members">
        <el-table :data="team.memberIds.map((id) => store.person(id)!)">
          <el-table-column label="姓名" width="160">
            <template #default="{ row }"><PersonAvatar :id="row.id" show-name :leader="team.leaderId === row.id" /></template>
          </el-table-column>
          <el-table-column label="学院" prop="college" />
          <el-table-column label="专业" prop="major" />
          <el-table-column label="年级" prop="grade" width="100" />
          <el-table-column label="角色" width="80">
            <template #default="{ row }">{{ team.leaderId === row.id ? '组长' : '组员' }}</template>
          </el-table-column>
          <el-table-column v-if="manage && project.teaming.hasLeader" width="100">
            <template #default="{ row }"><el-button v-if="team.leaderId !== row.id" link size="small" type="primary" @click="setLeader(row.id)">设为组长</el-button></template>
          </el-table-column>
        </el-table>
        <div v-if="team.evaluation" class="eval">
          <b>项目评价：</b><span class="score">{{ team.evaluation.score }}</span> {{ team.evaluation.comment }}
          <span class="muted">—— {{ store.person(team.evaluation.by)?.name }}</span>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="subDlg.show" :title="`提交：${subDlg.task?.title}`" width="560px">
      <div class="req muted rich-text">{{ subDlg.task?.description }}</div>
      <el-input v-model="subDlg.content" type="textarea" :rows="5" placeholder="说明本次提交的内容" />
      <div class="flex" style="margin-top: 10px; flex-wrap: wrap">
        <input ref="fileInput" type="file" multiple style="display: none" @change="onPick" />
        <el-button size="small" :icon="'Paperclip'" @click="fileInput?.click()">添加附件</el-button>
        <el-tag v-for="(f, i) in subDlg.files" :key="f" closable size="small" @close="subDlg.files.splice(i, 1)">{{ f }}</el-tag>
      </div>
      <div class="muted" style="margin-top: 8px">以团队名义提交，团队所有成员都能看到。原型中附件只记录文件名。</div>
      <template #footer>
        <el-button @click="subDlg.show = false">取消</el-button>
        <el-button type="primary" @click="submit">提交</el-button>
      </template>
    </el-dialog>
  </div>
  <el-result v-else icon="warning" title="你不是这个团队的成员">
    <template #extra><el-button type="primary" @click="router.push(`/pbl/projects/${projectId}`)">回到课题</el-button></template>
  </el-result>
</template>

<style scoped>
.crumb {
  margin-bottom: 14px;
}
.head {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  background: linear-gradient(120deg, #e9f7f7, #fff 60%);
  border: 1px solid var(--ch-border);
  border-radius: 12px;
  padding: 18px 22px;
  margin-bottom: 12px;
}
.badge {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--ch-primary);
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  display: grid;
  place-items: center;
}
.info {
  flex: 1;
  min-width: 240px;
  display: grid;
  gap: 6px;
}
.info h2 {
  margin: 0;
}
.members {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 4px;
}
.side-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.track {
  margin-bottom: 12px;
}
.level {
  border: 1px solid var(--ch-border);
  border-radius: 10px;
  margin-bottom: 12px;
  overflow: hidden;
}
.level.current {
  border-color: #f6c38b;
  box-shadow: 0 0 0 1px #f6c38b;
}
.level.upcoming {
  opacity: 0.65;
}
.level-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #f7f9fb;
}
.level.current .level-head {
  background: #fff7ea;
}
.lv-no {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--ch-primary);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
}
.level.upcoming .lv-no {
  background: #b8c0cc;
}
.pad {
  padding: 10px 14px;
}
.task {
  padding: 10px 14px;
  border-top: 1px solid #f0f2f5;
}
.task-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.t-main {
  flex: 1;
  min-width: 240px;
}
.task-detail {
  margin-top: 10px;
}
.req {
  background: #f7f9fb;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 10px;
  font-size: 13px;
}
.sub {
  border-left: 3px solid var(--ch-primary);
  padding: 6px 10px;
  margin-bottom: 10px;
  display: grid;
  gap: 6px;
}
.files {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.comment {
  background: #f0fafa;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
}
.score {
  color: var(--ch-primary);
  font-size: 18px;
}
.score small {
  font-size: 12px;
  color: var(--ch-text-2);
}
.eval {
  margin-top: 16px;
  padding: 12px;
  background: #fffcf3;
  border: 1px solid #f6e3b5;
  border-radius: 8px;
}
</style>

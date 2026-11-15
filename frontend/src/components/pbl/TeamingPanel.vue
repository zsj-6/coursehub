<script setup lang="ts">
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Team, TeamingRule } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { fmt, toISO } from '@/utils/format'
import PersonAvatar from './PersonAvatar.vue'

const props = defineProps<{ projectId: string }>()
const store = usePblStore()
const router = useRouter()

const project = computed(() => store.project(props.projectId)!)
const rule = computed(() => project.value.teaming)
const manage = computed(() => store.canManage(project.value))
const teams = computed(() => store.teamsOf(props.projectId))
const mine = computed(() => store.myTeam(props.projectId))
const open = computed(() => project.value.status === 'recruiting' && dayjs().isBefore(rule.value.deadline))
const signedUp = computed(() => project.value.signupIds.includes(store.personaId))
const unassigned = computed(() => store.unassigned(project.value))
const students = computed(() => store.data.people.filter((p) => p.role === 'student'))

// ---- 学生操作 ----
async function join(t: Team) {
  if (mine.value) {
    await ElMessageBox.confirm(`你已在「${mine.value.name}」，确定换到「${t.name}」？`, '换组', { type: 'warning' })
  }
  store.joinTeam(t)
  ElMessage.success(`已加入「${t.name}」`)
}
async function leave(t: Team) {
  await ElMessageBox.confirm(`确定退出「${t.name}」？`, '提示', { type: 'warning' })
  store.leaveTeam(t)
}
function doSignup() {
  if (project.value.signupIds.length >= rule.value.signupLimit) return ElMessage.warning('报名人数已满')
  store.signup(project.value)
  ElMessage.success('报名成功，截止后由老师统一分组')
}

// ---- 组队规则 ----
const ruleDlg = ref(false)
const ruleForm = reactive<TeamingRule & { deadlineDate: Date | null }>({ ...rule.value, deadlineDate: null })
function openRule() {
  Object.assign(ruleForm, { ...rule.value, deadlineDate: new Date(rule.value.deadline) })
  ruleDlg.value = true
}
function saveRule() {
  if (!ruleForm.deadlineDate) return ElMessage.warning('请设置报名截止时间')
  const { deadlineDate, ...r } = ruleForm
  store.saveTeaming(project.value, { ...r, deadline: toISO(deadlineDate)!, signupLimit: r.mode === 'free' ? r.teamCount * r.maxPerTeam : r.signupLimit })
  ruleDlg.value = false
  ElMessage.success('组队规则已保存')
}

// ---- 管理员调整 ----
async function addTeam() {
  const { value } = await ElMessageBox.prompt('团队名称', '新增团队', { inputValue: `第 ${teams.value.length + 1} 组` })
  store.createTeam(props.projectId, value)
}
async function delTeam(t: Team) {
  await ElMessageBox.confirm(`删除「${t.name}」？成员会回到未分组。`, '提示', { type: 'warning' })
  for (const s of t.memberIds) if (!project.value.signupIds.includes(s)) project.value.signupIds.push(s)
  store.removeTeam(t)
}
const addTo = ref<Team | null>(null)
const addIds = ref<string[]>([])
function openAdd(t: Team) {
  addTo.value = t
  addIds.value = []
}
function confirmAdd() {
  if (!addTo.value) return
  for (const s of addIds.value) store.addMember(addTo.value, s)
  addTo.value = null
}
function moveTo(sid: string, from: Team | null, toId: string) {
  const to = store.team(toId)
  if (!to) return
  if (from) store.removeMember(from, sid)
  store.addMember(to, sid)
}
function kick(t: Team, sid: string) {
  store.removeMember(t, sid)
  if (!project.value.signupIds.includes(sid)) project.value.signupIds.push(sid)
}

// ---- 随机分组（带动画） ----
const randDlg = ref(false)
const randForm = reactive({ by: 'count' as 'count' | 'size', n: rule.value.teamCount })
const animGroups = ref<string[][]>([])
const animPool = ref<string[]>([])
const animating = ref(false)
function openRandom() {
  if (!unassigned.value.length) return ElMessage.warning('没有待分组的学生')
  randForm.n = rule.value.teamCount
  animGroups.value = []
  animPool.value = [...unassigned.value]
  randDlg.value = true
}
async function runRandom() {
  const plan = store.planRandomGroups(project.value, randForm.by, randForm.n)
  animating.value = true
  animGroups.value = plan.map(() => [])
  animPool.value = [...unassigned.value]
  await nextTick()
  // 依次把学生"发"到各组
  const order: [number, string][] = []
  const maxLen = Math.max(...plan.map((g) => g.length))
  for (let i = 0; i < maxLen; i++) plan.forEach((g, gi) => g[i] && order.push([gi, g[i]]))
  for (const [gi, sid] of order) {
    await new Promise((r) => setTimeout(r, 180))
    animPool.value = animPool.value.filter((x) => x !== sid)
    animGroups.value[gi].push(sid)
  }
  await new Promise((r) => setTimeout(r, 400))
  animating.value = false
}
function applyRandom() {
  store.applyGroups(project.value, animGroups.value)
  randDlg.value = false
  ElMessage.success(`已生成 ${animGroups.value.length} 个团队`)
}

async function start() {
  await ElMessageBox.confirm('结束组队并开始项目？开始后学生进入团队空间按关卡推进。', '开始项目')
  store.startProject(project.value)
  ElMessage.success('项目已开始')
}
</script>

<template>
  <div>
    <!-- 规则说明 -->
    <div class="rule card-lite">
      <div class="flex wrap">
        <el-tag :type="rule.mode === 'free' ? 'success' : 'warning'" effect="dark">{{ rule.mode === 'free' ? '学生自由组队' : '报名后随机分组' }}</el-tag>
        <span v-if="rule.mode === 'free'">{{ rule.teamCount }} 个团队，每组最多 {{ rule.maxPerTeam }} 人</span>
        <span v-else>报名上限 {{ rule.signupLimit }} 人，已报名 <b>{{ project.signupIds.length }}</b> 人</span>
        <span>{{ rule.hasLeader ? '设组长（默认第一个加入的人）' : '不设组长' }}</span>
        <span :class="open ? '' : 'muted'">报名截止 {{ fmt(rule.deadline) }}{{ open ? '' : '（已截止）' }}</span>
        <div class="spacer" />
        <template v-if="manage">
          <el-button size="small" :icon="'Setting'" @click="openRule">组队规则</el-button>
          <el-button size="small" :icon="'Plus'" @click="addTeam">新增团队</el-button>
          <el-button v-if="rule.mode === 'random' || unassigned.length" size="small" type="warning" :icon="'MagicStick'" @click="openRandom">随机分组</el-button>
          <el-button v-if="project.status === 'recruiting'" size="small" type="primary" :icon="'VideoPlay'" @click="start">开始项目</el-button>
        </template>
      </div>
    </div>

    <!-- 学生：报名 / 我的团队 -->
    <el-alert v-if="store.isStudent && mine" type="success" :closable="false" show-icon class="mb">
      <template #title>
        {{ store.me.name }} 在「{{ mine.name }}」
        <el-button v-if="project.status !== 'recruiting'" link type="primary" @click="router.push(`/pbl/projects/${projectId}/teams/${mine.id}`)">进入团队空间 →</el-button>
      </template>
    </el-alert>
    <el-alert v-else-if="store.isStudent && rule.mode === 'random'" :type="signedUp ? 'success' : 'info'" :closable="false" show-icon class="mb">
      <template #title>
        <span v-if="signedUp">{{ store.me.name }}已报名，等待老师在截止后统一分组</span>
        <span v-else-if="open">以{{ store.me.name }}的身份报名，截止后由老师统一分组</span>
        <span v-else>本课题采用报名后随机分组</span>
        <el-button v-if="open && !signedUp" type="primary" size="small" style="margin-left: 12px" @click="doSignup">我要报名</el-button>
        <el-button v-if="open && signedUp" size="small" style="margin-left: 12px" @click="store.cancelSignup(project)">取消报名</el-button>
      </template>
    </el-alert>
    <el-alert v-else-if="open && !store.isStudent && !manage" type="info" :closable="false" show-icon class="mb">
      {{ rule.mode === 'random' ? '切换到学生演示视角即可报名' : '切换到学生演示视角即可加入团队' }}
    </el-alert>

    <!-- 待分组 -->
    <div v-if="manage && unassigned.length" class="pool card-lite mb">
      <div class="flex"><b>待分组（{{ unassigned.length }} 人）</b><span class="muted">已报名但还没进团队</span></div>
      <div class="pool-list">
        <span v-for="sid in unassigned" :key="sid" class="chip">
          <PersonAvatar :id="sid" :size="22" show-name />
          <el-dropdown v-if="teams.length" trigger="click" @command="(tid: string) => moveTo(sid, null, tid)">
            <el-button link size="small" type="primary">分到…</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="t in teams" :key="t.id" :command="t.id">{{ t.name }}（{{ t.memberIds.length }}）</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </span>
      </div>
    </div>

    <!-- 团队卡片 -->
    <div v-if="!teams.length" class="empty-tip">还没有团队{{ rule.mode === 'random' ? '，报名截止后点「随机分组」生成' : '' }}</div>
    <transition-group name="pop" tag="div" class="teams">
      <div v-for="t in teams" :key="t.id" class="team" :class="{ mine: mine?.id === t.id }">
        <div class="flex">
          <b class="tname">{{ t.name }}</b>
          <el-tag size="small" :type="t.memberIds.length >= rule.maxPerTeam ? 'danger' : 'info'" effect="plain">{{ t.memberIds.length }}/{{ rule.maxPerTeam }}</el-tag>
          <div class="spacer" />
          <el-button v-if="manage || mine?.id === t.id" link size="small" type="primary" @click="router.push(`/pbl/projects/${projectId}/teams/${t.id}`)">团队空间</el-button>
          <el-dropdown v-if="manage" trigger="click">
            <el-button link size="small" :icon="'MoreFilled'" />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :icon="'Plus'" @click="openAdd(t)">添加成员</el-dropdown-item>
                <el-dropdown-item :icon="'Delete'" @click="delTeam(t)">删除团队</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div class="members">
          <div v-for="sid in t.memberIds" :key="sid" class="member">
            <PersonAvatar :id="sid" :size="26" show-name :leader="rule.hasLeader && t.leaderId === sid" />
            <div class="spacer" />
            <template v-if="manage">
              <el-tooltip v-if="rule.hasLeader && t.leaderId !== sid" content="设为组长"><el-button link size="small" :icon="'Star'" @click="t.leaderId = sid" /></el-tooltip>
              <el-dropdown v-if="teams.length > 1" trigger="click" @command="(tid: string) => moveTo(sid, t, tid)">
                <el-button link size="small" :icon="'Switch'" />
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-for="o in teams.filter((x) => x.id !== t.id)" :key="o.id" :command="o.id">调到 {{ o.name }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button link size="small" type="danger" :icon="'Close'" @click="kick(t, sid)" />
            </template>
          </div>
          <div v-for="i in Math.max(0, rule.maxPerTeam - t.memberIds.length)" :key="`e${i}`" class="member slot">空位</div>
        </div>
        <div v-if="store.isStudent && rule.mode === 'free' && open" class="team-op">
          <el-button v-if="mine?.id === t.id" size="small" @click="leave(t)">退出团队</el-button>
          <el-button v-else size="small" type="primary" plain :disabled="t.memberIds.length >= rule.maxPerTeam" @click="join(t)">
            {{ t.memberIds.length >= rule.maxPerTeam ? '已满' : mine ? '换到这组' : '加入' }}
          </el-button>
        </div>
      </div>
    </transition-group>

    <!-- 组队规则对话框 -->
    <el-dialog v-model="ruleDlg" title="组队规则" width="520px">
      <el-form label-width="110px">
        <el-form-item label="组队方式">
          <el-radio-group v-model="ruleForm.mode">
            <el-radio value="free">学生自由组队</el-radio>
            <el-radio value="random">报名后随机分组</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="团队数量"><el-input-number v-model="ruleForm.teamCount" :min="1" :max="30" /></el-form-item>
        <el-form-item label="每组人数上限"><el-input-number v-model="ruleForm.maxPerTeam" :min="1" :max="20" /></el-form-item>
        <el-form-item v-if="ruleForm.mode === 'random'" label="报名人数上限"><el-input-number v-model="ruleForm.signupLimit" :min="1" :max="300" /></el-form-item>
        <el-form-item label="设置组长"><el-switch v-model="ruleForm.hasLeader" /></el-form-item>
        <el-form-item label="报名截止"><el-date-picker v-model="ruleForm.deadlineDate" type="datetime" /></el-form-item>
        <div class="muted">自由组队：保存后会按团队数量补齐空团队，学生自己选组加入。</div>
      </el-form>
      <template #footer>
        <el-button @click="ruleDlg = false">取消</el-button>
        <el-button type="primary" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>

    <!-- 添加成员 -->
    <el-dialog :model-value="!!addTo" :title="`添加成员到「${addTo?.name}」`" width="460px" @close="addTo = null">
      <el-select v-model="addIds" multiple filterable placeholder="搜索学生" style="width: 100%">
        <el-option v-for="s in students" :key="s.id" :label="`${s.name}（${s.major}）`" :value="s.id" />
      </el-select>
      <div class="muted" style="margin-top: 8px">如果学生已在本课题的其他团队，会自动调过来。</div>
      <template #footer>
        <el-button @click="addTo = null">取消</el-button>
        <el-button type="primary" @click="confirmAdd">添加</el-button>
      </template>
    </el-dialog>

    <!-- 随机分组 -->
    <el-dialog v-model="randDlg" title="随机分组" width="760px" :close-on-click-modal="!animating">
      <div class="flex wrap mb">
        <el-radio-group v-model="randForm.by" :disabled="animating">
          <el-radio value="count">按组数</el-radio>
          <el-radio value="size">按每组人数</el-radio>
        </el-radio-group>
        <el-input-number v-model="randForm.n" :min="1" :max="30" :disabled="animating" />
        <span class="muted">{{ randForm.by === 'count' ? '组' : '人/组' }}，共 {{ unassigned.length }} 人待分组</span>
        <div class="spacer" />
        <el-button type="warning" :icon="'MagicStick'" :loading="animating" @click="runRandom">{{ animGroups.length ? '重新分组' : '开始分组' }}</el-button>
      </div>
      <div class="rand-pool">
        <transition-group name="fly">
          <span v-for="sid in animPool" :key="sid" class="chip"><PersonAvatar :id="sid" :size="22" show-name /></span>
        </transition-group>
      </div>
      <div class="rand-groups">
        <div v-for="(g, i) in animGroups" :key="i" class="rand-group">
          <b>第 {{ teams.length + i + 1 }} 组</b>
          <transition-group name="fly" tag="div" class="rand-members">
            <span v-for="sid in g" :key="sid" class="chip"><PersonAvatar :id="sid" :size="22" show-name /></span>
          </transition-group>
        </div>
      </div>
      <template #footer>
        <el-button @click="randDlg = false">取消</el-button>
        <el-button type="primary" :disabled="animating || !animGroups.length" @click="applyRandom">确认生成团队</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.card-lite {
  background: #f7f9fb;
  border: 1px solid var(--ch-border);
  border-radius: 8px;
  padding: 12px 14px;
}
.rule {
  margin-bottom: 12px;
}
.wrap {
  flex-wrap: wrap;
  gap: 12px;
}
.mb {
  margin-bottom: 12px;
}
.pool-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #fff;
  border: 1px solid var(--ch-border);
  border-radius: 16px;
  padding: 3px 10px 3px 4px;
}
.teams {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}
.team {
  border: 1px solid var(--ch-border);
  border-radius: 8px;
  padding: 12px;
  background: #fff;
  transition: box-shadow 0.2s;
}
.team:hover {
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}
.team.mine {
  border-color: var(--ch-primary);
  box-shadow: 0 0 0 1px var(--ch-primary);
}
.tname {
  font-size: 15px;
}
.members {
  margin-top: 10px;
  display: grid;
  gap: 6px;
}
.member {
  display: flex;
  align-items: center;
  min-height: 28px;
}
.member.slot {
  border: 1px dashed var(--ch-border);
  border-radius: 6px;
  color: #b8c0cc;
  font-size: 12px;
  justify-content: center;
}
.team-op {
  margin-top: 10px;
  text-align: right;
}
.rand-pool {
  min-height: 48px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px;
  background: #fffaf3;
  border: 1px dashed #f6c38b;
  border-radius: 8px;
  margin-bottom: 12px;
}
.rand-groups {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}
.rand-group {
  border: 1px solid var(--ch-border);
  border-radius: 8px;
  padding: 10px;
  min-height: 90px;
}
.rand-members {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.fly-enter-active {
  transition: all 0.35s ease-out;
}
.fly-enter-from {
  opacity: 0;
  transform: translateY(-24px) scale(0.6);
}
.fly-leave-active {
  transition: all 0.2s;
  position: absolute;
}
.fly-leave-to {
  opacity: 0;
  transform: scale(0.5);
}
.pop-enter-active {
  transition: all 0.4s;
}
.pop-enter-from {
  opacity: 0;
  transform: scale(0.9);
}
</style>

<script setup lang="ts">
/**
 * 我的（领导版）：消息 / 收藏 / 学习 + 账号设置。
 * 教师、助教多一个"待我审核"：线下活动报名、实验室预约、项目申请集中处理。
 * 领导版的 L1–L3 心理预警消息属于"待领导确认"的部分，暂不放入。
 */
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PersonAvatar from '@/components/pbl/PersonAvatar.vue'
import { LEARNING } from '@/mock/growth'
import { useAiStore } from '@/stores/ai'
import { useGrowthStore, type Msg } from '@/stores/growth'
import { usePblStore } from '@/stores/pbl'

const g = useGrowthStore()
const ai = useAiStore()
const pbl = usePblStore()
const route = useRoute()
const router = useRouter()

const tab = computed({
  get: () => (route.query.tab as string) || (g.isStudent ? 'msg' : 'review'),
  set: (v) => router.replace({ query: { ...route.query, tab: v } }),
})

// ---------- 消息
const msgType = ref('ALL')
const msgs = computed(() => g.myMessages.filter((m) => msgType.value === 'ALL' || m.type === msgType.value))
const unread = computed(() => g.myMessages.filter((m) => m.status === 'UNREAD').length)
const detail = ref<Msg | null>(null)
function openMsg(m: Msg) {
  detail.value = m
  g.readMsg(m.id)
}
function readAll() {
  for (const m of g.myMessages) g.readMsg(m.id)
}
async function clearAll() {
  await ElMessageBox.confirm('清空后无法恢复，确定清空全部消息？', '清空消息', { type: 'warning' })
  g.clearMsgs()
}

// ---------- 收藏
const favCat = ref('ALL')
const favs = computed(() => g.myFavorites.filter((f) => favCat.value === 'ALL' || f.category === favCat.value))
const FAV_CATS: Record<string, string> = { RESOURCE: '资源', ACTIVITY: '活动', EXPERT: '导师 / 会话', AGENT: '智能体' }
async function unfav(id: string, title: string) {
  await ElMessageBox.confirm(`取消收藏「${title}」？`, '取消收藏', { type: 'warning' })
  g.removeFavorite(id)
}

// ---------- 学习
const levelRecords = computed(() =>
  ai.units.flatMap((u) => ai.levelsOf(u.id).filter((l) => ai.levelState(l) === 'passed').map((l) => ({ unit: u.name, title: `第 ${l.order} 关 · ${l.title}`, unitId: u.id }))),
)

// ---------- 待我审核（教师 / 助教）
const reviews = computed(() => g.pendingReviews)
const reviewCount = computed(() => reviews.value.signups.length + reviews.value.bookings.length + reviews.value.applications.length)
const actTitle = (id: string) => [...g.discussions, ...g.lectures].map((x) => ({ id: x.id, t: 'topic' in x ? x.topic : x.name })).find((x) => x.id === id)?.t ?? id
const projectTitle = (id: string) => {
  for (const u of ai.units) {
    const p = g.projectsOf(u.id).find((x) => x.id === id)
    if (p) return p.name
  }
  return id
}
const labName = (id: string) => g.labs.find((l) => l.id === id)?.name ?? id
const slotLabel = (id: string) => g.slots.find((s) => s.id === id)?.label ?? id
function decide(kind: 'signup' | 'booking' | 'application', a: { id: string; sid?: string }, ok: boolean) {
  const st = ok ? 'approved' : 'rejected'
  if (kind === 'signup') g.reviewSignup(a.id, a.sid!, st, actTitle(a.id))
  if (kind === 'booking') g.reviewBooking(a.id, st)
  if (kind === 'application') g.reviewApplication(a.id, a.sid!, st, projectTitle(a.id))
  ElMessage.success(ok ? '已通过，已通知学生' : '已驳回，已通知学生')
}

// ---------- 账号设置
const settingsOpen = ref(false)
const notify = ref({ signup: true, booking: true, ai: true })
</script>

<template>
  <div>
    <section class="card me">
      <PersonAvatar :id="pbl.personaId" :size="56" />
      <div class="me-main">
        <h2>{{ pbl.me.name }}</h2>
        <div class="muted">{{ pbl.me.college }}{{ pbl.me.major ? ` · ${pbl.me.major}` : '' }}{{ pbl.me.grade ? ` · ${pbl.me.grade}` : '' }}{{ pbl.me.title ? ` · ${pbl.me.title}` : '' }}</div>
      </div>
      <div class="me-stats">
        <div><b>{{ unread }}</b><span>未读消息</span></div>
        <div v-if="g.isStudent"><b>{{ g.myFavorites.length }}</b><span>收藏</span></div>
        <div v-if="g.isStudent"><b>{{ ai.passedList().length }}</b><span>已通过关卡</span></div>
        <div v-else><b :class="{ warn: reviewCount }">{{ reviewCount }}</b><span>待我审核</span></div>
      </div>
      <el-button :icon="'Setting'" @click="settingsOpen = true">账号设置</el-button>
    </section>

    <el-tabs v-model="tab">
      <el-tab-pane v-if="!g.isStudent" :label="`待我审核${reviewCount ? ` (${reviewCount})` : ''}`" name="review" />
      <el-tab-pane :label="`消息${unread ? ` (${unread})` : ''}`" name="msg" />
      <el-tab-pane v-if="g.isStudent" label="收藏" name="fav" />
      <el-tab-pane v-if="g.isStudent" label="学习" name="learn" />
    </el-tabs>

    <!-- 待我审核 -->
    <template v-if="tab === 'review'">
      <p class="muted hint">{{ g.canPublish ? '指导教师 / 管理员' : '助教' }}可以审核下列事项，审核结果会通过站内消息通知学生。</p>
      <section class="card rv">
        <h3 class="card-title">线下活动报名 <span class="muted">{{ reviews.signups.length }} 条</span></h3>
        <div v-if="!reviews.signups.length" class="empty-tip">没有待审核的报名</div>
        <div v-for="a in reviews.signups" :key="a.id + a.sid" class="rv-row">
          <PersonAvatar :id="a.sid" :size="28" />
          <div class="rv-main"><b>{{ g.name(a.sid) }}</b><span class="muted">报名 {{ actTitle(a.id) }}</span></div>
          <el-button size="small" type="primary" @click="decide('signup', a, true)">通过</el-button>
          <el-button size="small" @click="decide('signup', a, false)">驳回</el-button>
        </div>
      </section>
      <section class="card rv">
        <h3 class="card-title">实验室预约 <span class="muted">{{ reviews.bookings.length }} 条</span></h3>
        <div v-if="!reviews.bookings.length" class="empty-tip">没有待审核的预约</div>
        <div v-for="b in reviews.bookings" :key="b.id" class="rv-row">
          <PersonAvatar :id="b.pid" :size="28" />
          <div class="rv-main">
            <b>{{ g.name(b.pid) }}</b>
            <span class="muted">{{ labName(b.labId) }} · {{ b.date }} {{ slotLabel(b.slotId) }} · {{ b.people }} 人 · 用途：{{ b.purpose }}</span>
          </div>
          <el-button size="small" type="primary" @click="decide('booking', { id: b.id }, true)">通过</el-button>
          <el-button size="small" @click="decide('booking', { id: b.id }, false)">驳回</el-button>
        </div>
      </section>
      <section class="card rv">
        <h3 class="card-title">项目申请 <span class="muted">{{ reviews.applications.length }} 条</span></h3>
        <div v-if="!reviews.applications.length" class="empty-tip">没有待审核的申请</div>
        <div v-for="a in reviews.applications" :key="a.prj + a.sid" class="rv-row">
          <PersonAvatar :id="a.sid" :size="28" />
          <div class="rv-main">
            <b>{{ g.name(a.sid) }}</b>
            <span class="muted">申请加入 {{ projectTitle(a.prj) }}</span>
            <span>{{ a.note }}</span>
          </div>
          <el-button size="small" type="primary" @click="decide('application', { id: a.prj, sid: a.sid }, true)">通过</el-button>
          <el-button size="small" @click="decide('application', { id: a.prj, sid: a.sid }, false)">驳回</el-button>
        </div>
      </section>
    </template>

    <!-- 消息 -->
    <section v-if="tab === 'msg'" class="card">
      <div class="bar">
        <el-radio-group v-model="msgType" size="small">
          <el-radio-button value="ALL">全部</el-radio-button>
          <el-radio-button value="SYSTEM">系统通知</el-radio-button>
        </el-radio-group>
        <div class="spacer" />
        <el-button size="small" :disabled="!unread" @click="readAll">全部已读</el-button>
        <el-button size="small" :disabled="!g.myMessages.length" @click="clearAll">清空</el-button>
      </div>
      <div v-if="!msgs.length" class="empty-tip">没有消息</div>
      <div v-for="m in msgs" :key="m.id" class="msg-row" :class="{ unread: m.status === 'UNREAD' }" @click="openMsg(m)">
        <span class="dot" />
        <div class="m-main">
          <b>{{ m.title }}</b>
          <span class="muted">{{ m.desc }}</span>
        </div>
        <span class="muted time">{{ m.time }}</span>
      </div>
      <div class="muted foot">系统消息保留 90 天</div>
    </section>

    <!-- 收藏 -->
    <section v-if="tab === 'fav'" class="card">
      <div class="bar">
        <el-radio-group v-model="favCat" size="small">
          <el-radio-button value="ALL">全部</el-radio-button>
          <el-radio-button v-for="(v, k) in FAV_CATS" :key="k" :value="k">{{ v }}</el-radio-button>
        </el-radio-group>
      </div>
      <div v-if="!favs.length" class="empty-tip">还没有收藏，在今日推荐里点 ☆ 收藏</div>
      <div v-for="f in favs" :key="f.id" class="fav-row" :class="{ invalid: !f.valid }">
        <el-tag size="small" type="info">{{ f.tag }}</el-tag>
        <div class="m-main">
          <b>{{ f.title }}</b>
          <span class="muted">{{ f.source }} · 收藏于 {{ f.fav_time }}{{ f.valid ? '' : ' · 已失效' }}</span>
        </div>
        <el-button size="small" text @click="unfav(f.id, f.title)">取消收藏</el-button>
      </div>
    </section>

    <!-- 学习 -->
    <template v-if="tab === 'learn'">
      <section class="card">
        <h3 class="card-title">在学内容</h3>
        <div v-for="l in LEARNING" :key="l.id" class="learn-row">
          <div class="m-main">
            <b>{{ l.title }}</b>
            <span class="muted">{{ l.source }} · 上次学习 {{ l.last_learn }} · {{ l.learn_time }} · 预计 {{ l.estimated }}</span>
          </div>
          <el-progress :percentage="l.progress" :stroke-width="6" style="width: 200px" />
        </div>
      </section>
      <section class="card">
        <h3 class="card-title">已通过的关卡</h3>
        <div v-if="!levelRecords.length" class="empty-tip">还没有通过关卡</div>
        <router-link v-for="r in levelRecords" :key="r.unit + r.title" :to="`/units/${r.unitId}?tab=levels`" class="learn-row link">
          <div class="m-main"><b>{{ r.title }}</b><span class="muted">{{ r.unit }}</span></div>
          <el-tag size="small" type="success">已通过</el-tag>
        </router-link>
      </section>
    </template>

    <el-dialog :model-value="!!detail" :title="detail?.title" width="480px" @close="detail = null">
      <p>{{ detail?.desc }}</p>
      <p class="muted">{{ detail?.time }}</p>
    </el-dialog>

    <el-drawer v-model="settingsOpen" title="账号设置" size="380px">
      <div class="settings">
        <div class="set-row"><span>演示身份</span><b>{{ pbl.me.name }}</b></div>
        <div class="set-row"><span>登录账号</span><router-link to="/profile">修改姓名、头像、密码 →</router-link></div>
        <h4>消息通知</h4>
        <div class="set-row"><span>报名 / 申请审核结果</span><el-switch v-model="notify.signup" /></div>
        <div class="set-row"><span>实验室预约结果</span><el-switch v-model="notify.booking" /></div>
        <div class="set-row"><span>AI 推荐与学习提醒</span><el-switch v-model="notify.ai" /></div>
        <p class="muted">原型阶段通知设置只在本页有效。</p>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.me {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}
.me-main {
  flex: 1;
}
.me-main h2 {
  margin: 0 0 4px;
  font-size: 19px;
}
.me-stats {
  display: flex;
  gap: 28px;
  margin-right: 12px;
}
.me-stats div {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.me-stats b {
  font-size: 22px;
}
.me-stats b.warn {
  color: var(--ch-warning);
}
.me-stats span {
  font-size: 12px;
  color: var(--ch-text-2);
}
.hint {
  margin: 0 0 12px;
}
.rv {
  margin-bottom: 14px;
}
.card-title .muted {
  margin-left: 6px;
  font-weight: 400;
  font-size: 12px;
}
.rv-row,
.msg-row,
.fav-row,
.learn-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--ch-border-light);
}
.rv-main,
.m-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}
.rv-main b,
.m-main b {
  font-weight: 500;
  font-size: 14px;
}
.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.msg-row {
  cursor: pointer;
}
.msg-row:hover {
  background: var(--ch-fill-hover);
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}
.msg-row.unread .dot {
  background: var(--ch-danger);
}
.msg-row:not(.unread) b {
  font-weight: 400;
  color: var(--ch-text-2);
}
.time {
  font-size: 12px;
  white-space: nowrap;
}
.foot {
  margin-top: 8px;
  font-size: 12px;
  text-align: center;
}
.fav-row.invalid b {
  color: var(--ch-text-3);
  text-decoration: line-through;
}
.card + .card {
  margin-top: 14px;
}
.link {
  color: var(--ch-text);
}
.settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.set-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13.5px;
}
.set-row span {
  color: var(--ch-text-2);
}
</style>

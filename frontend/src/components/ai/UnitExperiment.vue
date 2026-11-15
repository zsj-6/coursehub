<script setup lang="ts">
/**
 * 能力单元 · 实验训练（领导版）
 *  A. 线上 VR 仿真：原型用"流程演示"——按步骤引导、记录操作日志、生成实验报告（可导出），不做真 3D
 *  B. 线下实验室预约：选实验室 → 日期 / 时段 / 机位 → 提交 → 教师或助教审核 → 站内消息 + 签到码
 */
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import PersonAvatar from '@/components/pbl/PersonAvatar.vue'
import type { Unit } from '@/mock/ai'
import { useGrowthStore, type Lab, type VrProject } from '@/stores/growth'

const props = defineProps<{ unit: Unit }>()
const g = useGrowthStore()
const mod = ref<'vr' | 'lab'>('vr')
const vrs = computed(() => g.vrOf(props.unit.id))
const DIFF: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }

// ---------- VR
const cur = ref<VrProject | null>(null)
const steps = computed(() => (cur.value ? g.vrSteps(cur.value) : []))
const run = computed(() => (cur.value ? g.vrRun(cur.value.id) : undefined))
const stepNow = computed(() => run.value?.step ?? 0)
function act() {
  if (!cur.value) return
  const r = g.vrAdvance(cur.value)
  if (r.done) ElMessage.success('实验完成，已生成实验报告')
}
function exportReport() {
  if (!cur.value || !run.value) return
  const txt = [
    `实验报告：${cur.value.name}`,
    `学生：${g.name(g.pid)}　完成时间：${dayjs(run.value.finishedAt).format('YYYY-MM-DD HH:mm')}`,
    `课程：${cur.value.subject}　步骤数：${steps.value.length}`,
    '',
    '操作日志：',
    ...run.value.log,
    '',
    '实验结论：（原型阶段由学生补充）',
  ].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }))
  a.download = `${cur.value.name}-实验报告.txt`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ---------- 实验室预约
const labFilter = ref<'all' | 'vr' | 'ai'>('all')
const labs = computed(() => g.labs.filter((l) => labFilter.value === 'all' || (labFilter.value === 'vr' ? l.vrSupport : l.aiSupport)))
const freeSeats = (l: Lab) => l.seats.filter((s) => s.status === 'FREE')
const booking = ref<Lab | null>(null)
const form = reactive({ date: dayjs().add(1, 'day').format('YYYY-MM-DD'), slotId: 'T1', seatId: '', purpose: '', people: 1 })
const dates = Array.from({ length: 7 }, (_, i) => dayjs().add(i + 1, 'day'))
function openBook(l: Lab) {
  booking.value = l
  form.seatId = freeSeats(l)[0]?.id ?? ''
  form.purpose = props.unit.id === 'robo' ? '自瞄标定实验' : ''
}
function submitBook() {
  if (!booking.value) return
  if (!form.purpose.trim()) return ElMessage.warning('请填写用途')
  const taken = g.state.bookings.some((b) => b.labId === booking.value!.id && b.date === form.date && b.slotId === form.slotId && b.seatId === form.seatId && b.status !== 'rejected')
  if (taken) return ElMessage.warning('这个机位在该时段已被预约，换一个吧')
  g.book({ labId: booking.value.id, date: form.date, slotId: form.slotId, seatId: form.seatId, purpose: form.purpose, people: form.people })
  ElMessage.success('预约已提交，审核结果会通过站内消息通知')
  booking.value = null
}
const STATUS: Record<string, { label: string; type: 'warning' | 'success' | 'danger' }> = {
  pending: { label: '待审核', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  rejected: { label: '未通过', type: 'danger' },
}
const labName = (id: string) => g.labs.find((l) => l.id === id)?.name ?? id
const slotLabel = (id: string) => g.slots.find((s) => s.id === id)?.label ?? id
function review(id: string, ok: boolean) {
  g.reviewBooking(id, ok ? 'approved' : 'rejected')
  ElMessage.success(ok ? '已通过，已把签到码发给学生' : '已驳回')
}
</script>

<template>
  <div>
    <el-radio-group v-model="mod" class="mods">
      <el-radio-button value="vr">线上 VR 仿真实验</el-radio-button>
      <el-radio-button value="lab">线下实验室预约</el-radio-button>
    </el-radio-group>

    <template v-if="mod === 'vr'">
      <p class="muted intro">网页直接进入的云端虚拟实验。原型阶段用流程演示：按步骤引导、校验操作、记录日志，结束后自动生成实验报告。</p>
      <div v-if="!vrs.length" class="card empty-tip">这个能力暂时没有线上仿真实验，可以预约线下实验室</div>
      <div class="vr-list">
        <article v-for="v in vrs" :key="v.id" class="card vr">
          <div class="v-head">
            <el-tag size="small" type="info">{{ v.subject }}</el-tag>
            <el-tag size="small">{{ DIFF[v.difficulty] }}</el-tag>
            <span class="muted">约 {{ v.mins }} 分钟 · {{ v.steps }} 步 · {{ v.doneCount }} 人做过 · 评分 {{ v.rating }}</span>
          </div>
          <b>{{ v.name }}</b>
          <p class="muted">{{ v.desc }}</p>
          <div class="v-foot">
            <span v-for="a in v.abilities" :key="a" class="tag">{{ a }}</span>
            <div class="spacer" />
            <el-tag v-if="g.vrRun(v.id)?.done" size="small" type="success">已完成</el-tag>
            <el-button size="small" type="primary" @click="cur = v">{{ g.vrRun(v.id)?.done ? '查看报告' : g.vrRun(v.id) ? '继续实验' : '进入实验' }}</el-button>
          </div>
        </article>
      </div>
    </template>

    <template v-else>
      <div class="lab-bar">
        <el-radio-group v-model="labFilter" size="small">
          <el-radio-button value="all">全部实验室</el-radio-button>
          <el-radio-button value="vr">支持 VR</el-radio-button>
          <el-radio-button value="ai">支持 AI 实训</el-radio-button>
        </el-radio-group>
      </div>

      <section v-if="g.canReview && g.pendingBookings.length" class="card pending">
        <h3 class="card-title">待审核的预约 <span class="muted">{{ g.canPublish ? '指导教师' : '助教' }}可审核</span></h3>
        <div v-for="b in g.pendingBookings" :key="b.id" class="row">
          <PersonAvatar :id="b.pid" :size="26" />
          <div class="r-main"><b>{{ g.name(b.pid) }}</b><span class="muted">{{ labName(b.labId) }} · {{ b.date }} {{ slotLabel(b.slotId) }} · {{ b.people }} 人 · {{ b.purpose }}</span></div>
          <el-button size="small" type="primary" @click="review(b.id, true)">通过</el-button>
          <el-button size="small" @click="review(b.id, false)">驳回</el-button>
        </div>
      </section>

      <section v-if="g.isStudent && g.myBookings.length" class="card mine">
        <h3 class="card-title">我的预约</h3>
        <div v-for="b in g.myBookings" :key="b.id" class="row">
          <div class="r-main"><b>{{ labName(b.labId) }}</b><span class="muted">{{ b.date }} {{ slotLabel(b.slotId) }} · {{ b.purpose }}</span></div>
          <el-tag size="small" :type="STATUS[b.status].type">{{ STATUS[b.status].label }}</el-tag>
          <span v-if="b.code" class="code">签到码 {{ b.code }}</span>
          <el-button v-if="b.status === 'pending'" size="small" text @click="g.cancelBooking(b.id)">取消</el-button>
        </div>
      </section>

      <div class="labs">
        <article v-for="l in labs" :key="l.id" class="card lab">
          <div class="l-head">
            <b>{{ l.name }}</b>
            <el-tag v-if="l.vrSupport" size="small">VR</el-tag>
            <el-tag v-if="l.aiSupport" size="small" type="warning">AI 实训</el-tag>
          </div>
          <div class="muted">{{ l.location }} · 容纳 {{ l.capacity }} 人 · 负责人 {{ l.owner }}</div>
          <div class="seats">
            <span v-for="s in l.seats" :key="s.id" class="seat" :class="s.status === 'FREE' ? 'free' : 'busy'">{{ s.name }}</span>
          </div>
          <div class="kv"><span>设备</span>{{ l.equipment.join('、') }}</div>
          <div class="kv"><span>开放</span>{{ l.openHours }}</div>
          <div class="kv"><span>规则</span>{{ l.rules }}</div>
          <div class="l-foot">
            <span class="muted">空闲机位 {{ freeSeats(l).length }}/{{ l.seats.length }}</span>
            <div class="spacer" />
            <el-button v-if="g.isStudent" size="small" type="primary" :disabled="!freeSeats(l).length" @click="openBook(l)">预约</el-button>
          </div>
        </article>
      </div>
    </template>

    <!-- VR 实验运行 -->
    <el-dialog :model-value="!!cur" :title="cur?.name" width="760px" @close="cur = null">
      <template v-if="cur">
        <div class="runner">
          <ol class="v-steps">
            <li v-for="(s, i) in steps" :key="i" :class="{ done: i < stepNow, now: i === stepNow && !run?.done }">
              <span class="n">{{ i + 1 }}</span>{{ s.n }}
            </li>
          </ol>
          <div class="stage">
            <template v-if="!run?.done">
              <div class="screen">
                <el-icon :size="36"><Monitor /></el-icon>
                <div>虚拟实验环境 · 第 {{ stepNow + 1 }}/{{ steps.length }} 步</div>
                <small>原型为流程演示，正式版接入云端仿真环境</small>
              </div>
              <div class="tip"><b>{{ steps[stepNow].n }}</b>{{ steps[stepNow].tip }}</div>
              <el-button type="primary" @click="act">{{ steps[stepNow].act }}</el-button>
            </template>
            <template v-else>
              <h3 class="report-t"><el-icon><CircleCheckFilled /></el-icon>实验完成，已生成实验报告</h3>
              <div class="muted">完成时间 {{ dayjs(run.finishedAt).format('YYYY-MM-DD HH:mm') }} · {{ steps.length }} 步全部通过校验</div>
            </template>
            <div class="log">
              <div class="muted">操作日志</div>
              <div v-for="(x, i) in run?.log ?? []" :key="i">{{ x }}</div>
              <div v-if="!run?.log.length" class="muted">还没有操作</div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <el-button v-if="run" @click="cur && g.vrReset(cur.id)">重做</el-button>
        <el-button v-if="run?.done" type="primary" :icon="'Download'" @click="exportReport">导出实验报告</el-button>
      </template>
    </el-dialog>

    <!-- 预约 -->
    <el-dialog :model-value="!!booking" :title="`预约 · ${booking?.name}`" width="480px" @close="booking = null">
      <el-form v-if="booking" label-width="64px">
        <el-form-item label="日期">
          <el-select v-model="form.date">
            <el-option v-for="d in dates" :key="d.format('YYYY-MM-DD')" :value="d.format('YYYY-MM-DD')" :label="`${d.format('MM-DD')} 周${'日一二三四五六'[d.day()]}`" />
          </el-select>
        </el-form-item>
        <el-form-item label="时段">
          <el-radio-group v-model="form.slotId">
            <el-radio-button v-for="s in g.slots" :key="s.id" :value="s.id">{{ s.label }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="机位">
          <el-select v-model="form.seatId">
            <el-option v-for="s in freeSeats(booking)" :key="s.id" :value="s.id" :label="s.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="人数"><el-input-number v-model="form.people" :min="1" :max="4" /></el-form-item>
        <el-form-item label="用途"><el-input v-model="form.purpose" placeholder="例如：自瞄标定实验" /></el-form-item>
        <p class="muted">{{ booking.rules }}</p>
      </el-form>
      <template #footer>
        <el-button @click="booking = null">取消</el-button>
        <el-button type="primary" @click="submitBook">提交预约</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.mods {
  margin-bottom: 12px;
}
.intro {
  margin: 0 0 14px;
}
.vr-list,
.labs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 14px;
}
.vr,
.lab {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px;
}
.v-head,
.l-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.v-head .muted {
  font-size: 12px;
}
.vr p {
  margin: 0;
  font-size: 13px;
}
.v-foot,
.l-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--ch-border-light);
}
.tag {
  font-size: 12px;
  padding: 0 7px;
  border-radius: 4px;
  background: var(--ch-fill);
  color: var(--ch-text-2);
}
.lab-bar {
  margin-bottom: 12px;
}
.pending,
.mine {
  margin-bottom: 14px;
}
.card-title .muted {
  margin-left: 6px;
  font-weight: 400;
  font-size: 12px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-top: 1px solid var(--ch-border-light);
}
.r-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  font-size: 13px;
}
.r-main b {
  font-weight: 500;
}
.code {
  font-weight: 600;
  color: var(--ch-primary-text);
  font-size: 13px;
}
.lab .muted {
  font-size: 12.5px;
}
.seats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.seat {
  font-size: 11.5px;
  padding: 1px 6px;
  border-radius: 3px;
}
.seat.free {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success-dark-2);
}
.seat.busy {
  background: var(--ch-fill);
  color: var(--ch-text-3);
  text-decoration: line-through;
}
.kv {
  font-size: 12.5px;
  color: var(--ch-text);
  line-height: 1.6;
}
.kv span {
  color: var(--ch-text-3);
  margin-right: 8px;
}
.runner {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
}
.v-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.v-steps li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  color: var(--ch-text-3);
}
.v-steps li.done {
  color: var(--ch-text);
}
.v-steps li.now {
  background: var(--ch-primary-bg);
  color: var(--ch-primary-text);
  font-weight: 500;
}
.n {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid currentColor;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.v-steps li.done .n {
  background: var(--ch-success);
  border-color: var(--ch-success);
  color: #fff;
}
.stage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}
.screen {
  width: 100%;
  aspect-ratio: 16 / 7;
  background: #1f2329;
  color: #fff;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.screen small {
  opacity: 0.6;
}
.tip {
  font-size: 13.5px;
  line-height: 1.7;
}
.tip b {
  margin-right: 8px;
}
.report-t {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--ch-success);
}
.log {
  width: 100%;
  max-height: 160px;
  overflow-y: auto;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  background: var(--ch-fill);
  border-radius: 6px;
  padding: 8px 10px;
}
</style>

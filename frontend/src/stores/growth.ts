/**
 * 领导版补齐部分的状态（纯前端原型，存 localStorage）：
 * 今日推荐、AI 导师会话、智能体、AI 训练、线下活动、实验训练、项目训练（4 类）、成长画像、我的。
 * 角色沿用 PBL 演示视角：学生 / 助教 / 指导教师 / 学院管理员。
 *   - 助教：可以审核报名、预约、项目申请，看学情；不能发布活动、不能审核图谱
 *   - 指导教师、管理员：全部
 */
import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { computed, reactive, watch } from 'vue'
import * as G from '@/mock/growth'
import * as R from '@/mock/growth-robo'
import { usePblStore } from '@/stores/pbl'

const KEY = 'coursehub.growth.v1'

export type TodayItem = (typeof G.TODAY)[number] & { link?: string }
export type Discussion = (typeof G.DISCUSSIONS)[number]
export type Lecture = (typeof G.LECTURES)[number]
export type TrainTask = (typeof G.TRAIN_TASKS)[number]
export type VrProject = (typeof G.VR_PROJECTS)[number]
export type Lab = (typeof G.LABS)[number]
export type LeaderProject = (typeof G.LEADER_PROJECTS)[number]
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface ChatMsg {
  role: 'me' | 'ai'
  text: string
  expert?: string
  sources?: { resId: string; partId: string; label: string }[]
  image?: string
}
export interface Session {
  id: string
  expert: string
  title: string
  updatedAt: string
  messages: ChatMsg[]
  rounds: number
}
export interface Booking {
  id: string
  pid: string
  labId: string
  date: string
  slotId: string
  seatId: string
  purpose: string
  people: number
  status: ReviewStatus
  code?: string
  at: string
}
export interface Msg {
  id: string
  type: string
  status: 'READ' | 'UNREAD'
  time: string
  title: string
  desc: string
}
interface VrRun {
  step: number
  done: boolean
  log: string[]
  finishedAt?: string
}

interface Persisted {
  hiddenToday: Record<string, Record<string, string>>
  todayFav: Record<string, string[]>
  sessions: Record<string, Session[]>
  badges: Record<string, string[]>
  signups: Record<string, Record<string, ReviewStatus>>
  applications: Record<string, Record<string, { status: ReviewStatus; note: string; at: string }>>
  bookings: Booking[]
  vr: Record<string, Record<string, VrRun>>
  train: Record<string, Record<string, { score: number; at: string }>>
  readMsgs: Record<string, string[]>
  clearedMsgs: Record<string, boolean>
  pushedMsgs: Record<string, Msg[]>
  favRemoved: Record<string, string[]>
  tagMarks: Record<string, string[]>
  profileVersion: Record<string, number>
}

const at = (days: number) => dayjs().add(days, 'day').format('YYYY-MM-DD')

function seed(): Persisted {
  return {
    hiddenToday: {},
    todayFav: {},
    sessions: {},
    badges: {},
    // 演示：几名同学报名了机甲大师研讨，等待教师 / 助教审核
    signups: { 'D-RB-1': { s3: 'pending', s7: 'pending', s9: 'approved' } },
    applications: { 'C-01': { s5: { status: 'pending', note: '有 ACM 校赛经历，希望和队友一起参加选拔', at: dayjs().subtract(1, 'day').toISOString() } } },
    bookings: [
      { id: 'BK1', pid: 's1', labId: 'LAB-ENG-01', date: at(-3), slotId: 'T3', seatId: 'S-01', purpose: '自瞄标定实验', people: 2, status: 'approved', code: '4827', at: dayjs().subtract(5, 'day').toISOString() },
      { id: 'BK2', pid: 's13', labId: 'LAB-ENG-01', date: at(2), slotId: 'T1', seatId: 'S-02', purpose: '云台 PID 联调', people: 3, status: 'pending', at: dayjs().subtract(2, 'hour').toISOString() },
    ],
    vr: {},
    train: {},
    readMsgs: {},
    clearedMsgs: {},
    pushedMsgs: {},
    favRemoved: {},
    tagMarks: {},
    profileVersion: {},
  }
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...seed(), ...JSON.parse(raw) }
  } catch {
    /* 读不到就用初始数据 */
  }
  return seed()
}

export const useGrowthStore = defineStore('growth', () => {
  const pbl = usePblStore()
  const state = reactive<Persisted>(load())
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* 存不了就只保留在内存里 */
    }
  }
  watch(state, save, { deep: true })

  const pid = computed(() => pbl.personaId)
  const role = computed(() => pbl.role)
  const isStudent = computed(() => role.value === 'student')
  /** 助教、指导教师、管理员都能审核报名 / 预约 / 申请 */
  const canReview = computed(() => !isStudent.value)
  /** 只有指导教师和管理员能发布、审核图谱 */
  const canPublish = computed(() => role.value === 'mentor' || role.value === 'admin')
  const name = (id: string) => pbl.person(id)?.name ?? id

  function push(to: string, title: string, desc: string, type = 'SYSTEM') {
    const list = (state.pushedMsgs[to] ??= [])
    list.unshift({ id: `P${Date.now().toString(36)}${list.length}`, type, status: 'UNREAD', time: dayjs().format('MM-DD HH:mm'), title, desc })
    save()
  }

  // ------------------------------------------------------------ 今日推荐
  const todayAll = computed<TodayItem[]>(() => [...R.ROBO_TODAY, ...G.TODAY])
  const hidden = computed(() => state.hiddenToday[pid.value] ?? {})
  function hideToday(id: string, reason: string) {
    ;(state.hiddenToday[pid.value] ??= {})[id] = reason
    save()
  }
  const todayFavs = computed(() => state.todayFav[pid.value] ?? [])
  function toggleTodayFav(id: string) {
    const list = (state.todayFav[pid.value] ??= [])
    const i = list.indexOf(id)
    if (i >= 0) list.splice(i, 1)
    else list.unshift(id)
    save()
    return i < 0
  }

  // ------------------------------------------------------------ AI 导师会话
  /** 第一次打开 AI 导师时，用领导版的示例会话初始化 */
  function ensureSessions() {
    if (!state.sessions[pid.value]) {
      state.sessions[pid.value] = G.SESSIONS.map((s, i) => ({
        id: s.id,
        expert: s.expert,
        title: s.title,
        updatedAt: dayjs().subtract(i * 26 + 1, 'hour').toISOString(),
        messages: s.messages.map((m) => ({ role: m.role, text: m.text })),
        rounds: 100 - Math.ceil(s.messages.length / 2),
      }))
    }
  }
  const mySessions = computed<Session[]>(() => [...(state.sessions[pid.value] ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
  function newSession(expert: string, title = '新对话') {
    const s: Session = { id: `S${Date.now().toString(36)}`, expert, title, updatedAt: new Date().toISOString(), messages: [], rounds: 100 }
    ;(state.sessions[pid.value] ??= []).unshift(s)
    save()
    return s
  }
  function touch(s: Session) {
    s.updatedAt = new Date().toISOString()
    save()
  }
  function removeSession(id: string) {
    const list = state.sessions[pid.value] ?? []
    const i = list.findIndex((x) => x.id === id)
    if (i >= 0) list.splice(i, 1)
    save()
  }
  const myBadges = computed(() => state.badges[pid.value] ?? [])
  function addBadge(b: string) {
    const list = (state.badges[pid.value] ??= [])
    if (!list.includes(b)) {
      list.push(b)
      save()
      return true
    }
    return false
  }

  // ------------------------------------------------------------ AI 训练
  const tasksOf = (unitId: string): TrainTask[] => [...R.ROBO_TASKS, ...G.TRAIN_TASKS].filter((t) => t.unitId === unitId)
  function trainScore(taskId: string, who = pid.value) {
    return state.train[who]?.[taskId]
  }
  function setTrainScore(taskId: string, score: number) {
    ;(state.train[pid.value] ??= {})[taskId] = { score, at: new Date().toISOString() }
    save()
  }

  // ------------------------------------------------------------ 线下活动
  const discussions = computed<Discussion[]>(() => [...R.ROBO_DISCUSSIONS, ...G.DISCUSSIONS])
  const lectures = computed<Lecture[]>(() => [...R.ROBO_LECTURES, ...G.LECTURES])
  const discussionsOf = (unitId: string) => discussions.value.filter((d) => d.units.includes(unitId))
  const lecturesOf = (unitId: string) => lectures.value.filter((d) => d.units.includes(unitId))
  const signupOf = (id: string, who = pid.value) => state.signups[id]?.[who]
  const signupsOf = (id: string) => Object.entries(state.signups[id] ?? {}).map(([sid, status]) => ({ sid, status }))
  function signup(id: string, title: string) {
    ;(state.signups[id] ??= {})[pid.value] = 'pending'
    push(pid.value, `【报名已提交】${title}`, '等待指导教师或助教审核，结果会通过站内消息通知你。')
  }
  function cancelSignup(id: string) {
    if (state.signups[id]) delete state.signups[id][pid.value]
    save()
  }
  function reviewSignup(id: string, sid: string, status: ReviewStatus, title: string) {
    ;(state.signups[id] ??= {})[sid] = status
    push(sid, status === 'approved' ? `【报名通过】${title}` : `【报名未通过】${title}`, status === 'approved' ? '请按时参加，迟到超过 15 分钟将取消资格。' : '名额有限，可以关注下一期。')
  }

  // ------------------------------------------------------------ 实验训练
  const vrOf = (unitId: string): VrProject[] => [...R.ROBO_VR, ...G.VR_PROJECTS].filter((v) => v.unitId === unitId)
  function vrSteps(v: VrProject) {
    if (v.id === 'VR-RB-1') return R.ROBO_VR_TEMPLATE
    const tpl = G.VR_TEMPLATES[v.id]
    if (tpl) return tpl
    // 没有专门流程的实验，按通用步骤演示
    return [
      { n: '进入虚拟实验环境', tip: `加载「${v.name}」实验场景。`, act: '加载场景' },
      { n: '阅读实验目标与安全提示', tip: v.desc, act: '我已了解' },
      ...v.abilities.map((a) => ({ n: a, tip: `按引导完成「${a}」操作，系统会校验每一步。`, act: '完成本步' })),
      { n: '数据采集', tip: '系统自动记录本次实验的关键参数和操作日志。', act: '采集数据' },
      { n: '生成实验报告', tip: '汇总实验记录、操作日志，生成实验报告。', act: '完成实验' },
    ]
  }
  const vrRun = (id: string) => state.vr[pid.value]?.[id]
  function vrAdvance(v: VrProject) {
    const steps = vrSteps(v)
    const run = ((state.vr[pid.value] ??= {})[v.id] ??= { step: 0, done: false, log: [] })
    if (run.done) return run
    run.log.push(`${dayjs().format('HH:mm:ss')} ${steps[run.step].n}：${steps[run.step].act} ✓`)
    run.step++
    if (run.step >= steps.length) {
      run.done = true
      run.finishedAt = new Date().toISOString()
    }
    save()
    return run
  }
  function vrReset(id: string) {
    if (state.vr[pid.value]) delete state.vr[pid.value][id]
    save()
  }
  const labs = G.LABS as Lab[]
  const slots = G.TIME_SLOTS
  const myBookings = computed(() => state.bookings.filter((b) => b.pid === pid.value))
  const pendingBookings = computed(() => state.bookings.filter((b) => b.status === 'pending'))
  function book(b: Omit<Booking, 'id' | 'pid' | 'status' | 'at'>) {
    state.bookings.unshift({ ...b, id: `BK${Date.now().toString(36)}`, pid: pid.value, status: 'pending', at: new Date().toISOString() })
    const lab = labs.find((l) => l.id === b.labId)
    push(pid.value, `【预约已提交】${lab?.name}`, `${b.date} ${slots.find((s) => s.id === b.slotId)?.label}，等待实验室审核。`)
  }
  function reviewBooking(id: string, status: ReviewStatus) {
    const b = state.bookings.find((x) => x.id === id)
    if (!b) return
    b.status = status
    if (status === 'approved') b.code = String(1000 + Math.floor(Math.random() * 9000))
    const lab = labs.find((l) => l.id === b.labId)
    push(b.pid, status === 'approved' ? `【预约通过】${lab?.name}` : `【预约未通过】${lab?.name}`, status === 'approved' ? `签到码 ${b.code}，请在开始前 10 分钟到场签到。` : '该时段已满，请换个时段。')
  }
  function cancelBooking(id: string) {
    const i = state.bookings.findIndex((x) => x.id === id)
    if (i >= 0) state.bookings.splice(i, 1)
    save()
  }

  // ------------------------------------------------------------ 项目训练（4 类）
  const leaderProjects = G.LEADER_PROJECTS as LeaderProject[]
  const projectsOf = (unitId: string) => leaderProjects.filter((p) => p.units.includes(unitId) || (unitId === 'robo' && p.units.includes('engineering')))
  const applicationOf = (id: string, who = pid.value) => state.applications[id]?.[who]
  const applicationsOf = (id: string) => Object.entries(state.applications[id] ?? {}).map(([sid, a]) => ({ sid, ...a }))
  const pendingApplications = computed(() =>
    Object.entries(state.applications).flatMap(([prj, m]) =>
      Object.entries(m)
        .filter(([, a]) => a.status === 'pending')
        .map(([sid, a]) => ({ prj, sid, ...a })),
    ),
  )
  function apply(id: string, title: string, note: string) {
    ;(state.applications[id] ??= {})[pid.value] = { status: 'pending', note, at: new Date().toISOString() }
    push(pid.value, `【申请已提交】${title}`, '等待项目负责人审核。')
  }
  function reviewApplication(id: string, sid: string, status: ReviewStatus, title: string) {
    const a = state.applications[id]?.[sid]
    if (!a) return
    a.status = status
    push(sid, status === 'approved' ? `【申请通过】${title}` : `【申请未通过】${title}`, status === 'approved' ? '欢迎加入，项目负责人会尽快联系你。' : '感谢关注，可以看看其他项目。')
  }

  /** 待我审核的事项（教师 / 助教） */
  const pendingReviews = computed(() => {
    const sign = Object.entries(state.signups).flatMap(([id, m]) =>
      Object.entries(m)
        .filter(([, s]) => s === 'pending')
        .map(([sid]) => ({ id, sid })),
    )
    return { signups: sign, bookings: pendingBookings.value, applications: pendingApplications.value }
  })

  // ------------------------------------------------------------ 我的
  const myMessages = computed<Msg[]>(() => {
    if (state.clearedMsgs[pid.value]) return state.pushedMsgs[pid.value] ?? []
    const base: Msg[] = isStudent.value ? (G.MESSAGES as Msg[]) : []
    const read = new Set(state.readMsgs[pid.value] ?? [])
    return [...(state.pushedMsgs[pid.value] ?? []), ...base].map((m) => (read.has(m.id) ? { ...m, status: 'READ' as const } : m))
  })
  function readMsg(id: string) {
    const list = (state.readMsgs[pid.value] ??= [])
    if (!list.includes(id)) list.push(id)
    const pushed = state.pushedMsgs[pid.value]?.find((m) => m.id === id)
    if (pushed) pushed.status = 'READ'
    save()
  }
  function clearMsgs() {
    state.clearedMsgs[pid.value] = true
    state.pushedMsgs[pid.value] = []
    save()
  }
  const myFavorites = computed(() => {
    const removed = new Set(state.favRemoved[pid.value] ?? [])
    const fromToday = todayFavs.value
      .map((id) => todayAll.value.find((t) => t.id === id))
      .filter((t): t is TodayItem => !!t)
      .map((t) => ({ id: t.id, category: 'RESOURCE', title: t.title, source: t.source, fav_time: '刚刚', tag: G.RESOURCE_TYPES.find((x) => x.code === t.type)?.name ?? '', valid: true }))
    const base = isStudent.value ? G.FAVORITES : []
    return [...fromToday, ...base].filter((f) => !removed.has(f.id))
  })
  function removeFavorite(id: string) {
    if (todayFavs.value.includes(id)) toggleTodayFav(id)
    else (state.favRemoved[pid.value] ??= []).push(id)
    save()
  }

  // ------------------------------------------------------------ 成长画像
  const tagMarks = computed(() => state.tagMarks[pid.value] ?? [])
  function toggleTagMark(name: string) {
    const list = (state.tagMarks[pid.value] ??= [])
    const i = list.indexOf(name)
    if (i >= 0) list.splice(i, 1)
    else list.push(name)
    save()
  }
  const profileVersion = computed(() => state.profileVersion[pid.value] ?? G.PROFILE.versions[0].version)
  function bumpProfile() {
    state.profileVersion[pid.value] = profileVersion.value + 1
    save()
  }

  function reset() {
    Object.assign(state, seed())
    save()
  }

  return {
    state,
    save,
    pid,
    role,
    isStudent,
    canReview,
    canPublish,
    name,
    push,
    todayAll,
    hidden,
    hideToday,
    todayFavs,
    toggleTodayFav,
    mySessions,
    ensureSessions,
    newSession,
    touch,
    removeSession,
    myBadges,
    addBadge,
    tasksOf,
    trainScore,
    setTrainScore,
    discussions,
    lectures,
    discussionsOf,
    lecturesOf,
    signupOf,
    signupsOf,
    signup,
    cancelSignup,
    reviewSignup,
    vrOf,
    vrSteps,
    vrRun,
    vrAdvance,
    vrReset,
    labs,
    slots,
    myBookings,
    pendingBookings,
    book,
    reviewBooking,
    cancelBooking,
    projectsOf,
    applicationOf,
    applicationsOf,
    pendingApplications,
    apply,
    reviewApplication,
    pendingReviews,
    myMessages,
    readMsg,
    clearMsgs,
    myFavorites,
    removeFavorite,
    tagMarks,
    toggleTagMark,
    profileVersion,
    bumpProfile,
    reset,
  }
})

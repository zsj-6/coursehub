/**
 * PBL 项目训练原型的状态（纯前端）。
 * 数据来自 src/mock/pbl.ts，修改会存进 localStorage，刷新后还在；「重置演示数据」恢复初始状态。
 */
import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import {
  DATA_VERSION,
  PERSONAS,
  createSeed,
  type Milestone,
  type PblData,
  type Person,
  type Project,
  type Resource,
  type ShareScope,
  type Submission,
  type Task,
  type Team,
  type TeamingRule,
  type Topic,
} from '@/mock/pbl'

const DATA_KEY = 'coursehub_pbl_data'
const PERSONA_KEY = 'coursehub_pbl_persona'
const FAV_KEY = 'coursehub_pbl_favorites'

function loadData(): PblData {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (raw) {
      const d = JSON.parse(raw) as PblData
      if (d.version === DATA_VERSION) return d
    }
  } catch {
    /* localStorage 不可用或数据损坏时用初始数据 */
  }
  return createSeed()
}

/** 收藏：{ 演示视角 id: 课题 id[] }。和演示数据分开存，改版演示数据时不会丢。 */
function loadFavorites(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return {}
}

function readPersona(): string | null {
  try {
    return localStorage.getItem(PERSONA_KEY)
  } catch {
    return null
  }
}

let seq = 0
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(++seq).toString(36)}`

export type TaskState = 'not_open' | 'todo' | 'submitted' | 'graded' | 'overdue'
export type MilestoneState = 'done' | 'current' | 'upcoming'

export const usePblStore = defineStore('pbl', () => {
  const data = reactive<PblData>(loadData())
  const personaId = ref<string>(readPersona() || '')
  const favorites = reactive<Record<string, string[]>>(loadFavorites())

  watch(
    data,
    (v) => {
      try {
        localStorage.setItem(DATA_KEY, JSON.stringify(v))
      } catch {
        /* 存不了就只保留在内存里 */
      }
    },
    { deep: true },
  )
  watch(
    favorites,
    (v) => {
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(v))
      } catch {
        /* ignore */
      }
    },
    { deep: true },
  )
  watch(personaId, (v) => {
    try {
      localStorage.setItem(PERSONA_KEY, v)
    } catch {
      /* ignore */
    }
  })

  /** 首次进入时按登录角色选一个默认视角。 */
  function ensurePersona(loginRole: string | undefined) {
    if (PERSONAS.some((p) => p.id === personaId.value)) return
    personaId.value = loginRole === 'student' ? 's1' : loginRole === 'teacher' ? 'm1' : 'a1'
  }

  function reset() {
    Object.assign(data, createSeed())
    for (const k of Object.keys(favorites)) delete favorites[k]
  }

  const myFavoriteIds = computed(() => favorites[personaId.value] ?? [])
  const isFavorite = (pid: string) => myFavoriteIds.value.includes(pid)
  /** 收藏 / 取消收藏，返回操作后是否已收藏。 */
  function toggleFavorite(pid: string) {
    const list = (favorites[personaId.value] ??= [])
    const i = list.indexOf(pid)
    if (i >= 0) list.splice(i, 1)
    else list.unshift(pid)
    return i < 0
  }

  // ---------- 查询 ----------
  const personMap = computed(() => new Map(data.people.map((p) => [p.id, p])))
  const person = (id: string | null | undefined): Person | undefined => (id ? personMap.value.get(id) : undefined)
  const me = computed(() => person(personaId.value)!)
  const role = computed(() => me.value?.role ?? 'student')
  const isAdmin = computed(() => role.value === 'admin')
  const isStudent = computed(() => role.value === 'student')

  const program = (id: string) => data.programs.find((g) => g.id === id)
  const project = (id: string) => data.projects.find((p) => p.id === id)
  const team = (id: string) => data.teams.find((t) => t.id === id)
  const task = (id: string) => data.tasks.find((k) => k.id === id)

  const canManage = (p: Project) => isAdmin.value || p.mentorIds.includes(personaId.value)
  const canSee = (p: Project) => p.published || canManage(p)

  const visibleProjects = computed(() => data.projects.filter(canSee))
  const projectsOf = (programId: string) => visibleProjects.value.filter((p) => p.programId === programId)
  const teamsOf = (pid: string) => data.teams.filter((t) => t.projectId === pid)
  const myTeam = (pid: string) => teamsOf(pid).find((t) => t.memberIds.includes(personaId.value))
  const tasksOf = (pid: string) =>
    data.tasks.filter((k) => k.projectId === pid).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const topicsOf = (pid: string) => data.topics.filter((c) => c.projectId === pid)

  /** 我参与的课题：学生是团队成员或已报名，教师是指导教师，管理员看全部。 */
  const myProjects = computed(() =>
    data.projects.filter((p) => {
      if (isAdmin.value) return true
      if (role.value === 'mentor') return p.mentorIds.includes(personaId.value)
      return p.published && (!!myTeam(p.id) || p.signupIds.includes(personaId.value))
    }),
  )

  function milestoneState(m: Milestone): MilestoneState {
    const now = dayjs()
    if (now.isAfter(m.end)) return 'done'
    if (now.isBefore(m.start)) return 'upcoming'
    return 'current'
  }
  const currentMilestone = (p: Project) => p.milestones.find((m) => milestoneState(m) === 'current')
  const progressPercent = (p: Project) => {
    if (!p.milestones.length) return 0
    const done = p.milestones.filter((m) => milestoneState(m) === 'done').length
    return Math.round((done / p.milestones.length) * 100)
  }

  const subsOf = (taskId: string, teamId?: string) =>
    data.submissions
      .filter((s) => s.taskId === taskId && (!teamId || s.teamId === teamId))
      .sort((a, b) => b.at.localeCompare(a.at))
  const latestSub = (taskId: string, teamId: string) => subsOf(taskId, teamId)[0]

  function taskState(k: Task, teamId: string): TaskState {
    const last = latestSub(k.id, teamId)
    if (last) return last.score !== null ? 'graded' : 'submitted'
    if (dayjs().isBefore(k.openAt)) return 'not_open'
    if (dayjs().isAfter(k.dueAt)) return 'overdue'
    return 'todo'
  }

  /** 资源可见范围：项目资源人人可见；团队资源按分享范围。 */
  function resourcesOf(pid: string, teamId?: string | null): Resource[] {
    const p = project(pid)
    const manage = p ? canManage(p) : false
    const mine = myTeam(pid)?.id
    return data.resources.filter((r) => {
      if (r.projectId !== pid) return false
      if (teamId !== undefined) return r.teamId === teamId
      if (!r.teamId) return true
      if (manage || r.teamId === mine) return true
      return r.scope !== 'team'
    })
  }
  const sharedResources = computed(() => data.resources.filter((r) => r.scope === 'school' && r.teamId))

  const postsOf = (topicId: string, teamId: string | null) =>
    data.posts.filter((x) => x.topicId === topicId && x.teamId === teamId)

  // ---------- 项目 ----------
  function saveProject(input: Omit<Project, 'id' | 'views' | 'interestedIds' | 'signupIds' | 'createdAt'> & { id?: string }) {
    if (input.id) {
      const p = project(input.id)
      if (p) Object.assign(p, input)
      return input.id
    }
    const id = uid('p')
    data.projects.push({ ...input, id, views: 0, interestedIds: [], signupIds: [], createdAt: dayjs().toISOString() })
    return id
  }
  function setPublished(p: Project, published: boolean) {
    p.published = published
    if (published && p.status === 'draft') p.status = 'recruiting'
    if (!published && p.status === 'recruiting') p.status = 'draft'
  }
  function view(p: Project) {
    p.views++
  }
  function toggleInterest(p: Project) {
    const i = p.interestedIds.indexOf(personaId.value)
    if (i >= 0) p.interestedIds.splice(i, 1)
    else p.interestedIds.push(personaId.value)
  }

  // ---------- 组队 ----------
  function saveTeaming(p: Project, rule: TeamingRule) {
    p.teaming = { ...rule }
    if (rule.mode === 'free') {
      // 自由组队：团队数不够就补空团队
      const teams = teamsOf(p.id)
      for (let i = teams.length; i < rule.teamCount; i++) createTeam(p.id)
    }
  }
  function createTeam(pid: string, name?: string): Team {
    const n = teamsOf(pid).length + 1
    const t: Team = { id: uid('t'), projectId: pid, name: name || `第 ${n} 组`, memberIds: [], leaderId: null, evaluation: null, showcase: null }
    data.teams.push(t)
    return t
  }
  function removeTeam(t: Team) {
    data.teams.splice(data.teams.indexOf(t), 1)
  }
  function addMember(t: Team, sid: string) {
    const p = project(t.projectId)!
    // 一个学生在一个课题里只能在一个团队
    for (const other of teamsOf(t.projectId)) if (other !== t) removeMember(other, sid)
    if (!t.memberIds.includes(sid)) t.memberIds.push(sid)
    if (p.teaming.hasLeader && !t.leaderId) t.leaderId = sid
  }
  function removeMember(t: Team, sid: string) {
    const i = t.memberIds.indexOf(sid)
    if (i < 0) return
    t.memberIds.splice(i, 1)
    if (t.leaderId === sid) t.leaderId = t.memberIds[0] ?? null
  }
  function joinTeam(t: Team) {
    addMember(t, personaId.value)
  }
  function leaveTeam(t: Team) {
    removeMember(t, personaId.value)
  }
  function signup(p: Project) {
    if (!p.signupIds.includes(personaId.value)) p.signupIds.push(personaId.value)
  }
  function cancelSignup(p: Project) {
    p.signupIds = p.signupIds.filter((x) => x !== personaId.value)
  }
  /** 报名学生里还没进团队的人。 */
  const unassigned = (p: Project) => {
    const inTeam = new Set(teamsOf(p.id).flatMap((t) => t.memberIds))
    return p.signupIds.filter((s) => !inTeam.has(s))
  }
  /** 随机分组：by=count 按组数，by=size 按每组人数。返回分好的组（名单），由页面播放动画后再落库。 */
  function planRandomGroups(p: Project, by: 'count' | 'size', n: number): string[][] {
    const pool = [...unassigned(p)]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const count = by === 'count' ? Math.max(1, n) : Math.max(1, Math.ceil(pool.length / Math.max(1, n)))
    const groups: string[][] = Array.from({ length: count }, () => [])
    pool.forEach((s, i) => groups[i % count].push(s))
    return groups.filter((g) => g.length)
  }
  function applyGroups(p: Project, groups: string[][]) {
    for (const g of groups) {
      const t = createTeam(p.id)
      for (const s of g) addMember(t, s)
    }
  }
  function startProject(p: Project) {
    p.status = 'running'
  }
  function finishProject(p: Project) {
    p.status = 'finished'
  }

  // ---------- 任务 ----------
  function saveTask(input: Omit<Task, 'id' | 'urges'> & { id?: string }) {
    if (input.id) {
      const k = task(input.id)
      if (k) Object.assign(k, input)
      return
    }
    data.tasks.push({ ...input, id: uid('k'), urges: [] })
  }
  function removeTask(k: Task) {
    data.tasks.splice(data.tasks.indexOf(k), 1)
    data.submissions = data.submissions.filter((s) => s.taskId !== k.id)
  }
  function submitTask(k: Task, teamId: string, content: string, files: string[]) {
    const attempt = subsOf(k.id, teamId).length + 1
    const s: Submission = {
      id: uid('sub'), taskId: k.id, teamId, byId: personaId.value, attempt, content, files,
      at: dayjs().toISOString(), score: null, comment: '', recommended: false,
    }
    data.submissions.push(s)
    return s
  }
  function grade(s: Submission, score: number | null, comment: string) {
    s.score = score
    s.comment = comment
  }
  function toggleRecommend(s: Submission) {
    s.recommended = !s.recommended
  }
  function urge(k: Task, teamIds: string[]) {
    const now = dayjs().toISOString()
    for (const teamId of teamIds) k.urges.push({ teamId, at: now })
  }
  const recommended = (pid: string) =>
    data.submissions.filter((s) => s.recommended && task(s.taskId)?.projectId === pid)

  // ---------- 资源 ----------
  function addResource(r: Omit<Resource, 'id' | 'at' | 'uploaderId'>) {
    data.resources.push({ ...r, id: uid('r'), at: dayjs().toISOString(), uploaderId: personaId.value })
  }
  function setScope(r: Resource, scope: ShareScope) {
    r.scope = scope
  }
  function removeResource(r: Resource) {
    data.resources.splice(data.resources.indexOf(r), 1)
  }

  // ---------- 讨论 ----------
  function saveTopic(input: Omit<Topic, 'id'> & { id?: string }) {
    if (input.id) {
      const c = data.topics.find((x) => x.id === input.id)
      if (c) Object.assign(c, input)
      return
    }
    data.topics.push({ ...input, id: uid('c') })
  }
  function addPost(topicId: string, teamId: string | null, content: string, parentId: string | null = null) {
    data.posts.push({
      id: uid('post'), topicId, teamId, parentId, authorId: personaId.value, content,
      at: dayjs().toISOString(), likeIds: [], pinned: false,
    })
  }
  function toggleLike(postId: string) {
    const x = data.posts.find((p) => p.id === postId)
    if (!x) return
    const i = x.likeIds.indexOf(personaId.value)
    if (i >= 0) x.likeIds.splice(i, 1)
    else x.likeIds.push(personaId.value)
  }
  function togglePin(postId: string) {
    const x = data.posts.find((p) => p.id === postId)
    if (x) x.pinned = !x.pinned
  }

  // ---------- 评价与成果 ----------
  /** 团队过程数据，作为评价参考（规则评分）。 */
  function teamMetrics(t: Team) {
    const ks = tasksOf(t.projectId).filter((k) => dayjs().isAfter(k.openAt))
    const submitted = ks.filter((k) => latestSub(k.id, t.id)).length
    const graded = ks.map((k) => latestSub(k.id, t.id)).filter((s): s is Submission => !!s && s.score !== null)
    const avg = graded.length
      ? graded.reduce((sum, s) => sum + (s.score! / (task(s.taskId)?.fullScore || 100)) * 100, 0) / graded.length
      : 0
    const posts = data.posts.filter((x) => t.memberIds.includes(x.authorId) && data.topics.find((c) => c.id === x.topicId)?.projectId === t.projectId).length
    const resources = data.resources.filter((r) => r.teamId === t.id).length
    const likes = data.posts.filter((x) => t.memberIds.includes(x.authorId)).reduce((n, x) => n + x.likeIds.length, 0)
    return { taskTotal: ks.length, submitted, avgScore: Math.round(avg), posts, resources, likes }
  }
  /** 按规则给出参考分：任务 60%（提交率与得分）、讨论 15%、资源 15%、获赞 10%。 */
  function suggestedScore(t: Team) {
    const m = teamMetrics(t)
    const taskPart = m.taskTotal ? (m.submitted / m.taskTotal) * 0.4 + (m.avgScore / 100) * 0.6 : 0
    const s = taskPart * 60 + Math.min(m.posts / 5, 1) * 15 + Math.min(m.resources / 3, 1) * 15 + Math.min(m.likes / 10, 1) * 10
    return Math.round(s)
  }
  function evaluate(t: Team, score: number, comment: string) {
    t.evaluation = { score, comment, by: personaId.value, at: dayjs().toISOString() }
  }
  function publishShowcase(t: Team, s: { title: string; summary: string; highlights: string[] }) {
    t.showcase = { ...s, at: dayjs().toISOString() }
  }
  function withdrawShowcase(t: Team) {
    t.showcase = null
  }
  const showcases = computed(() =>
    data.teams.filter((t) => t.showcase && project(t.projectId)?.published),
  )

  // ---------- 待办 ----------
  /** 当前视角的待办：学生是团队要交的任务和开放中的讨论；教师是待评阅提交和临近的关卡。 */
  const todos = computed(() => {
    const items: { kind: string; title: string; sub: string; time: string; link: string }[] = []
    const now = dayjs()
    for (const p of myProjects.value) {
      if (p.status !== 'running') continue
      if (isStudent.value) {
        const t = myTeam(p.id)
        if (!t) continue
        for (const k of tasksOf(p.id)) {
          if (taskState(k, t.id) === 'todo')
            items.push({ kind: '待提交', title: k.title, sub: p.title, time: k.dueAt, link: `/pbl/projects/${p.id}/teams/${t.id}` })
        }
        for (const c of topicsOf(p.id)) {
          if (now.isAfter(c.openAt) && now.isBefore(c.dueAt) && !data.posts.some((x) => x.topicId === c.id && x.authorId === personaId.value))
            items.push({ kind: '待参与讨论', title: c.title, sub: p.title, time: c.dueAt, link: `/pbl/projects/${p.id}?tab=discuss` })
        }
      } else {
        for (const k of tasksOf(p.id)) {
          const pending = teamsOf(p.id).filter((t) => latestSub(k.id, t.id)?.score === null).length
          if (pending)
            items.push({ kind: '待评阅', title: `${k.title}（${pending} 个团队）`, sub: p.title, time: k.dueAt, link: `/pbl/projects/${p.id}/tasks/${k.id}` })
        }
      }
      const m = currentMilestone(p)
      if (m && dayjs(m.end).diff(now, 'day') <= 7)
        items.push({ kind: '关卡即将截止', title: m.title, sub: p.title, time: m.end, link: `/pbl/projects/${p.id}` })
    }
    return items.sort((a, b) => a.time.localeCompare(b.time))
  })

  return {
    data, personaId, me, role, isAdmin, isStudent, ensurePersona, reset,
    person, program, project, team, task, canManage, canSee, visibleProjects, projectsOf, teamsOf, myTeam,
    tasksOf, topicsOf, myProjects, milestoneState, currentMilestone, progressPercent, subsOf, latestSub, taskState,
    resourcesOf, sharedResources, postsOf,
    saveProject, setPublished, view, toggleInterest, myFavoriteIds, isFavorite, toggleFavorite,
    saveTeaming, createTeam, removeTeam, addMember, removeMember, joinTeam, leaveTeam, signup, cancelSignup,
    unassigned, planRandomGroups, applyGroups, startProject, finishProject,
    saveTask, removeTask, submitTask, grade, toggleRecommend, urge, recommended,
    addResource, setScope, removeResource, saveTopic, addPost, toggleLike, togglePin,
    teamMetrics, suggestedScore, evaluate, publishShowcase, withdrawShowcase, showcases, todos,
  }
})

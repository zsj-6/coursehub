/**
 * AI 原型的状态与规则（纯前端）。
 * - 掌握度、学习路径、闯关解锁、分层分流都按规则计算，同样的输入永远得到同样的结果。
 * - AI 回复是"剧本式"：按知识点和关键词组织回答，并附出处；不调用任何模型。
 * - 演示人物沿用 PBL 原型（stores/pbl.ts 的 personaId）。
 */
import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import {
  AI_TAG_SUGGESTIONS,
  AI_VARIANTS,
  CLASS_BASE,
  ERROR_REPORTS,
  EXPERTS,
  LEVELS,
  PROJECT_LINKS,
  QUESTIONS,
  RESOURCES,
  SEED_MASTERY,
  SEED_PASSED,
  UNITS,
  type KNode,
  type Level,
  type QLevel,
  type Question,
  type ResPart,
  type Resource,
  type Unit,
} from '@/mock/ai'
import { usePblStore } from '@/stores/pbl'

const STORE_KEY = 'coursehub.ai.v1'

export interface Rec {
  nodeId: string
  /** 0–100 */
  score: number
  at: string
  from: string
}
export interface Source {
  resId: string
  partId: string
  label: string
}
export interface Reply {
  text: string
  sources: Source[]
  /** 资料库里没有相关内容 */
  noSource?: boolean
}
export interface TutorCtx {
  unitId?: string
  nodeId?: string
  resId?: string
  partId?: string
  projectId?: string
  teamId?: string
  /** 作业 / 测试进行中：不给答案 */
  inTest?: boolean
}
export interface Feedback {
  id: string
  personaId: string
  question: string
  answer: string
  at: string
  status: 'pending' | 'fixed' | 'dismissed'
}
export type MasteryLevel = 'none' | 'weak' | 'mid' | 'good'
export type LevelState = 'passed' | 'open' | 'locked' | 'building'

interface Persisted {
  records: Record<string, Rec[]>
  passed: Record<string, string[]>
  paths: Record<string, Record<string, QLevel>>
  nodeReview: Record<string, 'confirmed' | 'rejected'>
  questionReview: Record<string, 'adopted' | 'rejected'>
  clusterConfirmed: string[]
  pushed: string[]
  tagAdopted: string[]
  feedback: Feedback[]
  asks: Record<string, { text: string; nodeId?: string; unitId?: string; at: string }[]>
}

const empty = (): Persisted => ({
  records: {},
  passed: {},
  paths: {},
  nodeReview: {},
  questionReview: {},
  clusterConfirmed: [],
  pushed: [],
  tagAdopted: [],
  feedback: [],
  asks: {},
})

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return { ...empty(), ...JSON.parse(raw) }
  } catch {
    /* 读不到就用初始数据 */
  }
  return empty()
}

/** 稳定的伪随机：同一个字符串永远得到同一个数 */
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // 再混合一次，否则相似的短字符串（s5r13、s9r13）低位分布不均
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

export const masteryLevel = (m: number | null | undefined): MasteryLevel =>
  m === null || m === undefined ? 'none' : m < 60 ? 'weak' : m >= 80 ? 'good' : 'mid'
export const MASTERY_LABEL: Record<MasteryLevel, string> = { none: '未学', weak: '薄弱', mid: '学习中', good: '已掌握' }

export const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
export function partLabel(part: ResPart) {
  if (part.t !== undefined) return fmtTime(part.t)
  if (part.page !== undefined) return `第 ${part.page} 页`
  return part.title
}

const ASK_ANSWER = /答案|直接告诉|选哪个|选几|标准答案|结果是多少/

export const useAiStore = defineStore('ai', () => {
  const pbl = usePblStore()
  const state = reactive<Persisted>(load())
  watch(
    state,
    (v) => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(v))
      } catch {
        /* 存不了就只保留在内存里 */
      }
    },
    { deep: true },
  )

  const personaId = computed(() => pbl.personaId)
  const isStudent = computed(() => pbl.isStudent)
  /** 只有指导教师和管理员能采纳 AI 生成的知识点、题目、资源标签；助教只读 */
  const canPublish = computed(() => pbl.role === 'mentor' || pbl.role === 'admin')

  // ------------------------------------------------------------ 基础查询
  const unitMap = new Map(UNITS.map((u) => [u.id, u]))
  const nodeMap = new Map<string, KNode>()
  const nodeUnit = new Map<string, string>()
  for (const u of UNITS)
    for (const n of u.nodes) {
      nodeMap.set(n.id, n)
      nodeUnit.set(n.id, u.id)
    }
  const resMap = new Map(RESOURCES.map((r) => [r.id, r]))
  const questionMap = new Map([...QUESTIONS, ...AI_VARIANTS].map((q) => [q.id, q]))

  const unit = (id: string) => unitMap.get(id)
  const node = (id: string) => nodeMap.get(id)
  const resource = (id: string) => resMap.get(id)
  const question = (id: string) => questionMap.get(id)
  const unitOfNode = (id: string) => unitMap.get(nodeUnit.get(id) ?? '')

  /** 节点审核状态：mock 里 status = ai 的是 AI 候选，教师采纳后转为 confirmed */
  function nodeStatus(n: KNode): 'confirmed' | 'ai' | 'rejected' {
    const r = state.nodeReview[n.id]
    if (r) return r
    return n.status ?? 'confirmed'
  }
  /** 学生看到的是已确认的节点；教师还能看到待审核的 AI 候选 */
  function nodesOf(u: Unit, withPending = !isStudent.value) {
    return u.nodes.filter((n) => {
      const s = nodeStatus(n)
      return s === 'confirmed' || (withPending && s === 'ai')
    })
  }
  function edgesOf(u: Unit, withPending = !isStudent.value) {
    const ids = new Set(nodesOf(u, withPending).map((n) => n.id))
    return u.edges.filter((e) => ids.has(e.from) && ids.has(e.to))
  }
  const pendingNodes = computed(() => UNITS.flatMap((u) => u.nodes.filter((n) => nodeStatus(n) === 'ai')))
  function reviewNode(id: string, decision: 'confirmed' | 'rejected') {
    state.nodeReview[id] = decision
  }

  // ------------------------------------------------------------ 资源
  /** 资源的可定位片段。领导版迁移过来的资源没有分节，按标题生成 3 段导读。 */
  function partsOf(r: Resource): ResPart[] {
    if (r.parts.length) return r.parts
    const names = r.nodeIds.map((id) => node(id)?.name).filter(Boolean)
    const descs = r.nodeIds.map((id) => node(id)).filter(Boolean).map((n) => `「${n!.name}」：${n!.desc}`)
    return [
      { id: 'p1', title: '导读', page: 1, nodeIds: r.nodeIds, body: `${r.title}——${r.reason}。\n\n建议先通读目录，标出和你当前学习目标相关的章节，再带着问题精读。` },
      { id: 'p2', title: `核心内容：${names.join('、') || '主体内容'}`, page: 12, nodeIds: r.nodeIds, body: descs.join('\n\n') || '本资料的主体内容。' },
      { id: 'p3', title: '延伸思考', page: 36, nodeIds: r.nodeIds, body: '读完后试着回答：这份资料想解决什么问题？它用什么方法推进？哪一步你最没有把握？' },
    ]
  }
  function resourceNodeIds(r: Resource) {
    if (!r.nodeIds.length && state.tagAdopted.includes(r.id)) return AI_TAG_SUGGESTIONS[r.id]?.nodeIds ?? []
    return r.nodeIds
  }
  const resourcesOf = (unitId: string) => RESOURCES.filter((r) => r.unitId === unitId)
  /** 某个节点的出处：按教材 / 视频优先，最多 3 条 */
  function sourcesOf(nodeId: string, limit = 3): Source[] {
    const order = ['textbook', 'video', 'project', 'paper', 'book', 'course']
    const out: (Source & { rank: number })[] = []
    for (const r of RESOURCES) {
      const parts = partsOf(r).filter((p) => p.nodeIds.includes(nodeId))
      const p = parts.find((x) => x.page !== undefined || x.t !== undefined) ?? parts[0]
      if (p) out.push({ resId: r.id, partId: p.id, label: `${r.title} · ${partLabel(p)}`, rank: order.indexOf(r.kind) })
    }
    return out.sort((a, b) => a.rank - b.rank).slice(0, limit).map(({ rank: _r, ...s }) => s)
  }
  /** 资源检索：关键词命中标题 / 片段标题 / 片段正文 / 关联节点名，结果按片段返回 */
  function search(unitId: string, keyword: string) {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return []
    const hits: { res: Resource; part: ResPart }[] = []
    for (const r of resourcesOf(unitId)) {
      for (const p of partsOf(r)) {
        const nodeNames = p.nodeIds.map((id) => node(id)?.name ?? '').join(' ')
        const text = `${r.title} ${p.title} ${p.body ?? ''} ${nodeNames}`.toLowerCase()
        if (text.includes(kw)) hits.push({ res: r, part: p })
      }
    }
    return hits
  }

  // ------------------------------------------------------------ 掌握度
  /** 演示数据换算成"历史作答记录"，这样掌握度永远能说清由哪些作答算出 */
  function seedRecords(pid: string, nodeId: string): Rec[] {
    const n = node(nodeId)
    if (!n) return []
    let target: number | null | undefined
    const seed = SEED_MASTERY[pid]
    if (seed && nodeId in seed) target = seed[nodeId]
    else if (n.seed !== undefined && (pid === 's1' || pid === 's20')) target = pid === 's1' ? n.seed : clamp(n.seed - 18)
    else if (pid !== 's1' && pid !== 's20' && CLASS_BASE[nodeId] !== undefined) target = classMastery(nodeId, pid)
    if (target === null || target === undefined) return []
    const course = n.courses?.[0] || unitOfNode(nodeId)?.name || '课程'
    const deltas = [6, -6, 3, -3]
    const days = [-40, -26, -12, -4]
    return deltas.map((d, i) => ({
      nodeId,
      score: clamp(target! + d),
      at: dayjs().add(days[i], 'day').toISOString(),
      from: i === 3 ? `${course} · 单元测验` : `${course} · 第 ${i + 1} 次作业`,
    }))
  }
  function recordsOf(nodeId: string, pid = personaId.value): Rec[] {
    const mine = (state.records[pid] ?? []).filter((r) => r.nodeId === nodeId)
    return [...seedRecords(pid, nodeId), ...mine]
  }
  /** 掌握度 = 加权得分率，最近 30 天的作答权重为 2 */
  function mastery(nodeId: string, pid = personaId.value): number | null {
    const recs = recordsOf(nodeId, pid)
    if (!recs.length) return null
    const cutoff = dayjs().subtract(30, 'day')
    let sw = 0
    let s = 0
    for (const r of recs) {
      const w = dayjs(r.at).isAfter(cutoff) ? 2 : 1
      sw += w
      s += w * r.score
    }
    return clamp(s / sw)
  }
  /** 班级视图里某个学生的掌握度：s1 用真实记录，其余按班级均值 + 稳定扰动 */
  function classMastery(nodeId: string, sid: string): number | null {
    if (sid === 's1' || sid === 's20') return mastery(nodeId, sid)
    const n = node(nodeId)
    const base = CLASS_BASE[nodeId] ?? (n?.seed !== undefined ? n.seed - 8 : undefined)
    if (base === undefined) return null
    const v = base + ((hash(sid + nodeId) % 51) - 25)
    if (base < 50 && v < base - 12) return null
    return clamp(v)
  }
  const roster = computed(() => pbl.data.people.filter((p) => p.role === 'student'))
  function classAvg(nodeId: string) {
    const vals = roster.value.map((p) => classMastery(nodeId, p.id)).filter((v): v is number => v !== null)
    return vals.length ? clamp(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }
  /** 当前视角下节点的掌握度：学生看自己的，教师看班级平均 */
  function viewMastery(nodeId: string) {
    return isStudent.value ? mastery(nodeId) : classAvg(nodeId)
  }
  function addRecord(nodeId: string, correct: boolean, from: string) {
    const list = (state.records[personaId.value] ??= [])
    list.push({ nodeId, score: correct ? 100 : 0, at: new Date().toISOString(), from })
  }

  // ------------------------------------------------------------ 学习路径
  /** 沿前置关系往回找目标的所有上游节点，跳过已掌握（≥80%）的，按先后顺序排列；目标本身始终保留 */
  function learningPath(u: Unit, targetId: string): string[] {
    const edges = edgesOf(u, false)
    const parents = new Map<string, string[]>()
    for (const e of edges) (parents.get(e.to) ?? parents.set(e.to, []).get(e.to)!).push(e.from)
    const seen = new Set<string>()
    const order: string[] = []
    const visit = (id: string) => {
      if (seen.has(id)) return
      seen.add(id)
      for (const p of parents.get(id) ?? []) visit(p)
      order.push(id)
    }
    visit(targetId)
    return order.filter((id) => id === targetId || (mastery(id) ?? 0) < 80)
  }

  // ------------------------------------------------------------ 闯关
  const levelsOf = (unitId: string) => LEVELS.filter((l) => l.unitId === unitId).sort((a, b) => a.order - b.order)
  const level = (id: string) => LEVELS.find((l) => l.id === id)
  function passedList(pid = personaId.value) {
    if (pid in SEED_PASSED || !/^s\d+$/.test(pid)) return [...(SEED_PASSED[pid] ?? []), ...(state.passed[pid] ?? [])]
    // 班上其他同学没有演示记录：本关知识点掌握度都 ≥ 60% 视为已通过（按顺序，前一关没过后面也不算）
    const out: string[] = []
    for (const u of UNITS) {
      for (const l of LEVELS.filter((x) => x.unitId === u.id && x.diagnose.length).sort((a, b) => a.order - b.order)) {
        if (l.nodeIds.every((n) => (classMastery(n, pid) ?? 0) >= 60)) out.push(l.id)
        else break
      }
    }
    return out
  }
  function levelState(l: Level, pid = personaId.value): LevelState {
    if (!l.diagnose.length) return 'building'
    const passed = passedList(pid)
    if (passed.includes(l.id)) return 'passed'
    const prev = levelsOf(l.unitId).find((x) => x.order === l.order - 1)
    if (!prev || passed.includes(prev.id)) return 'open'
    return 'locked'
  }
  /** 诊断分流：全对 → 挑战；答对过半（含一半）→ 标准；否则补基础 */
  function assignPath(correct: number, total: number): QLevel {
    if (correct === total) return 'challenge'
    if (correct * 2 >= total && correct > 0) return 'standard'
    return 'basic'
  }
  function setPath(levelId: string, p: QLevel) {
    ;(state.paths[personaId.value] ??= {})[levelId] = p
  }
  const pathOf = (levelId: string) => state.paths[personaId.value]?.[levelId]
  function passLevel(levelId: string) {
    const list = (state.passed[personaId.value] ??= [])
    if (!list.includes(levelId)) list.push(levelId)
  }
  /** 教师分层视图：按班级每个学生在本关节点上的平均掌握度推算分流 */
  function classPathOf(l: Level, sid: string): QLevel | 'none' {
    const vals = l.nodeIds.map((n) => classMastery(n, sid)).filter((v): v is number => v !== null)
    if (!vals.length) return 'none'
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    return avg >= 85 ? 'challenge' : avg >= 60 ? 'standard' : 'basic'
  }

  // ------------------------------------------------------------ 推荐
  /** 为你推荐：最薄弱的节点各推一条资源，写明理由 */
  function recommendations(limit = 3) {
    const out: { node: KNode; unit: Unit; m: number; source: Source }[] = []
    for (const u of UNITS) {
      for (const n of nodesOf(u, false)) {
        const m = mastery(n.id)
        if (m === null || m >= 60) continue
        const s = sourcesOf(n.id, 1)[0]
        if (s) out.push({ node: n, unit: u, m, source: s })
      }
    }
    return out.sort((a, b) => a.m - b.m).slice(0, limit)
  }

  // ------------------------------------------------------------ 辅学（剧本式）
  const tutorOpen = ref(false)
  const tutorCtx = ref<TutorCtx>({})
  const tutorPrefill = ref('')
  const tutorMode = ref<'chat' | 'feynman'>('chat')
  const tutorBlocked = ref(false)
  function openTutor(ctx: TutorCtx = {}, prefill = '', mode: 'chat' | 'feynman' = 'chat') {
    tutorCtx.value = ctx
    tutorPrefill.value = prefill
    tutorMode.value = mode
    tutorOpen.value = true
  }

  /** 在问题里找知识点：优先当前单元，取最长的命中 */
  function findNode(text: string, unitId?: string): KNode | undefined {
    const s = text.toLowerCase()
    const units = unitId ? [unitMap.get(unitId)!, ...UNITS.filter((u) => u.id !== unitId)] : UNITS
    let best: KNode | undefined
    let bestLen = 0
    for (const u of units) {
      for (const n of nodesOf(u, false)) {
        const tokens = [n.name, ...n.name.split(/[\s·（）()：:]+/)].filter((t) => t.length >= 2)
        for (const t of tokens) {
          if (s.includes(t.toLowerCase()) && t.length > bestLen) {
            best = n
            bestLen = t.length
          }
        }
      }
      if (best && unitId && u.id === unitId) break
    }
    return best
  }
  function nextNodeName(n: KNode) {
    const u = unitOfNode(n.id)
    const e = u?.edges.find((x) => x.from === n.id)
    return e ? node(e.to)?.name : undefined
  }

  function reply(input: string, ctx: TutorCtx, expertId = 'academic'): Reply {
    const s = input.trim()
    if (ctx.inTest && ASK_ANSWER.test(s))
      return { text: '现在是作答过程中，我不能直接告诉你答案。可以先说说你卡在哪一步，我给你一个思考方向。', sources: [] }

    if (ctx.projectId && /该做|下一步|怎么办|做什么|计划|安排/.test(s)) {
      const coach = projectCoach(ctx.projectId, ctx.teamId)
      if (coach) return coach
    }

    const hit = findNode(s, ctx.unitId) ?? (ctx.nodeId ? node(ctx.nodeId) : undefined)
    const expertPrefix = expertId === 'contest' && hit && nodeUnit.get(hit.id) === 'robo' ? '从比赛实践的角度说，' : ''

    if (hit) {
      const sources = sourcesOf(hit.id)
      const next = nextNodeName(hit)
      if (/看不懂|不明白|不理解|太难|听不懂/.test(s))
        return {
          text: `看不懂往往是因为某个前提被跳过了。「${hit.name}」用到的前置知识是：${prereqNames(hit) || '无'}。\n\n先做一件小事：在下面第一条出处里，找出一个你觉得"应该先解释但我还没懂"的词，发给我，我们从那里开始。`,
          sources,
        }
      if (/例子|举例|具体|通俗|打个比方/.test(s))
        return {
          text: `${expertPrefix}例子最好由你自己造，那样才是真的懂。照这个框架补三格：\n① 机器人上有这样一个场景：____\n② 在这个场景里，「${hit.name}」对应的是：____\n③ 如果没有它，会出现的问题是：____\n\n写完发给我，我帮你看哪一格还不准确。`,
          sources,
        }
      if (/区别|差异|不同|关系|联系/.test(s))
        return {
          text: `对比题我先不直接给结论，给你两个对照维度：\n第一，它们各自想解决什么问题；\n第二，它们在什么条件下会给出不同的结果。\n\n先说说你对「${hit.name}」在这两个维度上的理解？${next ? `也可以想想它和后面要学的「${next}」是什么关系。` : ''}`,
          sources,
        }
      const answerAsked = ASK_ANSWER.test(s)
      return {
        text:
          (answerAsked ? '我先不直接给结论，把关键点讲给你，你自己推一遍更容易记住。\n\n' : '') +
          `${expertPrefix}先抓住「${hit.name}」的要点：\n${hit.explain || hit.desc}\n\n` +
          `下面的出处可以点开对照原文。读完试着用自己的话说一遍${next ? `，再想想它是怎么用到「${next}」上的` : ''}。说给我听，我帮你检查有没有漏的。`,
        sources,
      }
    }

    if (ctx.resId) {
      const r = resource(ctx.resId)
      const part = r && partsOf(r).find((p) => p.id === ctx.partId)
      if (r && part) {
        const src = [{ resId: r.id, partId: part.id, label: `${r.title} · ${partLabel(part)}` }]
        if (/总结|概括|梳理|提纲/.test(s))
          return { text: `总结自己做一遍比看我做十遍有用。给你一个句式：\n「${part.title}这一段想解决的问题是____；它用____的方法推进；我最有把握的是____，最没把握的是____。」\n\n写完发给我。`, sources: src }
        return {
          text: `我们顺着「${part.title}」往下想：这一段里最关键的一个前提是什么？如果把它拿掉，结论还成立吗？\n\n先回答这个小问题，我再接着讲。`,
          sources: src,
        }
      }
    }

    const byExpert = expertScript(expertId, s)
    if (byExpert) return byExpert

    return {
      text: '资料库里没有找到和这个问题直接相关的内容，我不想凭空编一个答案给你。\n\n可以换个说法（比如带上知识点的名字），或者到课程讨论区问老师。这个问题已经记下来，老师审核时能看到。',
      sources: [],
      noSource: true,
    }
  }

  /** 职业 / 升学 / 综合素养等导师：没有对应知识点时，按问题类型给引导式回答（领导版 AI 导师） */
  function expertScript(expertId: string, s: string): Reply | null {
    const e = expertId.toLowerCase()
    if (e === 'career' || /简历|面试|岗位|实习|求职|就业/.test(s))
      return {
        text: '先别急着改简历，我们把方向理清楚：\n1. 你想投的岗位是什么？把岗位要求里出现最多的 3 项能力写下来。\n2. 对照你的项目经历，每项能力找一个能证明它的具体例子（做了什么、结果是多少）。\n3. 缺的那一项，看看「能力成长」里有没有对应的能力单元可以补。\n\n先发给我第 1 步的答案。岗位和招聘信息以学校就业指导中心发布的为准。',
        sources: [],
      }
    if (e === 'graduate' || /保研|考研|留学|推免|夏令营/.test(s))
      return {
        text: '升学规划我建议分三步想：\n1. 目标：保研、考研还是出国？各自最晚的决策时间点是什么时候？\n2. 差距：对照目标院校往年的要求（绩点排名、科研 / 竞赛经历、英语），列出你现在缺什么。\n3. 计划：把缺的部分排进每个学期。\n\n你现在更倾向哪条路？具体政策以学校研究生院和教务处发布的为准。',
        sources: [],
      }
    if (e === 'general' || /演讲|沟通|表达|时间管理|拖延/.test(s))
      return {
        text: '这类能力最有效的办法是"小步练习 + 及时反馈"。给你一个本周就能做的练习：\n· 选一个你熟悉的知识点，用 3 分钟讲给同学听，录下来；\n· 回听时只记录两件事：哪里卡住了、哪里听众皱眉了；\n· 下次只改其中一处。\n\n想先练表达还是时间管理？',
        sources: [],
      }
    return null
  }

  /** 多导师协同：其他导师从各自角度补充一句 */
  function expertSupplement(expertId: string, topic?: string): string {
    const t = topic ? `「${topic}」` : '这个问题'
    const map: Record<string, string> = {
      academic: `从学习方法看，${t}建议先把定义和一个最简单的例子吃透，再做题。`,
      contest: `从比赛实践看，${t}在机甲大师里最容易出问题的地方是现场调试，建议提前准备排障清单。`,
      research: `从科研角度看，可以找 1~2 篇和${t}相关的论文，重点读实验设计部分。`,
      innovation: `从项目角度看，${t}可以拆成一个两周能做完的小目标，作为大创的起步。`,
      career: `从就业角度看，${t}对应的能力在相关岗位的面试里经常被问到，可以准备一个自己的实例。`,
      graduate: `从升学角度看，${t}相关的项目经历在推免面试里是加分项，记得留好过程材料。`,
      general: `从表达角度看，试着把${t}用 3 句话讲给不懂的人听，能讲清楚才是真的懂了。`,
    }
    return map[expertId.toLowerCase()] ?? `关于${t}，我同意上面的分析。`
  }
  /** 项目教练：按当前关卡、截止时间、所需节点和团队掌握情况给 3 条建议 */
  function projectCoach(projectId: string, teamId?: string): Reply | null {
    const p = pbl.project(projectId)
    if (!p) return null
    const ms = pbl.currentMilestone(p)
    const link = projectLink(projectId)
    const team = teamId ? pbl.team(teamId) : pbl.myTeam(projectId)
    if (!ms) return { text: `「${p.title}」目前没有进行中的关卡。可以先回顾上一关的评阅意见，或者提前预习下一关需要的知识点。`, sources: [] }
    const days = Math.max(0, dayjs(ms.end).diff(dayjs(), 'day'))
    const need = link?.milestoneNodes[ms.id] ?? []
    const weak = need
      .map((id) => {
        const members = team?.memberIds ?? [personaId.value]
        const ok = members.filter((sid) => (classMastery(id, sid) ?? 0) >= 80).length
        return { id, ok, total: members.length }
      })
      .sort((a, b) => a.ok - b.ok)
    const lines = [`你们现在在「${ms.title}」关，距离截止还有 ${days} 天。我的 3 条建议：`, '']
    lines.push(`1. 先对照关卡要求列出本周要交的东西：${ms.description}`)
    if (weak.length) {
      const w = weak[0]
      lines.push(`2. 本关需要「${weak.map((x) => node(x.id)?.name).join('」「')}」。团队里掌握「${node(w.id)?.name}」的只有 ${w.ok}/${w.total} 人，建议这周安排一人先补上，再给大家讲一遍。`)
    } else lines.push('2. 把任务拆到每个人，每人每天在组内讨论区同步一次进展。')
    lines.push('3. 提交前先用"提交诊断"自查一遍，缺什么补什么，再正式提交给指导教师。')
    const sources = weak.length ? sourcesOf(weak[0].id, 2) : []
    return { text: lines.join('\n'), sources }
  }

  function prereqNames(n: KNode) {
    const u = unitOfNode(n.id)
    return (u?.edges ?? [])
      .filter((e) => e.to === n.id)
      .map((e) => node(e.from)?.name)
      .filter(Boolean)
      .join('、')
  }

  /** 费曼模式：学生讲，AI 扮演没学过的同学，按要点检查讲到了哪些 */
  function feynman(nodeId: string, text: string) {
    const n = node(nodeId)!
    const points =
      n.keyPoints ??
      n.desc
        .replace(/。$/, '')
        .split(/[、，,]/)
        .filter((x) => x.length >= 2)
        .map((x) => ({ kw: [x.slice(0, 2)], point: x }))
    const lower = text.toLowerCase()
    const covered = points.filter((p) => p.kw.some((k) => lower.includes(k.toLowerCase())))
    const missed = points.filter((p) => !covered.includes(p))
    if (text.trim().length < 15)
      return { text: `讲得有点短。假设我完全没学过「${n.name}」，你再展开讲讲：它是什么、为什么需要它、怎么用？`, covered, missed, total: points.length }
    const lines = [`我是一个没学过「${n.name}」的同学，听完你的讲解：`, '']
    if (covered.length) lines.push(`听懂了：\n${covered.map((p) => `· ${p.point}`).join('\n')}`, '')
    if (missed.length) {
      lines.push(`还没讲到：\n${missed.map((p) => `· ${p.point.split('：')[0]}`).join('\n')}`, '')
      lines.push(`我追问一个：${missed[0].point.split('：')[0]}，这是怎么回事？`)
    } else lines.push('要点都讲到了，讲得很清楚！可以试试去闯关检验一下。')
    return { text: lines.join('\n'), covered, missed, total: points.length }
  }

  function logAsk(text: string, ctx: TutorCtx) {
    const list = (state.asks[personaId.value] ??= [])
    const n = findNode(text, ctx.unitId)
    list.unshift({ text, nodeId: n?.id ?? ctx.nodeId, unitId: ctx.unitId, at: new Date().toISOString() })
    if (list.length > 20) list.length = 20
  }
  const myAsks = computed(() => state.asks[personaId.value] ?? [])
  function reportError(questionText: string, answer: string) {
    state.feedback.unshift({
      id: `fb${Date.now().toString(36)}`,
      personaId: personaId.value,
      question: questionText,
      answer,
      at: new Date().toISOString(),
      status: 'pending',
    })
  }

  // ------------------------------------------------------------ 助教
  const errorReports = ERROR_REPORTS
  function confirmCluster(qId: string) {
    if (!state.clusterConfirmed.includes(qId)) state.clusterConfirmed.push(qId)
  }
  function push(key: string) {
    if (!state.pushed.includes(key)) state.pushed.push(key)
  }
  /** 分层练习：题库里该节点的题 + AI 变式题，按三档分组 */
  function practiceSet(nodeId: string) {
    const all = [...QUESTIONS, ...AI_VARIANTS].filter((q) => q.nodeId === nodeId)
    const group = (lv: QLevel) => all.filter((q) => q.level === lv)
    return { basic: group('basic'), standard: group('standard'), challenge: group('challenge') }
  }
  function reviewQuestion(id: string, d: 'adopted' | 'rejected') {
    state.questionReview[id] = d
  }
  function adoptTags(resId: string) {
    if (!state.tagAdopted.includes(resId)) state.tagAdopted.push(resId)
  }

  // ------------------------------------------------------------ PBL 关联
  const projectLinksOf = (unitId: string) => PROJECT_LINKS.filter((p) => p.unitId === unitId)
  const projectLink = (projectId: string) => PROJECT_LINKS.find((p) => p.projectId === projectId)

  function reset() {
    Object.assign(state, empty())
  }

  return {
    state,
    personaId,
    isStudent,
    canPublish,
    units: UNITS,
    experts: EXPERTS,
    unit,
    node,
    resource,
    question,
    unitOfNode,
    nodeStatus,
    nodesOf,
    edgesOf,
    pendingNodes,
    reviewNode,
    partsOf,
    resourceNodeIds,
    resourcesOf,
    sourcesOf,
    search,
    recordsOf,
    mastery,
    classMastery,
    classAvg,
    viewMastery,
    roster,
    addRecord,
    learningPath,
    levelsOf,
    level,
    levelState,
    passedList,
    assignPath,
    setPath,
    pathOf,
    passLevel,
    classPathOf,
    recommendations,
    tutorOpen,
    tutorCtx,
    tutorPrefill,
    tutorMode,
    tutorBlocked,
    openTutor,
    reply,
    expertSupplement,
    feynman,
    logAsk,
    myAsks,
    reportError,
    errorReports,
    confirmCluster,
    push,
    practiceSet,
    reviewQuestion,
    adoptTags,
    projectLinksOf,
    projectLink,
    findNode,
    reset,
  }
})

export type { Question }

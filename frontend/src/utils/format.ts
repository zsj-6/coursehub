import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import type { ActivityBrief, ActivityType, MemberRole, QuestionType, SubStatus } from '@/api/types'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export const fmt = (t?: string | null, pattern = 'YYYY-MM-DD HH:mm') => (t ? dayjs(t).format(pattern) : '—')
export const fromNow = (t?: string | null) => (t ? dayjs(t).fromNow() : '')
export const toISO = (d: Date | string | null | undefined) => (d ? dayjs(d).toISOString() : null)

export const TYPE_LABEL: Record<ActivityType, string> = {
  material: '参考资料',
  video: '音视频',
  homework: '作业',
  exam: '测试',
}

export const TYPE_COLOR: Record<ActivityType, string> = {
  material: '#4c7df0',
  video: '#7b67d6',
  homework: '#12969c',
  exam: '#e37318',
}

export const ROLE_LABEL: Record<MemberRole | 'admin', string> = {
  admin: '管理员',
  teacher: '教师',
  ta: '助教',
  student: '学生',
}

export const Q_LABEL: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  fill: '填空题',
  short: '简答题',
}

export const STATUS_LABEL: Record<SubStatus, string> = {
  not_submitted: '未提交',
  pending: '待批改',
  graded: '已批改',
}

export const STATUS_TAG: Record<SubStatus, 'info' | 'warning' | 'success'> = {
  not_submitted: 'info',
  pending: 'warning',
  graded: 'success',
}

export const optionLetter = (i: number) => String.fromCharCode(65 + i)

export function fmtSize(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function fmtScore(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

/** 活动给教师看的发布状态。 */
export function publishState(a: ActivityBrief): { text: string; type: 'info' | 'success' | 'warning' | 'danger' } {
  if (!a.is_published) return { text: '未发布', type: 'info' }
  const now = dayjs()
  if (a.open_at && now.isBefore(a.open_at)) return { text: `定时 ${fmt(a.open_at, 'MM-DD HH:mm')} 开放`, type: 'warning' }
  if (a.close_at && now.isAfter(a.close_at)) return { text: '已结束开放', type: 'danger' }
  return { text: '已发布', type: 'success' }
}

/** 一组"深色文字 + 浅色底"的色调，用于封面、头像、图标底色。 */
export const TONES: { fg: string; bg: string }[] = [
  { fg: '#0c7c82', bg: '#e7f5f5' },
  { fg: '#2b5fd9', bg: '#eaf0fe' },
  { fg: '#6247c5', bg: '#efecfb' },
  { fg: '#b65c13', bg: '#fcf1e8' },
  { fg: '#22835a', bg: '#eaf6f1' },
  { fg: '#aa3a34', bg: '#fbedec' },
]
export const toneVars = (i: number): Record<string, string> => {
  const t = TONES[((i % TONES.length) + TONES.length) % TONES.length]
  return { '--tone': t.fg, '--tone-bg': t.bg }
}

/** 课程卡片大封面的底纹：点阵、斜线、同心圆、方格，按课程 id 固定选一种。 */
const COVER_PATTERNS = [
  'radial-gradient(circle, var(--tone) 1.2px, transparent 1.7px) 0 0 / 14px 14px',
  'repeating-linear-gradient(135deg, var(--tone) 0 1px, transparent 1px 11px)',
  'repeating-radial-gradient(circle at 100% 100%, var(--tone) 0 1px, transparent 1px 13px)',
  'linear-gradient(var(--tone) 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(90deg, var(--tone) 1px, transparent 1px) 0 0 / 18px 18px',
]
/** 大封面：浅色调 + 底纹（CSS 用 --art 画在 ::after 上）。有封面图时只返回图片。 */
export function coverArt(id: number, cover?: string | null): Record<string, string> {
  if (cover) return coverStyle(id, cover)
  return { ...toneVars(id), '--art': COVER_PATTERNS[Math.floor(id / TONES.length + id) % COVER_PATTERNS.length] }
}

/** 课程封面：有封面图就用图，没有就按课程 id 取一个稳定的浅色调（由 CSS 读 --tone / --tone-bg）。 */
export function coverStyle(id: number, cover?: string | null): Record<string, string> {
  if (cover) return { ...toneVars(id), backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  return toneVars(id)
}

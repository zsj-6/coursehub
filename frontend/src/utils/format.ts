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
  material: '#5b8ff9',
  video: '#9270ca',
  homework: '#3bb4b8',
  exam: '#f6903d',
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

/** 给课程卡片生成稳定的渐变色封面。 */
export function coverStyle(id: number, cover?: string | null) {
  if (cover) return { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  const palettes = [
    ['#3bb4b8', '#2a8c99'],
    ['#5b8ff9', '#3d6fd6'],
    ['#9270ca', '#6f4fae'],
    ['#f6903d', '#e06c1f'],
    ['#5ad8a6', '#2fb07f'],
    ['#e8684a', '#c94a2d'],
  ]
  const [a, b] = palettes[id % palettes.length]
  return { backgroundImage: `linear-gradient(135deg, ${a}, ${b})` }
}

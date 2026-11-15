import type { ProjectStatus, ResourceKind, ShareScope } from '@/mock/pbl'
import type { TaskState } from '@/stores/pbl'
import { TONES, toneVars } from '@/utils/format'

export const PROJECT_STATUS: Record<ProjectStatus, { text: string; type: 'info' | 'success' | 'warning' | 'primary' }> = {
  draft: { text: '草稿', type: 'info' },
  recruiting: { text: '招募中', type: 'warning' },
  running: { text: '进行中', type: 'success' },
  finished: { text: '已结项', type: 'primary' },
}

export const STATUS_COLOR: Record<ProjectStatus, string> = {
  draft: '#c5c9ce',
  recruiting: '#e8862e',
  running: '#12969c',
  finished: '#4c7df0',
}

export const SCOPE_LABEL: Record<ShareScope, string> = {
  team: '组内公开',
  project: '项目内公开',
  school: '校内公开',
}

export const KIND_ICON: Record<ResourceKind, { icon: string; color: string }> = {
  pdf: { icon: 'Document', color: '#d54941' },
  video: { icon: 'VideoPlay', color: '#7b67d6' },
  doc: { icon: 'Tickets', color: '#4c7df0' },
  ppt: { icon: 'DataBoard', color: '#e37318' },
  code: { icon: 'Files', color: '#41464f' },
  image: { icon: 'Picture', color: '#2ba471' },
}

export const TASK_STATE: Record<TaskState, { text: string; type: 'info' | 'success' | 'warning' | 'danger' | 'primary' }> = {
  not_open: { text: '未开放', type: 'info' },
  todo: { text: '待提交', type: 'warning' },
  submitted: { text: '待评阅', type: 'primary' },
  graded: { text: '已评阅', type: 'success' },
  overdue: { text: '已逾期', type: 'danger' },
}

export function kindOf(filename: string): ResourceKind {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return 'pdf'
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return 'video'
  if (['ppt', 'pptx', 'key'].includes(ext)) return 'ppt'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image'
  if (['py', 'cpp', 'c', 'h', 'zip', 'rar', 'js', 'ts'].includes(ext)) return 'code'
  return 'doc'
}

/** 大项目的色调：返回 --tone / --tone-bg 两个 CSS 变量，具体怎么用由各页面的样式决定。 */
export const programCover = (i: number) => toneVars(i)

export function avatarColor(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TONES[h % TONES.length]
}

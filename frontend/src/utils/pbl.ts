import type { ProjectStatus, ResourceKind, ShareScope } from '@/mock/pbl'
import type { TaskState } from '@/stores/pbl'

export const PROJECT_STATUS: Record<ProjectStatus, { text: string; type: 'info' | 'success' | 'warning' | 'primary' }> = {
  draft: { text: '草稿', type: 'info' },
  recruiting: { text: '招募中', type: 'warning' },
  running: { text: '进行中', type: 'success' },
  finished: { text: '已结项', type: 'primary' },
}

export const STATUS_COLOR: Record<ProjectStatus, string> = {
  draft: '#b8c0cc',
  recruiting: '#f6903d',
  running: '#3bb4b8',
  finished: '#5b8ff9',
}

export const SCOPE_LABEL: Record<ShareScope, string> = {
  team: '组内公开',
  project: '项目内公开',
  school: '校内公开',
}

export const KIND_ICON: Record<ResourceKind, { icon: string; color: string }> = {
  pdf: { icon: 'Document', color: '#e8684a' },
  video: { icon: 'VideoPlay', color: '#9270ca' },
  doc: { icon: 'Tickets', color: '#5b8ff9' },
  ppt: { icon: 'DataBoard', color: '#f6903d' },
  code: { icon: 'Files', color: '#2c3e50' },
  image: { icon: 'Picture', color: '#5ad8a6' },
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

const PROGRAM_PALETTES = [
  ['#3bb4b8', '#22808a'],
  ['#5b8ff9', '#3d6fd6'],
  ['#9270ca', '#6a4aa8'],
  ['#f6903d', '#d9691b'],
  ['#5ad8a6', '#279c71'],
]
export const programCover = (i: number) => {
  const [a, b] = PROGRAM_PALETTES[i % PROGRAM_PALETTES.length]
  return { backgroundImage: `linear-gradient(135deg, ${a}, ${b})` }
}

export const AVATAR_COLORS = ['#3bb4b8', '#5b8ff9', '#9270ca', '#f6903d', '#5ad8a6', '#e8684a', '#6dc8ec']
export function avatarColor(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

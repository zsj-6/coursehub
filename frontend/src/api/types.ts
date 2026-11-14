export type Role = 'admin' | 'teacher' | 'student'
export type MemberRole = 'teacher' | 'ta' | 'student'
export type ActivityType = 'material' | 'video' | 'homework' | 'exam'
export type QuestionType = 'single' | 'multiple' | 'judge' | 'fill' | 'short'
export type SubStatus = 'not_submitted' | 'pending' | 'graded'

export interface User {
  id: number
  username: string
  name: string
  avatar: string | null
  role: Role
  student_no: string | null
}

export type UserBrief = Pick<User, 'id' | 'name' | 'username' | 'student_no' | 'avatar'>

export interface FileInfo {
  id: number
  key: string
  filename: string
  mime: string
  size: number
  url: string
}

export interface Course {
  id: number
  name: string
  code: string
  cover: string | null
  description: string
  semester: string
  archived: boolean
  owner: { id: number; name: string } | null
  created_at: string
  my_role: MemberRole | null
  student_count: number | null
}

export interface ActivityBrief {
  id: number
  course_id: number
  chapter_id: number
  type: ActivityType
  title: string
  sort: number
  is_published: boolean
  open_at: string | null
  close_at: string | null
  start_at: string | null
  due_at: string | null
  full_score: number
  score_ratio: number
  completed?: boolean
  // 列表接口附带
  my_status?: SubStatus
  my_score?: number | null
  my_attempts?: number
  student_count?: number
  submitted_count?: number
  pending_count?: number
  graded_count?: number
}

export interface Activity extends ActivityBrief {
  description: string
  settings: Record<string, any>
  created_at: string
  files?: FileInfo[]
  question_count?: number
  my_role?: MemberRole
  progress?: { completed: boolean; watched_seconds: number; last_pos: number } | null
}

export interface ChapterNode {
  id: number
  title: string
  sort: number
  parent_id: number | null
  activities: ActivityBrief[]
  units?: ChapterNode[]
}

export interface Question {
  id?: number
  type: QuestionType
  stem: string
  options: string[]
  answer: any
  score: number
  analysis: string
  sort?: number
}

export interface PaperQuestion {
  id: number
  type: QuestionType
  stem: string
  score: number
  options: { key: number; text: string }[]
  blank_count?: number
}

export interface Submission {
  id: number
  activity_id: number
  user_id: number
  attempt_no: number
  content: string
  files: FileInfo[]
  auto_score: number | null
  question_scores: Record<string, number | null>
  score: number | null
  comment: string
  status: 'draft' | 'submitted' | 'graded'
  started_at: string | null
  submitted_at: string | null
  graded_at: string | null
  user?: UserBrief
  questions?: (Question & { id: number; given: any; got: number | null; blank_count?: number })[]
  show_answer?: boolean
}

export interface SubmissionRow {
  user: UserBrief
  status: SubStatus
  attempts: number
  submission_ids: number[]
  latest_submitted_at: string | null
  score: number | null
  override: number | null
  final: number | null
}

export interface GradeTable {
  activities: { id: number; title: string; type: ActivityType; full_score: number; score_ratio: number; is_published: boolean }[]
  ratio_sum: number
  rows: {
    user: UserBrief
    cells: Record<string, { raw: number | null; override: number | null; final: number | null; status: SubStatus }>
    total_calc: number
    total_override: number | null
    total: number
  }[]
}

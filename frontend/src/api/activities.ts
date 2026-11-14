import { download, http } from './http'
import type { Activity, ActivityBrief, PaperQuestion, Question, Submission, SubmissionRow, SubStatus } from './types'

export interface ExamPaper {
  submission_id: number
  attempt_no: number
  started_at: string
  deadline: string | null
  server_now: string
  answers: Record<string, any>
  questions: PaperQuestion[]
}

export interface MySubmissions {
  submissions: Submission[]
  draft_id: number | null
  status: SubStatus
  score: number | null
  attempts_used: number
}

export const activitiesApi = {
  list: (courseId: number, type?: string) =>
    http.get<ActivityBrief[]>(`/courses/${courseId}/activities`, { params: { type } }).then((r) => r.data),
  get: (id: number) => http.get<Activity>(`/activities/${id}`).then((r) => r.data),
  create: (courseId: number, data: Record<string, any>) =>
    http.post<Activity>(`/courses/${courseId}/activities`, data).then((r) => r.data),
  update: (id: number, data: Record<string, any>) => http.put<Activity>(`/activities/${id}`, data).then((r) => r.data),
  remove: (id: number) => http.delete(`/activities/${id}`).then((r) => r.data),
  move: (id: number, direction: 'up' | 'down') => http.post(`/activities/${id}/move`, { direction }).then((r) => r.data),
  batchPublish: (
    courseId: number,
    data: { ids: number[]; publish: boolean; open_at?: string | null; close_at?: string | null },
  ) => http.post(`/courses/${courseId}/activities/batch-publish`, data).then((r) => r.data),
  progress: (id: number, data: { delta_seconds?: number; last_pos?: number; duration?: number; completed?: boolean }) =>
    http.post(`/activities/${id}/progress`, data, { silent: true } as any).then((r) => r.data),

  // 题目
  questions: (id: number) => http.get<Question[]>(`/activities/${id}/questions`).then((r) => r.data),
  saveQuestions: (id: number, questions: Question[]) =>
    http.put<Question[]>(`/activities/${id}/questions`, { questions }).then((r) => r.data),

  // 作业
  submitHomework: (id: number, content: string, file_ids: number[]) =>
    http.post<Submission>(`/activities/${id}/submissions`, { content, file_ids }).then((r) => r.data),
  mySubmissions: (id: number) => http.get<MySubmissions>(`/activities/${id}/submissions/mine`).then((r) => r.data),
  submissionRows: (id: number, params: { submit_status?: string; grade_status?: string } = {}) =>
    http
      .get<{ activity_id: number; full_score: number; rows: SubmissionRow[] }>(`/activities/${id}/submissions`, { params })
      .then((r) => r.data),
  exportZip: (id: number, title: string) => download(`/activities/${id}/export.zip`, `${title}.zip`),

  // 测试
  startExam: (id: number) => http.post<ExamPaper>(`/activities/${id}/exam/start`).then((r) => r.data),
  saveAnswers: (submissionId: number, answers: Record<string, any>) =>
    http.put(`/submissions/${submissionId}/answers`, { answers }, { silent: true } as any).then((r) => r.data),
  submitExam: (submissionId: number, answers?: Record<string, any>) =>
    http.post<Submission>(`/submissions/${submissionId}/submit`, { answers }).then((r) => r.data),

  // 提交详情与批改
  submission: (submissionId: number) => http.get<Submission>(`/submissions/${submissionId}`).then((r) => r.data),
  grade: (submissionId: number, data: { score?: number | null; comment?: string; question_scores?: Record<string, number> }) =>
    http.put<Submission>(`/submissions/${submissionId}/grade`, data).then((r) => r.data),
}

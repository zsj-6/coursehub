import { download, http } from './http'
import type { ChapterNode, Course, GradeTable, MemberRole, UserBrief } from './types'

export const coursesApi = {
  list: (params: { q?: string; archived?: boolean } = {}) =>
    http.get<Course[]>('/courses', { params }).then((r) => r.data),
  create: (data: { name: string; description?: string; semester?: string }) =>
    http.post<Course>('/courses', data).then((r) => r.data),
  get: (id: number) => http.get<Course>(`/courses/${id}`).then((r) => r.data),
  update: (id: number, data: Partial<Pick<Course, 'name' | 'description' | 'semester' | 'cover' | 'archived'>>) =>
    http.put<Course>(`/courses/${id}`, data).then((r) => r.data),
  remove: (id: number) => http.delete(`/courses/${id}`).then((r) => r.data),
  join: (code: string) => http.post<Course>('/courses/join', { code }).then((r) => r.data),
  regenerateCode: (id: number) => http.post<{ code: string }>(`/courses/${id}/regenerate-code`).then((r) => r.data),
  copyTo: (id: number, targetId: number) =>
    http.post<{ copied_activities: number }>(`/courses/${id}/copy-to/${targetId}`).then((r) => r.data),

  members: (id: number) =>
    http.get<{ role: MemberRole; joined_at: string; user: UserBrief }[]>(`/courses/${id}/members`).then((r) => r.data),
  addMembers: (id: number, usernames: string[], role: MemberRole) =>
    http
      .post<{ added: string[]; existed: string[]; not_found: string[] }>(`/courses/${id}/members`, { usernames, role })
      .then((r) => r.data),
  setMemberRole: (id: number, userId: number, role: MemberRole) =>
    http.put(`/courses/${id}/members/${userId}`, { role }).then((r) => r.data),
  removeMember: (id: number, userId: number) => http.delete(`/courses/${id}/members/${userId}`).then((r) => r.data),

  outline: (id: number, asStudent = false) =>
    http.get<ChapterNode[]>(`/courses/${id}/outline`, { params: asStudent ? { as_student: 1 } : {} }).then((r) => r.data),
  createChapter: (id: number, title: string, parentId: number | null = null) =>
    http.post(`/courses/${id}/chapters`, { title, parent_id: parentId }).then((r) => r.data),
  updateChapter: (chapterId: number, title: string) => http.put(`/chapters/${chapterId}`, { title }).then((r) => r.data),
  deleteChapter: (chapterId: number) => http.delete(`/chapters/${chapterId}`).then((r) => r.data),
  moveChapter: (chapterId: number, direction: 'up' | 'down') =>
    http.post(`/chapters/${chapterId}/move`, { direction }).then((r) => r.data),

  grades: (id: number) => http.get<GradeTable>(`/courses/${id}/grades`).then((r) => r.data),
  setOverride: (id: number, data: { user_id: number; activity_id: number | null; score: number | null }) =>
    http.put(`/courses/${id}/grades/override`, data).then((r) => r.data),
  exportGrades: (id: number) => download(`/courses/${id}/grades/export.xlsx`, '成绩.xlsx'),
}

import { http } from './http'
import type { Role, User } from './types'

export const adminApi = {
  users: (params: { q?: string; role?: string; page?: number; size?: number }) =>
    http.get<{ items: User[]; total: number }>('/admin/users', { params }).then((r) => r.data),
  createUser: (data: { username: string; name: string; role: Role; student_no?: string | null; password?: string }) =>
    http.post<User>('/admin/users', data).then((r) => r.data),
  updateUser: (id: number, data: { name?: string; role?: Role; student_no?: string | null; password?: string }) =>
    http.put<User>(`/admin/users/${id}`, data).then((r) => r.data),
  deleteUser: (id: number) => http.delete(`/admin/users/${id}`).then((r) => r.data),
  importUsers: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return http
      .post<{ created: number; skipped: string[]; errors: string[] }>('/admin/users/import', fd)
      .then((r) => r.data)
  },
}

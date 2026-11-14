import { http } from './http'
import type { User } from './types'

export const authApi = {
  login: (username: string, password: string) =>
    http.post<{ token: string; user: User }>('/auth/login', { username, password }).then((r) => r.data),
  me: () => http.get<User>('/me').then((r) => r.data),
  updateMe: (data: { name?: string; avatar?: string | null }) => http.put<User>('/me', data).then((r) => r.data),
  changePassword: (old_password: string, new_password: string) =>
    http.put('/me/password', { old_password, new_password }).then((r) => r.data),
  dashboard: () => http.get('/dashboard').then((r) => r.data),
}

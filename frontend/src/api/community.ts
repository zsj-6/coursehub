import { http } from './http'
import type { ActivityType, UserBrief } from './types'

export interface Announcement {
  id: number
  course_id: number
  title: string
  content: string
  open_at: string | null
  close_at: string | null
  pinned: boolean
  created_at: string
  author: UserBrief | null
  visible: boolean
}

export interface AnnouncementInput {
  title: string
  content: string
  open_at: string | null
  close_at: string | null
  pinned: boolean
}

export interface PostItem {
  id: number
  parent_id: number | null
  content: string
  pinned: boolean
  created_at: string
  user: UserBrief
  user_role: 'admin' | 'teacher' | 'ta' | 'student'
  likes: number
  liked: boolean
  can_delete: boolean
  replies?: PostItem[]
}

export interface Analytics {
  activities: { id: number; type: ActivityType; title: string; done_rate: number }[]
  rows: { user: UserBrief; done: number[]; rate: number; video_percent: Record<string, number> }[]
  avg_rate: number
}

export const communityApi = {
  announcements: (courseId: number) =>
    http.get<Announcement[]>(`/courses/${courseId}/announcements`).then((r) => r.data),
  createAnnouncement: (courseId: number, data: AnnouncementInput) =>
    http.post<Announcement>(`/courses/${courseId}/announcements`, data).then((r) => r.data),
  updateAnnouncement: (id: number, data: AnnouncementInput) =>
    http.put<Announcement>(`/announcements/${id}`, data).then((r) => r.data),
  removeAnnouncement: (id: number) => http.delete(`/announcements/${id}`).then((r) => r.data),

  posts: (activityId: number) =>
    http.get<{ items: PostItem[]; can_moderate: boolean }>(`/activities/${activityId}/posts`).then((r) => r.data),
  createPost: (activityId: number, content: string, parentId: number | null = null) =>
    http.post(`/activities/${activityId}/posts`, { content, parent_id: parentId }).then((r) => r.data),
  like: (postId: number) => http.post<{ liked: boolean }>(`/posts/${postId}/like`).then((r) => r.data),
  pin: (postId: number) => http.post<{ pinned: boolean }>(`/posts/${postId}/pin`).then((r) => r.data),
  removePost: (postId: number) => http.delete(`/posts/${postId}`).then((r) => r.data),

  analytics: (courseId: number) => http.get<Analytics>(`/courses/${courseId}/analytics`).then((r) => r.data),
}

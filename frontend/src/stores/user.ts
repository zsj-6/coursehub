import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi } from '@/api/auth'
import { TOKEN_KEY, getToken } from '@/api/http'
import type { User } from '@/api/types'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(getToken())
  const user = ref<User | null>(null)

  const isAdmin = computed(() => user.value?.role === 'admin')
  const canCreateCourse = computed(() => user.value?.role === 'teacher' || user.value?.role === 'admin')

  function setToken(t: string | null) {
    token.value = t
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* 隐私模式等情况下 localStorage 不可用，只保留内存中的 token */
    }
  }

  async function login(username: string, password: string) {
    const res = await authApi.login(username, password)
    setToken(res.token)
    user.value = res.user
  }

  async function fetchMe() {
    user.value = await authApi.me()
  }

  function logout() {
    setToken(null)
    user.value = null
  }

  return { token, user, isAdmin, canCreateCourse, login, fetchMe, logout }
})

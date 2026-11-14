import axios, { AxiosError } from 'axios'
import { ElMessage } from 'element-plus'

export const TOKEN_KEY = 'coursehub_token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export const http = axios.create({ baseURL: '/api', timeout: 60000 })

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

function detailOf(err: AxiosError<any>): string {
  const d = err.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d) && d[0]?.msg) return `参数错误：${d[0].msg}`
  if (err.code === 'ECONNABORTED') return '请求超时'
  if (!err.response) return '无法连接服务器'
  return `请求失败（${err.response.status}）`
}

http.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<any>) => {
    // blob 请求的错误体也是 blob，转回 JSON 才能拿到 detail
    if (err.response?.data instanceof Blob) {
      try {
        err.response.data = JSON.parse(await err.response.data.text())
      } catch {
        /* ignore */
      }
    }
    if (err.response?.status === 401) {
      try {
        localStorage.removeItem(TOKEN_KEY)
      } catch {
        /* ignore */
      }
      if (!location.pathname.startsWith('/login')) {
        location.href = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`
      }
    } else if (!(err.config as any)?.silent) {
      ElMessage.error(detailOf(err))
    }
    return Promise.reject(err)
  },
)

/** 带鉴权下载文件（导出 Excel / zip）。 */
export async function download(url: string, fallbackName: string) {
  const res = await http.get(url, { responseType: 'blob' })
  const cd: string = res.headers['content-disposition'] || ''
  const m = /filename\*=UTF-8''([^;]+)/i.exec(cd)
  const name = m ? decodeURIComponent(m[1]) : fallbackName
  const href = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

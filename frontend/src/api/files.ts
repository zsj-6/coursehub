import { http } from './http'
import type { FileInfo } from './types'

export const filesApi = {
  upload: (file: File, onProgress?: (pct: number) => void) => {
    const fd = new FormData()
    fd.append('file', file)
    return http
      .post<FileInfo>('/files', fd, {
        timeout: 0,
        onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
      })
      .then((r) => r.data)
  },
}

export function downloadUrl(f: FileInfo): string {
  return `${f.url}?download=1`
}

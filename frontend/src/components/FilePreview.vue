<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { downloadUrl } from '@/api/files'
import type { FileInfo } from '@/api/types'
import { fmtSize } from '@/utils/format'

/** 多个文件时左侧切换；PDF / 图片 / 视频 / 纯文本可在线预览，其他只能下载。 */
const props = defineProps<{ files: FileInfo[]; allowDownload?: boolean }>()
const current = ref<FileInfo | null>(props.files[0] ?? null)
watch(
  () => props.files,
  (fs) => (current.value = fs[0] ?? null),
)

const kind = computed(() => {
  const f = current.value
  if (!f) return 'none'
  const name = f.filename.toLowerCase()
  if (f.mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (f.mime.startsWith('image/')) return 'image'
  if (f.mime.startsWith('video/') || f.mime.startsWith('audio/')) return 'video'
  if (f.mime.startsWith('text/') || /\.(txt|md|py|c|cpp|java|js|ts|json|csv)$/.test(name)) return 'text'
  return 'other'
})
// 不允许下载时隐藏 PDF 阅读器的工具栏（只是界面限制）
const pdfSrc = computed(() => (current.value ? `${current.value.url}${props.allowDownload === false ? '#toolbar=0' : ''}` : ''))
</script>

<template>
  <div class="preview">
    <div v-if="files.length > 1" class="list">
      <div
        v-for="f in files"
        :key="f.id"
        class="file"
        :class="{ active: current?.id === f.id }"
        @click="current = f"
      >
        <el-icon><Document /></el-icon>
        <span class="fname">{{ f.filename }}</span>
      </div>
    </div>
    <div v-if="current" class="viewer">
      <div class="bar">
        <span class="fname">{{ current.filename }}</span>
        <span class="muted">{{ fmtSize(current.size) }}</span>
        <span class="spacer" />
        <a v-if="allowDownload !== false" :href="downloadUrl(current)">
          <el-button size="small"><el-icon><Download /></el-icon>&nbsp;下载</el-button>
        </a>
      </div>
      <iframe v-if="kind === 'pdf' || kind === 'text'" :src="pdfSrc" class="frame" />
      <img v-else-if="kind === 'image'" :src="current.url" class="img" />
      <video v-else-if="kind === 'video'" :src="current.url" controls class="img" />
      <el-empty v-else description="该格式暂不支持在线预览">
        <a v-if="allowDownload !== false" :href="downloadUrl(current)"><el-button type="primary">下载查看</el-button></a>
        <span v-else class="muted">老师未开放下载</span>
      </el-empty>
    </div>
    <el-empty v-else description="没有文件" />
  </div>
</template>

<style scoped>
.preview {
  display: flex;
  gap: 12px;
}
.list {
  width: 200px;
  flex-shrink: 0;
}
.file {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
}
.file.active,
.file:hover {
  background: var(--el-color-primary-light-9);
  color: var(--ch-primary);
}
.fname {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.viewer {
  flex: 1;
  min-width: 0;
}
.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.frame {
  width: 100%;
  height: 72vh;
  border: 1px solid var(--ch-border);
  border-radius: 6px;
  background: #fff;
}
.img {
  max-width: 100%;
  max-height: 72vh;
  display: block;
  margin: 0 auto;
}
@media (max-width: 640px) {
  .preview {
    flex-direction: column;
  }
  .list {
    width: 100%;
  }
}
</style>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { filesApi } from '@/api/files'
import type { FileInfo } from '@/api/types'
import { fmtSize } from '@/utils/format'

/** 上传文件并维护已上传文件列表（v-model 是 FileInfo 数组）。 */
const props = withDefaults(defineProps<{ accept?: string; multiple?: boolean; buttonText?: string; maxMb?: number }>(), {
  multiple: true,
  buttonText: '添加文件',
  maxMb: 500,
})
const files = defineModel<FileInfo[]>({ default: () => [] })
const uploading = ref<{ name: string; pct: number }[]>([])
const input = ref<HTMLInputElement>()

async function onPick(e: Event) {
  const list = Array.from((e.target as HTMLInputElement).files || [])
  ;(e.target as HTMLInputElement).value = ''
  for (const f of list) {
    if (f.size > props.maxMb * 1024 * 1024) {
      ElMessage.warning(`${f.name} 超过 ${props.maxMb}MB`)
      continue
    }
    const item = { name: f.name, pct: 0 }
    uploading.value.push(item)
    try {
      const info = await filesApi.upload(f, (p) => (item.pct = p))
      files.value = props.multiple ? [...files.value, info] : [info]
    } finally {
      uploading.value = uploading.value.filter((x) => x !== item)
    }
  }
}

function remove(id: number) {
  files.value = files.value.filter((f) => f.id !== id)
}
</script>

<template>
  <div class="uploader">
    <input ref="input" type="file" :accept="accept" :multiple="multiple" hidden @change="onPick" />
    <el-button size="small" @click="input?.click()"><el-icon><Upload /></el-icon>&nbsp;{{ buttonText }}</el-button>
    <div v-for="u in uploading" :key="u.name" class="row">
      <span class="name">{{ u.name }}</span>
      <el-progress :percentage="u.pct" style="width: 160px" />
    </div>
    <div v-for="f in files" :key="f.id" class="row">
      <el-icon><Document /></el-icon>
      <a :href="f.url" target="_blank" class="name">{{ f.filename }}</a>
      <span class="muted">{{ fmtSize(f.size) }}</span>
      <el-button link type="danger" size="small" @click="remove(f.id)">移除</el-button>
    </div>
  </div>
</template>

<style scoped>
.uploader {
  width: 100%;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.name {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

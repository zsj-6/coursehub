<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { activitiesApi } from '@/api/activities'
import type { Activity } from '@/api/types'

/** 播放视频；学生每 10 秒上报一次实际观看秒数（拖动进度条不算观看）。 */
const props = defineProps<{ activity: Activity; report: boolean }>()
const emit = defineEmits<{ completed: [] }>()
const video = ref<HTMLVideoElement>()
const src = props.activity.settings.url || props.activity.files?.[0]?.url || ''

let watched = 0 // 尚未上报的观看秒数
let lastTime = 0
let timer: number | undefined

function onTimeUpdate() {
  const v = video.value!
  const delta = v.currentTime - lastTime
  if (delta > 0 && delta < 2) watched += delta
  lastTime = v.currentTime
}

async function flush() {
  const v = video.value
  if (!props.report || !v) return
  const delta = Math.round(watched)
  // 视频播完时把不足 1 秒的零头也报上去
  if (delta < 1 && !v.ended) return
  watched -= delta
  const res = await activitiesApi
    .progress(props.activity.id, {
      delta_seconds: Math.max(delta, 0),
      last_pos: v.currentTime,
      duration: Number.isFinite(v.duration) ? v.duration : undefined,
    })
    .catch(() => null)
  if (res?.completed) emit('completed')
}

function onLoaded() {
  const pos = props.activity.progress?.last_pos
  const v = video.value!
  if (pos && pos < v.duration - 3) v.currentTime = pos
  lastTime = v.currentTime
}

onMounted(() => {
  timer = window.setInterval(flush, 10000)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  flush()
})
</script>

<template>
  <div class="player">
    <video
      v-if="src"
      ref="video"
      :src="src"
      controls
      preload="metadata"
      @loadedmetadata="onLoaded"
      @timeupdate="onTimeUpdate"
      @pause="flush"
      @ended="flush"
    />
    <el-empty v-else description="视频地址缺失" />
  </div>
</template>

<style scoped>
.player video {
  width: 100%;
  max-height: 70vh;
  background: #000;
  border-radius: 6px;
}
</style>

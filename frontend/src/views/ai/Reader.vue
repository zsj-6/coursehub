<script setup lang="ts">
/**
 * 资料阅读 + AI 辅学伴读（领导版"资料详情 + 启发式对话"）
 * - 教材 / 讲义：按节显示页码，打开时定位到指定片段
 * - 视频：AI 按字幕切成片段，点片段跳到对应时间
 * - 划词提问：选中一段文字，直接问 AI 辅学
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackBar from '@/components/BackBar.vue'
import ChatPanel from '@/components/ai/ChatPanel.vue'
import { RES_KIND_META } from '@/mock/ai'
import { fmtTime, partLabel, useAiStore } from '@/stores/ai'

const props = defineProps<{ unitId: string; resId: string }>()
const ai = useAiStore()
const route = useRoute()
const router = useRouter()

const unit = computed(() => ai.unit(props.unitId))
const res = computed(() => ai.resource(props.resId))
const parts = computed(() => (res.value ? ai.partsOf(res.value) : []))
const isVideo = computed(() => res.value?.kind === 'video')
const current = ref<string>((route.query.part as string) || parts.value[0]?.id || '')
const part = computed(() => parts.value.find((p) => p.id === current.value))
const ctx = computed(() => ({ unitId: props.unitId, resId: props.resId, partId: current.value, nodeId: part.value?.nodeIds[0] }))

watch(current, (v) => router.replace({ query: { ...route.query, part: v } }))

// ---------- 文档：滚动定位
const articleEl = ref<HTMLElement>()
function goPart(id: string) {
  current.value = id
  if (isVideo.value) {
    const p = parts.value.find((x) => x.id === id)
    time.value = p?.t ?? 0
    return
  }
  // 只滚动正文区域，不带着整页一起滚
  nextTick(() => {
    const el = document.getElementById(`part-${id}`)
    if (el && articleEl.value) articleEl.value.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
  })
}

// ---------- 视频（原型：模拟播放进度）
const time = ref(part.value?.t ?? 0)
const playing = ref(false)
let timer: number | undefined
function toggle() {
  playing.value = !playing.value
  clearInterval(timer)
  if (playing.value)
    timer = window.setInterval(() => {
      time.value = Math.min(res.value?.duration ?? 0, time.value + 5)
      const cur = [...parts.value].reverse().find((p) => (p.t ?? 0) <= time.value)
      if (cur && cur.id !== current.value) current.value = cur.id
    }, 1000)
}
function seek(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const ratio = (e.clientX - el.getBoundingClientRect().left) / el.clientWidth
  time.value = Math.round((res.value?.duration ?? 0) * ratio)
  const cur = [...parts.value].reverse().find((p) => (p.t ?? 0) <= time.value)
  if (cur) current.value = cur.id
}

// ---------- 划词提问
const chat = ref<InstanceType<typeof ChatPanel>>()
const sel = ref<{ text: string; x: number; y: number } | null>(null)
function onMouseUp(e: MouseEvent) {
  const t = window.getSelection()?.toString().trim() ?? ''
  if (t.length >= 2 && t.length <= 80) sel.value = { text: t, x: e.clientX, y: e.clientY }
  else sel.value = null
}
function askSelection() {
  if (!sel.value) return
  chat.value?.ask(`「${sel.value.text}」这里我没看懂`)
  sel.value = null
  window.getSelection()?.removeAllRanges()
}

onMounted(() => {
  if (current.value) goPart(current.value)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div v-if="!res || !unit" class="empty-tip">资料不存在</div>
  <div v-else>
    <BackBar :items="[{ label: '能力成长', to: '/units' }, { label: unit.name, to: `/units/${unit.id}?tab=resources` }, { label: res.title }]" />
    <div class="reader">
      <section class="card doc">
        <div class="doc-head">
          <el-tag size="small" type="info">{{ RES_KIND_META[res.kind].label }}</el-tag>
          <h1>{{ res.title }}</h1>
        </div>
        <div class="muted meta">{{ res.author }} · {{ res.source }} · 约 {{ res.minutes }} 分钟</div>

        <template v-if="isVideo">
          <div class="player">
            <button class="play" @click="toggle">
              <el-icon :size="40"><component :is="playing ? 'VideoPause' : 'VideoPlay'" /></el-icon>
            </button>
            <div class="now">{{ part?.title }}</div>
            <div class="bar">
              <span class="tm">{{ fmtTime(time) }}</span>
              <div class="track" @click="seek">
                <div class="fill" :style="{ width: `${(time / (res.duration || 1)) * 100}%` }" />
                <i v-for="p in parts" :key="p.id" class="mark" :style="{ left: `${((p.t ?? 0) / (res.duration || 1)) * 100}%` }" />
              </div>
              <span class="tm">{{ fmtTime(res.duration ?? 0) }}</span>
            </div>
          </div>
          <div class="seg-title">AI 切片 <span class="muted">按字幕切成 {{ parts.length }} 段，每段对应一个知识点</span></div>
          <div class="segs" @mouseup="onMouseUp">
            <div v-for="p in parts" :key="p.id" class="seg" :class="{ on: current === p.id }" @click="goPart(p.id)">
              <span class="t">{{ partLabel(p) }}</span>
              <div class="s-main">
                <b>{{ p.title }}</b>
                <span v-if="p.body" class="muted">{{ p.body }}</span>
                <div class="nodes">
                  <span v-for="id in p.nodeIds" :key="id" class="nchip">{{ ai.node(id)?.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="toc">
            <button v-for="p in parts" :key="p.id" :class="{ on: current === p.id }" @click="goPart(p.id)">{{ p.title }}</button>
          </div>
          <article ref="articleEl" class="article" @mouseup="onMouseUp">
            <section v-for="p in parts" :id="`part-${p.id}`" :key="p.id" class="sec" :class="{ on: current === p.id }" @click="current = p.id">
              <div class="sec-head">
                <h2>{{ p.title }}</h2>
                <span class="page">{{ partLabel(p) }}</span>
              </div>
              <div class="body rich-text">{{ p.body }}</div>
              <div class="nodes">
                <span class="muted">知识点</span>
                <router-link v-for="id in p.nodeIds" :key="id" :to="`/units/${unit.id}?tab=graph`" class="nchip">{{ ai.node(id)?.name }}</router-link>
              </div>
            </section>
          </article>
          <div class="tip muted">提示：选中正文里的一段文字，可以直接问 AI 辅学</div>
        </template>
      </section>

      <aside class="card side">
        <div class="side-title">
          <b>AI 辅学 · 伴读</b>
          <span class="muted">正在看：{{ part?.title }}</span>
        </div>
        <ChatPanel ref="chat" :ctx="ctx" class="panel" />
      </aside>
    </div>

    <button v-if="sel" class="sel-ask" :style="{ left: `${sel.x}px`, top: `${sel.y + 12}px` }" @mousedown.prevent @click="askSelection">
      <el-icon><ChatDotRound /></el-icon>问 AI 辅学
    </button>
  </div>
</template>

<style scoped>
.reader {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  gap: 16px;
  align-items: start;
}
.doc-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.doc-head h1 {
  margin: 0;
  font-size: 20px;
}
.meta {
  margin: 6px 0 16px;
}
.toc {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ch-border-light);
  margin-bottom: 8px;
}
.toc button {
  border: 1px solid var(--ch-border);
  background: #fff;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12.5px;
  color: var(--ch-text-2);
  cursor: pointer;
}
.toc button.on {
  border-color: var(--ch-primary);
  color: var(--ch-primary-text);
  background: var(--ch-primary-bg);
}
.article {
  position: relative;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
  padding-right: 6px;
}
.sec {
  padding: 14px 16px;
  margin: 8px 0;
  border-left: 3px solid transparent;
  border-radius: 4px;
}
.sec.on {
  border-left-color: var(--ch-primary);
  background: #fafcfc;
}
.sec-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.sec-head h2 {
  margin: 0 0 8px;
  font-size: 16px;
}
.page {
  font-size: 12px;
  color: var(--ch-text-3);
}
.body {
  font-size: 14.5px;
  line-height: 1.9;
}
.nodes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
}
.nchip {
  font-size: 12px;
  padding: 0 7px;
  border-radius: 4px;
  background: var(--ch-primary-bg);
  color: var(--ch-primary-text);
}
.tip {
  margin-top: 10px;
  font-size: 12px;
}
.player {
  position: relative;
  aspect-ratio: 16 / 9;
  max-height: 380px;
  width: 100%;
  background: #1f2329;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.play {
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border-radius: 50%;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.now {
  margin-top: 12px;
  font-size: 14px;
  opacity: 0.85;
}
.bar {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}
.track {
  position: relative;
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 2px;
  cursor: pointer;
}
.fill {
  height: 100%;
  background: var(--ch-primary);
  border-radius: 2px;
}
.mark {
  position: absolute;
  top: -3px;
  width: 2px;
  height: 10px;
  background: #fff;
}
.seg-title {
  margin: 16px 0 8px;
  font-weight: 600;
}
.seg-title .muted {
  font-weight: 400;
  font-size: 12px;
  margin-left: 6px;
}
.segs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.seg {
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--ch-border-light);
  border-radius: 6px;
  cursor: pointer;
}
.seg.on {
  border-color: var(--ch-primary);
  background: #fafcfc;
}
.seg .t {
  flex: none;
  width: 48px;
  color: var(--ch-primary-text);
  font-weight: 600;
  font-size: 13px;
}
.s-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.s-main b {
  font-weight: 500;
}
.s-main .muted {
  font-size: 12.5px;
}
.side {
  position: sticky;
  top: calc(var(--ch-header-h) + 64px);
  height: calc(100vh - var(--ch-header-h) - 96px);
  display: flex;
  flex-direction: column;
  padding: 16px;
}
.side-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 10px;
}
.side-title .muted {
  font-size: 12px;
}
.panel {
  flex: 1;
  min-height: 0;
}
.sel-ask {
  position: fixed;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 4px;
  transform: translateX(-50%);
  padding: 5px 12px;
  border: none;
  border-radius: 14px;
  background: var(--ch-text);
  color: #fff;
  font-size: 12.5px;
  cursor: pointer;
}
@media (max-width: 1100px) {
  .reader {
    grid-template-columns: minmax(0, 1fr);
  }
  .side {
    position: static;
    height: 560px;
  }
}
</style>

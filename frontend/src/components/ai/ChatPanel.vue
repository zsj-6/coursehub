<script setup lang="ts">
/**
 * AI 辅学对话面板（剧本式）。资料阅读页右栏和右下角抽屉共用。
 * - 答疑模式：先追问、再讲要点，每条回答带出处卡片；资料库里没有的明确说没有。
 * - 费曼模式：学生讲，AI 扮演没学过的同学，按要点检查讲到了哪些。
 */
import { ElMessage } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAiStore, type Source, type TutorCtx } from '@/stores/ai'

const props = withDefaults(defineProps<{ ctx: TutorCtx; mode?: 'chat' | 'feynman'; initial?: string }>(), { mode: 'chat', initial: '' })
const ai = useAiStore()

interface Msg {
  id: number
  who: 'ai' | 'me'
  text: string
  shown: string
  sources: Source[]
  noSource?: boolean
  q?: string
  fb?: 'up' | 'down'
  note?: string
}
const msgs = ref<Msg[]>([])
const input = ref('')
const busy = ref(false)
const expert = ref('academic')
const listEl = ref<HTMLElement>()
let seq = 0
let timer: number | undefined

const unitNodes = computed(() => {
  const u = props.ctx.unitId ? ai.unit(props.ctx.unitId) : ai.unit('robo')
  return u ? ai.nodesOf(u, false) : []
})
const feynmanNode = ref(props.ctx.nodeId ?? (unitNodes.value.find((n) => n.keyPoints)?.id || unitNodes.value[0]?.id || 'r9'))
const ctxNode = computed(() => (props.ctx.nodeId ? ai.node(props.ctx.nodeId) : undefined))

const quick = computed(() => {
  if (props.mode === 'feynman') return []
  if (props.ctx.projectId) return ['我们现在该做什么？', '方案设计关要准备什么？']
  if (ctxNode.value) return [`「${ctxNode.value.name}」的要点是什么？`, '能举个例子吗？', '我看不懂这部分']
  if (props.ctx.resId) return ['帮我梳理一下这一段', '这一段的关键前提是什么？']
  return ['坐标系变换怎么反过来算？', 'PID 的积分项有什么用？', '我看不懂 PnP']
})

function greet() {
  if (props.mode === 'feynman') {
    const n = ai.node(feynmanNode.value)
    pushAi(`费曼模式：把「${n?.name}」讲给我听吧。我是一个没学过它的同学，听完会告诉你哪里讲清楚了、哪里还漏了。`, [])
  } else {
    const e = ai.experts.find((x) => x.id === expert.value)
    pushAi(e?.greet ?? '', [], true)
  }
}

function scroll() {
  nextTick(() => listEl.value?.scrollTo({ top: listEl.value.scrollHeight }))
}
function pushAi(text: string, sources: Source[], instant = false, extra: Partial<Msg> = {}) {
  const m: Msg = { id: ++seq, who: 'ai', text, shown: instant ? text : '', sources, ...extra }
  msgs.value.push(m)
  scroll()
  if (instant) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const target = msgs.value[msgs.value.length - 1]
    let i = 0
    clearInterval(timer)
    timer = window.setInterval(() => {
      i += 3
      target.shown = text.slice(0, i)
      if (i % 30 === 0) scroll()
      if (i >= text.length) {
        target.shown = text
        clearInterval(timer)
        scroll()
        resolve()
      }
    }, 16)
  })
}

async function send(text?: string) {
  const t = (text ?? input.value).trim()
  if (!t || busy.value) return
  input.value = ''
  msgs.value.push({ id: ++seq, who: 'me', text: t, shown: t, sources: [] })
  scroll()
  busy.value = true
  await new Promise((r) => setTimeout(r, 450))
  if (props.mode === 'feynman') {
    const r = ai.feynman(feynmanNode.value, t)
    await pushAi(r.text, ai.sourcesOf(feynmanNode.value, 2), false, { note: `讲到 ${r.covered.length}/${r.total} 个要点` })
  } else {
    ai.logAsk(t, props.ctx)
    const r = ai.reply(t, props.ctx, expert.value)
    await pushAi(r.text, r.sources, false, { noSource: r.noSource, q: t })
  }
  busy.value = false
}
defineExpose({ ask: send })

function feedback(m: Msg, v: 'up' | 'down') {
  if (m.fb) return
  m.fb = v
  if (v === 'down') {
    ai.reportError(m.q ?? '', m.text)
    ElMessage.success('已反馈给老师，老师更正后会进入知识库')
  }
}
function sourceLink(s: Source) {
  const r = ai.resource(s.resId)
  return `/units/${r?.unitId}/read/${s.resId}?part=${s.partId}`
}

watch([expert, feynmanNode], () => {
  msgs.value = []
  greet()
})
onMounted(() => {
  greet()
  if (props.initial) send(props.initial)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="chat">
    <div class="chat-head">
      <template v-if="mode === 'chat'">
        <el-select v-model="expert" size="small" style="width: 220px">
          <el-option v-for="e in ai.experts" :key="e.id" :value="e.id" :label="`${e.name} · ${e.scene}`" />
        </el-select>
      </template>
      <template v-else>
        <span class="muted">讲解的知识点</span>
        <el-select v-model="feynmanNode" size="small" filterable style="width: 180px">
          <el-option v-for="n in unitNodes" :key="n.id" :value="n.id" :label="n.name" />
        </el-select>
      </template>
    </div>

    <div ref="listEl" class="msgs">
      <div v-for="m in msgs" :key="m.id" class="msg" :class="m.who">
        <div class="bubble">
          <div class="text">{{ m.shown }}<span v-if="m.who === 'ai' && m.shown.length < m.text.length" class="caret" /></div>
          <template v-if="m.who === 'ai' && m.shown.length === m.text.length">
            <div v-if="m.note" class="note">{{ m.note }}</div>
            <div v-if="m.sources.length" class="sources">
              <div class="src-title">出处</div>
              <router-link v-for="s in m.sources" :key="s.resId + s.partId" :to="sourceLink(s)" class="src">
                <el-icon><Link /></el-icon>{{ s.label }}
              </router-link>
            </div>
            <div v-else-if="m.noSource" class="no-src">没有找到出处，以上不是资料库里的内容</div>
            <div v-if="m.q !== undefined" class="fb">
              <button :class="{ on: m.fb === 'up' }" @click="feedback(m, 'up')"><el-icon><CircleCheck /></el-icon>有帮助</button>
              <button :class="{ on: m.fb === 'down' }" @click="feedback(m, 'down')"><el-icon><Warning /></el-icon>有错误</button>
            </div>
          </template>
        </div>
      </div>
      <div v-if="busy && msgs[msgs.length - 1]?.who === 'me'" class="msg ai">
        <div class="bubble thinking">正在查资料…</div>
      </div>
    </div>

    <div v-if="quick.length" class="quick">
      <button v-for="q in quick" :key="q" :disabled="busy" @click="send(q)">{{ q }}</button>
    </div>
    <div class="composer">
      <el-input
        v-model="input"
        type="textarea"
        :autosize="{ minRows: 1, maxRows: 4 }"
        resize="none"
        :placeholder="mode === 'feynman' ? '用你自己的话讲一遍……' : '输入问题，Enter 发送'"
        @keydown.enter.exact.prevent="send()"
      />
      <el-button type="primary" :loading="busy" @click="send()">发送</el-button>
    </div>
    <div class="disclaimer">AI 生成，仅供参考 · 原型阶段为预置剧本</div>
  </div>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.chat-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--ch-border-light);
}
.msgs {
  flex: 1;
  overflow-y: auto;
  padding: 12px 2px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}
.msg {
  display: flex;
}
.msg.me {
  justify-content: flex-end;
}
.bubble {
  max-width: 92%;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--ch-fill);
  font-size: 13.5px;
  line-height: 1.7;
}
.msg.me .bubble {
  background: var(--ch-primary-bg);
  color: var(--ch-text);
}
.text {
  white-space: pre-wrap;
  word-break: break-word;
}
.caret {
  display: inline-block;
  width: 6px;
  height: 14px;
  margin-left: 2px;
  vertical-align: -2px;
  background: var(--ch-primary);
  animation: blink 0.8s steps(1) infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
.thinking {
  color: var(--ch-text-3);
}
.note {
  margin-top: 8px;
  font-size: 12px;
  color: var(--ch-primary-text);
}
.sources {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--ch-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.src-title {
  font-size: 12px;
  color: var(--ch-text-3);
}
.src {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
}
.src:hover {
  text-decoration: underline;
}
.no-src {
  margin-top: 8px;
  font-size: 12px;
  color: var(--ch-warning);
}
.fb {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
.fb button {
  display: flex;
  align-items: center;
  gap: 3px;
  border: none;
  background: none;
  padding: 0;
  font-size: 12px;
  color: var(--ch-text-3);
  cursor: pointer;
}
.fb button:hover,
.fb button.on {
  color: var(--ch-primary-text);
}
.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 0;
}
.quick button {
  border: 1px solid var(--ch-border);
  background: #fff;
  border-radius: 14px;
  padding: 3px 10px;
  font-size: 12px;
  color: var(--ch-text-2);
  cursor: pointer;
}
.quick button:hover:not(:disabled) {
  border-color: var(--ch-primary);
  color: var(--ch-primary-text);
}
.composer {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.disclaimer {
  margin-top: 6px;
  font-size: 11.5px;
  color: var(--ch-text-3);
  text-align: center;
}
</style>

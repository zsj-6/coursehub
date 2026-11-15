<script setup lang="ts">
/**
 * AI 导师（领导版）：会话历史、7 位导师、费曼模式 + 勋章、@ 其他导师协同、上传图片、导出、每个会话 100 轮。
 * 回答走 AI 辅学的剧本式引擎（stores/ai.ts）：命中知识点时附出处，资料里没有的明确说没有。
 * 心理导师属于"待领导确认"的部分，暂不提供。
 */
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AGENTS, EXPERTS_ALL } from '@/mock/growth'
import { useAiStore } from '@/stores/ai'
import { useGrowthStore, type ChatMsg, type Session } from '@/stores/growth'
import { toneVars } from '@/utils/format'

const ai = useAiStore()
const g = useGrowthStore()
const route = useRoute()
const router = useRouter()
g.ensureSessions()

const MAX_LEN = 5000
const expertName = (code: string) => EXPERTS_ALL.find((e) => e.code === code)?.name ?? '导师'
const expertIdx = (code: string) => EXPERTS_ALL.findIndex((e) => e.code === code)

// ---------- 会话列表
const search = ref('')
const sessions = computed(() => g.mySessions.filter((s) => !search.value.trim() || s.title.includes(search.value.trim())))
const curId = ref<string>(g.mySessions[0]?.id ?? '')
const cur = computed<Session | undefined>(() => g.mySessions.find((s) => s.id === curId.value))
const expert = computed({
  get: () => cur.value?.expert ?? 'ACADEMIC',
  set: (v) => {
    if (cur.value) cur.value.expert = v
  },
})

function create(expertCode = expert.value, title = '新对话', greet?: string) {
  const s = g.newSession(expertCode, title)
  if (greet) s.messages.push({ role: 'ai', text: greet, expert: expertCode })
  curId.value = s.id
  return s
}
async function remove(s: Session) {
  await ElMessageBox.confirm(`删除会话「${s.title}」？`, '删除会话', { type: 'warning' })
  g.removeSession(s.id)
  if (curId.value === s.id) curId.value = g.mySessions[0]?.id ?? ''
}
const when = (iso: string) => {
  const d = dayjs(iso)
  if (dayjs().diff(d, 'minute') < 2) return '刚刚'
  if (d.isSame(dayjs(), 'day')) return d.format('HH:mm')
  if (d.isSame(dayjs().subtract(1, 'day'), 'day')) return `昨天 ${d.format('HH:mm')}`
  return d.format('MM-DD')
}

// ---------- 发送
const input = ref('')
const busy = ref(false)
const feynman = ref(false)
const feynmanNodes = computed(() => ai.units.flatMap((u) => ai.nodesOf(u, false)).filter((n) => n.keyPoints))
const feynmanNode = ref(feynmanNodes.value[0]?.id ?? '')
const helpers = ref<string[]>([])
const listEl = ref<HTMLElement>()
const scroll = () => nextTick(() => listEl.value?.scrollTo({ top: listEl.value.scrollHeight }))
watch(curId, scroll)

async function send(text?: string) {
  const t = (text ?? input.value).trim()
  if (!t || busy.value) return
  const s = cur.value ?? create()
  if (s.rounds <= 0) return ElMessage.warning('本次会话已达到 100 轮，请新建会话')
  input.value = ''
  s.messages.push({ role: 'me', text: t })
  if (s.title === '新对话') s.title = t.slice(0, 18)
  s.rounds--
  g.touch(s)
  scroll()
  busy.value = true
  await new Promise((r) => setTimeout(r, 500))
  if (feynman.value) {
    const r = ai.feynman(feynmanNode.value, t)
    s.messages.push({ role: 'ai', text: `${r.text}\n\n（讲到 ${r.covered.length}/${r.total} 个要点）`, expert: s.expert, sources: ai.sourcesOf(feynmanNode.value, 2) })
    if (!r.missed.length && r.total) {
      const name = ai.node(feynmanNode.value)?.name
      if (g.addBadge(`费曼勋章 · ${name}`)) ElMessage.success(`获得「费曼勋章 · ${name}」`)
    }
  } else {
    ai.logAsk(t, {})
    const r = ai.reply(t, {}, s.expert.toLowerCase())
    s.messages.push({ role: 'ai', text: r.text, expert: s.expert, sources: r.sources })
    // 多导师协同：被 @ 的导师各补充一句
    const topic = ai.findNode(t)?.name
    for (const h of helpers.value.filter((x) => x !== s.expert))
      s.messages.push({ role: 'ai', text: ai.expertSupplement(h, topic), expert: h })
  }
  g.touch(s)
  busy.value = false
  scroll()
}

// ---------- 上传图片（原型不做识别）
const fileEl = ref<HTMLInputElement>()
function onImage(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const s = cur.value ?? create()
  s.messages.push({ role: 'me', text: `[图片] ${f.name}`, image: URL.createObjectURL(f) })
  s.messages.push({ role: 'ai', text: '收到图片。原型阶段不做图片识别——请用文字描述一下题目或报错信息，我来帮你分析。', expert: s.expert })
  g.touch(s)
  ;(e.target as HTMLInputElement).value = ''
  scroll()
}

// ---------- 导出
function exportChat() {
  const s = cur.value
  if (!s) return
  const md = [`# ${s.title}`, `导师：${expertName(s.expert)}　导出时间：${dayjs().format('YYYY-MM-DD HH:mm')}`, '']
  for (const m of s.messages) {
    md.push(`**${m.role === 'me' ? '我' : expertName(m.expert ?? s.expert)}**：`, '', m.text, '')
    if (m.sources?.length) md.push(`出处：${m.sources.map((x) => x.label).join('；')}`, '')
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([md.join('\n')], { type: 'text/markdown;charset=utf-8' }))
  a.download = `${s.title}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}

function sourceLink(src: { resId: string; partId: string }) {
  const r = ai.resource(src.resId)
  return `/units/${r?.unitId}/read/${src.resId}?part=${src.partId}`
}
const quick = computed(() =>
  feynman.value ? [] : ['坐标系变换怎么反过来算？', 'PID 的积分项有什么用？', '我该怎么准备保研？', '帮我看看简历怎么写'],
)

onMounted(() => {
  const agentId = route.query.agent as string | undefined
  const agent = AGENTS.find((a) => a.id === agentId)
  if (agent) {
    create(agent.expert, agent.name, `我是「${agent.name}」：${agent.desc}。\n\n把你的具体需求告诉我（例如学科、对象、想要的格式），我先帮你理一个框架。`)
    router.replace({ query: {} })
  } else if (!cur.value) create()
  scroll()
})
const msgExpert = (m: ChatMsg) => m.expert ?? cur.value?.expert ?? 'ACADEMIC'
</script>

<template>
  <div class="tutor">
    <aside class="card sessions">
      <el-button type="primary" :icon="'Plus'" class="new" @click="create()">新建对话</el-button>
      <el-input v-model="search" size="small" placeholder="搜索历史会话" clearable :prefix-icon="'Search'" />
      <div class="s-list">
        <div v-for="s in sessions" :key="s.id" class="s-item" :class="{ on: s.id === curId }" @click="curId = s.id">
          <span class="tone s-dot" :style="toneVars(expertIdx(s.expert))">{{ expertName(s.expert).slice(0, 1) }}</span>
          <div class="s-main">
            <b>{{ s.title }}</b>
            <span class="muted">{{ expertName(s.expert) }} · {{ when(s.updatedAt) }}</span>
          </div>
          <button class="del" title="删除" @click.stop="remove(s)"><el-icon><Delete /></el-icon></button>
        </div>
        <div v-if="!sessions.length" class="empty-tip">没有会话</div>
      </div>
      <div class="s-foot muted">共 {{ g.mySessions.length }} 条会话 · 保留 90 天</div>
      <div v-if="g.myBadges.length" class="badges">
        <div class="muted">我的勋章</div>
        <el-tag v-for="b in g.myBadges" :key="b" size="small" type="warning">{{ b }}</el-tag>
      </div>
    </aside>

    <section class="card chat">
      <div class="c-head">
        <el-select v-model="expert" style="width: 260px">
          <el-option v-for="e in EXPERTS_ALL" :key="e.code" :value="e.code" :label="`${e.name} · ${e.scene}`" />
        </el-select>
        <el-tag v-if="feynman" type="warning">费曼模式</el-tag>
        <el-tag v-if="helpers.length">多导师协同：{{ helpers.map(expertName).join('、') }}</el-tag>
        <div class="spacer" />
        <el-button :icon="'Download'" :disabled="!cur?.messages.length" @click="exportChat">导出</el-button>
      </div>
      <p class="muted e-desc">{{ EXPERTS_ALL.find((e) => e.code === expert)?.desc }}</p>

      <div ref="listEl" class="msgs">
        <div v-if="!cur?.messages.length" class="empty-tip">向{{ expertName(expert) }}提问吧</div>
        <div v-for="(m, i) in cur?.messages ?? []" :key="i" class="msg" :class="m.role">
          <span v-if="m.role === 'ai'" class="tone avatar" :style="toneVars(expertIdx(msgExpert(m)))">{{ expertName(msgExpert(m)).slice(0, 1) }}</span>
          <div class="bubble">
            <div v-if="m.role === 'ai' && m.expert && m.expert !== cur?.expert" class="who">{{ expertName(m.expert) }}补充</div>
            <img v-if="m.image" :src="m.image" class="img" alt="上传的图片" @error="($event.target as HTMLImageElement).style.display = 'none'" />
            <div class="text">{{ m.text }}</div>
            <div v-if="m.sources?.length" class="sources">
              <span class="muted">出处</span>
              <router-link v-for="s in m.sources" :key="s.resId + s.partId" :to="sourceLink(s)"><el-icon><Link /></el-icon>{{ s.label }}</router-link>
            </div>
          </div>
        </div>
        <div v-if="busy" class="msg ai"><div class="bubble thinking">正在思考…</div></div>
      </div>

      <div v-if="quick.length" class="quick">
        <button v-for="q in quick" :key="q" :disabled="busy" @click="send(q)">{{ q }}</button>
      </div>
      <div class="composer">
        <div class="tools">
          <el-tooltip content="上传图片"><el-button text :icon="'Picture'" @click="fileEl?.click()" /></el-tooltip>
          <input ref="fileEl" type="file" accept="image/*" hidden @change="onImage" />
          <el-tooltip content="费曼模式：你讲，AI 扮演没学过的同学检查你讲到了哪些要点">
            <el-button text :type="feynman ? 'warning' : ''" :icon="'Medal'" @click="feynman = !feynman">费曼</el-button>
          </el-tooltip>
          <el-select v-if="feynman" v-model="feynmanNode" size="small" filterable style="width: 160px">
            <el-option v-for="n in feynmanNodes" :key="n.id" :value="n.id" :label="n.name" />
          </el-select>
          <el-select v-else v-model="helpers" size="small" multiple collapse-tags placeholder="@ 其他导师" style="width: 200px">
            <el-option v-for="e in EXPERTS_ALL.filter((x) => x.code !== expert)" :key="e.code" :value="e.code" :label="e.name" />
          </el-select>
          <div class="spacer" />
          <span class="muted">{{ input.length }}/{{ MAX_LEN }}</span>
        </div>
        <el-input
          v-model="input"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
          resize="none"
          :maxlength="MAX_LEN"
          :placeholder="feynman ? `把「${ai.node(feynmanNode)?.name}」讲给我听……` : '输入你的问题，Enter 发送，Shift + Enter 换行'"
          @keydown.enter.exact.prevent="send()"
        />
        <div class="c-foot">
          <span class="muted">本次会话剩余 <b>{{ cur?.rounds ?? 100 }}</b> 轮</span>
          <div class="spacer" />
          <el-button type="primary" :loading="busy" @click="send()">发送</el-button>
        </div>
      </div>
      <div class="disclaimer">AI 生成内容仅供参考，请勿完全依赖 · 原型阶段为预置剧本</div>
    </section>
  </div>
</template>

<style scoped>
.tutor {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  height: calc(100vh - var(--ch-header-h) - 180px);
  min-height: 560px;
}
.sessions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  min-height: 0;
}
.new {
  width: 100%;
}
.s-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.s-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
}
.s-item:hover {
  background: var(--ch-fill-hover);
}
.s-item.on {
  background: var(--ch-primary-bg);
}
.s-dot,
.avatar {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}
.s-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.s-main b {
  font-weight: 500;
  font-size: 13.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.s-main .muted {
  font-size: 12px;
}
.del {
  border: none;
  background: none;
  color: var(--ch-text-3);
  cursor: pointer;
  opacity: 0;
}
.s-item:hover .del {
  opacity: 1;
}
.s-foot {
  font-size: 12px;
  text-align: center;
}
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--ch-border-light);
}
.badges .muted {
  width: 100%;
  font-size: 12px;
}
.chat {
  display: flex;
  flex-direction: column;
  padding: 14px 18px;
  min-height: 0;
}
.c-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.e-desc {
  margin: 6px 0 0;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--ch-border-light);
  font-size: 12.5px;
}
.msgs {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 14px 4px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.msg {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.msg.me {
  justify-content: flex-end;
}
.bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--ch-fill);
  font-size: 14px;
  line-height: 1.75;
}
.msg.me .bubble {
  background: var(--ch-primary-bg);
}
.who {
  font-size: 12px;
  color: var(--ch-primary-text);
  margin-bottom: 2px;
}
.text {
  white-space: pre-wrap;
  word-break: break-word;
}
.img {
  max-width: 220px;
  border-radius: 6px;
  display: block;
  margin-bottom: 6px;
}
.thinking {
  color: var(--ch-text-3);
}
.sources {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed var(--ch-border);
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12.5px;
}
.sources a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 0;
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
  border: 1px solid var(--ch-border);
  border-radius: 8px;
  padding: 6px 10px 8px;
}
.composer :deep(.el-textarea__inner) {
  box-shadow: none;
  padding: 4px 0;
}
.tools,
.c-foot {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tools .muted,
.c-foot .muted {
  font-size: 12px;
}
.c-foot b {
  color: var(--ch-primary-text);
}
.disclaimer {
  margin-top: 6px;
  font-size: 11.5px;
  color: var(--ch-text-3);
  text-align: center;
}
@media (max-width: 900px) {
  .tutor {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
  }
  .sessions {
    max-height: 240px;
  }
}
</style>

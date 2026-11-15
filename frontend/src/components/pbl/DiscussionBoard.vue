<script setup lang="ts">
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import type { Post, Topic } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { fmt, fromNow, toISO } from '@/utils/format'
import PersonAvatar from './PersonAvatar.vue'

/** teamId 有值时是团队空间里的讨论：只显示分组讨论，并固定为该团队。 */
const props = defineProps<{ projectId: string; teamId?: string }>()
const store = usePblStore()

const project = computed(() => store.project(props.projectId)!)
const manage = computed(() => store.canManage(project.value))
const topics = computed(() =>
  store.topicsOf(props.projectId).filter((c) => (props.teamId ? c.type === 'group' : true)),
)
const activeId = ref('')
watch(
  topics,
  (list) => {
    if (!list.some((c) => c.id === activeId.value)) {
      const open = list.find((c) => topicState(c) === 'open')
      activeId.value = (open || list[0])?.id || ''
    }
  },
  { immediate: true },
)
const active = computed(() => topics.value.find((c) => c.id === activeId.value))

function topicState(c: Topic) {
  if (dayjs().isBefore(c.openAt)) return 'upcoming'
  if (dayjs().isAfter(c.dueAt)) return 'closed'
  return 'open'
}
const STATE_TEXT = { upcoming: '未开放', open: '进行中', closed: '已结束' }

// 分组讨论时看哪个团队
const teams = computed(() => store.teamsOf(props.projectId))
const viewTeamId = ref<string>('')
watch(
  [active, () => props.teamId],
  () => {
    if (props.teamId) viewTeamId.value = props.teamId
    else if (!viewTeamId.value || !teams.value.some((t) => t.id === viewTeamId.value))
      viewTeamId.value = store.myTeam(props.projectId)?.id || teams.value[0]?.id || ''
  },
  { immediate: true },
)
const threadTeamId = computed(() => (active.value?.type === 'group' ? viewTeamId.value || null : null))
const canPost = computed(() => {
  if (!active.value || topicState(active.value) !== 'open') return false
  if (manage.value) return true
  if (active.value.type === 'group') return store.myTeam(props.projectId)?.id === threadTeamId.value
  return true
})

const posts = computed(() => (active.value ? store.postsOf(active.value.id, threadTeamId.value) : []))
const roots = computed(() =>
  posts.value
    .filter((x) => !x.parentId)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.at.localeCompare(b.at)),
)
const repliesOf = (id: string): Post[] => posts.value.filter((x) => x.parentId === id).sort((a, b) => a.at.localeCompare(b.at))

const draft = ref('')
function send() {
  if (!draft.value.trim() || !active.value) return
  store.addPost(active.value.id, threadTeamId.value, draft.value.trim())
  draft.value = ''
  ElMessage.success('已发表')
}
const replyTo = ref<string | null>(null)
const replyText = ref('')
function sendReply(parentId: string) {
  if (!replyText.value.trim() || !active.value) return
  store.addPost(active.value.id, threadTeamId.value, replyText.value.trim(), parentId)
  replyText.value = ''
  replyTo.value = null
}

// 新建讨论区
const dlg = ref(false)
const form = reactive({ title: '', description: '', type: 'public' as 'public' | 'group', range: [] as Date[] })
function openCreate() {
  Object.assign(form, { title: '', description: '', type: props.teamId ? 'group' : 'public', range: [new Date(), dayjs().add(14, 'day').toDate()] })
  dlg.value = true
}
function saveTopic() {
  if (!form.title.trim() || form.range.length !== 2) return ElMessage.warning('请填写话题和时间')
  store.saveTopic({
    projectId: props.projectId, title: form.title.trim(), description: form.description, type: form.type,
    openAt: toISO(form.range[0])!, dueAt: toISO(form.range[1])!,
  })
  dlg.value = false
  ElMessage.success('讨论区已创建')
}

// 词云（原型：按关键词词表统计出现次数）
const VOCAB = ['识别', '光照', '反光', '强光', '预测', '数据集', '时延', '命中率', '误检', '云台', '分工', '训练', '检测', '模型', '颜色', '规划', '仿真', '建图', '标定', '实车', '同步', '轻量化', '指标', '方案']
const cloud = computed(() => {
  const text = posts.value.map((x) => x.content).join(' ')
  const words = [...VOCAB, ...project.value.tags]
  return words
    .map((w) => ({ w, n: text.split(w).length - 1 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 16)
})
const showCloud = ref(false)
</script>

<template>
  <div class="board">
    <aside class="topics">
      <div class="flex topics-head">
        <b>讨论区</b>
        <div class="spacer" />
        <el-button v-if="manage" size="small" type="primary" link :icon="'Plus'" @click="openCreate">新建</el-button>
      </div>
      <div v-if="!topics.length" class="empty-tip">暂无讨论区</div>
      <div v-for="c in topics" :key="c.id" class="topic" :class="{ on: c.id === activeId }" @click="activeId = c.id">
        <div class="flex">
          <span class="ellipsis tt">{{ c.title }}</span>
          <div class="spacer" />
          <el-tag size="small" :type="topicState(c) === 'open' ? 'success' : 'info'" effect="plain">{{ STATE_TEXT[topicState(c)] }}</el-tag>
        </div>
        <div class="muted">{{ c.type === 'group' ? '分组讨论' : '公开讨论' }} · 截止 {{ fmt(c.dueAt, 'MM-DD') }}</div>
      </div>
    </aside>

    <section v-if="active" class="thread">
      <div class="thread-head">
        <div>
          <div class="flex">
            <h3>{{ active.title }}</h3>
            <el-tag size="small" effect="plain">{{ active.type === 'group' ? '分组讨论' : '公开讨论' }}</el-tag>
          </div>
          <div class="muted">{{ active.description }}</div>
          <div class="muted">开放时间 {{ fmt(active.openAt) }} ~ {{ fmt(active.dueAt) }}</div>
        </div>
        <div class="spacer" />
        <el-select v-if="active.type === 'group' && !teamId && manage" v-model="viewTeamId" size="small" style="width: 130px">
          <el-option v-for="t in teams" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
        <el-button size="small" :icon="'PieChart'" @click="showCloud = !showCloud">词云</el-button>
      </div>

      <transition name="fade">
        <div v-if="showCloud" class="cloud">
          <span v-if="!cloud.length" class="muted">讨论内容还不够多</span>
          <span v-for="(x, i) in cloud" :key="x.w" class="word" :style="{ fontSize: `${14 + Math.min(x.n, 6) * 4}px`, opacity: 1 - i * 0.035 }">{{ x.w }}</span>
        </div>
      </transition>

      <div v-if="active.type === 'group' && !threadTeamId" class="empty-tip">还没有团队</div>
      <div v-else-if="!roots.length" class="empty-tip">还没有人发言</div>
      <transition-group name="list" tag="div">
        <div v-for="x in roots" :key="x.id" class="post">
          <PersonAvatar :id="x.authorId" :size="34" />
          <div class="body">
            <div class="flex">
              <b>{{ store.person(x.authorId)?.name }}</b>
              <el-tag v-if="store.person(x.authorId)?.role !== 'student'" size="small" type="warning" effect="plain">老师</el-tag>
              <el-tag v-if="x.pinned" size="small" type="danger" effect="dark">置顶</el-tag>
              <span class="muted">{{ fromNow(x.at) }}</span>
            </div>
            <div class="rich-text content">{{ x.content }}</div>
            <div class="ops">
              <span class="op" :class="{ liked: x.likeIds.includes(store.personaId) }" @click="store.toggleLike(x.id)">
                <el-icon><Pointer /></el-icon> {{ x.likeIds.length || '' }} 赞
              </span>
              <span v-if="canPost" class="op" @click="replyTo = replyTo === x.id ? null : x.id"><el-icon><ChatDotRound /></el-icon> 回复</span>
              <span v-if="manage" class="op" @click="store.togglePin(x.id)"><el-icon><Top /></el-icon> {{ x.pinned ? '取消置顶' : '置顶' }}</span>
            </div>
            <div v-for="r in repliesOf(x.id)" :key="r.id" class="reply">
              <PersonAvatar :id="r.authorId" :size="24" />
              <div class="body">
                <div class="flex">
                  <b>{{ store.person(r.authorId)?.name }}</b>
                  <span class="muted">{{ fromNow(r.at) }}</span>
                </div>
                <div class="rich-text">{{ r.content }}</div>
                <span class="op" :class="{ liked: r.likeIds.includes(store.personaId) }" @click="store.toggleLike(r.id)">
                  <el-icon><Pointer /></el-icon> {{ r.likeIds.length || '' }} 赞
                </span>
              </div>
            </div>
            <div v-if="replyTo === x.id" class="reply-box">
              <el-input v-model="replyText" size="small" placeholder="写下你的回复" @keyup.enter="sendReply(x.id)" />
              <el-button size="small" type="primary" @click="sendReply(x.id)">回复</el-button>
            </div>
          </div>
        </div>
      </transition-group>

      <div v-if="canPost" class="composer">
        <el-input v-model="draft" type="textarea" :rows="3" placeholder="发表你的观点…" />
        <div class="flex" style="margin-top: 8px">
          <span class="muted">支持上传附件（原型中只记录文件名）</span>
          <div class="spacer" />
          <el-button type="primary" :disabled="!draft.trim()" @click="send">发表</el-button>
        </div>
      </div>
      <div v-else-if="topicState(active) !== 'open'" class="muted closed-tip">讨论区{{ STATE_TEXT[topicState(active)] }}，不能发言</div>
    </section>
    <section v-else class="thread empty-tip">请选择一个讨论区</section>

    <el-dialog v-model="dlg" title="新建讨论区" width="520px">
      <el-form label-width="80px">
        <el-form-item label="话题"><el-input v-model="form.title" placeholder="例如：任务分工" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="form.type" :disabled="!!teamId">
            <el-radio value="public">公开讨论</el-radio>
            <el-radio value="group">分组讨论（每组独立）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="开放时间">
          <el-date-picker v-model="form.range" type="datetimerange" start-placeholder="开放" end-placeholder="截止" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlg = false">取消</el-button>
        <el-button type="primary" @click="saveTopic">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
  min-height: 360px;
}
.topics {
  border-right: 1px solid var(--ch-border);
  padding-right: 12px;
}
.topics-head {
  margin-bottom: 8px;
}
.topic {
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
}
.topic:hover {
  background: var(--ch-fill);
}
.topic.on {
  background: var(--el-color-primary-light-9);
}
.tt {
  font-weight: 500;
  max-width: 140px;
}
.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.thread-head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  border-bottom: 1px solid var(--ch-border);
  padding-bottom: 12px;
  margin-bottom: 12px;
}
.thread-head h3 {
  margin: 0;
  font-size: 16px;
}
.cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--ch-fill);
  border-radius: 8px;
  margin-bottom: 12px;
}
.word {
  color: var(--ch-text-2);
  font-weight: 500;
}
.word:nth-child(3n) {
  color: var(--ch-primary-text);
  font-weight: 600;
}
.post {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px dashed var(--ch-border);
}
.body {
  flex: 1;
  min-width: 0;
}
.content {
  margin: 6px 0;
}
.ops {
  display: flex;
  gap: 16px;
}
.op {
  font-size: 12px;
  color: var(--ch-text-2);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  user-select: none;
}
.op:hover,
.op.liked {
  color: var(--ch-primary-text);
}
.op.liked {
  font-weight: 600;
}
.reply {
  display: flex;
  gap: 8px;
  background: var(--ch-fill);
  border-radius: 6px;
  padding: 8px 10px;
  margin-top: 8px;
}
.reply-box {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.composer {
  margin-top: 16px;
}
.closed-tip {
  margin-top: 16px;
  text-align: center;
}
.fade-enter-active,
.fade-leave-active {
  transition: all 0.25s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.list-enter-active {
  transition: all 0.4s;
}
.list-enter-from {
  opacity: 0;
  transform: translateY(10px);
  background: var(--el-color-primary-light-9);
}
@media (max-width: 760px) {
  .board {
    grid-template-columns: 1fr;
  }
  .topics {
    border-right: 0;
    padding-right: 0;
  }
}
</style>

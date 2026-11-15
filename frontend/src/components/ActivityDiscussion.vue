<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref } from 'vue'
import { communityApi, type PostItem } from '@/api/community'
import { fromNow } from '@/utils/format'

const props = defineProps<{ activityId: number }>()
const items = ref<PostItem[]>([])
const canModerate = ref(false)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const d = await communityApi.posts(props.activityId)
    items.value = d.items
    canModerate.value = d.can_moderate
  } finally {
    loading.value = false
  }
}
onMounted(load)

const draft = ref('')
const sending = ref(false)
async function send() {
  if (!draft.value.trim()) return
  sending.value = true
  try {
    await communityApi.createPost(props.activityId, draft.value.trim())
    draft.value = ''
    ElMessage.success('已发表')
    load()
  } finally {
    sending.value = false
  }
}
const replyTo = ref<number | null>(null)
const replyText = ref('')
async function reply(p: PostItem) {
  if (!replyText.value.trim()) return
  await communityApi.createPost(props.activityId, replyText.value.trim(), p.id)
  replyText.value = ''
  replyTo.value = null
  load()
}
async function like(p: PostItem) {
  const r = await communityApi.like(p.id)
  p.liked = r.liked
  p.likes += r.liked ? 1 : -1
}
async function pin(p: PostItem) {
  await communityApi.pin(p.id)
  load()
}
async function remove(p: PostItem) {
  await ElMessageBox.confirm('删除这条帖子？回复也会一起删除。', '提示', { type: 'warning' })
  await communityApi.removePost(p.id)
  load()
}
const isTeacher = (p: PostItem) => p.user_role !== 'student'
</script>

<template>
  <section v-loading="loading" class="card disc">
    <div class="head">
      <b>讨论区</b>
      <span class="muted">{{ items.length }} 个话题</span>
    </div>
    <div class="composer">
      <el-input v-model="draft" type="textarea" :rows="2" placeholder="有问题或想法？发个帖子吧" maxlength="5000" />
      <el-button type="primary" :loading="sending" :disabled="!draft.trim()" @click="send">发表</el-button>
    </div>
    <div v-if="!items.length" class="empty-tip">还没有人发帖</div>
    <div v-for="p in items" :key="p.id" class="post">
      <el-avatar :size="34" :src="p.user.avatar || undefined">{{ p.user.name.slice(-2) }}</el-avatar>
      <div class="body">
        <div class="flex">
          <b>{{ p.user.name }}</b>
          <el-tag v-if="isTeacher(p)" size="small" type="warning" effect="plain">{{ p.user_role === 'ta' ? '助教' : '老师' }}</el-tag>
          <el-tag v-if="p.pinned" size="small" type="danger" effect="dark">置顶</el-tag>
          <span class="muted">{{ fromNow(p.created_at) }}</span>
        </div>
        <div class="rich-text text">{{ p.content }}</div>
        <div class="ops">
          <span class="op" :class="{ on: p.liked }" @click="like(p)"><el-icon><Pointer /></el-icon> {{ p.likes || '' }} 赞</span>
          <span class="op" @click="replyTo = replyTo === p.id ? null : p.id"><el-icon><ChatDotRound /></el-icon> 回复</span>
          <span v-if="canModerate" class="op" @click="pin(p)"><el-icon><Top /></el-icon> {{ p.pinned ? '取消置顶' : '置顶' }}</span>
          <span v-if="p.can_delete" class="op danger" @click="remove(p)"><el-icon><Delete /></el-icon> 删除</span>
        </div>
        <div v-for="r in p.replies" :key="r.id" class="reply">
          <el-avatar :size="24" :src="r.user.avatar || undefined">{{ r.user.name.slice(-2) }}</el-avatar>
          <div class="body">
            <div class="flex">
              <b>{{ r.user.name }}</b>
              <el-tag v-if="isTeacher(r)" size="small" type="warning" effect="plain">{{ r.user_role === 'ta' ? '助教' : '老师' }}</el-tag>
              <span class="muted">{{ fromNow(r.created_at) }}</span>
            </div>
            <div class="rich-text">{{ r.content }}</div>
            <div class="ops">
              <span class="op" :class="{ on: r.liked }" @click="like(r)"><el-icon><Pointer /></el-icon> {{ r.likes || '' }} 赞</span>
              <span class="op" @click="replyTo = replyTo === p.id ? null : p.id">回复</span>
              <span v-if="r.can_delete" class="op danger" @click="remove(r)">删除</span>
            </div>
          </div>
        </div>
        <div v-if="replyTo === p.id" class="reply-box">
          <el-input v-model="replyText" size="small" placeholder="写下你的回复" @keyup.enter="reply(p)" />
          <el-button size="small" type="primary" @click="reply(p)">回复</el-button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.disc {
  margin-top: 16px;
}
.head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 15px;
}
.composer {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  margin-bottom: 8px;
}
.post {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--ch-border-light);
}
.body {
  flex: 1;
  min-width: 0;
}
.text {
  margin: 6px 0;
}
.ops {
  display: flex;
  gap: 14px;
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
.op.on {
  color: var(--ch-primary-text);
}
.op.danger:hover {
  color: var(--ch-danger);
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
</style>

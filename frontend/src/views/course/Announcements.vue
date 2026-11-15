<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import { communityApi, type Announcement } from '@/api/community'
import { useCourseStore } from '@/stores/course'
import { fmt, fromNow, toISO } from '@/utils/format'

const cs = useCourseStore()
const list = ref<Announcement[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    list.value = await communityApi.announcements(cs.course!.id)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const dlg = ref(false)
const saving = ref(false)
const editing = ref<Announcement | null>(null)
const form = reactive({ title: '', content: '', range: null as Date[] | null, pinned: false })
function open(a?: Announcement) {
  editing.value = a ?? null
  Object.assign(form, {
    title: a?.title ?? '',
    content: a?.content ?? '',
    range: a && (a.open_at || a.close_at) ? [new Date(a.open_at || a.created_at), a.close_at ? new Date(a.close_at) : new Date(Date.now() + 30 * 864e5)] : null,
    pinned: a?.pinned ?? false,
  })
  dlg.value = true
}
async function save() {
  if (!form.title.trim()) return ElMessage.warning('请填写标题')
  const data = {
    title: form.title.trim(),
    content: form.content,
    open_at: form.range ? toISO(form.range[0]) : null,
    close_at: form.range ? toISO(form.range[1]) : null,
    pinned: form.pinned,
  }
  saving.value = true
  try {
    if (editing.value) await communityApi.updateAnnouncement(editing.value.id, data)
    else await communityApi.createAnnouncement(cs.course!.id, data)
    ElMessage.success('已发布')
    dlg.value = false
    load()
  } finally {
    saving.value = false
  }
}
async function remove(a: Announcement) {
  await ElMessageBox.confirm(`删除公告「${a.title}」？`, '提示', { type: 'warning' })
  await communityApi.removeAnnouncement(a.id)
  load()
}
</script>

<template>
  <div v-loading="loading">
    <div class="page-title">
      <span>课程公告</span>
      <el-button v-if="cs.isManager" type="primary" :icon="'Plus'" @click="open()">发布公告</el-button>
    </div>
    <div v-if="!list.length" class="card empty-tip">暂无公告</div>
    <article v-for="a in list" :key="a.id" class="card ann" :class="{ pinned: a.pinned, hidden: !a.visible }">
      <div class="flex">
        <el-tag v-if="a.pinned" type="danger" effect="dark" size="small">置顶</el-tag>
        <b class="title">{{ a.title }}</b>
        <el-tag v-if="!a.visible" type="warning" size="small">{{ a.open_at && new Date(a.open_at) > new Date() ? `定时 ${fmt(a.open_at, 'MM-DD HH:mm')} 开放` : '已过期' }}（学生不可见）</el-tag>
        <div class="spacer" />
        <template v-if="cs.isManager">
          <el-button link type="primary" size="small" @click="open(a)">编辑</el-button>
          <el-button link type="danger" size="small" @click="remove(a)">删除</el-button>
        </template>
      </div>
      <div class="rich-text body">{{ a.content }}</div>
      <div class="muted">
        {{ a.author?.name }} · 发布于 {{ fromNow(a.open_at || a.created_at) }}
        <template v-if="a.close_at"> · {{ fmt(a.close_at) }} 截止</template>
      </div>
    </article>

    <el-dialog v-model="dlg" :title="editing ? '编辑公告' : '发布公告'" width="560px">
      <el-form label-width="80px">
        <el-form-item label="标题"><el-input v-model="form.title" maxlength="200" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="6" /></el-form-item>
        <el-form-item label="开放时间">
          <el-date-picker v-model="form.range" type="datetimerange" start-placeholder="开放" end-placeholder="截止" clearable />
          <div class="muted" style="width: 100%">不设置表示立即发布、一直可见</div>
        </el-form-item>
        <el-form-item label="置顶"><el-switch v-model="form.pinned" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlg = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.ann {
  margin-bottom: 12px;
}
.ann.pinned {
  border-left: 3px solid var(--ch-danger);
}
.ann.hidden {
  background: var(--ch-fill);
}
.title {
  font-size: 16px;
}
.body {
  margin: 10px 0;
}
</style>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PersonAvatar from '@/components/pbl/PersonAvatar.vue'
import { usePblStore } from '@/stores/pbl'
import { fmt, fromNow } from '@/utils/format'
import { TASK_STATE } from '@/utils/pbl'

const props = defineProps<{ projectId: string; taskId: string }>()
const store = usePblStore()
const route = useRoute()
const router = useRouter()

const project = computed(() => store.project(props.projectId))
const task = computed(() => store.task(props.taskId))
const manage = computed(() => !!project.value && store.canManage(project.value))
const teams = computed(() => store.teamsOf(props.projectId))

const filter = ref<'all' | 'submitted' | 'graded' | 'missing'>('all')
const shown = computed(() =>
  teams.value.filter((t) => {
    const st = store.taskState(task.value!, t.id)
    if (filter.value === 'submitted') return st === 'submitted'
    if (filter.value === 'graded') return st === 'graded'
    if (filter.value === 'missing') return st === 'todo' || st === 'overdue'
    return true
  }),
)
const counts = computed(() => {
  const st = teams.value.map((t) => store.taskState(task.value!, t.id))
  return {
    all: st.length,
    submitted: st.filter((s) => s === 'submitted').length,
    graded: st.filter((s) => s === 'graded').length,
    missing: st.filter((s) => s === 'todo' || s === 'overdue').length,
  }
})

const curId = ref<string>((route.query.team as string) || teams.value[0]?.id || '')
const cur = computed(() => store.team(curId.value))
const subs = computed(() => (cur.value ? store.subsOf(props.taskId, cur.value.id) : []))
const viewSubId = ref('')
watch(subs, (l) => (viewSubId.value = l[0]?.id || ''), { immediate: true })
const viewSub = computed(() => subs.value.find((s) => s.id === viewSubId.value))

const score = ref<number | undefined>()
const comment = ref('')
watch(
  viewSub,
  (s) => {
    score.value = s?.score ?? undefined
    comment.value = s?.comment ?? ''
  },
  { immediate: true },
)
function save(goNext = false) {
  if (!viewSub.value) return
  if (score.value === undefined || score.value === null) return ElMessage.warning('请输入分数')
  store.grade(viewSub.value, score.value, comment.value)
  ElMessage.success('已保存')
  if (goNext) move(1)
}
function move(d: number) {
  const list = shown.value
  const i = list.findIndex((t) => t.id === curId.value)
  const next = list[i + d]
  if (next) curId.value = next.id
  else ElMessage.info(d > 0 ? '已经是最后一个' : '已经是第一个')
}
function urgeMissing() {
  const ids = teams.value.filter((t) => ['todo', 'overdue'].includes(store.taskState(task.value!, t.id))).map((t) => t.id)
  if (!ids.length) return ElMessage.info('所有团队都已提交')
  store.urge(task.value!, ids)
  ElMessage.success(`已向 ${ids.length} 个团队发送催交提醒`)
}
function urgeOne() {
  if (!cur.value) return
  store.urge(task.value!, [cur.value.id])
  ElMessage.success(`已提醒「${cur.value.name}」`)
}
</script>

<template>
  <div v-if="project && task && manage">
    <el-breadcrumb separator="/" class="crumb">
      <el-breadcrumb-item :to="'/pbl'">项目大厅</el-breadcrumb-item>
      <el-breadcrumb-item :to="`/pbl/projects/${projectId}?tab=tasks`">{{ project.title }}</el-breadcrumb-item>
      <el-breadcrumb-item>评阅：{{ task.title }}</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="page-title">
      <span>{{ task.title }} <span class="muted">截止 {{ fmt(task.dueAt) }} · 满分 {{ task.fullScore }}</span></span>
      <el-button type="warning" plain :icon="'Bell'" @click="urgeMissing">一键催交（{{ counts.missing }}）</el-button>
    </div>

    <div class="review">
      <aside class="card left">
        <el-radio-group v-model="filter" size="small" class="filter">
          <el-radio-button value="all">全部 {{ counts.all }}</el-radio-button>
          <el-radio-button value="submitted">待评 {{ counts.submitted }}</el-radio-button>
          <el-radio-button value="graded">已评 {{ counts.graded }}</el-radio-button>
          <el-radio-button value="missing">未交 {{ counts.missing }}</el-radio-button>
        </el-radio-group>
        <div v-for="t in shown" :key="t.id" class="team-item" :class="{ on: t.id === curId }" @click="curId = t.id">
          <b>{{ t.name }}</b>
          <div class="spacer" />
          <el-tag size="small" :type="TASK_STATE[store.taskState(task, t.id)].type">{{ TASK_STATE[store.taskState(task, t.id)].text }}</el-tag>
          <span v-if="store.latestSub(task.id, t.id)?.score != null" class="sc">{{ store.latestSub(task.id, t.id)!.score }}</span>
        </div>
        <div v-if="!shown.length" class="empty-tip">没有团队</div>
      </aside>

      <section class="card mid">
        <template v-if="cur">
          <div class="flex">
            <h3>{{ cur.name }}</h3>
            <span class="avs"><PersonAvatar v-for="sid in cur.memberIds" :id="sid" :key="sid" :size="24" :leader="cur.leaderId === sid" /></span>
            <div class="spacer" />
            <el-button size="small" :icon="'ArrowLeft'" @click="move(-1)">上一个</el-button>
            <el-button size="small" @click="move(1)">下一个<el-icon class="el-icon--right"><ArrowRight /></el-icon></el-button>
          </div>
          <div v-if="!subs.length" class="empty-tip">
            该团队还没有提交
            <div style="margin-top: 10px"><el-button size="small" type="warning" plain :icon="'Bell'" @click="urgeOne">催交</el-button></div>
            <div v-if="task.urges.some((u) => u.teamId === cur!.id)" class="muted">已催交 {{ task.urges.filter((u) => u.teamId === cur!.id).length }} 次</div>
          </div>
          <template v-else>
            <el-radio-group v-if="subs.length > 1" v-model="viewSubId" size="small" class="versions">
              <el-radio-button v-for="s in subs" :key="s.id" :value="s.id">第 {{ s.attempt }} 次</el-radio-button>
            </el-radio-group>
            <div v-if="viewSub" class="content">
              <div class="muted">{{ store.person(viewSub.byId)?.name }} 提交于 {{ fmt(viewSub.at) }}（{{ fromNow(viewSub.at) }}）</div>
              <div class="rich-text body">{{ viewSub.content || '（没有文字说明）' }}</div>
              <div class="files">
                <div v-for="f in viewSub.files" :key="f" class="file"><el-icon><Paperclip /></el-icon>{{ f }}<el-button link size="small" type="primary" @click="ElMessage.info(`原型演示：预览「${f}」`)">预览</el-button></div>
              </div>
            </div>
          </template>
        </template>
      </section>

      <aside class="card right">
        <h4>评阅</h4>
        <template v-if="viewSub">
          <el-form label-position="top">
            <el-form-item :label="`分数（满分 ${task.fullScore}）`">
              <el-input-number v-model="score" :min="0" :max="task.fullScore" style="width: 100%" />
            </el-form-item>
            <el-form-item label="评语">
              <el-input v-model="comment" type="textarea" :rows="6" placeholder="给团队的反馈" />
            </el-form-item>
          </el-form>
          <div class="btns">
            <el-button type="primary" @click="save(false)">保存</el-button>
            <el-button @click="save(true)">保存并下一个</el-button>
          </div>
          <el-divider />
          <el-checkbox :model-value="viewSub.recommended" @change="store.toggleRecommend(viewSub)">设为推荐内容</el-checkbox>
          <div class="muted">推荐后会展示在课题概览页，供其他团队参考。</div>
        </template>
        <div v-else class="muted">没有可评阅的提交</div>
      </aside>
    </div>
  </div>
  <el-result v-else icon="warning" title="只有指导教师和管理员可以评阅">
    <template #extra><el-button type="primary" @click="router.push(`/pbl/projects/${projectId}`)">回到课题</el-button></template>
  </el-result>
</template>

<style scoped>
.crumb {
  margin-bottom: 14px;
}
.review {
  display: grid;
  grid-template-columns: 260px 1fr 280px;
  gap: 12px;
  align-items: start;
}
.filter {
  margin-bottom: 10px;
  display: flex;
}
.team-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
}
.team-item:hover {
  background: #f5f7fa;
}
.team-item.on {
  background: var(--el-color-primary-light-9);
}
.sc {
  font-weight: 700;
  color: var(--ch-primary);
  width: 26px;
  text-align: right;
}
.mid h3 {
  margin: 0;
}
.avs {
  display: flex;
  gap: 4px;
}
.versions {
  margin: 12px 0;
}
.content {
  margin-top: 12px;
}
.body {
  margin: 10px 0;
  padding: 12px;
  background: #f7f9fb;
  border-radius: 8px;
  min-height: 80px;
}
.files {
  display: grid;
  gap: 6px;
}
.file {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--ch-border);
  border-radius: 6px;
}
.right h4 {
  margin: 0 0 10px;
}
.btns {
  display: flex;
  gap: 8px;
}
@media (max-width: 1000px) {
  .review {
    grid-template-columns: 1fr;
  }
}
</style>

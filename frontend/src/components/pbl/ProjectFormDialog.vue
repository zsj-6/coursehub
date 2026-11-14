<script setup lang="ts">
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import type { Project } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { toISO } from '@/utils/format'

const emit = defineEmits<{ saved: [id: string] }>()
const store = usePblStore()
const visible = ref(false)
const step = ref(0)
const editingId = ref<string | undefined>()

interface MsForm {
  id: string
  title: string
  description: string
  range: Date[]
}
const form = reactive({
  programId: '',
  title: '',
  summary: '',
  goals: [''] as string[],
  mentorIds: [] as string[],
  tags: [] as string[],
  milestones: [] as MsForm[],
})
const mentors = computed(() => store.data.people.filter((p) => p.role === 'mentor'))
const TAG_OPTIONS = ['计算机视觉', '嵌入式', '机械设计', '自动控制', 'ROS', 'C++', 'Python', '深度学习', '路径规划']

const TEMPLATE = ['需求分析与技术调研', '方案设计', '原型实现', '联调与测试', '结项答辩']
function templateMilestones(): MsForm[] {
  let d = dayjs().add(7, 'day').startOf('day')
  return TEMPLATE.map((title, i) => {
    const len = i === 2 || i === 3 ? 21 : 14
    const r = [d.toDate(), d.add(len - 1, 'day').endOf('day').toDate()]
    d = d.add(len, 'day')
    return { id: `new-ms${i}`, title, description: '', range: r }
  })
}

function open(p?: Project, programId?: string) {
  step.value = 0
  editingId.value = p?.id
  if (p) {
    Object.assign(form, {
      programId: p.programId, title: p.title, summary: p.summary, goals: [...p.goals], mentorIds: [...p.mentorIds], tags: [...p.tags],
      milestones: p.milestones.map((m) => ({ id: m.id, title: m.title, description: m.description, range: [new Date(m.start), new Date(m.end)] })),
    })
  } else {
    Object.assign(form, {
      programId: programId || store.data.programs[0]?.id || '', title: '', summary: '', goals: [''],
      mentorIds: store.role === 'mentor' ? [store.personaId] : [], tags: [], milestones: templateMilestones(),
    })
  }
  visible.value = true
}
defineExpose({ open })

function addMs() {
  const last = form.milestones[form.milestones.length - 1]
  const start = last?.range[1] ? dayjs(last.range[1]).add(1, 'day').startOf('day') : dayjs().startOf('day')
  form.milestones.push({ id: `new-ms${Date.now()}`, title: '', description: '', range: [start.toDate(), start.add(13, 'day').endOf('day').toDate()] })
}
function moveMs(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= form.milestones.length) return
  ;[form.milestones[i], form.milestones[j]] = [form.milestones[j], form.milestones[i]]
}

function next() {
  if (step.value === 0) {
    if (!form.title.trim()) return ElMessage.warning('请填写课题名称')
    if (!form.mentorIds.length) return ElMessage.warning('请选择指导教师')
  }
  step.value++
}

function save(publish: boolean) {
  if (form.milestones.some((m) => !m.title.trim() || m.range?.length !== 2)) return ElMessage.warning('请把每个关卡的名称和时间填完整')
  const old = editingId.value ? store.project(editingId.value) : undefined
  const id = store.saveProject({
    id: editingId.value,
    programId: form.programId,
    title: form.title.trim(),
    summary: form.summary,
    goals: form.goals.map((g) => g.trim()).filter(Boolean),
    mentorIds: form.mentorIds,
    tags: form.tags,
    status: old?.status ?? (publish ? 'recruiting' : 'draft'),
    published: old ? old.published || publish : publish,
    milestones: form.milestones.map((m, i) => ({
      id: m.id.startsWith('new-') ? `${Date.now().toString(36)}-ms${i}` : m.id,
      title: m.title.trim(), description: m.description, start: toISO(m.range[0])!, end: toISO(m.range[1])!,
    })),
    teaming: old?.teaming ?? {
      mode: 'free', teamCount: 3, maxPerTeam: 4, hasLeader: true,
      deadline: toISO(dayjs(form.milestones[0]?.range[0]).subtract(1, 'day').endOf('day').toDate())!, signupLimit: 12,
    },
  })
  visible.value = false
  ElMessage.success(publish ? '已保存并发布，学生现在可以看到' : '已保存')
  emit('saved', id)
}
</script>

<template>
  <el-dialog v-model="visible" :title="editingId ? '编辑课题' : '新建课题'" width="760px" top="6vh">
    <el-steps :active="step" finish-status="success" simple class="steps">
      <el-step title="基本信息" />
      <el-step title="关卡设置" />
    </el-steps>

    <el-form v-show="step === 0" label-width="90px">
      <el-form-item label="所属大项目">
        <el-select v-model="form.programId" style="width: 100%">
          <el-option v-for="g in store.data.programs" :key="g.id" :label="`${g.title}（${g.source}）`" :value="g.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="课题名称"><el-input v-model="form.title" placeholder="例如：视觉识别与自动瞄准" /></el-form-item>
      <el-form-item label="课题简介"><el-input v-model="form.summary" type="textarea" :rows="3" /></el-form-item>
      <el-form-item label="项目目标">
        <div class="goals">
          <div v-for="(_, i) in form.goals" :key="i" class="flex">
            <el-input v-model="form.goals[i]" :placeholder="`目标 ${i + 1}`" />
            <el-button link :icon="'Delete'" :disabled="form.goals.length === 1" @click="form.goals.splice(i, 1)" />
          </div>
          <el-button link type="primary" :icon="'Plus'" @click="form.goals.push('')">添加目标</el-button>
        </div>
      </el-form-item>
      <el-form-item label="指导教师">
        <el-select v-model="form.mentorIds" multiple style="width: 100%">
          <el-option v-for="m in mentors" :key="m.id" :label="`${m.name}（${m.college}）`" :value="m.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="标签">
        <el-select v-model="form.tags" multiple filterable allow-create default-first-option style="width: 100%" placeholder="选择或输入标签">
          <el-option v-for="t in TAG_OPTIONS" :key="t" :label="t" :value="t" />
        </el-select>
      </el-form-item>
    </el-form>

    <div v-show="step === 1">
      <div class="muted" style="margin-bottom: 10px">学生按关卡顺序推进，每个关卡下可以布置任务。已按常用模板预填，可以修改。</div>
      <div v-for="(m, i) in form.milestones" :key="m.id" class="ms">
        <div class="ms-no">{{ i + 1 }}</div>
        <div class="ms-body">
          <div class="flex">
            <el-input v-model="m.title" placeholder="关卡名称" style="max-width: 220px" />
            <el-date-picker v-model="m.range" type="daterange" start-placeholder="开始" end-placeholder="结束" style="max-width: 280px" />
            <div class="spacer" />
            <el-button link :icon="'Top'" :disabled="i === 0" @click="moveMs(i, -1)" />
            <el-button link :icon="'Bottom'" :disabled="i === form.milestones.length - 1" @click="moveMs(i, 1)" />
            <el-button link type="danger" :icon="'Delete'" @click="form.milestones.splice(i, 1)" />
          </div>
          <el-input v-model="m.description" placeholder="关卡说明（选填）" size="small" style="margin-top: 6px" />
        </div>
      </div>
      <el-button :icon="'Plus'" @click="addMs">添加关卡</el-button>
    </div>

    <template #footer>
      <el-button v-if="step > 0" @click="step--">上一步</el-button>
      <el-button v-if="step === 0" type="primary" @click="next">下一步</el-button>
      <template v-else>
        <el-button @click="save(false)">保存{{ editingId ? '' : '为草稿' }}</el-button>
        <el-button v-if="!editingId || !store.project(editingId)?.published" type="primary" @click="save(true)">保存并发布</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<style scoped>
.steps {
  margin-bottom: 20px;
}
.goals {
  width: 100%;
  display: grid;
  gap: 6px;
}
.ms {
  display: flex;
  gap: 12px;
  border: 1px solid var(--ch-border);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 8px;
}
.ms-no {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--ch-primary);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 700;
  flex-shrink: 0;
}
.ms-body {
  flex: 1;
}
</style>

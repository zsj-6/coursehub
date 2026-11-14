<script setup lang="ts">
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import type { Task } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { toISO } from '@/utils/format'

const props = defineProps<{ projectId: string }>()
const store = usePblStore()
const project = computed(() => store.project(props.projectId)!)
const visible = ref(false)
const form = reactive({
  id: undefined as string | undefined,
  milestoneId: '',
  title: '',
  description: '',
  range: [] as Date[],
  maxAttempts: 2,
  fullScore: 100,
})

function open(k?: Task, milestoneId?: string) {
  if (k) {
    Object.assign(form, { id: k.id, milestoneId: k.milestoneId, title: k.title, description: k.description, range: [new Date(k.openAt), new Date(k.dueAt)], maxAttempts: k.maxAttempts, fullScore: k.fullScore })
  } else {
    const m = project.value.milestones.find((x) => x.id === milestoneId) || store.currentMilestone(project.value) || project.value.milestones[0]
    Object.assign(form, {
      id: undefined, milestoneId: m?.id || '', title: '', description: '',
      range: m ? [new Date(Math.max(Date.now(), +new Date(m.start))), new Date(m.end)] : [new Date(), dayjs().add(7, 'day').toDate()],
      maxAttempts: 2, fullScore: 100,
    })
  }
  visible.value = true
}
defineExpose({ open })

function save() {
  if (!form.title.trim() || form.range?.length !== 2) return ElMessage.warning('请填写任务标题和时间')
  store.saveTask({
    id: form.id, projectId: props.projectId, milestoneId: form.milestoneId, title: form.title.trim(), description: form.description,
    openAt: toISO(form.range[0])!, dueAt: toISO(form.range[1])!, maxAttempts: form.maxAttempts, fullScore: form.fullScore,
  })
  visible.value = false
  ElMessage.success('任务已保存')
}
</script>

<template>
  <el-dialog v-model="visible" :title="form.id ? '编辑任务' : '布置任务'" width="560px">
    <el-form label-width="90px">
      <el-form-item label="所属关卡">
        <el-select v-model="form.milestoneId" style="width: 100%">
          <el-option v-for="(m, i) in project.milestones" :key="m.id" :label="`关卡 ${i + 1} · ${m.title}`" :value="m.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="任务标题"><el-input v-model="form.title" /></el-form-item>
      <el-form-item label="提交要求"><el-input v-model="form.description" type="textarea" :rows="4" placeholder="说明要提交什么、格式要求等" /></el-form-item>
      <el-form-item label="开放时间"><el-date-picker v-model="form.range" type="datetimerange" start-placeholder="开放" end-placeholder="截止" /></el-form-item>
      <el-form-item label="提交次数">
        <el-input-number v-model="form.maxAttempts" :min="0" :max="20" />
        <span class="muted" style="margin-left: 8px">0 表示不限</span>
      </el-form-item>
      <el-form-item label="满分"><el-input-number v-model="form.fullScore" :min="1" :max="1000" /></el-form-item>
      <div class="muted">任务以团队为单位提交，团队任何成员都可以提交。</div>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { ref, watch } from 'vue'
import { activitiesApi } from '@/api/activities'
import { toISO } from '@/utils/format'

/** 发布（立即 / 定时）一个或多个活动。 */
const props = defineProps<{ courseId: number; ids: number[] }>()
const visible = defineModel<boolean>({ default: false })
const emit = defineEmits<{ done: [] }>()

const mode = ref<'now' | 'scheduled'>('now')
const range = ref<[Date, Date] | null>(null)
const saving = ref(false)

watch(visible, (v) => {
  if (v) {
    mode.value = 'now'
    range.value = null
  }
})

async function submit() {
  if (mode.value === 'scheduled' && !range.value) return ElMessage.warning('请选择开放时间段')
  saving.value = true
  try {
    await activitiesApi.batchPublish(props.courseId, {
      ids: props.ids,
      publish: true,
      open_at: mode.value === 'scheduled' && range.value ? toISO(range.value[0]) : null,
      close_at: mode.value === 'scheduled' && range.value ? toISO(range.value[1]) : null,
    })
    ElMessage.success(`已发布 ${props.ids.length} 个活动`)
    visible.value = false
    emit('done')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="`发布 ${ids.length} 个活动`" width="520px">
    <el-radio-group v-model="mode">
      <el-radio value="now">立即发布</el-radio>
      <el-radio value="scheduled">定时发布</el-radio>
    </el-radio-group>
    <div class="muted" style="margin: 10px 0">
      {{ mode === 'now' ? '发布后学生立即可以看到。' : '学生只能在下面的时间段内看到。' }}
    </div>
    <el-date-picker
      v-if="mode === 'scheduled'"
      v-model="range"
      type="datetimerange"
      start-placeholder="开放时间"
      end-placeholder="结束时间"
    />
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">发布</el-button>
    </template>
  </el-dialog>
</template>

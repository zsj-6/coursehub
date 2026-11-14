<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { activitiesApi } from '@/api/activities'
import type { ActivityBrief } from '@/api/types'
import ActivityIcon from '@/components/ActivityIcon.vue'
import { useCourseStore } from '@/stores/course'
import { STATUS_LABEL, STATUS_TAG, TYPE_LABEL, fmt, fmtScore, publishState } from '@/utils/format'

/** 作业列表 / 测试列表。 */
const props = defineProps<{ type: 'homework' | 'exam' }>()
const cs = useCourseStore()
const items = ref<ActivityBrief[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    items.value = await activitiesApi.list(cs.course!.id, props.type)
  } finally {
    loading.value = false
  }
})

const link = (a: ActivityBrief) => `/courses/${a.course_id}/activities/${a.id}`
</script>

<template>
  <div>
    <div class="page-title">
      <span>{{ TYPE_LABEL[type] }}</span>
      <span class="muted">在「课程内容」中新增{{ TYPE_LABEL[type] }}</span>
    </div>
    <section class="card">
      <el-table v-loading="loading" :data="items" :empty-text="`暂无${TYPE_LABEL[type]}`" @row-click="(r: any) => $router.push(link(r))">
        <el-table-column label="名称" min-width="220">
          <template #default="{ row }">
            <div class="flex">
              <ActivityIcon :type="row.type" :size="24" />
              <router-link :to="link(row as ActivityBrief)">{{ row.title }}</router-link>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="type === 'exam' ? '作答时间' : '截止时间'" min-width="160">
          <template #default="{ row }">
            <template v-if="type === 'exam'">{{ row.start_at ? fmt(row.start_at, 'MM-DD HH:mm') : '—' }} ~ {{ row.due_at ? fmt(row.due_at, 'MM-DD HH:mm') : '—' }}</template>
            <template v-else>{{ fmt(row.due_at) }}</template>
          </template>
        </el-table-column>
        <el-table-column label="成绩占比" width="90"><template #default="{ row }">{{ row.score_ratio }}%</template></el-table-column>

        <template v-if="cs.isStudent">
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="STATUS_TAG[row.my_status as keyof typeof STATUS_TAG]">{{ STATUS_LABEL[row.my_status as keyof typeof STATUS_LABEL] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="得分" width="100">
            <template #default="{ row }">{{ fmtScore(row.my_score) }} / {{ row.full_score }}</template>
          </el-table-column>
        </template>
        <template v-else>
          <el-table-column label="发布" width="130">
            <template #default="{ row }"><el-tag size="small" :type="publishState(row as ActivityBrief).type">{{ publishState(row as ActivityBrief).text }}</el-tag></template>
          </el-table-column>
          <el-table-column label="提交" width="200">
            <template #default="{ row }">
              <span>{{ row.submitted_count }} / {{ row.student_count }}</span>
              <el-tag v-if="row.pending_count" size="small" type="warning" style="margin-left: 8px">{{ row.pending_count }} 待批改</el-tag>
            </template>
          </el-table-column>
        </template>
      </el-table>
    </section>
  </div>
</template>

<style scoped>
:deep(.el-table__row) {
  cursor: pointer;
}
</style>

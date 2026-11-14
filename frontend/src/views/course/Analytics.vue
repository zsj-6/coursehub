<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { communityApi, type Analytics } from '@/api/community'
import ActivityIcon from '@/components/ActivityIcon.vue'
import { useCourseStore } from '@/stores/course'
import { TYPE_LABEL } from '@/utils/format'

const cs = useCourseStore()
const data = ref<Analytics | null>(null)
const loading = ref(false)
const q = ref('')
const sortBy = ref<'no' | 'rate_desc' | 'rate_asc'>('no')

onMounted(async () => {
  loading.value = true
  try {
    data.value = await communityApi.analytics(cs.course!.id)
  } finally {
    loading.value = false
  }
})

const rows = computed(() => {
  const list = (data.value?.rows ?? []).filter((r) => !q.value || r.user.name.includes(q.value) || (r.user.student_no || '').includes(q.value))
  if (sortBy.value === 'rate_desc') return [...list].sort((a, b) => b.rate - a.rate)
  if (sortBy.value === 'rate_asc') return [...list].sort((a, b) => a.rate - b.rate)
  return list
})
const videos = computed(() => data.value?.activities.filter((a) => a.type === 'video') ?? [])
const rateColor = (v: number) => (v >= 80 ? '#3bb4b8' : v >= 50 ? '#f6903d' : '#e8684a')
</script>

<template>
  <div v-loading="loading">
    <div class="page-title">
      <span>学习分析</span>
      <span class="muted">完成规则按「课程设置 → 完成指标」动态计算</span>
    </div>
    <template v-if="data">
      <div class="summary">
        <div class="card stat"><b :style="{ color: rateColor(data.avg_rate) }">{{ data.avg_rate }}%</b><span class="muted">平均完成度</span></div>
        <div class="card stat"><b>{{ data.rows.length }}</b><span class="muted">学生</span></div>
        <div class="card stat"><b>{{ data.activities.length }}</b><span class="muted">已开放活动</span></div>
        <div class="card stat"><b>{{ data.rows.filter((r) => r.rate < 50).length }}</b><span class="muted">完成度低于 50%</span></div>
      </div>

      <section class="card">
        <h4>各活动完成率</h4>
        <div v-for="a in data.activities" :key="a.id" class="bar-row">
          <span class="bar-label"><ActivityIcon :type="a.type" :size="16" /> {{ a.title }}</span>
          <el-progress :percentage="a.done_rate" :color="rateColor(a.done_rate)" :stroke-width="10" />
        </div>
      </section>

      <section class="card">
        <div class="flex" style="margin-bottom: 12px">
          <h4 style="margin: 0">完成度明细（学生 × 活动）</h4>
          <div class="spacer" />
          <el-input v-model="q" size="small" placeholder="姓名或学号" clearable style="width: 160px" />
          <el-select v-model="sortBy" size="small" style="width: 130px">
            <el-option label="按学号" value="no" />
            <el-option label="完成度从高到低" value="rate_desc" />
            <el-option label="完成度从低到高" value="rate_asc" />
          </el-select>
        </div>
        <el-table :data="rows" size="small" border max-height="560">
          <el-table-column label="学生" fixed width="140">
            <template #default="{ row }">
              <div>{{ row.user.name }}</div>
              <div class="muted">{{ row.user.student_no }}</div>
            </template>
          </el-table-column>
          <el-table-column label="完成度" width="110" fixed>
            <template #default="{ row }">
              <b :style="{ color: rateColor(row.rate) }">{{ row.rate }}%</b>
            </template>
          </el-table-column>
          <el-table-column v-for="a in data.activities" :key="a.id" align="center" min-width="110">
            <template #header>
              <el-tooltip :content="`${TYPE_LABEL[a.type]}：${a.title}`"><span class="col-h">{{ a.title }}</span></el-tooltip>
            </template>
            <template #default="{ row }">
              <el-icon v-if="row.done.includes(a.id)" color="#3bb4b8" size="18"><CircleCheckFilled /></el-icon>
              <span v-else-if="a.type === 'video' && row.video_percent[a.id]" class="muted">{{ row.video_percent[a.id] }}%</span>
              <span v-else class="dash">—</span>
            </template>
          </el-table-column>
        </el-table>
        <div class="muted" style="margin-top: 8px">✔ 已完成；视频未完成时显示累计观看百分比。</div>
      </section>

      <section v-if="videos.length" class="card">
        <h4>视频观看进度</h4>
        <el-table :data="rows" size="small" max-height="400">
          <el-table-column label="学生" prop="user.name" width="140" />
          <el-table-column v-for="v in videos" :key="v.id" :label="v.title" min-width="200">
            <template #default="{ row }">
              <el-progress :percentage="row.video_percent[v.id] || 0" :stroke-width="8" />
            </template>
          </el-table-column>
        </el-table>
      </section>
    </template>
  </div>
</template>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.stat b {
  font-size: 24px;
}
section.card {
  margin-bottom: 12px;
}
h4 {
  margin: 0 0 12px;
}
.bar-row {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
}
.bar-label {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.col-h {
  display: inline-block;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
.dash {
  color: #c9d2dc;
}
@media (max-width: 760px) {
  .summary {
    grid-template-columns: repeat(2, 1fr);
  }
  .bar-row {
    grid-template-columns: 1fr;
  }
}
</style>

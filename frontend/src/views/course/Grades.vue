<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { coursesApi } from '@/api/courses'
import type { GradeTable } from '@/api/types'
import { useCourseStore } from '@/stores/course'
import { STATUS_LABEL, TYPE_LABEL, fmtScore } from '@/utils/format'

const cs = useCourseStore()
const table = ref<GradeTable | null>(null)
const loading = ref(false)
const q = ref('')

async function load() {
  loading.value = true
  try {
    table.value = await coursesApi.grades(cs.course!.id)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const rows = computed(() => {
  const kw = q.value.trim()
  const all = table.value?.rows ?? []
  return kw ? all.filter((r) => r.user.name.includes(kw) || (r.user.student_no || '').includes(kw)) : all
})

const stats = computed(() => {
  const totals = (table.value?.rows ?? []).map((r) => r.total)
  if (!totals.length) return null
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length
  return { avg: avg.toFixed(1), max: Math.max(...totals), min: Math.min(...totals), pass: totals.filter((t) => t >= 60).length }
})

type Row = GradeTable['rows'][number]

async function editCell(row: Row, activityId: number | null) {
  if (!cs.canGrade) return
  const act = table.value!.activities.find((a) => a.id === activityId)
  const cur = activityId === null ? row.total_override : row.cells[String(activityId)].override
  const max = act ? act.full_score : 100
  const { value } = await ElMessageBox.prompt(
    `${row.user.name} · ${act ? act.title : '总评'}（满分 ${max}）\n留空表示撤销手动修改，恢复系统计算的成绩。`,
    '修改最终成绩',
    { inputValue: cur !== null ? String(cur) : '', inputPattern: /^(\d+(\.\d+)?)?$/, inputErrorMessage: '请输入数字' },
  )
  await coursesApi.setOverride(cs.course!.id, {
    user_id: row.user.id,
    activity_id: activityId,
    score: value === '' || value === null ? null : Number(value),
  })
  ElMessage.success('已保存')
  load()
}
</script>

<template>
  <div>
    <div class="page-title">
      <span>成绩</span>
      <div v-if="cs.canGrade" class="flex">
        <el-input v-model="q" placeholder="搜索姓名 / 学号" clearable style="width: 200px" />
        <el-button @click="coursesApi.exportGrades(cs.course!.id)"><el-icon><Download /></el-icon>&nbsp;导出 Excel</el-button>
      </div>
    </div>

    <div v-if="table && cs.canGrade" class="stats">
      <div class="card stat"><div class="muted">学生人数</div><b>{{ table.rows.length }}</b></div>
      <div class="card stat"><div class="muted">平均总评</div><b>{{ stats?.avg ?? '—' }}</b></div>
      <div class="card stat"><div class="muted">最高 / 最低</div><b>{{ stats ? `${fmtScore(stats.max)} / ${fmtScore(stats.min)}` : '—' }}</b></div>
      <div class="card stat"><div class="muted">及格（≥60）</div><b>{{ stats?.pass ?? '—' }}</b></div>
      <div class="card stat" :class="{ warn: table.ratio_sum !== 100 }">
        <div class="muted">成绩占比合计</div><b>{{ table.ratio_sum }}%</b>
      </div>
    </div>

    <section v-loading="loading" class="card">
      <el-alert
        v-if="table && cs.canGrade && table.ratio_sum !== 100"
        type="warning"
        :closable="false"
        show-icon
        :title="`各活动成绩占比合计为 ${table.ratio_sum}%，不是 100%，总评满分会相应变化。可在活动的编辑页调整占比。`"
        style="margin-bottom: 12px"
      />
      <el-table v-if="table" :data="rows" border stripe size="small" max-height="65vh" empty-text="暂无学生">
        <el-table-column label="学号" width="110" fixed><template #default="{ row }">{{ row.user.student_no || '—' }}</template></el-table-column>
        <el-table-column label="姓名" width="90" fixed><template #default="{ row }">{{ row.user.name }}</template></el-table-column>
        <el-table-column v-for="a in table.activities" :key="a.id" min-width="130" align="center">
          <template #header>
            <div class="th">
              <router-link :to="`/courses/${cs.course!.id}/activities/${a.id}`" :title="a.title">{{ a.title }}</router-link>
              <div class="muted">{{ TYPE_LABEL[a.type] }} · {{ a.full_score }}分 · {{ a.score_ratio }}%</div>
            </div>
          </template>
          <template #default="{ row }">
            <span
              class="cell"
              :class="{ editable: cs.canGrade, over: row.cells[a.id].override !== null }"
              :title="row.cells[a.id].override !== null ? `系统计算 ${fmtScore(row.cells[a.id].raw)}，已手动修改` : STATUS_LABEL[row.cells[a.id].status as keyof typeof STATUS_LABEL]"
              @click="editCell(row as Row, a.id)"
            >
              <template v-if="row.cells[a.id].final !== null">{{ fmtScore(row.cells[a.id].final) }}</template>
              <span v-else class="muted">{{ STATUS_LABEL[row.cells[a.id].status as keyof typeof STATUS_LABEL] }}</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="总评" width="100" align="center" fixed="right">
          <template #default="{ row }">
            <b
              class="cell"
              :class="{ editable: cs.canGrade, over: row.total_override !== null }"
              :title="row.total_override !== null ? `系统计算 ${fmtScore(row.total_calc)}，已手动修改` : ''"
              @click="editCell(row as Row, null)"
            >
              {{ fmtScore(row.total) }}
            </b>
          </template>
        </el-table-column>
      </el-table>
      <div class="muted" style="margin-top: 8px">
        总评 = Σ（活动得分 ÷ 满分 × 成绩占比），未交按 0 分计。
        <template v-if="cs.canGrade">点击任意成绩可手动修改，<span class="over-legend">橙色</span>表示已手动修改。</template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.stat b {
  font-size: 20px;
  display: block;
  margin-top: 4px;
}
.stat.warn b {
  color: var(--el-color-warning);
}
.th {
  line-height: 1.4;
  white-space: normal;
}
.th a {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell.editable {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}
.cell.editable:hover {
  background: var(--el-color-primary-light-9);
}
.cell.over,
.over-legend {
  color: var(--el-color-warning);
}
</style>

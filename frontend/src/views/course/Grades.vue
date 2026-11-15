<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { type ScoreRatios, coursesApi } from '@/api/courses'
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

// 成绩比例设定
const ratioVisible = ref(false)
const ratioItems = ref<ScoreRatios['items']>([])
const ratioSaving = ref(false)
const ratioTotal = computed(() => Math.round(ratioItems.value.reduce((s, a) => s + (Number(a.score_ratio) || 0), 0) * 100) / 100)
async function openRatios() {
  ratioItems.value = (await coursesApi.scoreRatios(cs.course!.id)).items.map((a) => ({ ...a }))
  ratioVisible.value = true
}
async function saveRatios() {
  if (ratioTotal.value > 100) return ElMessage.warning(`成绩占比合计 ${ratioTotal.value}%，不能超过 100%`)
  ratioSaving.value = true
  try {
    await coursesApi.setScoreRatios(cs.course!.id, Object.fromEntries(ratioItems.value.map((a) => [a.id, a.score_ratio || 0])))
    ElMessage.success('成绩比例已保存')
    ratioVisible.value = false
    load()
  } finally {
    ratioSaving.value = false
  }
}

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
        <el-button v-if="cs.isManager" @click="openRatios"><el-icon><PieChart /></el-icon>&nbsp;成绩比例设定</el-button>
        <el-button @click="coursesApi.exportGrades(cs.course!.id)"><el-icon><Download /></el-icon>&nbsp;导出 Excel</el-button>
      </div>
    </div>

    <div v-if="table && cs.canGrade" class="stat-strip">
      <div class="stat"><div class="stat-label">学生人数</div><div class="stat-value">{{ table.rows.length }}<small>人</small></div></div>
      <div class="stat is-key"><div class="stat-label">平均总评</div><div class="stat-value">{{ stats?.avg ?? '—' }}<small>分</small></div></div>
      <div class="stat"><div class="stat-label">最高 / 最低</div><div class="stat-value">{{ stats ? `${fmtScore(stats.max)} / ${fmtScore(stats.min)}` : '—' }}</div></div>
      <div class="stat"><div class="stat-label">及格（≥60）</div><div class="stat-value">{{ stats?.pass ?? '—' }}<small>人</small></div></div>
      <div class="stat" :class="{ 'is-warn': table.ratio_sum !== 100 }">
        <div class="stat-label">成绩占比合计</div>
        <div class="stat-value">{{ table.ratio_sum }}<small>%</small></div>
        <div class="stat-note">还可分配 {{ Math.max(100 - table.ratio_sum, 0) }}%</div>
      </div>
    </div>

    <section v-loading="loading" class="card">
      <el-alert
        v-if="table && cs.canGrade && table.ratio_sum !== 100"
        type="warning"
        :closable="false"
        show-icon
        :title="`各活动成绩占比合计为 ${table.ratio_sum}%，不是 100%，总评满分会相应变化。${cs.isManager ? '点右上角「成绩比例设定」统一调整。' : ''}`"
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
              <span v-if="row.cells[a.id].hidden" class="muted">成绩未公布</span>
              <template v-else-if="row.cells[a.id].final !== null">{{ fmtScore(row.cells[a.id].final) }}</template>
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

    <el-dialog v-model="ratioVisible" title="成绩比例设定" width="560px">
      <div class="muted" style="margin-bottom: 12px">原始成绩 = Σ（各项成绩 ÷ 满分 × 成绩比例），各项比例合计不能超过 100%。</div>
      <el-table :data="ratioItems" size="small" max-height="50vh" empty-text="还没有作业或测试">
        <el-table-column label="活动" min-width="200">
          <template #default="{ row }">
            {{ row.title }}
            <el-tag v-if="!row.is_published" size="small" type="info" style="margin-left: 4px">未发布</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="70"><template #default="{ row }">{{ TYPE_LABEL[row.type as keyof typeof TYPE_LABEL] }}</template></el-table-column>
        <el-table-column label="成绩比例" width="170">
          <template #default="{ row }">
            <el-input-number v-model="row.score_ratio" :min="0" :max="100" :precision="1" size="small" style="width: 120px" /> %
          </template>
        </el-table-column>
      </el-table>
      <div class="ratio-sum" :class="{ over: ratioTotal > 100 }">
        当前合计 {{ ratioTotal }}%，{{ ratioTotal > 100 ? `超出 ${Math.round((ratioTotal - 100) * 100) / 100}%` : `可分配 ${Math.round((100 - ratioTotal) * 100) / 100}%` }}
      </div>
      <template #footer>
        <el-button @click="ratioVisible = false">取消</el-button>
        <el-button type="primary" :loading="ratioSaving" :disabled="ratioTotal > 100" @click="saveRatios">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
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
.ratio-sum {
  margin-top: 12px;
  font-weight: 600;
  color: var(--ch-primary-text);
}
.ratio-sum.over {
  color: var(--el-color-danger);
}
.cell.over,
.over-legend {
  color: var(--el-color-warning);
}
</style>

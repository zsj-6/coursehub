<script setup lang="ts">
/**
 * 能力单元 · 项目训练页签：PBL 课题的每个关卡标注"需要掌握哪些知识点"，
 * 显示团队掌握情况，并提供项目教练和提交诊断（AI 建议，不打分）。
 */
import { computed, reactive, ref } from 'vue'
import PersonAvatar from '@/components/pbl/PersonAvatar.vue'
import type { Unit } from '@/mock/ai'
import { masteryLevel, useAiStore } from '@/stores/ai'
import { usePblStore } from '@/stores/pbl'

const props = defineProps<{ unit: Unit }>()
const ai = useAiStore()
const pbl = usePblStore()

const links = computed(() => ai.projectLinksOf(props.unit.id).filter((l) => pbl.project(l.projectId)))
const pickedTeam = reactive<Record<string, string>>({})
function teamOf(pid: string) {
  if (ai.isStudent) return pbl.myTeam(pid)
  const teams = pbl.teamsOf(pid)
  return teams.find((t) => t.id === pickedTeam[pid]) ?? teams[0]
}
const MS_LABEL = { done: '已完成', current: '进行中', upcoming: '未开始' } as const

// ---------- 提交诊断（演示）
const diagText = ref('')
const diagResult = ref<{ ok: string[]; miss: string[]; tips: string[] } | null>(null)
const diagLoading = ref(false)
function diagnose(nodeIds: string[]) {
  diagLoading.value = true
  diagResult.value = null
  setTimeout(() => {
    const t = diagText.value
    const ok: string[] = []
    const miss: string[] = []
    for (const id of nodeIds) {
      const n = ai.node(id)!
      const tokens = [n.name, ...n.name.split(/[\s·]+/)].filter((x) => x.length >= 2)
      ;(tokens.some((k) => t.toLowerCase().includes(k.toLowerCase())) ? ok : miss).push(n.name)
    }
    const tips: string[] = []
    if (t.length < 80) tips.push('篇幅偏短，方案说明建议至少写清目标、思路、关键模块、风险四部分。')
    if (!/测试|实验|验证|误差/.test(t)) tips.push('没有看到验证计划：准备怎么测、指标是多少？')
    if (!/分工|负责/.test(t)) tips.push('没有写团队分工，建议列出每人负责的模块。')
    diagResult.value = { ok, miss, tips }
    diagLoading.value = false
  }, 900)
}
</script>

<template>
  <div v-if="!links.length" class="card empty-tip">这个能力单元还没有关联项目训练课题</div>
  <div v-else class="projects">
    <section v-for="l in links" :key="l.projectId" class="card proj">
      <div class="p-head">
        <div>
          <b>{{ pbl.project(l.projectId)!.title }}</b>
          <span class="muted">{{ pbl.data.programs.find((g) => g.id === pbl.project(l.projectId)!.programId)?.title }}</span>
        </div>
        <div class="spacer" />
        <el-select v-if="!ai.isStudent && pbl.teamsOf(l.projectId).length" v-model="pickedTeam[l.projectId]" :placeholder="teamOf(l.projectId)?.name" size="small" style="width: 140px">
          <el-option v-for="t in pbl.teamsOf(l.projectId)" :key="t.id" :value="t.id" :label="t.name" />
        </el-select>
        <router-link :to="`/pbl/projects/${l.projectId}`"><el-button size="small">打开课题</el-button></router-link>
        <el-button
          v-if="ai.isStudent && teamOf(l.projectId)"
          size="small"
          type="primary"
          :icon="'ChatDotRound'"
          @click="ai.openTutor({ unitId: unit.id, projectId: l.projectId, teamId: teamOf(l.projectId)?.id }, '我们现在该做什么？')"
        >
          问项目教练
        </el-button>
      </div>

      <div v-if="teamOf(l.projectId)" class="team">
        <span class="muted">{{ ai.isStudent ? '我的团队' : '查看团队' }}</span>
        <b>{{ teamOf(l.projectId)!.name }}</b>
        <PersonAvatar v-for="sid in teamOf(l.projectId)!.memberIds" :id="sid" :key="sid" :size="22" />
      </div>
      <div v-else class="muted team">{{ ai.isStudent ? '你还没有加入这个课题的团队' : '这个课题还没有团队' }}</div>

      <table class="ms">
        <thead>
          <tr>
            <th>课题关卡</th>
            <th>状态</th>
            <th>本关需要的知识点 · 团队已掌握人数</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ms in pbl.project(l.projectId)!.milestones" :key="ms.id" :class="pbl.milestoneState(ms)">
            <td>{{ ms.title }}</td>
            <td><span class="st">{{ MS_LABEL[pbl.milestoneState(ms)] }}</span></td>
            <td>
              <div class="need">
                <template v-if="l.milestoneNodes[ms.id]">
                  <span v-for="id in l.milestoneNodes[ms.id]" :key="id" class="nchip">
                    {{ ai.node(id)?.name }}
                    <template v-if="teamOf(l.projectId)">
                      <b
                        :class="
                          masteryLevel(
                            (teamOf(l.projectId)!.memberIds.filter((s) => (ai.classMastery(id, s) ?? 0) >= 80).length / teamOf(l.projectId)!.memberIds.length) * 100,
                          )
                        "
                      >
                        {{ teamOf(l.projectId)!.memberIds.filter((s) => (ai.classMastery(id, s) ?? 0) >= 80).length }}/{{ teamOf(l.projectId)!.memberIds.length }}
                      </b>
                    </template>
                  </span>
                </template>
                <span v-else class="muted">—</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="ai.isStudent" class="card diag">
      <h3 class="card-title">提交诊断 <el-tag size="small" type="warning">AI 建议，不打分</el-tag></h3>
      <p class="muted">正式提交给指导教师前，先把方案说明贴进来，AI 按本关需要的知识点和任务要求帮你自查。</p>
      <el-input v-model="diagText" type="textarea" :rows="4" placeholder="例如：我们的自瞄方案先做相机标定，用 PnP 解算装甲板位姿……" />
      <div class="diag-actions">
        <el-button type="primary" :loading="diagLoading" :disabled="!diagText.trim()" @click="diagnose(links[0].milestoneNodes['p1-ms3'] ?? [])">诊断（原型实现关）</el-button>
      </div>
      <div v-if="diagResult" class="diag-result">
        <div v-if="diagResult.ok.length"><b class="good">已覆盖</b>{{ diagResult.ok.join('、') }}</div>
        <div v-if="diagResult.miss.length"><b class="warn">没有提到</b>{{ diagResult.miss.join('、') }} —— 本关需要用到，建议补充对应的设计</div>
        <div v-for="t in diagResult.tips" :key="t"><b class="warn">建议</b>{{ t }}</div>
        <div v-if="!diagResult.miss.length && !diagResult.tips.length"><b class="good">很完整</b>可以提交给指导教师了</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.projects {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.p-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.p-head b {
  font-size: 15px;
  margin-right: 8px;
}
.team {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 13px;
}
.ms {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.ms th {
  text-align: left;
  font-weight: 500;
  color: var(--ch-text-2);
  background: #fafafb;
  padding: 8px 10px;
  border-bottom: 1px solid var(--ch-border-light);
}
.ms td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--ch-border-light);
  vertical-align: middle;
}
.ms tr.current td {
  background: var(--ch-primary-bg);
}
.ms tr.current .st {
  color: var(--ch-primary-text);
  font-weight: 600;
}
.ms tr.done .st {
  color: var(--ch-text-3);
}
.need {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.nchip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 4px;
  background: #fff;
  border: 1px solid var(--ch-border);
}
.nchip b {
  font-weight: 600;
}
.nchip b.weak,
.nchip b.none {
  color: var(--ch-warning);
}
.nchip b.good {
  color: var(--ch-success);
}
.nchip b.mid {
  color: var(--ch-primary-text);
}
.diag p {
  margin: 0 0 10px;
}
.diag-actions {
  margin-top: 10px;
}
.diag-result {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  padding: 10px 12px;
  background: var(--ch-fill);
  border-radius: 6px;
}
.diag-result b {
  margin-right: 8px;
}
.good {
  color: var(--ch-success);
}
.warn {
  color: var(--ch-warning);
}
</style>

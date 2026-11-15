<script setup lang="ts">
/**
 * 能力单元 · 闯关页签
 * 学生：闯关地图（每关 = 一组知识点），只有"未解锁 / 进行中 / 已通过"三种状态，不做星级和排行榜
 * 教师：分层视图——每关学生在三条路径上的分布、卡在哪个知识点
 */
import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import { LEVEL_PATH_META, type Level, type QLevel, type Unit } from '@/mock/ai'
import { MASTERY_LABEL, masteryLevel, useAiStore, type LevelState } from '@/stores/ai'

const props = defineProps<{ unit: Unit }>()
const ai = useAiStore()
const levels = computed(() => ai.levelsOf(props.unit.id))

const STATE_META: Record<LevelState, { label: string; type: 'success' | 'primary' | 'info' }> = {
  passed: { label: '已通过', type: 'success' },
  open: { label: '进行中', type: 'primary' },
  locked: { label: '未解锁', type: 'info' },
  building: { label: '建设中', type: 'info' },
}

function classDist(l: Level) {
  const c: Record<QLevel | 'none', string[]> = { basic: [], standard: [], challenge: [], none: [] }
  for (const p of ai.roster) c[ai.classPathOf(l, p.id)].push(p.name)
  return c
}
function stuck(l: Level) {
  return [...l.nodeIds].sort((a, b) => (ai.classAvg(a) ?? 0) - (ai.classAvg(b) ?? 0))[0]
}
function pull(l: Level) {
  const n = classDist(l).basic.length
  ai.push(`pull-${l.id}`)
  ElMessage.success(`已为补基础路径的 ${n} 名同学创建讨论帖，并推送「${ai.node(stuck(l))?.name}」的补充资料`)
}
</script>

<template>
  <div>
    <p class="intro muted">
      每一关对应图谱上的一组知识点。进关先做诊断，按结果分到<b>补基础 / 标准 / 挑战</b>三条路径；三条路径的<b>过关标准一样</b>。闯关只更新掌握度，不进成绩、不算学分。
    </p>

    <div v-if="!levels.length" class="card empty-tip">这个能力还没有设置关卡</div>

    <!-- 学生：闯关地图 -->
    <div v-if="ai.isStudent" class="map">
      <div v-for="(l, i) in levels" :key="l.id" class="lv card" :class="ai.levelState(l)">
        <div class="lv-no">第 {{ l.order }} 关</div>
        <div class="lv-main">
          <div class="lv-title">
            <b>{{ l.title }}</b>
            <el-tag size="small" :type="STATE_META[ai.levelState(l)].type">{{ STATE_META[ai.levelState(l)].label }}</el-tag>
            <el-tag v-if="ai.pathOf(l.id)" size="small" type="info">上次：{{ LEVEL_PATH_META[ai.pathOf(l.id)!].label }}</el-tag>
          </div>
          <div class="lv-nodes">
            <span v-for="id in l.nodeIds" :key="id" class="nchip" :class="masteryLevel(ai.mastery(id))">
              {{ ai.node(id)?.name }} · {{ MASTERY_LABEL[masteryLevel(ai.mastery(id))] }}
            </span>
          </div>
        </div>
        <router-link v-if="ai.levelState(l) === 'open' || ai.levelState(l) === 'passed'" :to="`/units/${unit.id}/levels/${l.id}`">
          <el-button :type="ai.levelState(l) === 'open' ? 'primary' : 'default'">{{ ai.levelState(l) === 'open' ? '进入本关' : '再练一次' }}</el-button>
        </router-link>
        <el-button v-else disabled>{{ ai.levelState(l) === 'locked' ? `先通过第 ${l.order - 1} 关` : '题目建设中' }}</el-button>
        <span v-if="i < levels.length - 1" class="link-line" />
      </div>
    </div>

    <!-- 教师：分层视图 -->
    <div v-else class="teacher">
      <section v-for="l in levels.filter((x) => x.diagnose.length)" :key="l.id" class="card tl">
        <div class="tl-head">
          <b>第 {{ l.order }} 关 · {{ l.title }}</b>
          <span class="muted">{{ l.nodeIds.map((id) => ai.node(id)?.name).join('、') }}</span>
          <div class="spacer" />
          <span class="muted">卡点：<b class="warn">{{ ai.node(stuck(l))?.name }}</b>（班级平均 {{ ai.classAvg(stuck(l)) }}%）</span>
        </div>
        <div class="dist">
          <div v-for="k in (['basic', 'standard', 'challenge'] as const)" :key="k" class="d-col">
            <div class="d-label">
              {{ LEVEL_PATH_META[k].label }} <b>{{ classDist(l)[k].length }}</b> 人
            </div>
            <div class="d-bar"><div :class="k" :style="{ width: `${(classDist(l)[k].length / ai.roster.length) * 100}%` }" /></div>
            <div class="d-names">{{ classDist(l)[k].slice(0, 8).join('、') }}{{ classDist(l)[k].length > 8 ? ' 等' : '' }}</div>
          </div>
        </div>
        <div class="tl-actions">
          <el-button size="small" :disabled="ai.state.pushed.includes(`pull-${l.id}`)" @click="pull(l)">
            {{ ai.state.pushed.includes(`pull-${l.id}`) ? '已推送' : '把补基础的同学拉进讨论帖，并推送补充资料' }}
          </el-button>
          <span class="muted">分流按每个学生在本关知识点上的平均掌握度推算（≥85% 挑战，≥60% 标准，其余补基础）</span>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.intro {
  margin: 0 0 16px;
  line-height: 1.7;
}
.intro b {
  color: var(--ch-text);
  font-weight: 500;
}
.map {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 920px;
}
.lv {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
}
.lv.locked,
.lv.building {
  background: var(--ch-fill);
}
.lv.open {
  border-color: var(--ch-primary);
}
.lv-no {
  flex: none;
  width: 64px;
  font-size: 13px;
  color: var(--ch-text-2);
  font-weight: 500;
}
.lv-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lv-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.lv-title b {
  font-size: 15px;
}
.lv-nodes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.nchip {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 4px;
  background: var(--ch-fill);
  color: var(--ch-text-2);
}
.nchip.weak {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}
.nchip.good {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success-dark-2);
}
.nchip.mid {
  background: var(--ch-primary-bg);
  color: var(--ch-primary-text);
}
.link-line {
  position: absolute;
  left: 51px;
  bottom: -15px;
  width: 2px;
  height: 14px;
  background: var(--ch-border);
}
.teacher {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tl-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.warn {
  color: var(--ch-warning);
}
.dist {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.d-label {
  font-size: 13px;
  color: var(--ch-text-2);
}
.d-label b {
  font-size: 18px;
  color: var(--ch-text);
  margin: 0 2px;
}
.d-bar {
  height: 8px;
  border-radius: 4px;
  background: var(--el-fill-color);
  margin: 6px 0;
  overflow: hidden;
}
.d-bar div {
  height: 100%;
  border-radius: 4px;
}
.d-bar .basic {
  background: var(--ch-warning);
}
.d-bar .standard {
  background: var(--ch-primary);
}
.d-bar .challenge {
  background: var(--ch-success);
}
.d-names {
  font-size: 12px;
  color: var(--ch-text-3);
  line-height: 1.6;
}
.tl-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  flex-wrap: wrap;
}
</style>

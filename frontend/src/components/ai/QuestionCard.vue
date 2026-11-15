<script setup lang="ts">
/**
 * 单选题卡片。
 * - test：测验 / 过关检测，不给提示；
 * - practice：练习，提供提示阶梯（方向 → 思路 → 关键步骤），完整讲解只在作答后开放。
 */
import { computed, ref } from 'vue'
import type { Question } from '@/mock/ai'
import { partLabel, useAiStore } from '@/stores/ai'

const props = defineProps<{ q: Question; mode: 'test' | 'practice'; revealed: boolean; index?: number; unitId?: string }>()
const model = defineModel<number | null>({ default: null })
const ai = useAiStore()
const hintLv = ref(0)
const HINT_NAMES = ['方向', '思路', '关键步骤']

const node = computed(() => ai.node(props.q.nodeId))
const refInfo = computed(() => {
  if (!props.q.ref) return null
  const r = ai.resource(props.q.ref.resId)
  const p = r && ai.partsOf(r).find((x) => x.id === props.q.ref!.partId)
  return r && p ? { to: `/units/${r.unitId}/read/${r.id}?part=${p.id}`, label: `${r.title} · ${partLabel(p)}` } : null
})
function optClass(i: number) {
  if (!props.revealed) return { on: model.value === i }
  return { right: i === props.q.answer, wrong: model.value === i && i !== props.q.answer }
}
function askTutor() {
  ai.openTutor({ unitId: props.unitId, nodeId: props.q.nodeId, inTest: false }, `这道题我卡住了：${props.q.stem}`)
}
</script>

<template>
  <div class="qc" :class="{ done: revealed }">
    <div class="stem">
      <span v-if="index !== undefined" class="no">{{ index + 1 }}</span>
      <span>{{ q.stem }}</span>
    </div>
    <div class="meta">
      <el-tag size="small" type="info">{{ node?.name }}</el-tag>
      <el-tag v-if="q.ai" size="small" type="warning">AI 变式</el-tag>
    </div>
    <div class="opts">
      <button v-for="(o, i) in q.options" :key="i" class="opt" :class="optClass(i)" :disabled="revealed" @click="model = i">
        <span class="key">{{ 'ABCD'[i] }}</span>{{ o }}
      </button>
    </div>

    <div v-if="mode === 'practice' && !revealed" class="ladder">
      <div v-for="i in hintLv" :key="i" class="hint">
        <b>提示 {{ i }} · {{ HINT_NAMES[i - 1] }}</b>{{ q.hints[i - 1] }}
      </div>
      <div class="ladder-actions">
        <el-button v-if="hintLv < 3" size="small" @click="hintLv++">要个提示（{{ HINT_NAMES[hintLv] }}）</el-button>
        <span v-else class="muted">完整讲解在作答后开放</span>
        <el-button size="small" text type="primary" :icon="'ChatDotRound'" @click="askTutor">问 AI 辅学</el-button>
      </div>
    </div>

    <div v-if="revealed" class="explain">
      <div :class="model === q.answer ? 'ok' : 'bad'">
        {{ model === q.answer ? '回答正确' : `回答错误，正确答案是 ${'ABCD'[q.answer]}` }}
      </div>
      <div class="exp-text">{{ q.explain }}</div>
      <router-link v-if="refInfo" :to="refInfo.to" class="ref"><el-icon><Link /></el-icon>出处：{{ refInfo.label }}</router-link>
    </div>
  </div>
</template>

<style scoped>
.qc {
  padding: 16px 0;
  border-bottom: 1px solid var(--ch-border-light);
}
.qc:last-child {
  border-bottom: none;
}
.stem {
  display: flex;
  gap: 8px;
  font-size: 14.5px;
  line-height: 1.7;
  font-weight: 500;
}
.no {
  flex: none;
  width: 22px;
  height: 22px;
  margin-top: 2px;
  border-radius: 50%;
  background: var(--ch-fill);
  color: var(--ch-text-2);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.meta {
  display: flex;
  gap: 6px;
  margin: 6px 0 10px 30px;
}
.opts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-left: 30px;
}
.opt {
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  padding: 8px 12px;
  border: 1px solid var(--ch-border);
  border-radius: 6px;
  background: #fff;
  color: var(--ch-text);
  font-size: 14px;
  cursor: pointer;
}
.opt:hover:not(:disabled) {
  border-color: var(--ch-primary);
}
.opt:disabled {
  cursor: default;
}
.opt.on {
  border-color: var(--ch-primary);
  background: var(--ch-primary-bg);
}
.opt.right {
  border-color: var(--ch-success);
  background: var(--el-color-success-light-9);
}
.opt.wrong {
  border-color: var(--ch-danger);
  background: var(--el-color-danger-light-9);
}
.key {
  flex: none;
  width: 20px;
  color: var(--ch-text-3);
  font-weight: 600;
}
.ladder,
.explain {
  margin: 12px 0 0 30px;
}
.hint {
  font-size: 13px;
  line-height: 1.6;
  padding: 8px 10px;
  background: var(--ch-fill);
  border-radius: 6px;
  margin-bottom: 6px;
}
.hint b {
  margin-right: 8px;
  color: var(--ch-primary-text);
  font-weight: 600;
}
.ladder-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.explain {
  font-size: 13px;
  line-height: 1.7;
  padding: 10px 12px;
  background: var(--ch-fill);
  border-radius: 6px;
}
.ok {
  color: var(--ch-success);
  font-weight: 600;
}
.bad {
  color: var(--ch-danger);
  font-weight: 600;
}
.exp-text {
  margin-top: 4px;
}
.ref {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 12.5px;
}
</style>

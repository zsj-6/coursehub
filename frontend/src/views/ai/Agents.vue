<script setup lang="ts">
/**
 * 智能体广场（领导版）：5 类 28 个智能体。
 * 教学助手里已有对应功能的（学情分析、课堂出题、作业批改）直接跳到 AI 助教工作台；
 * 其余智能体进入 AI 导师，用该智能体的身份开一个新会话。
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AGENT_CATS, AGENTS } from '@/mock/growth'
import { useGrowthStore } from '@/stores/growth'
import { toneVars } from '@/utils/format'

const g = useGrowthStore()
const router = useRouter()
const cat = ref('ALL')
const kw = ref('')

const CAT_ICON: Record<string, string> = { TEACHING: 'Notebook', LEARNING: 'Reading', PRACTICE: 'SetUp', RESEARCH: 'DataAnalysis', EFFICIENCY: 'Lightning' }
/** 教学助手中已经在 AI 助教工作台实现的 */
const DESK_LINK: Record<string, string> = { A_T03: 'practice', A_T04: 'errors', A_T05: 'report' }

const list = computed(() =>
  AGENTS.filter((a) => (cat.value === 'ALL' || a.cat === cat.value) && (!kw.value.trim() || `${a.name}${a.desc}${a.tags.join('')}`.includes(kw.value.trim()))),
)
const count = (c: string) => AGENTS.filter((a) => c === 'ALL' || a.cat === c).length
const catIndex = (c: string) => AGENT_CATS.findIndex((x) => x.code === c)
const usage = (id: string) => 200 + ((id.charCodeAt(2) * 131 + id.charCodeAt(4) * 17) % 2600)

function teacherOnly(cat: string) {
  return cat === 'TEACHING' && g.isStudent
}
function use(a: (typeof AGENTS)[number]) {
  if (DESK_LINK[a.id]) return router.push(`/units/desk?tab=${DESK_LINK[a.id]}`)
  router.push({ path: '/units/tutor', query: { agent: a.id } })
}
</script>

<template>
  <div>
    <h1 class="page-title">
      <span>智能体广场 <span class="sub">面向教学、学习、实践、科研和日常效率的 AI 工具</span></span>
      <el-input v-model="kw" placeholder="搜索智能体" clearable :prefix-icon="'Search'" style="width: 240px" />
    </h1>

    <el-radio-group v-model="cat" class="cats">
      <el-radio-button value="ALL">全部 {{ count('ALL') }}</el-radio-button>
      <el-radio-button v-for="c in AGENT_CATS" :key="c.code" :value="c.code">{{ c.name }} {{ count(c.code) }}</el-radio-button>
    </el-radio-group>
    <p v-if="cat !== 'ALL'" class="muted cat-desc">{{ AGENT_CATS.find((c) => c.code === cat)?.desc }}</p>

    <div class="grid">
      <article v-for="a in list" :key="a.id" class="agent card">
        <div class="a-head">
          <span class="tone a-icon" :style="toneVars(catIndex(a.cat))"><el-icon><component :is="CAT_ICON[a.cat]" /></el-icon></span>
          <div class="a-title">
            <b>{{ a.name }}</b>
            <span class="muted">{{ AGENT_CATS.find((c) => c.code === a.cat)?.name }} · {{ usage(a.id) }} 次使用</span>
          </div>
        </div>
        <p class="desc">{{ a.desc }}</p>
        <div class="a-foot">
          <span v-for="t in a.tags" :key="t" class="tag">{{ t }}</span>
          <div class="spacer" />
          <el-tooltip v-if="teacherOnly(a.cat)" content="教学助手仅教师和助教可用">
            <el-button size="small" disabled>教师可用</el-button>
          </el-tooltip>
          <el-button v-else size="small" type="primary" plain @click="use(a)">{{ DESK_LINK[a.id] ? '打开' : '使用' }}</el-button>
        </div>
        <span v-if="DESK_LINK[a.id]" class="linked">已接入 AI 助教工作台</span>
      </article>
    </div>
    <div v-if="!list.length" class="card empty-tip">没有找到相关智能体</div>
  </div>
</template>

<style scoped>
.sub {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 400;
  color: var(--ch-text-3);
}
.cats {
  margin-bottom: 10px;
}
.cat-desc {
  margin: 0 0 12px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
  margin-top: 12px;
}
.agent {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px;
}
.agent:hover {
  border-color: var(--el-color-primary-light-5);
}
.a-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.a-icon {
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.a-title {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.a-title b {
  font-weight: 600;
}
.a-title .muted {
  font-size: 12px;
}
.desc {
  margin: 0;
  font-size: 13px;
  color: var(--ch-text-2);
  line-height: 1.6;
}
.a-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
}
.tag {
  font-size: 12px;
  padding: 0 7px;
  border-radius: 4px;
  background: var(--ch-fill);
  color: var(--ch-text-2);
}
.linked {
  position: absolute;
  top: 12px;
  right: 14px;
  font-size: 11.5px;
  color: var(--ch-primary-text);
}
</style>

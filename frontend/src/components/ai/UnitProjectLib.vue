<script setup lang="ts">
/**
 * 能力单元 · 项目训练 · 项目库（领导版）：竞赛 / 大创 / 实践 / 科研 4 类，
 * 搜索、状态筛选、详情、申请加入 → 项目负责人（教师）或助教审核 → 站内消息。
 * 机甲大师的 PBL 课题（大项目 → 课题 → 关卡 → 组队）在上方单独展示。
 */
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import PersonAvatar from '@/components/pbl/PersonAvatar.vue'
import { PRJ_CATS } from '@/mock/growth'
import type { Unit } from '@/mock/ai'
import { useGrowthStore, type LeaderProject } from '@/stores/growth'

const props = defineProps<{ unit: Unit }>()
const g = useGrowthStore()
const cat = ref('ALL')
const kw = ref('')
const all = computed(() => g.projectsOf(props.unit.id))
const list = computed(() => all.value.filter((p) => (cat.value === 'ALL' || p.catCode === cat.value) && (!kw.value.trim() || `${p.name}${p.intro}${p.publisherOrg}`.includes(kw.value.trim()))))
const count = (c: string) => all.value.filter((p) => c === 'ALL' || p.catCode === c).length
const catName = (c: string) => PRJ_CATS.find((x) => x.code === c)?.name ?? c

const APP: Record<string, { label: string; type: 'warning' | 'success' | 'danger' }> = {
  pending: { label: '申请审核中', type: 'warning' },
  approved: { label: '已加入', type: 'success' },
  rejected: { label: '未通过', type: 'danger' },
}
const STATUS: Record<string, string> = { RECRUITING: '招募中', ONGOING: '进行中', ENDED: '已结束', CLOSED: '已截止' }

const detail = ref<LeaderProject | null>(null)
const applying = ref<LeaderProject | null>(null)
const note = ref('')
function submitApply() {
  if (!applying.value) return
  if (!note.value.trim()) return ElMessage.warning('简单写一下你的相关经历和想法')
  g.apply(applying.value.id, applying.value.name, note.value.trim())
  ElMessage.success('申请已提交，等待项目负责人审核')
  applying.value = null
  note.value = ''
}
function review(p: LeaderProject, sid: string, ok: boolean) {
  g.reviewApplication(p.id, sid, ok ? 'approved' : 'rejected', p.name)
  ElMessage.success(ok ? '已通过，已通知学生' : '已驳回')
}
</script>

<template>
  <section class="lib">
    <div class="lib-head">
      <h3 class="card-title">项目库 <span class="muted">竞赛、大创、实践、科研项目，可申请加入</span></h3>
      <div class="spacer" />
      <el-input v-model="kw" size="small" placeholder="搜索项目" clearable :prefix-icon="'Search'" style="width: 200px" />
    </div>
    <el-radio-group v-model="cat" size="small" class="cats">
      <el-radio-button value="ALL">全部 {{ count('ALL') }}</el-radio-button>
      <el-radio-button v-for="c in PRJ_CATS" :key="c.code" :value="c.code">{{ c.name }} {{ count(c.code) }}</el-radio-button>
    </el-radio-group>
    <p v-if="cat !== 'ALL'" class="muted cat-desc">{{ PRJ_CATS.find((c) => c.code === cat)?.desc }}</p>

    <div v-if="!list.length" class="card empty-tip">这个能力暂时没有相关项目</div>
    <div class="list">
      <article v-for="p in list" :key="p.id" class="card item">
        <div class="i-head">
          <el-tag size="small" type="info">{{ catName(p.catCode) }}</el-tag>
          <el-tag size="small">{{ STATUS[p.status] ?? p.status }}</el-tag>
          <div class="spacer" />
          <el-tag v-if="g.applicationOf(p.id)" size="small" :type="APP[g.applicationOf(p.id)!.status].type">{{ APP[g.applicationOf(p.id)!.status].label }}</el-tag>
        </div>
        <b class="title" @click="detail = p">{{ p.name }}</b>
        <p class="muted">{{ p.intro }}</p>
        <div class="muted meta">{{ p.publisher }} · {{ p.publisherOrg }} · {{ p.startTime }} ~ {{ p.endTime }}</div>
        <div class="i-foot">
          <span class="muted">报名截止 {{ p.deadline }}</span>
          <div class="spacer" />
          <el-tag v-if="g.canReview && g.applicationsOf(p.id).some((a) => a.status === 'pending')" size="small" type="warning">
            {{ g.applicationsOf(p.id).filter((a) => a.status === 'pending').length }} 人待审核
          </el-tag>
          <el-button size="small" @click="detail = p">详情</el-button>
          <el-button v-if="g.isStudent && !g.applicationOf(p.id) && p.status === 'RECRUITING'" size="small" type="primary" @click="applying = p">申请加入</el-button>
        </div>
      </article>
    </div>

    <el-dialog :model-value="!!detail" :title="detail?.name" width="680px" @close="detail = null">
      <template v-if="detail">
        <p>{{ detail.intro }}</p>
        <div class="cols">
          <div><h4>项目目标</h4><ul><li v-for="x in detail.goals" :key="x">{{ x }}</li></ul></div>
          <div><h4>参与要求</h4><ul><li v-for="x in detail.requirements" :key="x">{{ x }}</li></ul></div>
          <div><h4>可获得</h4><ul><li v-for="x in detail.outcomes" :key="x">{{ x }}</li></ul></div>
          <div><h4>支持资源</h4><ul><li v-for="x in detail.resources" :key="x">{{ x }}</li></ul></div>
        </div>
        <h4>进度安排</h4>
        <el-steps :active="0" align-center class="sched">
          <el-step v-for="s in detail.schedule" :key="s.t" :title="s.t" :description="s.d" />
        </el-steps>
        <h4>申请方式</h4>
        <p>{{ detail.applyWay }}（截止 {{ detail.deadline }}）</p>
        <template v-if="detail.attachments?.length">
          <h4>附件</h4>
          <div v-for="a in detail.attachments" :key="a.name" class="row"><el-icon><Document /></el-icon>{{ a.name }}<span class="muted">{{ a.size }}</span></div>
        </template>
        <template v-if="g.canReview">
          <h4>申请名单</h4>
          <div v-if="!g.applicationsOf(detail.id).length" class="muted">还没有本平台同学申请</div>
          <div v-for="a in g.applicationsOf(detail.id)" :key="a.sid" class="row">
            <PersonAvatar :id="a.sid" :size="24" />
            <b>{{ g.name(a.sid) }}</b>
            <span class="muted note">{{ a.note }}</span>
            <el-tag size="small" :type="APP[a.status].type">{{ APP[a.status].label }}</el-tag>
            <template v-if="a.status === 'pending'">
              <el-button size="small" type="primary" @click="review(detail, a.sid, true)">通过</el-button>
              <el-button size="small" @click="review(detail, a.sid, false)">驳回</el-button>
            </template>
          </div>
        </template>
      </template>
      <template #footer>
        <el-button v-if="detail && g.isStudent && !g.applicationOf(detail.id) && detail.status === 'RECRUITING'" type="primary" @click="applying = detail; detail = null">申请加入</el-button>
      </template>
    </el-dialog>

    <el-dialog :model-value="!!applying" :title="`申请加入 · ${applying?.name}`" width="480px" @close="applying = null">
      <p class="muted">{{ applying?.applyWay }}</p>
      <el-input v-model="note" type="textarea" :rows="4" placeholder="简单介绍你的相关经历、能投入的时间，以及想在项目里做什么" />
      <template #footer>
        <el-button @click="applying = null">取消</el-button>
        <el-button type="primary" @click="submitApply">提交申请</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.lib {
  margin-top: 20px;
}
.lib-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.lib-head .card-title {
  margin: 0;
}
.card-title .muted {
  margin-left: 6px;
  font-weight: 400;
  font-size: 12px;
}
.cats {
  margin: 10px 0;
}
.cat-desc {
  margin: 0 0 10px;
}
.list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 14px;
}
.item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
}
.i-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.title {
  font-size: 15px;
  cursor: pointer;
}
.title:hover {
  color: var(--ch-primary-text);
}
.item p {
  margin: 0;
  font-size: 13px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.meta {
  font-size: 12px;
}
.i-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--ch-border-light);
  font-size: 12.5px;
}
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 20px;
}
.cols ul {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.8;
}
.sched {
  margin: 8px 0 12px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-top: 1px solid var(--ch-border-light);
  font-size: 13px;
}
.note {
  flex: 1;
  min-width: 0;
}
</style>

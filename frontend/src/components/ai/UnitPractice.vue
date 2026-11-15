<script setup lang="ts">
/**
 * 能力单元 · 线下活动（领导版）
 *  A. 小组讨论：列表 / 详情 / 报名 → 创建者（教师）或助教审核 → 站内消息通知
 *  B. 活动讲座：免报名直播或预约报名、讲义、回放
 */
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import PersonAvatar from '@/components/pbl/PersonAvatar.vue'
import type { Unit } from '@/mock/ai'
import { useGrowthStore, type Discussion, type Lecture } from '@/stores/growth'

const props = defineProps<{ unit: Unit }>()
const g = useGrowthStore()
const sub = ref<'discussion' | 'lecture'>('discussion')
const discussions = computed(() => g.discussionsOf(props.unit.id))
const lectures = computed(() => g.lecturesOf(props.unit.id))

const SIGN: Record<string, { label: string; type: 'warning' | 'success' | 'danger' }> = {
  pending: { label: '待审核', type: 'warning' },
  approved: { label: '报名成功', type: 'success' },
  rejected: { label: '未通过', type: 'danger' },
}
const fmt = (t: string) => dayjs(t).format('MM-DD HH:mm')
const signedCount = (d: Discussion) => d.signed + g.signupsOf(d.id).filter((x) => x.status !== 'rejected').length

const disc = ref<Discussion | null>(null)
const lec = ref<Lecture | null>(null)
function signup(d: Discussion) {
  if (signedCount(d) >= d.capacity) return ElMessage.warning('名额已满')
  g.signup(d.id, d.topic)
  ElMessage.success('报名已提交，等待审核')
}
function review(d: Discussion, sid: string, ok: boolean) {
  g.reviewSignup(d.id, sid, ok ? 'approved' : 'rejected', d.topic)
  ElMessage.success(ok ? '已通过，已通知学生' : '已驳回')
}
const LEC_STATUS: Record<string, string> = { UPCOMING: '未开始', LIVE: '直播中', ENDED: '已结束' }
function enter(l: Lecture) {
  ElMessage.info(l.status === 'ENDED' ? '原型阶段不提供回放视频' : '原型阶段不提供直播，正式版会跳转到直播间')
}
</script>

<template>
  <div>
    <el-radio-group v-model="sub" class="subs">
      <el-radio-button value="discussion">小组讨论 {{ discussions.length }}</el-radio-button>
      <el-radio-button value="lecture">活动讲座 {{ lectures.length }}</el-radio-button>
    </el-radio-group>

    <template v-if="sub === 'discussion'">
      <div v-if="!discussions.length" class="card empty-tip">这个能力暂时没有小组讨论</div>
      <div class="list">
        <article v-for="d in discussions" :key="d.id" class="card item">
          <div class="i-head">
            <el-tag size="small" :type="d.mode === 'OFFLINE' ? 'info' : 'primary'">{{ d.mode === 'OFFLINE' ? '线下' : '线上' }}</el-tag>
            <span class="muted">{{ fmt(d.startTime) }} – {{ dayjs(d.endTime).format('HH:mm') }}</span>
            <div class="spacer" />
            <el-tag v-if="g.signupOf(d.id)" size="small" :type="SIGN[g.signupOf(d.id)!].type">{{ SIGN[g.signupOf(d.id)!].label }}</el-tag>
          </div>
          <b class="title" @click="disc = d">{{ d.topic }}</b>
          <div class="muted">{{ d.place }}</div>
          <div class="muted">发起人 {{ d.creator.name }} · {{ d.creator.title }}</div>
          <div class="i-foot">
            <span class="cap">已报名 <b>{{ signedCount(d) }}</b>/{{ d.capacity }}</span>
            <span class="muted">报名截止 {{ fmt(d.signupEnd) }}</span>
            <div class="spacer" />
            <el-button size="small" @click="disc = d">{{ g.canReview ? '详情 / 审核' : '详情' }}</el-button>
            <template v-if="g.isStudent">
              <el-button v-if="!g.signupOf(d.id)" size="small" type="primary" @click="signup(d)">报名</el-button>
              <el-button v-else-if="g.signupOf(d.id) === 'pending'" size="small" @click="g.cancelSignup(d.id)">取消报名</el-button>
            </template>
            <el-tag v-else-if="g.signupsOf(d.id).some((x) => x.status === 'pending')" size="small" type="warning">
              {{ g.signupsOf(d.id).filter((x) => x.status === 'pending').length }} 人待审核
            </el-tag>
          </div>
        </article>
      </div>
    </template>

    <template v-else>
      <div v-if="!lectures.length" class="card empty-tip">这个能力暂时没有讲座</div>
      <div class="list">
        <article v-for="l in lectures" :key="l.id" class="card item">
          <div class="i-head">
            <el-tag size="small" :type="l.mode === 'ONLINE' ? 'primary' : 'info'">{{ l.mode === 'ONLINE' ? '线上' : '线下' }}</el-tag>
            <el-tag size="small" type="info">{{ LEC_STATUS[l.status] ?? l.status }}</el-tag>
            <span class="muted">{{ fmt(l.startTime) }}</span>
          </div>
          <b class="title" @click="lec = l">{{ l.name }}</b>
          <div class="muted">主讲 {{ l.speaker.name }} · {{ l.speaker.title }}</div>
          <div class="muted">{{ l.publisher }} · {{ l.place }}</div>
          <div class="i-foot">
            <span class="muted">{{ l.signupMode === 'FREE' ? '免报名' : `需报名${l.signupDeadline ? `，${fmt(l.signupDeadline)} 截止` : ''}` }}</span>
            <div class="spacer" />
            <el-button size="small" @click="lec = l">详情</el-button>
            <el-button size="small" type="primary" plain @click="enter(l)">{{ l.status === 'ENDED' ? '看回放' : '进入直播' }}</el-button>
          </div>
        </article>
      </div>
    </template>

    <el-dialog :model-value="!!disc" :title="disc?.topic" width="640px" @close="disc = null">
      <template v-if="disc">
        <dl class="dl">
          <dt>时间</dt><dd>{{ disc.startTime }} – {{ dayjs(disc.endTime).format('HH:mm') }}</dd>
          <dt>地点</dt><dd>{{ disc.place }}</dd>
          <dt>发起人</dt><dd>{{ disc.creator.name }} · {{ disc.creator.title }} · {{ disc.creator.org }}</dd>
          <dt>名额</dt><dd>{{ signedCount(disc) }}/{{ disc.capacity }}，报名 {{ disc.signupStart }} ~ {{ disc.signupEnd }}</dd>
          <dt>参与要求</dt><dd>{{ disc.requirements }}</dd>
          <dt>入会方式</dt><dd>{{ disc.joinWay }}</dd>
        </dl>
        <p>{{ disc.intro }}</p>
        <h4>研讨议程</h4>
        <ol class="ol"><li v-for="o in disc.outline" :key="o">{{ o }}</li></ol>
        <h4>报名须知</h4>
        <ul class="ol"><li v-for="r in disc.rules" :key="r">{{ r }}</li></ul>
        <template v-if="g.canReview">
          <h4>报名名单</h4>
          <div v-if="!g.signupsOf(disc.id).length" class="muted">还没有本平台同学报名</div>
          <div v-for="x in g.signupsOf(disc.id)" :key="x.sid" class="row">
            <PersonAvatar :id="x.sid" :size="24" />
            <span class="nm">{{ g.name(x.sid) }}</span>
            <el-tag size="small" :type="SIGN[x.status].type">{{ SIGN[x.status].label }}</el-tag>
            <div class="spacer" />
            <template v-if="x.status === 'pending'">
              <el-button size="small" type="primary" @click="review(disc, x.sid, true)">通过</el-button>
              <el-button size="small" @click="review(disc, x.sid, false)">驳回</el-button>
            </template>
          </div>
        </template>
      </template>
      <template #footer>
        <template v-if="disc && g.isStudent">
          <el-button v-if="!g.signupOf(disc.id)" type="primary" @click="signup(disc)">报名</el-button>
          <el-tag v-else :type="SIGN[g.signupOf(disc.id)!].type">{{ SIGN[g.signupOf(disc.id)!].label }}</el-tag>
        </template>
      </template>
    </el-dialog>

    <el-dialog :model-value="!!lec" :title="lec?.name" width="620px" @close="lec = null">
      <template v-if="lec">
        <dl class="dl">
          <dt>时间</dt><dd>{{ lec.startTime }} – {{ dayjs(lec.endTime).format('HH:mm') }}</dd>
          <dt>地点</dt><dd>{{ lec.place }}</dd>
          <dt>主讲人</dt><dd>{{ lec.speaker.name }} · {{ lec.speaker.title }}</dd>
          <dt>面向</dt><dd>{{ lec.audience.join('、') }}</dd>
        </dl>
        <p>{{ lec.intro }}</p>
        <p class="muted">{{ lec.speaker.bio }}</p>
        <h4>讲座提纲</h4>
        <ol class="ol"><li v-for="o in lec.outline" :key="o">{{ o }}</li></ol>
        <h4>须知</h4>
        <ul class="ol"><li v-for="n in lec.notice" :key="n">{{ n }}</li></ul>
        <h4 v-if="lec.attachments?.length">资料</h4>
        <div v-for="a in lec.attachments ?? []" :key="a.name" class="row">
          <el-icon><Document /></el-icon><span>{{ a.name }}</span><span class="muted">{{ a.size }}</span>
          <div class="spacer" />
          <el-tooltip content="原型阶段不提供附件下载"><el-button size="small" text disabled>下载</el-button></el-tooltip>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.subs {
  margin-bottom: 12px;
}
.list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 14px;
}
.item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
}
.item .muted {
  font-size: 12.5px;
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
.i-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--ch-border-light);
  font-size: 12.5px;
}
.cap b {
  color: var(--ch-primary-text);
}
.dl {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 6px 12px;
  font-size: 13.5px;
  margin: 0 0 10px;
}
.dl dt {
  color: var(--ch-text-2);
}
.dl dd {
  margin: 0;
}
.ol {
  margin: 0;
  padding-left: 20px;
  font-size: 13.5px;
  line-height: 1.8;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-top: 1px solid var(--ch-border-light);
  font-size: 13px;
}
.nm {
  font-weight: 500;
}
</style>

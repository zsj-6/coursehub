<script setup lang="ts">
import { computed, ref } from 'vue'
import PersonAvatar from '@/components/pbl/PersonAvatar.vue'
import type { Team } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { fmt } from '@/utils/format'
import { programCover } from '@/utils/pbl'

const store = usePblStore()
const list = computed(() => store.showcases)
const detail = ref<Team | null>(null)
const shared = computed(() => store.sharedResources)
</script>

<template>
  <div>
    <div class="page-title"><span>优秀成果</span><span class="muted">指导教师从各课题中精选的团队成果</span></div>
    <div v-if="!list.length" class="empty-tip card">还没有成果。课题结项后，指导教师可以在「评价与成果」里把优秀团队的成果发布到这里。</div>
    <div class="grid">
      <div v-for="t in list" :key="t.id" class="sc" @click="detail = t">
        <div class="body" :style="programCover(store.program(store.project(t.projectId)!.programId)?.color ?? 0)">
          <div class="from"><i />{{ store.project(t.projectId)?.title }}</div>
          <b class="title">{{ t.showcase!.title }}</b>
          <div class="muted">{{ t.name }} · {{ fmt(t.showcase!.at, 'YYYY-MM-DD') }}</div>
          <p>{{ t.showcase!.summary }}</p>
          <div class="flex">
            <span class="avs"><PersonAvatar v-for="sid in t.memberIds" :id="sid" :key="sid" :size="24" /></span>
            <div class="spacer" />
            <span v-if="t.evaluation" class="eval">项目评价 <b>{{ t.evaluation.score }}</b></span>
          </div>
        </div>
      </div>
    </div>

    <div class="page-title" style="margin-top: 28px"><span>校内共享资料</span><span class="muted">各团队设为「校内公开」的过程资料</span></div>
    <el-table :data="shared" class="card table-card" empty-text="暂无">
      <el-table-column label="名称" prop="title" min-width="220" />
      <el-table-column label="团队" width="120"><template #default="{ row }">{{ store.team(row.teamId)?.name }}</template></el-table-column>
      <el-table-column label="课题" min-width="160"><template #default="{ row }">{{ store.project(row.projectId)?.title }}</template></el-table-column>
      <el-table-column label="上传者" width="100"><template #default="{ row }">{{ store.person(row.uploaderId)?.name }}</template></el-table-column>
    </el-table>

    <el-dialog :model-value="!!detail" :title="detail?.showcase?.title" width="620px" @close="detail = null">
      <template v-if="detail?.showcase">
        <div class="muted">{{ store.project(detail.projectId)?.title }} · {{ detail.name }}</div>
        <p class="rich-text">{{ detail.showcase.summary }}</p>
        <h4>成果亮点</h4>
        <ul><li v-for="h in detail.showcase.highlights" :key="h">{{ h }}</li></ul>
        <h4>团队成员</h4>
        <div class="flex" style="flex-wrap: wrap; gap: 12px">
          <PersonAvatar v-for="sid in detail.memberIds" :id="sid" :key="sid" show-name :leader="detail.leaderId === sid" />
        </div>
        <template v-if="detail.evaluation">
          <h4>指导教师评价</h4>
          <p><b class="score">{{ detail.evaluation.score }}</b> {{ detail.evaluation.comment }}</p>
        </template>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}
.sc {
  background: #fff;
  border: 1px solid var(--ch-border);
  border-radius: var(--ch-radius);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.sc:hover {
  border-color: var(--el-border-color-hover);
  box-shadow: var(--el-box-shadow-lighter);
}
.body {
  padding: 16px;
  display: grid;
  gap: 6px;
}
.from {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--tone);
}
.from i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tone);
}
.title {
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}
.body p {
  margin: 4px 0 8px;
  color: var(--ch-text-2);
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.avs {
  display: flex;
  gap: 4px;
}
.eval {
  font-size: 13px;
  color: var(--ch-text-2);
}
.eval b {
  font-size: 18px;
  font-weight: 600;
  color: var(--ch-primary-text);
  margin-left: 2px;
}
.table-card {
  padding: 4px 12px;
}
.score {
  color: var(--ch-primary-text);
  font-size: 20px;
  margin-right: 6px;
}
</style>

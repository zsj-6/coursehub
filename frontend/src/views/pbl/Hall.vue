<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import ProjectCard from '@/components/pbl/ProjectCard.vue'
import ProjectFormDialog from '@/components/pbl/ProjectFormDialog.vue'
import type { Program, ProjectStatus } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { PROJECT_STATUS, programCover } from '@/utils/pbl'

const store = usePblStore()
const router = useRouter()

// 大项目筛选
const progQ = reactive({ college: '', source: '' })
const colleges = computed(() => [...new Set(store.data.programs.map((g) => g.college))])
const programs = computed(() =>
  store.data.programs.filter(
    (g) => (!progQ.college || g.college === progQ.college) && (!progQ.source || g.source === progQ.source) && (store.isAdmin || store.projectsOf(g.id).length),
  ),
)

// 课题筛选
const q = reactive({ text: '', status: '' as '' | ProjectStatus, tag: '', mentor: '', programId: '' })
const tags = computed(() => [...new Set(store.visibleProjects.flatMap((p) => p.tags))])
const mentors = computed(() => store.data.people.filter((p) => p.role === 'mentor'))
const projects = computed(() =>
  store.visibleProjects.filter((p) => {
    const g = store.program(p.programId)
    const text = q.text.trim()
    return (
      (!text || p.title.includes(text) || g?.title.includes(text)) &&
      (!q.status || p.status === q.status) &&
      (!q.tag || p.tags.includes(q.tag)) &&
      (!q.mentor || p.mentorIds.includes(q.mentor)) &&
      (!q.programId || p.programId === q.programId)
    )
  }),
)
const counts = computed(() => ({
  programs: store.data.programs.length,
  projects: store.visibleProjects.length,
  recruiting: store.visibleProjects.filter((p) => p.status === 'recruiting').length,
  teams: store.data.teams.filter((t) => store.visibleProjects.some((p) => p.id === t.projectId)).length,
}))

const formRef = ref<InstanceType<typeof ProjectFormDialog>>()

// 新建大项目
const progDlg = ref(false)
const progForm = reactive<Omit<Program, 'id'>>({ title: '', source: '竞赛项目', partner: '', college: '', level: '本科', description: '', color: 0 })
function openProgram() {
  Object.assign(progForm, { title: '', source: '企业项目', partner: '', college: colleges.value[0] || '', level: '本科', description: '', color: store.data.programs.length })
  progDlg.value = true
}
function saveProgram() {
  if (!progForm.title.trim()) return ElMessage.warning('请填写项目名称')
  const id = `g${Date.now().toString(36)}`
  store.data.programs.push({ ...progForm, id, title: progForm.title.trim() })
  progDlg.value = false
  ElMessage.success('大项目已创建，接下来把它拆成课题')
  router.push(`/pbl/programs/${id}`)
}
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <h2>从真实项目出发，组队闯关</h2>
        <p>大项目拆成课题，学生按兴趣报名组队，按关卡推进，指导老师全程评阅。</p>
      </div>
      <div class="spacer" />
      <div class="nums">
        <div><b>{{ counts.programs }}</b><span>大项目</span></div>
        <div><b>{{ counts.projects }}</b><span>课题</span></div>
        <div><b>{{ counts.recruiting }}</b><span>招募中</span></div>
        <div><b>{{ counts.teams }}</b><span>团队</span></div>
      </div>
    </section>

    <div class="page-title">
      <span>大项目</span>
      <div class="flex">
        <el-select v-model="progQ.college" clearable placeholder="学院" size="small" style="width: 130px">
          <el-option v-for="c in colleges" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="progQ.source" clearable placeholder="来源" size="small" style="width: 110px">
          <el-option v-for="s in ['竞赛项目', '企业项目', '科研课题']" :key="s" :label="s" :value="s" />
        </el-select>
        <el-button v-if="store.isAdmin" size="small" type="primary" plain :icon="'Plus'" @click="openProgram">新建大项目</el-button>
      </div>
    </div>
    <div class="programs">
      <router-link v-for="g in programs" :key="g.id" :to="`/pbl/programs/${g.id}`" class="program" :style="programCover(g.color)">
        <div class="flex">
          <el-tag size="small" effect="light">{{ g.source }}</el-tag>
          <span class="lv">{{ g.level }}</span>
        </div>
        <div class="gt">{{ g.title }}</div>
        <div class="gm">{{ g.college }} · {{ g.partner }}</div>
        <div class="gm">{{ store.projectsOf(g.id).length }} 个课题 · {{ store.projectsOf(g.id).reduce((n, p) => n + store.teamsOf(p.id).length, 0) }} 个团队</div>
      </router-link>
    </div>

    <div class="page-title" style="margin-top: 24px">
      <span>全部课题</span>
      <el-button v-if="!store.isStudent" type="primary" :icon="'Plus'" @click="formRef?.open()">新建课题</el-button>
    </div>
    <div class="filters">
      <el-input v-model="q.text" placeholder="搜索课题或项目名称" clearable :prefix-icon="'Search'" style="width: 220px" />
      <el-select v-model="q.programId" clearable placeholder="大项目" style="width: 200px">
        <el-option v-for="g in store.data.programs" :key="g.id" :label="g.title" :value="g.id" />
      </el-select>
      <el-select v-model="q.status" clearable placeholder="状态" style="width: 110px">
        <el-option v-for="(s, k) in PROJECT_STATUS" :key="k" :label="s.text" :value="k" :disabled="k === 'draft' && store.isStudent" />
      </el-select>
      <el-select v-model="q.tag" clearable placeholder="标签" style="width: 130px">
        <el-option v-for="t in tags" :key="t" :label="t" :value="t" />
      </el-select>
      <el-select v-model="q.mentor" clearable placeholder="指导教师" style="width: 120px">
        <el-option v-for="m in mentors" :key="m.id" :label="m.name" :value="m.id" />
      </el-select>
    </div>
    <div v-if="!projects.length" class="empty-tip card">没有符合条件的课题</div>
    <transition-group name="grid" tag="div" class="grid">
      <ProjectCard v-for="p in projects" :key="p.id" :project="p" />
    </transition-group>

    <ProjectFormDialog ref="formRef" @saved="(id) => router.push(`/pbl/projects/${id}`)" />

    <el-dialog v-model="progDlg" title="新建大项目" width="520px">
      <el-form label-width="80px">
        <el-form-item label="项目名称"><el-input v-model="progForm.title" placeholder="例如：企业提出的真实问题" /></el-form-item>
        <el-form-item label="来源">
          <el-radio-group v-model="progForm.source">
            <el-radio v-for="s in ['企业项目', '竞赛项目', '科研课题']" :key="s" :value="s">{{ s }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="合作方"><el-input v-model="progForm.partner" placeholder="企业名称 / 赛事 / 课题组" /></el-form-item>
        <el-form-item label="关联学院"><el-input v-model="progForm.college" /></el-form-item>
        <el-form-item label="面向">
          <el-radio-group v-model="progForm.level">
            <el-radio v-for="s in ['本科', '研究生', '本研']" :key="s" :value="s">{{ s }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="项目描述"><el-input v-model="progForm.description" type="textarea" :rows="4" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="progDlg = false">取消</el-button>
        <el-button type="primary" @click="saveProgram">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  padding: 22px 28px;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(120deg, #2a8c99, #3bb4b8 45%, #5b8ff9);
  margin-bottom: 20px;
}
.hero h2 {
  margin: 0 0 6px;
  font-size: 22px;
}
.hero p {
  margin: 0;
  opacity: 0.9;
}
.nums {
  display: flex;
  gap: 28px;
}
.nums div {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.nums b {
  font-size: 26px;
}
.nums span {
  font-size: 12px;
  opacity: 0.85;
}
.programs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.program {
  color: #fff;
  border-radius: 10px;
  padding: 16px;
  display: grid;
  gap: 6px;
  transition: transform 0.2s, box-shadow 0.2s;
}
.program:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.15);
}
.lv {
  font-size: 12px;
  opacity: 0.85;
}
.gt {
  font-size: 17px;
  font-weight: 700;
}
.gm {
  font-size: 12px;
  opacity: 0.9;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
}
.grid-move,
.grid-enter-active {
  transition: all 0.35s;
}
.grid-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.grid-leave-active {
  display: none;
}
</style>

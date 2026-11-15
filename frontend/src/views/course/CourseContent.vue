<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { activitiesApi } from '@/api/activities'
import { coursesApi } from '@/api/courses'
import type { Activity, ActivityBrief, ActivityType, ChapterNode, Course } from '@/api/types'
import ActivityFormDialog from '@/components/ActivityFormDialog.vue'
import ActivityRow from '@/components/ActivityRow.vue'
import PublishDialog from '@/components/PublishDialog.vue'
import { useCourseStore } from '@/stores/course'

const cs = useCourseStore()
const router = useRouter()
const courseId = computed(() => cs.course!.id)
const tree = ref<ChapterNode[]>([])
const loading = ref(false)
const studentView = ref(false)
const selected = ref<Record<number, boolean>>({})

const manage = computed(() => cs.isManager)
const showAsStudent = computed(() => cs.isStudent || studentView.value)

async function load() {
  loading.value = true
  try {
    tree.value = await coursesApi.outline(courseId.value, studentView.value && !cs.isStudent)
    selected.value = {}
  } finally {
    loading.value = false
  }
}
onMounted(load)

const allActivities = computed(() =>
  tree.value.flatMap((c) => [...c.activities, ...(c.units || []).flatMap((u) => u.activities)]),
)
const selectedIds = computed(() =>
  Object.entries(selected.value)
    .filter(([, v]) => v)
    .map(([k]) => Number(k)),
)
const chapterOptions = computed(() =>
  tree.value.flatMap((c) => [
    { id: c.id, label: c.title },
    ...(c.units || []).map((u) => ({ id: u.id, label: `　${c.title} / ${u.title}` })),
  ]),
)
const progress = computed(() => {
  const acts = allActivities.value
  if (!cs.isStudent || !acts.length) return null
  const done = acts.filter((a) => a.completed).length
  return { done, total: acts.length, pct: Math.round((done / acts.length) * 100) }
})

// ---------- 章节 ----------
async function addChapter(parent: ChapterNode | null = null) {
  const { value } = await ElMessageBox.prompt(parent ? `在「${parent.title}」下新增单元` : '章节名称', parent ? '新增单元' : '新增章节', {
    inputPattern: /\S/,
    inputErrorMessage: '名称不能为空',
  })
  await coursesApi.createChapter(courseId.value, value.trim(), parent?.id ?? null)
  load()
}
async function chapterCommand(cmd: string, ch: ChapterNode) {
  if (cmd === 'rename') {
    const { value } = await ElMessageBox.prompt('新名称', '重命名', { inputValue: ch.title, inputPattern: /\S/ })
    await coursesApi.updateChapter(ch.id, value.trim())
  } else if (cmd === 'unit') {
    return addChapter(ch)
  } else if (cmd === 'activity') {
    return openCreate(ch.id)
  } else if (cmd === 'up' || cmd === 'down') {
    await coursesApi.moveChapter(ch.id, cmd)
  } else if (cmd === 'delete') {
    await ElMessageBox.confirm(`删除「${ch.title}」会同时删除其下的所有单元、活动以及学生的提交记录，不能恢复。`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
    })
    await coursesApi.deleteChapter(ch.id)
    ElMessage.success('已删除')
  }
  load()
}

// ---------- 活动 ----------
const formVisible = ref(false)
const editing = ref<Activity | null>(null)
const defaultChapterId = ref<number | null>(null)
const defaultType = ref<ActivityType>('material')

function openCreate(chapterId: number | null = null, type: ActivityType = 'material') {
  if (!tree.value.length) return ElMessage.warning('请先新增一个章节')
  editing.value = null
  defaultChapterId.value = chapterId
  defaultType.value = type
  formVisible.value = true
}
function onSaved(a: Activity) {
  load()
  if (!editing.value && a.type === 'exam') {
    ElMessage.info('接下来请添加测试题目')
    router.push(`/courses/${courseId.value}/activities/${a.id}/questions`)
  }
}

const publishVisible = ref(false)
const publishIds = ref<number[]>([])

async function activityCommand(cmd: string, a: ActivityBrief) {
  if (cmd === 'edit') {
    editing.value = await activitiesApi.get(a.id)
    formVisible.value = true
    return
  }
  if (cmd === 'questions') return router.push(`/courses/${courseId.value}/activities/${a.id}/questions`)
  if (cmd === 'publish') {
    publishIds.value = [a.id]
    publishVisible.value = true
    return
  }
  if (cmd === 'unpublish') {
    await activitiesApi.batchPublish(courseId.value, { ids: [a.id], publish: false })
    ElMessage.success('已取消发布，学生将看不到该活动')
  } else if (cmd === 'up' || cmd === 'down') {
    await activitiesApi.move(a.id, cmd)
  } else if (cmd === 'delete') {
    await ElMessageBox.confirm(`删除「${a.title}」会同时删除学生的提交记录，不能恢复。`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
    })
    await activitiesApi.remove(a.id)
    ElMessage.success('已删除')
  }
  load()
}

function batchPublish() {
  publishIds.value = selectedIds.value
  publishVisible.value = true
}
async function batchUnpublish() {
  await activitiesApi.batchPublish(courseId.value, { ids: selectedIds.value, publish: false })
  ElMessage.success(`已取消发布 ${selectedIds.value.length} 个活动`)
  load()
}
function selectAll(v: boolean) {
  selected.value = Object.fromEntries(allActivities.value.map((a) => [a.id, v]))
}

// ---------- 复制课程内容 ----------
const copyVisible = ref(false)
const copyTargets = ref<Course[]>([])
const copyTarget = ref<number | null>(null)
async function openCopy() {
  copyTargets.value = (await coursesApi.list()).filter((c) => c.my_role === 'teacher' && c.id !== courseId.value)
  copyTarget.value = null
  copyVisible.value = true
}
async function doCopy() {
  if (!copyTarget.value) return ElMessage.warning('请选择目标课程')
  const res = await coursesApi.copyTo(courseId.value, copyTarget.value)
  ElMessage.success(`已复制 ${res.copied_activities} 个活动（均为未发布状态）`)
  copyVisible.value = false
}
</script>

<template>
  <div>
    <div class="page-title">
      <span>课程内容</span>
      <div v-if="manage" class="flex wrap">
        <el-switch v-model="studentView" active-text="学生视角" @change="load" />
        <template v-if="!studentView">
          <el-button @click="openCopy"><el-icon><CopyDocument /></el-icon>&nbsp;复制到其他课程</el-button>
          <el-button @click="addChapter()"><el-icon><FolderAdd /></el-icon>&nbsp;新增章节</el-button>
          <el-button type="primary" @click="openCreate()"><el-icon><Plus /></el-icon>&nbsp;新增学习活动</el-button>
        </template>
      </div>
    </div>

    <div v-if="manage && !studentView && allActivities.length" class="card batch">
      <el-checkbox
        :model-value="selectedIds.length > 0 && selectedIds.length === allActivities.length"
        :indeterminate="selectedIds.length > 0 && selectedIds.length < allActivities.length"
        @change="(v: any) => selectAll(!!v)"
      >
        全选
      </el-checkbox>
      <span class="muted">已选 {{ selectedIds.length }} 个</span>
      <el-button size="small" type="primary" plain :disabled="!selectedIds.length" @click="batchPublish">批量发布</el-button>
      <el-button size="small" :disabled="!selectedIds.length" @click="batchUnpublish">批量取消发布</el-button>
      <span class="muted spacer" style="text-align: right">新建的活动默认是草稿，发布后学生才能看到</span>
    </div>

    <el-alert v-if="studentView" type="info" :closable="false" show-icon style="margin-bottom: 12px">
      正在以学生视角预览：只显示已发布且在开放时间内的活动。
    </el-alert>

    <div v-if="progress" class="card progress">
      <span>学习进度</span>
      <el-progress :percentage="progress.pct" style="flex: 1" />
      <span class="muted">{{ progress.done }} / {{ progress.total }}</span>
    </div>

    <div v-loading="loading" class="chapters">
      <div v-if="!loading && !tree.length" class="card empty-tip">
        {{ manage ? '还没有内容，先点右上角「新增章节」开始建课吧' : '老师还没有发布课程内容' }}
      </div>
      <section v-for="ch in tree" :key="ch.id" class="card chapter">
        <div class="ch-head">
          <span class="ch-title">{{ ch.title }}</span>
          <el-dropdown v-if="manage && !studentView" trigger="click" @command="(c: string) => chapterCommand(c, ch)">
            <el-button link><el-icon><MoreFilled /></el-icon></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="activity" icon="Plus">新增活动</el-dropdown-item>
                <el-dropdown-item command="unit" icon="FolderAdd">新增单元</el-dropdown-item>
                <el-dropdown-item command="rename" icon="Edit">重命名</el-dropdown-item>
                <el-dropdown-item command="up" icon="Top" divided>上移</el-dropdown-item>
                <el-dropdown-item command="down" icon="Bottom">下移</el-dropdown-item>
                <el-dropdown-item command="delete" icon="Delete" divided>删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <ActivityRow
          v-for="a in ch.activities"
          :key="a.id"
          v-model:selected="selected[a.id]"
          :act="a"
          :course-id="courseId"
          :manage="manage"
          :student-view="showAsStudent"
          @command="activityCommand"
        />
        <div v-for="u in ch.units" :key="u.id" class="unit">
          <div class="unit-head">
            <el-icon><Folder /></el-icon>
            <span>{{ u.title }}</span>
            <span class="spacer" />
            <el-dropdown v-if="manage && !studentView" trigger="click" @command="(c: string) => chapterCommand(c, u)">
              <el-button link size="small"><el-icon><MoreFilled /></el-icon></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="activity" icon="Plus">新增活动</el-dropdown-item>
                  <el-dropdown-item command="rename" icon="Edit">重命名</el-dropdown-item>
                  <el-dropdown-item command="up" icon="Top" divided>上移</el-dropdown-item>
                  <el-dropdown-item command="down" icon="Bottom">下移</el-dropdown-item>
                  <el-dropdown-item command="delete" icon="Delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <ActivityRow
            v-for="a in u.activities"
            :key="a.id"
            v-model:selected="selected[a.id]"
            :act="a"
            :course-id="courseId"
            :manage="manage"
            :student-view="showAsStudent"
            @command="activityCommand"
          />
          <div v-if="!u.activities.length" class="muted none">暂无活动</div>
        </div>
        <div v-if="!ch.activities.length && !ch.units?.length" class="muted none">暂无活动</div>
      </section>
    </div>

    <ActivityFormDialog
      v-model="formVisible"
      :course-id="courseId"
      :chapters="chapterOptions"
      :activity="editing"
      :default-type="defaultType"
      :default-chapter-id="defaultChapterId"
      @saved="onSaved"
    />
    <PublishDialog v-model="publishVisible" :course-id="courseId" :ids="publishIds" @done="load" />

    <el-dialog v-model="copyVisible" title="复制课程内容到其他课程" width="440px">
      <p class="muted" style="margin-top: 0">会把本课程的全部章节、活动和题目追加到目标课程，复制出的活动都是未发布状态。</p>
      <el-select v-model="copyTarget" placeholder="选择目标课程（需要是该课程的教师）" style="width: 100%">
        <el-option v-for="c in copyTargets" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>
      <template #footer>
        <el-button @click="copyVisible = false">取消</el-button>
        <el-button type="primary" @click="doCopy">复制</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.wrap {
  flex-wrap: wrap;
}
.batch,
.progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 16px;
}
.chapters {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 120px;
}
.chapter {
  padding: 12px 12px 8px;
}
.ch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px 8px;
  border-bottom: 1px solid var(--ch-border-light);
  margin-bottom: 4px;
}
.ch-title {
  font-weight: 600;
  font-size: 15px;
}
.unit {
  margin: 6px 0 4px 16px;
  border-left: 2px solid var(--ch-border);
  padding-left: 8px;
}
.unit-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-weight: 500;
}
.none {
  padding: 8px 12px;
}
</style>

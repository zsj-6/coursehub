<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import type { Resource, ShareScope } from '@/mock/pbl'
import { usePblStore } from '@/stores/pbl'
import { fmt, fmtSize } from '@/utils/format'
import { KIND_ICON, SCOPE_LABEL, kindOf } from '@/utils/pbl'

/** teamId 为 undefined：课题资源页（项目资源 + 各团队分享出来的）；有值：某个团队空间。 */
const props = defineProps<{ projectId: string; teamId?: string }>()
const store = usePblStore()
const project = computed(() => store.project(props.projectId)!)
const manage = computed(() => store.canManage(project.value))
const inMyTeam = computed(() => !!props.teamId && store.myTeam(props.projectId)?.id === props.teamId)
const canUpload = computed(() => (props.teamId ? inMyTeam.value || manage.value : manage.value))

const list = computed(() => store.resourcesOf(props.projectId, props.teamId))
const folders = computed(() => {
  const set = new Set(list.value.map((r) => r.folder))
  return ['全部', ...set]
})
const folder = ref('全部')
const shown = computed(() => list.value.filter((r) => folder.value === '全部' || r.folder === folder.value))

const canEdit = (r: Resource) => manage.value || r.uploaderId === store.personaId

// 上传（原型：只记录文件名和大小，不真正上传）
const dlg = ref(false)
const form = reactive({ folder: '', files: [] as File[], scope: 'project' as ShareScope, allowDownload: true })
const fileInput = ref<HTMLInputElement>()
function openUpload() {
  Object.assign(form, { folder: props.teamId ? '团队资料' : folders.value[1] || '参考资料', files: [], scope: props.teamId ? 'team' : 'project', allowDownload: true })
  dlg.value = true
}
function onPick(e: Event) {
  form.files = Array.from((e.target as HTMLInputElement).files || [])
}
function save() {
  if (!form.files.length) return ElMessage.warning('请选择文件')
  for (const f of form.files) {
    store.addResource({
      projectId: props.projectId, teamId: props.teamId ?? null, folder: form.folder || '未分类', title: f.name,
      kind: kindOf(f.name), size: f.size, scope: props.teamId ? form.scope : 'project', allowDownload: form.allowDownload,
    })
  }
  dlg.value = false
  ElMessage.success(`已上传 ${form.files.length} 个文件`)
}
async function remove(r: Resource) {
  await ElMessageBox.confirm(`删除「${r.title}」？`, '提示', { type: 'warning' })
  store.removeResource(r)
}
function download(r: Resource) {
  ElMessage.info(`原型演示：下载「${r.title}」`)
}
</script>

<template>
  <div>
    <div class="flex bar">
      <el-radio-group v-model="folder" size="small">
        <el-radio-button v-for="f in folders" :key="f" :value="f">{{ f }}</el-radio-button>
      </el-radio-group>
      <div class="spacer" />
      <el-button v-if="canUpload" type="primary" size="small" :icon="'Upload'" @click="openUpload">上传资源</el-button>
    </div>
    <el-table :data="shown" size="small" empty-text="暂无资源">
      <el-table-column label="名称" min-width="240">
        <template #default="{ row }">
          <span class="flex">
            <el-icon :style="{ color: KIND_ICON[row.kind as Resource['kind']].color }" size="18"><component :is="KIND_ICON[row.kind as Resource['kind']].icon" /></el-icon>
            <span>{{ row.title }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="目录" prop="folder" width="110" />
      <el-table-column v-if="teamId === undefined" label="来源" width="110">
        <template #default="{ row }">{{ row.teamId ? store.team(row.teamId)?.name : '指导教师' }}</template>
      </el-table-column>
      <el-table-column label="分享范围" width="130">
        <template #default="{ row }">
          <el-select v-if="row.teamId && canEdit(row as Resource)" :model-value="row.scope" size="small" @change="(v: ShareScope) => store.setScope(row as Resource, v)">
            <el-option v-for="(t, k) in SCOPE_LABEL" :key="k" :label="t" :value="k" />
          </el-select>
          <span v-else class="muted">{{ row.teamId ? SCOPE_LABEL[row.scope as ShareScope] : '项目内公开' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="上传者" width="90">
        <template #default="{ row }">{{ store.person(row.uploaderId)?.name }}</template>
      </el-table-column>
      <el-table-column label="大小" width="90">
        <template #default="{ row }">{{ fmtSize(row.size) }}</template>
      </el-table-column>
      <el-table-column label="时间" width="110">
        <template #default="{ row }">{{ fmt(row.at, 'MM-DD HH:mm') }}</template>
      </el-table-column>
      <el-table-column label="" width="130" align="right">
        <template #default="{ row }">
          <el-button v-if="row.allowDownload || canEdit(row as Resource)" link type="primary" size="small" @click="download(row as Resource)">下载</el-button>
          <el-tooltip v-else content="不允许下载，只能在线查看"><el-button link size="small" @click="download(row as Resource)">查看</el-button></el-tooltip>
          <el-button v-if="canEdit(row as Resource)" link type="danger" size="small" @click="remove(row as Resource)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dlg" title="上传资源" width="480px">
      <el-form label-width="90px">
        <el-form-item label="文件">
          <input ref="fileInput" type="file" multiple style="display: none" @change="onPick" />
          <el-button :icon="'FolderOpened'" @click="fileInput?.click()">选择文件</el-button>
          <div v-for="f in form.files" :key="f.name" class="muted" style="width: 100%">{{ f.name }}（{{ fmtSize(f.size) }}）</div>
        </el-form-item>
        <el-form-item label="目录">
          <el-select v-model="form.folder" filterable allow-create default-first-option placeholder="选择或输入新目录">
            <el-option v-for="f in folders.slice(1)" :key="f" :label="f" :value="f" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="teamId" label="分享范围">
          <el-radio-group v-model="form.scope">
            <el-radio v-for="(t, k) in SCOPE_LABEL" :key="k" :value="k">{{ t }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="允许下载"><el-switch v-model="form.allowDownload" /></el-form-item>
        <div class="muted">原型演示：只记录文件名和大小，不会真正上传。</div>
      </el-form>
      <template #footer>
        <el-button @click="dlg = false">取消</el-button>
        <el-button type="primary" @click="save">上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.bar {
  margin-bottom: 12px;
  flex-wrap: wrap;
}
</style>

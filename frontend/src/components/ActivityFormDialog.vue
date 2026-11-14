<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { activitiesApi } from '@/api/activities'
import { coursesApi } from '@/api/courses'
import type { Activity, ActivityType, FileInfo } from '@/api/types'
import FileUploader from '@/components/FileUploader.vue'
import { TYPE_LABEL, toISO } from '@/utils/format'

const props = defineProps<{
  courseId: number
  chapters: { id: number; label: string }[]
  /** 编辑时传入；新建时为空 */
  activity?: Activity | null
  defaultType?: ActivityType
  defaultChapterId?: number | null
}>()
const visible = defineModel<boolean>({ default: false })
const emit = defineEmits<{ saved: [Activity] }>()

const form = reactive({
  type: 'material' as ActivityType,
  chapter_id: null as number | null,
  title: '',
  description: '',
  scheduled: false,
  open_range: null as [Date, Date] | null,
  // material
  files: [] as FileInfo[],
  allow_download: true,
  // video
  video_source: 'upload' as 'upload' | 'url',
  video_files: [] as FileInfo[],
  video_url: '',
  // homework / exam
  start_at: null as Date | null,
  due_at: null as Date | null,
  full_score: 100,
  score_ratio: 0,
  max_attempts: 0,
  score_rule: 'last',
  duration_min: 0,
  attempts: 1,
  shuffle_options: false,
  show_answer: true,
  score_publish: 'immediate' as 'none' | 'immediate' | 'scheduled',
  score_publish_at: null as Date | null,
})
/** 本活动最多还能分配的成绩占比（其他作业/测试已占用的之外） */
const ratioLeft = ref(100)
const graded = computed(() => form.type === 'homework' || form.type === 'exam')
const saving = ref(false)
const isEdit = computed(() => !!props.activity)

watch(visible, async (v) => {
  if (!v) return
  const a = props.activity
  const s = a?.settings || {}
  Object.assign(form, {
    type: a?.type || props.defaultType || 'material',
    chapter_id: a?.chapter_id ?? props.defaultChapterId ?? props.chapters[0]?.id ?? null,
    title: a?.title || '',
    description: a?.description || '',
    scheduled: !!(a?.open_at || a?.close_at),
    open_range: a?.open_at && a?.close_at ? [new Date(a.open_at), new Date(a.close_at)] : null,
    files: a?.type === 'material' ? a.files || [] : [],
    allow_download: s.allow_download ?? true,
    video_source: a?.type === 'video' && s.url ? 'url' : 'upload',
    video_files: a?.type === 'video' ? a.files || [] : [],
    video_url: s.url || '',
    start_at: a?.start_at ? new Date(a.start_at) : null,
    due_at: a?.due_at ? new Date(a.due_at) : null,
    full_score: a?.full_score ?? 100,
    score_ratio: a?.score_ratio ?? 0,
    max_attempts: s.max_attempts ?? 0,
    score_rule: s.score_rule ?? 'last',
    duration_min: s.duration_min ?? 0,
    attempts: s.attempts ?? 1,
    shuffle_options: s.shuffle_options ?? false,
    show_answer: s.show_answer ?? true,
    score_publish: s.score_publish ?? 'immediate',
    score_publish_at: s.score_publish_at ? new Date(s.score_publish_at) : null,
  })
  ratioLeft.value = 100
  const info = await coursesApi.scoreRatios(props.courseId).catch(() => null)
  if (info) {
    const own = a && (a.type === 'homework' || a.type === 'exam') ? a.score_ratio : 0
    ratioLeft.value = Math.round((info.left + own) * 100) / 100
  }
})

function buildPayload(publish: boolean | null) {
  const p: Record<string, any> = {
    chapter_id: form.chapter_id,
    title: form.title.trim(),
    description: form.description,
    open_at: form.scheduled && form.open_range ? toISO(form.open_range[0]) : null,
    close_at: form.scheduled && form.open_range ? toISO(form.open_range[1]) : null,
  }
  if (publish !== null) p.is_published = publish
  if (form.type === 'material') {
    p.settings = { file_ids: form.files.map((f) => f.id), allow_download: form.allow_download }
  } else if (form.type === 'video') {
    p.settings =
      form.video_source === 'url'
        ? { url: form.video_url.trim(), file_id: null }
        : { file_id: form.video_files[0]?.id ?? null, url: null }
  } else if (form.type === 'homework') {
    p.due_at = toISO(form.due_at)
    p.full_score = form.full_score
    p.score_ratio = form.score_ratio
    p.settings = { max_attempts: form.max_attempts, score_rule: form.score_rule }
  } else {
    p.start_at = toISO(form.start_at)
    p.due_at = toISO(form.due_at)
    p.score_ratio = form.score_ratio
    p.settings = {
      duration_min: form.duration_min,
      attempts: form.attempts,
      shuffle_options: form.shuffle_options,
      show_answer: form.show_answer,
      score_publish: form.score_publish,
      score_publish_at: form.score_publish === 'scheduled' ? toISO(form.score_publish_at) : null,
    }
  }
  return p
}

function validate(): string | null {
  if (!form.title.trim()) return '请输入标题'
  if (!form.chapter_id) return '请选择所属章节'
  if (form.type === 'material' && !form.files.length) return '请添加至少一个文件'
  if (form.type === 'video') {
    if (form.video_source === 'url' && !/^https?:\/\//.test(form.video_url.trim())) return '请填写以 http 开头的视频链接'
    if (form.video_source === 'upload' && !form.video_files.length) return '请上传视频文件'
  }
  if (form.scheduled && !form.open_range) return '请选择开放时间段'
  if (form.type === 'exam' && form.start_at && form.due_at && form.start_at >= form.due_at) return '开始时间必须早于结束时间'
  if (graded.value && form.score_ratio > ratioLeft.value) return `成绩占比合计不能超过 100%，本活动最多 ${ratioLeft.value}%`
  if (form.type === 'exam' && form.score_publish === 'scheduled' && !form.score_publish_at) return '请选择成绩公布时间'
  return null
}

/** publish: true=保存并发布，false=存为草稿，null=编辑时保持原状态 */
async function save(publish: boolean | null) {
  const err = validate()
  if (err) return ElMessage.warning(err)
  saving.value = true
  try {
    const payload = buildPayload(publish)
    const saved = isEdit.value
      ? await activitiesApi.update(props.activity!.id, payload)
      : await activitiesApi.create(props.courseId, { ...payload, type: form.type })
    ElMessage.success('已保存')
    visible.value = false
    emit('saved', saved)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="isEdit ? `编辑${TYPE_LABEL[form.type]}` : '新增学习活动'" width="640px" top="6vh">
    <el-form label-width="96px">
      <el-form-item v-if="!isEdit" label="活动类型">
        <el-radio-group v-model="form.type">
          <el-radio-button v-for="(label, t) in TYPE_LABEL" :key="t" :value="t">{{ label }}</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="标题" required>
        <el-input v-model="form.title" maxlength="200" :placeholder="`${TYPE_LABEL[form.type]}标题`" />
      </el-form-item>
      <el-form-item label="所属章节" required>
        <el-select v-model="form.chapter_id" style="width: 100%">
          <el-option v-for="c in chapters" :key="c.id" :label="c.label" :value="c.id" />
        </el-select>
      </el-form-item>
      <el-form-item :label="form.type === 'homework' ? '作业说明' : '说明'">
        <el-input v-model="form.description" type="textarea" :rows="3" />
      </el-form-item>

      <!-- 参考资料 -->
      <template v-if="form.type === 'material'">
        <el-form-item label="文件" required><FileUploader v-model="form.files" /></el-form-item>
        <el-form-item label="允许下载"><el-switch v-model="form.allow_download" /></el-form-item>
      </template>

      <!-- 音视频 -->
      <template v-if="form.type === 'video'">
        <el-form-item label="视频来源">
          <el-radio-group v-model="form.video_source">
            <el-radio value="upload">上传音视频</el-radio>
            <el-radio value="url">影音链接</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.video_source === 'upload'" label="视频文件" required>
          <FileUploader v-model="form.video_files" :multiple="false" accept="video/*,audio/*" button-text="上传视频" />
        </el-form-item>
        <el-form-item v-else label="视频链接" required>
          <el-input v-model="form.video_url" placeholder="https://...mp4" />
        </el-form-item>
      </template>

      <!-- 作业 -->
      <template v-if="form.type === 'homework'">
        <el-form-item label="截止时间">
          <el-date-picker v-model="form.due_at" type="datetime" placeholder="不设置则不限" />
        </el-form-item>
        <el-form-item label="满分 / 占比">
          <el-input-number v-model="form.full_score" :min="1" :max="1000" />
          <span class="muted" style="margin: 0 8px">占课程总评</span>
          <el-input-number v-model="form.score_ratio" :min="0" :max="ratioLeft" />
          <span class="muted" style="margin-left: 4px">%</span>
          <div class="muted ratio-tip">总成绩比例不能超过 100%，本活动最多可设 {{ ratioLeft }}%</div>
        </el-form-item>
        <el-form-item label="提交次数">
          <el-input-number v-model="form.max_attempts" :min="0" :max="99" />
          <span class="muted" style="margin-left: 8px">0 表示不限</span>
        </el-form-item>
        <el-form-item label="计分规则">
          <el-radio-group v-model="form.score_rule">
            <el-radio value="last">最后一次得分</el-radio>
            <el-radio value="max">最高得分</el-radio>
            <el-radio value="avg">平均得分</el-radio>
          </el-radio-group>
        </el-form-item>
      </template>

      <!-- 测试 -->
      <template v-if="form.type === 'exam'">
        <el-form-item label="作答时间">
          <el-date-picker v-model="form.start_at" type="datetime" placeholder="开始时间（不设则发布即可作答）" style="width: 220px" />
          <span class="muted" style="margin: 0 8px">至</span>
          <el-date-picker v-model="form.due_at" type="datetime" placeholder="结束时间" style="width: 200px" />
        </el-form-item>
        <el-form-item label="限时">
          <el-input-number v-model="form.duration_min" :min="0" :max="600" />
          <span class="muted" style="margin-left: 8px">分钟，0 表示不限时</span>
        </el-form-item>
        <el-form-item label="作答次数">
          <el-input-number v-model="form.attempts" :min="0" :max="99" />
          <span class="muted" style="margin-left: 8px">0 表示不限，多次作答取最高分</span>
        </el-form-item>
        <el-form-item label="成绩占比">
          <el-input-number v-model="form.score_ratio" :min="0" :max="ratioLeft" />
          <span class="muted" style="margin-left: 8px">% · 满分由题目分值相加得出</span>
          <div class="muted ratio-tip">总成绩比例不能超过 100%，本活动最多可设 {{ ratioLeft }}%</div>
        </el-form-item>
        <el-form-item label="组卷设置">
          <el-checkbox v-model="form.shuffle_options">选项乱序</el-checkbox>
        </el-form-item>
        <el-form-item label="公布成绩">
          <el-radio-group v-model="form.score_publish">
            <el-radio value="none">不公布</el-radio>
            <el-radio value="immediate">交卷后立即公布</el-radio>
            <el-radio value="scheduled">定时公布</el-radio>
          </el-radio-group>
          <el-date-picker
            v-if="form.score_publish === 'scheduled'"
            v-model="form.score_publish_at"
            type="datetime"
            placeholder="公布时间"
            style="margin-top: 8px"
          />
          <div style="width: 100%">
            <el-checkbox v-model="form.show_answer">成绩公布后，学生可以看到答案和解析</el-checkbox>
          </div>
        </el-form-item>
      </template>

      <el-form-item label="定时开放">
        <el-switch v-model="form.scheduled" />
        <el-date-picker
          v-if="form.scheduled"
          v-model="form.open_range"
          type="datetimerange"
          start-placeholder="开放时间"
          end-placeholder="结束时间"
          style="margin-left: 12px"
        />
      </el-form-item>
      <div v-if="form.scheduled" class="muted" style="margin: -8px 0 0 96px">发布后，学生只能在这段时间内看到该活动。</div>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <template v-if="isEdit">
        <el-button type="primary" :loading="saving" @click="save(null)">保存</el-button>
      </template>
      <template v-else>
        <el-button :loading="saving" @click="save(false)">保存为草稿</el-button>
        <el-button type="primary" :loading="saving" @click="save(true)">
          {{ form.type === 'exam' ? '保存并发布（稍后添加题目）' : '保存并发布' }}
        </el-button>
      </template>
    </template>
  </el-dialog>
</template>

<style scoped>
.ratio-tip {
  width: 100%;
  line-height: 1.6;
}
</style>

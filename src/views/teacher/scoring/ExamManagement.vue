<template>
  <div class="exam-management-page">
    <el-card shadow="never">
      <template #header>
        <div class="page-header">
          <div>
            <h2>考试管理</h2>
            <p>可查看全部考试，或按科目筛选并维护考试信息。</p>
          </div>
          <el-button type="primary" :disabled="!subjects.length" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新增考试
          </el-button>
        </div>
      </template>

      <div class="toolbar">
        <el-input
          v-model="searchKeyword"
          clearable
          placeholder="搜索考试名称"
          :prefix-icon="Search"
          @keyup.enter="fetchExams"
          @clear="fetchExams"
        />
        <el-select
          v-model="selectedSubjectId"
          filterable
          clearable
          placeholder="全部科目"
          :loading="subjectsLoading"
          @change="handleSubjectChange"
        >
          <el-option
            v-for="subject in subjects"
            :key="subject.subject_id"
            :label="`${subject.subject_no} · ${subject.subject_name}`"
            :value="subject.subject_id"
          />
        </el-select>
      </div>

      <el-table v-loading="loading" :data="exams" row-key="id" empty-text="暂无考试">
        <el-table-column prop="exam_name" label="考试名称" min-width="220" />
        <el-table-column label="所属科目" min-width="200">
          <template #default="{ row }">
            {{ row.subject_no || subjectById.get(row.subject_id)?.subject_no }} ·
            {{ row.subject_name || subjectById.get(row.subject_id)?.subject_name }}
          </template>
        </el-table-column>
        <el-table-column label="考试时间" min-width="180">
          <template #default="{ row }">{{ formatDate(row.exam_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.blank_paper_path" link type="primary" @click="viewBlankPaper(row)">查看空白试卷</el-button>
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && exams.length === 0" description="暂无考试" />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="min(760px, calc(100vw - 32px))" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
        <el-form-item label="所属科目" prop="subject_id">
          <el-select
            v-model="form.subject_id"
            filterable
            :disabled="isEditing"
            placeholder="请选择科目"
            style="width: 100%"
          >
            <el-option
              v-for="subject in subjects"
              :key="subject.subject_id"
              :label="`${subject.subject_no} · ${subject.subject_name}`"
              :value="subject.subject_id"
            />
          </el-select>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="14">
            <el-form-item label="考试时间" prop="exam_time">
              <el-date-picker
                v-model="form.exam_time"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择考试日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item label="考试场次" prop="exam_session">
              <el-select v-model="form.exam_session" placeholder="请选择场次" style="width: 100%">
                <el-option v-for="session in sessionOptions" :key="session" :label="session" :value="session" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="考试名称">
          <el-input :model-value="generatedExamName" placeholder="选择考试日期与场次后自动生成" disabled />
        </el-form-item>
        <el-form-item label="空白试卷" prop="blank_paper">
          <el-upload
            :auto-upload="false"
            :limit="1"
            :on-change="handleBlankPaperChange"
            :show-file-list="false"
          >
            <el-button>选择空白试卷</el-button>
            <template #tip><div class="el-upload__tip">先上传空白试卷，系统才能识别考试结构并生成阅卷标准。</div></template>
          </el-upload>
          <div v-if="blankPaperDisplayName" class="selected-blank-paper">
            <el-icon><Document /></el-icon>
            <span :title="blankPaperDisplayName">{{ blankPaperDisplayName }}</span>
          </div>
        </el-form-item>
        <el-form-item label="素材文件夹" prop="material_files">
          <div class="material-folder-field">
            <el-button @click="triggerMaterialFolderSelect">选择素材文件夹</el-button>
            <input
              ref="materialFolderInput"
              type="file"
              webkitdirectory
              multiple
              style="display: none"
              @change="handleMaterialFolderChange"
            >
            <div class="el-upload__tip">评阅时用素材文件名与考生提交的工程/会话文件做比对，考生缺了名单中的素材会写入复核评语。</div>
          </div>
          <div v-if="materialFiles.length" class="selected-material-files">
            <el-icon><FolderOpened /></el-icon>
            <span>已选择文件夹「{{ selectedMaterialFolderName }}」，共 {{ materialFiles.length }} 个文件</span>
            <el-button link type="danger" @click="clearMaterialFiles">清空</el-button>
          </div>
          <div
            v-else-if="existingMaterialFolderName"
            class="selected-material-files"
          >
            <el-icon><FolderOpened /></el-icon>
            <span>已保存素材文件夹「{{ existingMaterialFolderName }}」，重新选择将整体替换</span>
            <el-button link type="danger" @click="clearMaterialFiles">删除</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">
          {{ isEditing ? '保存' : '创建考试' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type UploadFile } from 'element-plus'
import { Document, FolderOpened, Plus, Search } from '@element-plus/icons-vue'
import {
  createExam,
  deleteExam,
  getAllExams,
  getExams,
  getSubjects,
  updateExam,
  type ExamItem,
  type SubjectItem
} from '@/api/teacher-scoring'

defineOptions({ name: 'TeacherExamManagement' })

const route = useRoute()
const router = useRouter()
const subjects = ref<SubjectItem[]>([])
const exams = ref<ExamItem[]>([])
const selectedSubjectId = ref<number>()
const searchKeyword = ref('')
const subjectsLoading = ref(false)
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEditing = ref(false)
const editingExamId = ref<number>()
const formRef = ref<FormInstance>()
const form = reactive<{
  subject_id?: number
  exam_time: string
  exam_session: string
}>({
  subject_id: undefined,
  exam_time: '',
  exam_session: ''
})
const blankPaperFile = ref<File>()
const materialFiles = ref<File[]>([])
const materialFolderInput = ref<HTMLInputElement | null>(null)
const existingMaterialFolderName = ref('')
const removeMaterialFolder = ref(false)
const existingBlankPaperName = ref('')
const blankPaperDisplayName = computed(() => blankPaperFile.value?.name || existingBlankPaperName.value)

const subjectById = computed(() => new Map(subjects.value.map((subject) => [subject.subject_id, subject])))
const dialogTitle = computed(() => (isEditing.value ? '编辑考试' : '新增考试'))
const sessionOptions = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))
// 考试名称由「科目名 + 考试年月(YYYYMM) + 场次」自动生成，例：大学信息技术基础202611-A
const generatedExamName = computed(() => {
  const subject = form.subject_id ? subjectById.value.get(form.subject_id) : undefined
  if (!subject || !form.exam_time || !form.exam_session) return ''
  const yearMonth = form.exam_time.replace(/-/g, '').slice(0, 6)
  return `${subject.subject_name}${yearMonth}-${form.exam_session}`
})
const rules: FormRules = {
  subject_id: [{ required: true, message: '请选择所属科目', trigger: 'change' }],
  exam_session: [{ required: true, message: '请选择考试场次', trigger: 'change' }]
}

// 科目管理与考试管理会被 KeepAlive 缓存；每次切回考试管理时刷新科目列表。
onActivated(loadSubjects)

watch(searchKeyword, () => {
  fetchExams()
})

async function loadSubjects() {
  subjectsLoading.value = true
  try {
    const response = await getSubjects()
    if (response.code !== 0 && response.code !== 200) throw new Error(response.message || '获取科目失败')
    subjects.value = response.data || []
    const requestedSubjectId = Number(route.query.subjectId)
    const existingSubjectId = subjects.value.find(
      (subject) => subject.subject_id === selectedSubjectId.value
    )?.subject_id
    const requestedSelection = subjects.value.find(
      (subject) => subject.subject_id === requestedSubjectId
    )?.subject_id
    selectedSubjectId.value = existingSubjectId || requestedSelection
    await fetchExams()
  } catch (error) {
    ElMessage.error(errorMessage(error, '获取科目失败'))
  } finally {
    subjectsLoading.value = false
  }
}

async function handleSubjectChange() {
  searchKeyword.value = ''
  exams.value = []
  await fetchExams()
}

async function fetchExams() {
  loading.value = true
  try {
    const response = selectedSubjectId.value
      ? await getExams(selectedSubjectId.value, searchKeyword.value.trim())
      : await getAllExams(searchKeyword.value.trim())
    if (response.code !== 0 && response.code !== 200) throw new Error(response.message || '获取考试失败')
    exams.value = response.data || []
  } catch (error) {
    ElMessage.error(errorMessage(error, '获取考试失败'))
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  isEditing.value = false
  editingExamId.value = undefined
  form.subject_id = selectedSubjectId.value
  form.exam_time = ''
  form.exam_session = ''
  blankPaperFile.value = undefined
  materialFiles.value = []
  existingBlankPaperName.value = ''
  existingMaterialFolderName.value = ''
  removeMaterialFolder.value = false
  dialogVisible.value = true
}

function openEditDialog(exam: ExamItem) {
  isEditing.value = true
  editingExamId.value = exam.id
  form.subject_id = exam.subject_id
  form.exam_time = normalizeDateTime(exam.exam_time).slice(0, 10)
  form.exam_session = /-([A-Z])$/.exec(exam.exam_name || '')?.[1] || ''
  blankPaperFile.value = undefined
  materialFiles.value = []
  existingBlankPaperName.value = exam.blank_paper_path?.split('/').pop() || ''
  existingMaterialFolderName.value = (exam.material_path || '').split('/').pop() || ''
  removeMaterialFolder.value = false
  dialogVisible.value = true
}

function handleBlankPaperChange(file: UploadFile) {
  blankPaperFile.value = file.raw
  if (file.raw) existingBlankPaperName.value = ''
}

// 素材文件夹选择：浏览器原生 webkitdirectory 输入（Element Plus 的
// el-upload 不支持选文件夹），选中后整包替换，File 上保留
// webkitRelativePath 供上传时还原目录层级。
function triggerMaterialFolderSelect() {
  materialFolderInput.value?.click()
}

const selectedMaterialFolderName = computed(() => {
  const first = materialFiles.value[0] as (File & { webkitRelativePath?: string }) | undefined
  const relative = first?.webkitRelativePath || first?.name || ''
  return relative.split('/')[0] || ''
})

function handleMaterialFolderChange(event: Event) {
  const input = event.target as HTMLInputElement
  materialFiles.value = Array.from(input.files || [])
  removeMaterialFolder.value = false
  // 清空 input，允许再次选择同一个文件夹
  input.value = ''
}

function clearMaterialFiles() {
  materialFiles.value = []
  if (materialFolderInput.value) materialFolderInput.value.value = ''
  // 编辑模式下点「删除」= 移除已保存的素材文件夹（提交时带删除标志）
  removeMaterialFolder.value = isEditing.value && Boolean(existingMaterialFolderName.value)
}

async function submitForm() {
  if (!formRef.value || !form.subject_id) return
  try {
    await formRef.value.validate()
    if (!generatedExamName.value) {
      ElMessage.warning('请先选择考试日期与场次，自动生成考试名称')
      return
    }
    submitting.value = true
    const payload = {
      exam_name: generatedExamName.value,
      exam_time: form.exam_time || undefined,
      blank_paper: blankPaperFile.value,
      material_files: materialFiles.value,
      remove_material_folder: removeMaterialFolder.value || undefined
    }
    const response = isEditing.value && editingExamId.value
      ? await updateExam(form.subject_id, editingExamId.value, payload)
      : await createExam(form.subject_id, payload)
    if (response.code !== 0 && response.code !== 200) throw new Error(response.message || '保存考试失败')
    ElMessage.success(isEditing.value ? '考试修改成功' : '考试创建成功')
    dialogVisible.value = false
    selectedSubjectId.value = form.subject_id
    await fetchExams()
  } catch (error) {
    if (error !== false) ElMessage.error(errorMessage(error, '保存考试失败'))
  } finally {
    submitting.value = false
  }
}

function viewBlankPaper(exam: ExamItem) {
  router.push({
    name: 'answer-upload-structure',
    params: { subjectId: exam.subject_id, examId: exam.id }
  })
}

async function confirmDelete(exam: ExamItem) {
  try {
    await ElMessageBox.confirm(`确定删除考试“${exam.exam_name}”吗？删除后不可恢复。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消'
    })
    const response = await deleteExam(exam.subject_id, exam.id)
    if (response.code !== 0 && response.code !== 200) throw new Error(response.message || '删除考试失败')
    ElMessage.success('考试删除成功')
    await fetchExams()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(errorMessage(error, '删除考试失败'))
  }
}

function normalizeDateTime(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 19) : ''
}

function formatDate(value?: string) {
  return value ? normalizeDateTime(value).slice(0, 10) : '未设置'
}

function errorMessage(error: unknown, fallback: string) {
  const candidate = error as { response?: { data?: { message?: string } }; message?: string }
  return candidate?.response?.data?.message || candidate?.message || fallback
}
</script>

<style scoped>
.exam-management-page { padding: 20px; color: var(--el-text-color-primary); font-size: 14px; }
.page-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.page-header h2 { margin: 0; color: var(--el-text-color-primary); font-size: 20px; font-weight: 600; line-height: 1.4; }
.page-header p { margin: 6px 0 0; color: var(--el-text-color-secondary); font-size: 14px; line-height: 1.6; }
.toolbar { display: flex; gap: 12px; margin-bottom: 18px; }
.toolbar .el-select { width: min(360px, 45%); }
.toolbar .el-input { max-width: 300px; }
.exam-management-page :deep(.el-table) { font-size: 14px; }
.exam-management-page :deep(.el-table th.el-table__cell) { font-size: 14px; font-weight: 600; }
.exam-management-page :deep(.el-form-item__label),
.exam-management-page :deep(.el-input__inner),
.exam-management-page :deep(.el-select__placeholder),
.exam-management-page :deep(.el-button) { font-size: 14px; }
.selected-blank-paper { display: flex; align-items: flex-start; gap: 6px; width: 100%; margin-top: 8px; color: var(--el-text-color-regular); line-height: 1.6; }
.selected-blank-paper .el-icon { flex: 0 0 auto; margin-top: 3px; color: var(--el-color-primary); }
.selected-blank-paper span { min-width: 0; overflow-wrap: anywhere; word-break: break-all; }
.selected-material-files { display: flex; align-items: center; gap: 6px; margin-top: 8px; color: var(--el-text-color-regular); }
.selected-material-files .el-icon { color: var(--el-color-primary); }
.selected-material-files span { min-width: 0; overflow-wrap: anywhere; word-break: break-all; }
.material-folder-field { width: 100%; }
.material-folder-field .el-upload__tip { margin-top: 8px; line-height: 1.6; }
@media (max-width: 640px) {
  .page-header, .toolbar { align-items: stretch; flex-direction: column; }
  .toolbar .el-select, .toolbar .el-input { width: 100%; max-width: none; }
}
</style>

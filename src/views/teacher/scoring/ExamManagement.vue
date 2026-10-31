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
        <el-input
          v-model="searchKeyword"
          clearable
          placeholder="搜索考试名称"
          :prefix-icon="Search"
          @keyup.enter="fetchExams"
          @clear="fetchExams"
        />
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
          <template #default="{ row }">{{ formatDateTime(row.exam_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && exams.length === 0" description="暂无考试" />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px" destroy-on-close>
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
        <el-form-item label="考试名称" prop="exam_name">
          <el-input v-model="form.exam_name" placeholder="请输入考试名称" />
        </el-form-item>
        <el-form-item label="考试时间" prop="exam_time">
          <el-date-picker
            v-model="form.exam_time"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="请选择考试时间"
            style="width: 100%"
          />
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
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
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
const form = reactive<{ subject_id?: number; exam_name: string; exam_time: string }>({
  subject_id: undefined,
  exam_name: '',
  exam_time: ''
})

const subjectById = computed(() => new Map(subjects.value.map((subject) => [subject.subject_id, subject])))
const dialogTitle = computed(() => (isEditing.value ? '编辑考试' : '新增考试'))
const rules: FormRules = {
  subject_id: [{ required: true, message: '请选择所属科目', trigger: 'change' }],
  exam_name: [{ required: true, message: '请输入考试名称', trigger: 'blur' }]
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
  form.exam_name = ''
  form.exam_time = ''
  dialogVisible.value = true
}

function openEditDialog(exam: ExamItem) {
  isEditing.value = true
  editingExamId.value = exam.id
  form.subject_id = exam.subject_id
  form.exam_name = exam.exam_name
  form.exam_time = normalizeDateTime(exam.exam_time)
  dialogVisible.value = true
}

async function submitForm() {
  if (!formRef.value || !form.subject_id) return
  try {
    await formRef.value.validate()
    submitting.value = true
    const payload = { exam_name: form.exam_name.trim(), exam_time: form.exam_time || undefined }
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

function formatDateTime(value?: string) {
  return value ? normalizeDateTime(value) : '未设置'
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
@media (max-width: 640px) {
  .page-header, .toolbar { align-items: stretch; flex-direction: column; }
  .toolbar .el-select, .toolbar .el-input { width: 100%; max-width: none; }
}
</style>

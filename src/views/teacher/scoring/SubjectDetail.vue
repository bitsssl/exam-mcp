<template>
  <div class="subject-detail-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ subjectTitle }}</span>
          <div class="header-actions">
            <el-button class="templates-entry-btn" @click="openTemplatesDialog">
              <el-icon><Collection /></el-icon>
              阅卷模板
            </el-button>
            <el-button @click="goBack">返回</el-button>
          </div>
        </div>
      </template>

      <div class="toolbar-row">
        <el-button type="primary" class="add-exam-btn" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          新增考试
        </el-button>

        <el-input
          v-model="searchKeyword"
          class="exam-search"
          clearable
          placeholder="搜索考试名称"
          :prefix-icon="Search"
          @clear="fetchExams"
          @keyup.enter="fetchExams"
        />
      </div>

      <div v-loading="loading" class="exam-grid">
        <div
          v-for="exam in exams"
          :key="exam.id"
          class="exam-card"
          @click="goToExamDetail(exam)"
        >
          <div class="exam-card-header">
            <span class="exam-no">考试</span>
          </div>
          <div class="exam-name">{{ exam.exam_name }}</div>
          <div class="exam-meta">考试时间：{{ formatDateTime(exam.exam_time) }}</div>
          <div class="exam-actions">
            <el-button size="small" @click.stop="openEditDialog(exam)">修改</el-button>
            <el-button size="small" type="danger" @click.stop="confirmDeleteExam(exam)">
              删除
            </el-button>
          </div>
        </div>

        <el-empty
          v-if="!loading && exams.length === 0"
          class="empty-state"
          description="暂无考试"
        />
      </div>

      <el-dialog
        v-model="dialogVisible"
        :title="dialogTitle"
        width="560px"
        append-to-body
        class="exam-dialog"
        destroy-on-close
      >
        <el-form
          ref="examFormRef"
          :model="examForm"
          :rules="examRules"
          label-width="96px"
        >
          <el-form-item label="考试名称" prop="exam_name">
            <el-input v-model="examForm.exam_name" placeholder="请输入考试名称" />
          </el-form-item>
          <el-form-item label="考试时间" prop="exam_time">
            <el-date-picker
              v-model="examForm.exam_time"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm:ss"
              placeholder="请选择考试时间"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="说明" prop="remark">
            <el-input
              v-model="examForm.remark"
              type="textarea"
              :rows="3"
              maxlength="255"
              show-word-limit
              placeholder="请输入说明"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="submitting" @click="submitExam">
              {{ isEditing ? '保存' : '提交' }}
            </el-button>
          </div>
        </template>
      </el-dialog>

      <el-dialog
        v-model="templatesDialogVisible"
        title="阅卷模板"
        width="720px"
        append-to-body
        class="subject-template-dialog"
      >
        <div class="template-overview" v-loading="templatesLoading">
          <div v-if="!templatesLoading && !subjectTemplates.length" class="template-empty-wrap">
            <el-empty description="当前科目下暂无阅卷模板" />
          </div>
          <div v-else class="template-card-grid">
            <div
              v-for="template in subjectTemplates"
              :key="template.template_id"
              class="template-card"
            >
              <div class="template-card-head">
                <el-icon class="template-card-icon"><Collection /></el-icon>
                <strong class="template-card-name">{{ template.template_name }}</strong>
              </div>
              <div class="template-card-body">
                <div class="template-card-row">
                  <span class="template-card-label">所属考试</span>
                  <span class="template-card-value">{{ template.exam_name }}</span>
                </div>
                <div class="template-card-row">
                  <span class="template-card-label">绑定题数</span>
                  <span class="template-card-value">{{ template.template_items.length }} 道题</span>
                </div>
                <div class="template-card-row">
                  <span class="template-card-label">创建时间</span>
                  <span class="template-card-value">{{ formatDateTime(template.created_at) }}</span>
                </div>
              </div>
              <div class="template-card-actions">
                <el-button class="template-view-btn" size="small" @click="viewTemplateDetail(template)">查看组装详情</el-button>
                <el-button class="template-copy-btn" size="small" :loading="copyingTemplateId === template.template_id" @click="openCopyDialog(template)">复用至其他考试</el-button>
                <el-button class="template-delete-btn" size="small" :loading="deletingTemplateId === template.template_id" @click="confirmDeleteTemplate(template)">删除</el-button>
              </div>
            </div>
          </div>
        </div>
      </el-dialog>

      <el-dialog v-model="copyDialogVisible" title="复用阅卷模板" width="480px" append-to-body>
        <el-form label-position="top" :model="copyForm">
          <el-form-item label="源模板">
            <div class="copy-source">{{ copySource?.template_name }}（{{ copySource?.exam_name }}）</div>
          </el-form-item>
          <el-form-item label="目标考试">
            <el-select v-model="copyForm.target_exam_id" class="full-width" filterable placeholder="请选择本科目下的其他考试">
              <el-option v-for="exam in copyTargetExams" :key="exam.id" :label="exam.exam_name" :value="exam.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="新模板名称（可选）">
            <el-input v-model="copyForm.template_name" :placeholder="`${copySource?.template_name || '模板'}（副本）`" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="copyDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="copyingTemplateId !== null" :disabled="!copyForm.target_exam_id" @click="submitCopy">
            复制到目标考试
          </el-button>
        </template>
      </el-dialog>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { Collection, Plus, Search } from '@element-plus/icons-vue';
import {
  copyGradingTemplate,
  createExam,
  deleteExam,
  deleteGradingTemplate,
  getExams,
  getGradingTemplates,
  getSubject,
  updateExam,
  type ExamGradingTemplate,
  type GradingTemplateItem,
  type ExamItem,
  type SubjectItem
} from '@/api/teacher-scoring';

defineOptions({
  name: 'TeacherSubjectDetail'
});

const route = useRoute();
const router = useRouter();
const subjectId = computed(() => String(route.params.subjectId || ''));
const loading = ref(false);
const submitting = ref(false);
const templatesDialogVisible = ref(false);
const templatesLoading = ref(false);
const deletingTemplateId = ref<number | null>(null);
const copyingTemplateId = ref<number | null>(null);
const copyDialogVisible = ref(false);
const copySource = ref<SubjectTemplateView | null>(null);
const copyForm = reactive<{ target_exam_id: number | null; template_name: string }>({ target_exam_id: null, template_name: '' });
const subjectTemplates = ref<SubjectTemplateView[]>([]);
const dialogVisible = ref(false);
const isEditing = ref(false);
const editingExamId = ref<number | null>(null);
const searchKeyword = ref('');
const subject = ref<SubjectItem | null>(null);
const exams = ref<ExamItem[]>([]);
const examFormRef = ref<FormInstance>();
const subjectTitle = computed(() => subject.value ? `${subject.value.subject_name} - 科目详情` : '科目详情');
const dialogTitle = computed(() => isEditing.value ? '修改考试' : '新增考试');
interface SubjectTemplateView extends ExamGradingTemplate {
  exam_name: string;
  exam_time?: string;
}

const examForm = reactive({
  exam_name: '',
  exam_time: '',
  remark: ''
});

const copyTargetExams = computed(() => exams.value.filter((exam) => String(exam.id) !== String(copySource.value?.exam_id)));

const questionTypeLabelMap: Record<string, string> = {
  short_answer: '简答题',
  image: '图片题',
  operation: '操作题',
  code: '代码题',
  file: '文件题',
  subjective: '主观题',
  calculation: '计算题'
};

const getQuestionTypeLabel = (value?: string) => {
  const key = String(value || '').trim();
  return questionTypeLabelMap[key] || key || '未设置';
};

const displayQuestionVersion = (item: GradingTemplateItem) => item.question_version_no || item.standard_item?.question_version_no || '';
const displayQuestionVersionLabel = (item: GradingTemplateItem) => {
  const version = displayQuestionVersion(item);
  return version ? '本题 V' + version : '本题版本未记录';
};
const examRules: FormRules = {
  exam_name: [
    { required: true, message: '请输入考试名称', trigger: 'blur' }
  ]
};

let searchTimer: number | undefined;

watch(searchKeyword, () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    fetchExams();
  }, 300);
});

onMounted(async () => {
  await fetchSubject();
  await fetchExams();
});

const resetForm = () => {
  isEditing.value = false;
  editingExamId.value = null;
  examForm.exam_name = '';
  examForm.exam_time = '';
  examForm.remark = '';
  examFormRef.value?.clearValidate();
};

const openCreateDialog = () => {
  resetForm();
  dialogVisible.value = true;
};

const openEditDialog = (exam: ExamItem) => {
  isEditing.value = true;
  editingExamId.value = exam.id;
  examForm.exam_name = exam.exam_name;
  examForm.exam_time = normalizeDateTime(exam.exam_time);
  examForm.remark = '';
  examFormRef.value?.clearValidate();
  dialogVisible.value = true;
};


const openTemplatesDialog = async () => {
  templatesDialogVisible.value = true;
  await fetchSubjectTemplates();
};

const confirmDeleteTemplate = async (template: SubjectTemplateView) => {
  try {
    await ElMessageBox.confirm(
      `确定删除阅卷模板“${template.template_name}”吗？删除后不会影响已创建的评阅标准版本。`,
      '删除阅卷模板',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    );
  } catch {
    return;
  }

  deletingTemplateId.value = template.template_id;
  try {
    const response = await deleteGradingTemplate(subjectId.value, template.exam_id, template.template_id);
    if (response.code === 0 || response.code === 200) {
      ElMessage.success(response.message || '阅卷模板已删除');
      const deletedId = template.template_id;
      subjectTemplates.value = subjectTemplates.value.filter((item) => item.template_id !== deletedId);
    } else {
      ElMessage.error(response.message || '删除阅卷模板失败');
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || error.message || '删除阅卷模板失败');
  } finally {
    deletingTemplateId.value = null;
  }
};

const openCopyDialog = (template: SubjectTemplateView) => {
  copySource.value = template;
  copyForm.target_exam_id = null;
  copyForm.template_name = '';
  copyDialogVisible.value = true;
};

const viewTemplateDetail = (template: SubjectTemplateView) => {
  router.push({
    name: 'teacher-grading-templates',
    params: { subjectId: subjectId.value, examId: template.exam_id },
    query: { readonly: '1', templateId: String(template.template_id) }
  });
};

const submitCopy = async () => {
  if (!copySource.value || !copyForm.target_exam_id) return;
  copyingTemplateId.value = copySource.value.template_id;
  try {
    const response = await copyGradingTemplate(
      subjectId.value,
      copySource.value.exam_id,
      copySource.value.template_id,
      { target_exam_id: copyForm.target_exam_id, template_name: copyForm.template_name.trim() || undefined }
    );
    if (response.code === 0 || response.code === 200) {
      ElMessage.success(response.message || '阅卷模板已复制');
      copyDialogVisible.value = false;
      await fetchSubjectTemplates();
    } else {
      ElMessage.error(response.message || '复制阅卷模板失败');
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || error.message || '复制阅卷模板失败');
  } finally {
    copyingTemplateId.value = null;
  }
};
const fetchSubjectTemplates = async () => {
  templatesLoading.value = true;
  try {
    const examsResponse = await getExams(subjectId.value, '');
    const templateExams = (examsResponse.code === 0 || examsResponse.code === 200)
      ? (examsResponse.data || []) as ExamItem[]
      : exams.value;
    const grouped = await Promise.all(templateExams.map(async (exam) => {
      const response = await getGradingTemplates(subjectId.value, exam.id);
      if (response.code !== 0 && response.code !== 200) return [];
      return (response.data || []).map((template: ExamGradingTemplate) => ({
        ...template,
        exam_name: exam.exam_name,
        exam_time: exam.exam_time
      }));
    }));
    subjectTemplates.value = grouped
      .flat()
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || error.message || '获取阅卷模板失败');
  } finally {
    templatesLoading.value = false;
  }
};
const goToExamDetail = (exam: ExamItem) => {
  router.push(`/teacher/scoring/subjects/${subjectId.value}/exams/${exam.id}`);
};

const goToTemplates = () => {
  const exam = exams.value[0];
  if (!exam) {
    ElMessage.info('请先创建考试，再组装阅卷模板');
    return;
  }
  router.push({ name: 'teacher-grading-templates', params: { subjectId: subjectId.value, examId: exam.id } });
};

const goBack = () => {
  router.push({ name: 'teacher-scoring' });
};

const fetchSubject = async () => {
  try {
    const response = await getSubject(subjectId.value);
    if (response.code === 0 || response.code === 200) {
      subject.value = response.data;
    } else {
      ElMessage.error(response.message || '获取科目失败');
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '获取科目失败');
  }
};

const fetchExams = async () => {
  loading.value = true;
  try {
    const response = await getExams(subjectId.value, searchKeyword.value.trim());
    if (response.code === 0 || response.code === 200) {
      exams.value = response.data || [];
    } else {
      ElMessage.error(response.message || '获取考试失败');
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '获取考试失败');
  } finally {
    loading.value = false;
  }
};

const submitExam = async () => {
  if (!examFormRef.value) return;

  try {
    await examFormRef.value.validate();
    submitting.value = true;

    const payload = {
      exam_name: examForm.exam_name,
      exam_time: examForm.exam_time || undefined,
    };

    const response = isEditing.value && editingExamId.value
      ? await updateExam(subjectId.value, editingExamId.value, payload)
      : await createExam(subjectId.value, payload);

    if (response.code === 0 || response.code === 200) {
      ElMessage.success(isEditing.value ? '考试修改成功' : '考试创建成功');
      dialogVisible.value = false;
      resetForm();
      await fetchExams();
    } else {
      ElMessage.error(response.message || (isEditing.value ? '考试修改失败' : '考试创建失败'));
    }
  } catch (error: any) {
    if (error.response) {
      ElMessage.error(error.response.data.message || (isEditing.value ? '考试修改失败' : '考试创建失败'));
    } else {
      ElMessage.error(error.message || (isEditing.value ? '考试修改失败' : '考试创建失败'));
    }
  } finally {
    submitting.value = false;
  }
};

const confirmDeleteExam = async (exam: ExamItem) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除考试“${exam.exam_name}”吗？删除后不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const response = await deleteExam(subjectId.value, exam.id);
    if (response.code === 0 || response.code === 200) {
      ElMessage.success('考试删除成功');
      await fetchExams();
    } else {
      const message = response.message || '考试删除失败';
      if (response.code === 400) {
        ElMessage.warning(message);
      } else {
        ElMessage.error(message);
      }
    }
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return;
    const message = error.response?.data?.message || error.message || '考试删除失败';
    if (error.response?.status === 400 || error.response?.data?.code === 400) {
      ElMessage.warning(message);
    } else {
      ElMessage.error(message);
    }
  }
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  return value.slice(0, 16);
};

const normalizeDateTime = (value?: string) => {
  if (!value) return '';
  return value.slice(0, 19);
};

</script>

<style scoped>
.subject-detail-page {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.templates-entry-btn {
  height: 40px;
  border-radius: 8px;
  font-weight: 500;
}

.templates-entry-btn :deep(.el-icon) {
  margin-right: 4px;
}

.add-exam-btn {
  height: 40px;
  border-radius: 8px;
  font-weight: 500;
}

.exam-search {
  width: 180px;
  margin-left: auto;
}

.exam-search :deep(.el-input__wrapper) {
  border-radius: 999px;
}

.exam-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px;
  min-height: 240px;
}

.exam-card {
  position: relative;
  min-height: 150px;
  padding: 16px 16px 52px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.exam-card:hover {
  border-color: #4f8ef7;
  box-shadow: 0 8px 20px rgba(79, 142, 247, 0.12);
  transform: translateY(-2px);
}

.exam-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.exam-no {
  display: inline-flex;
  max-width: 100%;
  padding: 4px 10px;
  border-radius: 6px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 13px;
  font-weight: 600;
}

.exam-name {
  margin-bottom: 10px;
  color: #111827;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.exam-meta,
.exam-file {
  margin-bottom: 8px;
  color: #64748b;
  font-size: 13px;
}

.exam-actions {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.empty-state {
  grid-column: 1 / -1;
  align-self: center;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

:deep(.exam-dialog) {
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  margin-top: 7vh;
}

:deep(.exam-dialog .el-dialog__body) {
  overflow-y: auto;
  padding-bottom: 8px;
}


.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.template-overview {
  min-height: 320px;
}

.template-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.template-card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  padding: 16px 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.template-card:hover {
  border-color: #c7d2fe;
  box-shadow: 0 4px 14px rgba(30, 41, 59, 0.07);
}

.template-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.template-card-icon {
  color: #6366f1;
  font-size: 18px;
}

.template-card-name {
  font-size: 15px;
  color: #1f2937;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 4px;
  border-top: 1px dashed #eef2f7;
}

.template-card-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  line-height: 1.8;
}

.template-card-label {
  color: #94a3b8;
}

.template-card-value {
  color: #374151;
  font-weight: 500;
  max-width: 60%;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
}

.template-list {
  max-height: 520px;
  overflow-y: auto;
  padding-right: 4px;
  border-right: 1px solid #e5e7eb;
}

.template-list-item {
  width: 100%;
  margin-bottom: 10px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.template-list-item:hover,
.template-list-item.active {
  border-color: #67c23a;
  background: #f6ffed;
  box-shadow: 0 4px 14px rgba(103, 194, 58, 0.12);
}

.template-list-main strong,
.template-list-main span,
.template-list-meta span {
  display: block;
}

.template-list-main strong {
  color: #111827;
  font-size: 14px;
  line-height: 1.4;
}

.template-list-main span,
.template-list-meta {
  color: #64748b;
  font-size: 12px;
}

.template-list-main span {
  margin-top: 4px;
}

.template-list-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}

.template-list-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 10px;
}

.template-view-btn {
  border-color: #67c23a;
  background: #fff;
  color: #67c23a;
  font-weight: 500;
}

.template-delete-btn {
  border-color: #cbd5e1;
  background: #ffffff;
  color: #334155;
  font-weight: 600;
}

.template-delete-btn:hover,
.template-delete-btn:focus {
  border-color: #94a3b8;
  background: #f8fafc;
  color: #0f172a;
}

.template-copy-btn {
  border-color: #3478e5;
  background: #fff;
  color: #3478e5;
  font-weight: 500;
}

.copy-source {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
  color: #374151;
  font-size: 13px;
}

.template-detail-panel {
  min-width: 0;
}

.template-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.template-detail-kicker {
  margin-bottom: 4px;
  color: #67c23a;
  font-size: 13px;
  font-weight: 600;
}

.template-detail-head h3 {
  margin: 0;
  color: #111827;
  font-size: 20px;
  line-height: 1.35;
}

.template-detail-actions {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.template-detail-badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.template-description {
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
  color: #475569;
  line-height: 1.6;
}

.template-detail-table {
  width: 100%;
}

.version-stack {
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: #475569;
  font-size: 12px;
}

.criteria-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.55;
}

.criteria-box {
  max-height: 180px;
  min-height: 72px;
  overflow-y: auto;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #ffffff;
}

.criteria-text.muted {
  color: #64748b;
}

:deep(.subject-template-dialog .el-dialog__body) {
  padding-top: 12px;
}
@media (max-width: 1400px) {
  .exam-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 1100px) {
  .exam-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}


@media (max-width: 900px) {
  .template-stats,
  .template-browser {
    grid-template-columns: 1fr;
  }

  .template-list {
    max-height: 260px;
    border-right: 0;
    border-bottom: 1px solid #e5e7eb;
    padding-right: 0;
    padding-bottom: 8px;
  }

  .template-detail-head,
  .template-detail-actions {
    align-items: flex-start;
  }

  .template-detail-head {
    flex-direction: column;
  }

  .template-detail-badges {
    justify-content: flex-start;
  }
}
@media (max-width: 760px) {
  .toolbar-row {
    align-items: stretch;
    flex-direction: column;
  }

  .exam-search {
    width: 100%;
    margin-left: 0;
  }

  .exam-grid {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}
</style>

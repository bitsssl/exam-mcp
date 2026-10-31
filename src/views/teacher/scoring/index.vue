<template>
  <div class="teacher-scoring-page">
    <el-card>
      <template #header>
        <div class="page-header">
          <h2>科目管理</h2>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新增科目
          </el-button>
        </div>
      </template>

      <div class="toolbar-row">
        <el-input
          v-model="searchKeyword"
          class="subject-search"
          clearable
          placeholder="搜索科目号或科目名"
          :prefix-icon="Search"
          @clear="fetchSubjects"
          @keyup.enter="fetchSubjects"
        />
      </div>

      <div v-loading="loading" class="subject-list">
        <div
          v-for="subject in subjects"
          :key="subject.subject_id"
          class="subject-card"
        >
          <div class="subject-identity">
            <span class="subject-no">{{ subject.subject_no }}</span>
            <div class="subject-name">{{ subject.subject_name }}</div>
          </div>
          <div class="subject-meta">创建日期：{{ formatDate(subject.created_at) }}</div>
          <div class="subject-remark" :title="subject.remark || '暂无备注'">{{ subject.remark || '暂无备注' }}</div>
          <div class="subject-actions">
            <el-button link type="primary" @click.stop="openEditDialog(subject)">编辑</el-button>
            <el-button type="danger" @click.stop="confirmDeleteSubject(subject)">
              删除
            </el-button>
          </div>
        </div>

        <el-empty
          v-if="!loading && subjects.length === 0"
          class="empty-state"
          description="暂无科目"
        />
      </div>

      <el-dialog
        v-model="dialogVisible"
        :title="dialogTitle"
        width="520px"
        append-to-body
        class="subject-dialog"
        destroy-on-close
      >
        <el-form
          ref="subjectFormRef"
          :model="subjectForm"
          :rules="subjectRules"
          label-width="90px"
        >
          <el-form-item label="科目号" prop="subject_no">
            <el-input v-model="subjectForm.subject_no" placeholder="请输入科目号" />
          </el-form-item>
          <el-form-item label="科目名" prop="subject_name">
            <el-input v-model="subjectForm.subject_name" placeholder="请输入科目名" />
          </el-form-item>
          <el-form-item label="创建日期" prop="created_at">
            <el-date-picker
              v-model="subjectForm.created_at"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="请选择创建日期"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="备注" prop="remark">
            <el-input
              v-model="subjectForm.remark"
              type="textarea"
              :rows="3"
              maxlength="255"
              show-word-limit
              placeholder="请输入备注"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="submitting" @click="submitSubject">
              {{ isEditing ? '保存' : '提交' }}
            </el-button>
          </div>
        </template>
      </el-dialog>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox, FormInstance, FormRules } from 'element-plus';
import { Plus, Search } from '@element-plus/icons-vue';
import {
  createSubject,
  deleteSubject,
  getSubjects,
  updateSubject,
  type SubjectItem
} from '@/api/teacher-scoring';

defineOptions({
  name: 'TeacherScoring'
});

const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const isEditing = ref(false);
const editingSubjectId = ref<number | null>(null);
const searchKeyword = ref('');
const subjects = ref<SubjectItem[]>([]);
const subjectFormRef = ref<FormInstance>();
const dialogTitle = computed(() => isEditing.value ? '修改科目' : '新增科目');

const subjectForm = reactive({
  subject_no: '',
  subject_name: '',
  created_at: '',
  remark: ''
});

const subjectRules: FormRules = {
  subject_no: [
    { required: true, message: '请输入科目号', trigger: 'blur' }
  ],
  subject_name: [
    { required: true, message: '请输入科目名', trigger: 'blur' }
  ],
  created_at: [
    { required: true, message: '请选择创建日期', trigger: 'change' }
  ]
};

let searchTimer: number | undefined;

watch(searchKeyword, () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    fetchSubjects();
  }, 300);
});

onMounted(() => {
  fetchSubjects();
});

const resetForm = () => {
  isEditing.value = false;
  editingSubjectId.value = null;
  subjectForm.subject_no = '';
  subjectForm.subject_name = '';
  subjectForm.created_at = new Date().toISOString().slice(0, 10);
  subjectForm.remark = '';
  subjectFormRef.value?.clearValidate();
};

const openCreateDialog = () => {
  resetForm();
  dialogVisible.value = true;
};

const openEditDialog = (subject: SubjectItem) => {
  isEditing.value = true;
  editingSubjectId.value = subject.subject_id;
  subjectForm.subject_no = subject.subject_no;
  subjectForm.subject_name = subject.subject_name;
  subjectForm.created_at = formatDate(subject.created_at);
  subjectForm.remark = subject.remark || '';
  subjectFormRef.value?.clearValidate();
  dialogVisible.value = true;
};

const fetchSubjects = async () => {
  loading.value = true;
  try {
    const response = await getSubjects(searchKeyword.value.trim());
    if (response.code === 0 || response.code === 200) {
      subjects.value = response.data || [];
    } else {
      ElMessage.error(response.message || '获取科目失败');
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '获取科目失败');
  } finally {
    loading.value = false;
  }
};

const submitSubject = async () => {
  if (!subjectFormRef.value) return;

  try {
    await subjectFormRef.value.validate();
    submitting.value = true;

    const payload = {
      subject_no: subjectForm.subject_no,
      subject_name: subjectForm.subject_name,
      created_at: subjectForm.created_at,
      remark: subjectForm.remark || undefined
    };

    const response = isEditing.value && editingSubjectId.value
      ? await updateSubject(editingSubjectId.value, payload)
      : await createSubject(payload);

    if (response.code === 0 || response.code === 200) {
      ElMessage.success(isEditing.value ? '科目修改成功' : '科目创建成功');
      dialogVisible.value = false;
      resetForm();
      await fetchSubjects();
    } else {
      ElMessage.error(response.message || (isEditing.value ? '科目修改失败' : '科目创建失败'));
    }
  } catch (error: any) {
    if (error.response) {
      ElMessage.error(error.response.data.message || (isEditing.value ? '科目修改失败' : '科目创建失败'));
    } else {
      ElMessage.error(error.message || (isEditing.value ? '科目修改失败' : '科目创建失败'));
    }
  } finally {
    submitting.value = false;
  }
};

const confirmDeleteSubject = async (subject: SubjectItem) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除科目“${subject.subject_name}”吗？删除后不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const response = await deleteSubject(subject.subject_id);
    if (response.code === 0 || response.code === 200) {
      ElMessage.success('科目删除成功');
      await fetchSubjects();
    } else {
      const message = response.message || '科目删除失败';
      if (response.code === 400) {
        ElMessage.warning(message);
      } else {
        ElMessage.error(message);
      }
    }
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return;
    const message = error.response?.data?.message || error.message || '科目删除失败';
    if (error.response?.status === 400 || error.response?.data?.code === 400) {
      ElMessage.warning(message);
    } else {
      ElMessage.error(message);
    }
  }
};

const formatDate = (value: string) => {
  if (!value) return '-';
  return value.slice(0, 10);
};
</script>

<style scoped>
.teacher-scoring-page {
  padding: 20px;
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.page-header h2 { margin: 0; color: var(--el-text-color-primary); font-size: 20px; font-weight: 600; line-height: 1.4; }

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  margin-bottom: 20px;
}

.subject-search {
  width: min(300px, 100%);
}

.subject-search :deep(.el-input__wrapper) {
  border-radius: 999px;
}

.subject-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 240px;
}

.subject-card {
  display: grid;
  grid-template-columns: minmax(230px, 1.2fr) minmax(150px, 0.7fr) minmax(180px, 1fr) auto;
  align-items: center;
  gap: 20px;
  min-height: 82px;
  padding: 14px 18px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.subject-card:hover { border-color: var(--el-color-primary-light-5); box-shadow: 0 3px 12px rgba(15, 23, 42, 0.07); }
.subject-identity { display: flex; align-items: center; gap: 14px; min-width: 0; }

.subject-no {
  display: inline-flex;
  max-width: 100%;
  padding: 4px 10px;
  border-radius: 6px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subject-name {
  min-width: 0;
  color: #111827;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.subject-meta {
  color: #64748b;
  font-size: 14px;
  white-space: nowrap;
}

.subject-remark {
  color: #94a3b8;
  font-size: 14px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subject-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-self: end;
}

.empty-state {
  align-self: center;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

:deep(.subject-dialog) {
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  margin-top: 7vh;
}

:deep(.subject-dialog .el-dialog__body) {
  overflow-y: auto;
  padding-bottom: 8px;
}

@media (max-width: 900px) {
  .subject-card { grid-template-columns: minmax(180px, 1fr) minmax(140px, auto) auto; gap: 12px; }
  .subject-remark { grid-column: 1 / 3; grid-row: 2; }
  .subject-actions { grid-column: 3; grid-row: 1 / 3; }
}

@media (max-width: 640px) {
  .page-header { align-items: stretch; flex-direction: column; }
  .toolbar-row { justify-content: stretch; }
  .subject-search { width: 100%; }
  .subject-card { grid-template-columns: minmax(0, 1fr) auto; gap: 8px 12px; }
  .subject-identity { grid-column: 1 / -1; }
  .subject-meta { grid-column: 1; }
  .subject-remark { grid-column: 1 / -1; grid-row: auto; }
  .subject-actions { grid-column: 2; grid-row: 2; }
}
</style>

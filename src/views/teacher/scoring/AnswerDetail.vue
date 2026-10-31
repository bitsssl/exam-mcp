<template>
  <div class="answer-detail-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ answerTitle }}</span>
          <el-button @click="goBack">返回</el-button>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="files"
        border
        style="width: 100%"
      >
        <el-table-column prop="file_name" label="文件名" min-width="220" />
        <el-table-column prop="file_type" label="类型" width="120" />
        <el-table-column label="大小" width="120">
          <template #default="{ row }">
            {{ formatFileSize(row.file_size) }}
          </template>
        </el-table-column>
        <el-table-column prop="relative_path" label="相对路径" min-width="360" />
      </el-table>

      <el-empty
        v-if="!loading && files.length === 0"
        description="暂无文件明细"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  getAnswerFiles,
  type AnswerFileItem,
  type AnswerSheetItem
} from '@/api/teacher-scoring';

defineOptions({
  name: 'TeacherAnswerDetail'
});

const route = useRoute();
const router = useRouter();
const subjectId = computed(() => String(route.params.subjectId || ''));
const examId = computed(() => String(route.params.examId || ''));
const packageId = computed(() => String(route.params.packageId || ''));
const answerId = computed(() => String(route.params.answerId || ''));
const loading = ref(false);
const answer = ref<AnswerSheetItem | null>(null);
const files = ref<AnswerFileItem[]>([]);
const answerTitle = computed(() => answer.value ? `${answer.value.student_no} - 考生答卷详情` : '考生答卷详情');

onMounted(() => {
  fetchFiles();
});

const goBack = () => {
  router.back();
};

const fetchFiles = async () => {
  loading.value = true;
  try {
    const response = await getAnswerFiles(
      subjectId.value,
      examId.value,
      packageId.value,
      answerId.value
    );
    if (response.code === 0 || response.code === 200) {
      answer.value = response.data?.answer || null;
      files.value = response.data?.files || [];
    } else {
      ElMessage.error(response.message || '获取答卷文件失败');
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '获取答卷文件失败');
  } finally {
    loading.value = false;
  }
};

const formatFileSize = (value?: number) => {
  if (!value && value !== 0) return '-';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
};
</script>

<style scoped>
.answer-detail-page {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}
</style>

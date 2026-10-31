<template>
  <div class="student-score-compare-page" v-loading="loading">
    <header class="compare-header">
      <div>
        <div class="compare-eyebrow">{{ resultTypeLabel }}考生评分对比</div>
        <h2>{{ packageName }}</h2>
        <p>{{ compareIntro }}</p>
      </div>
      <div class="compare-header-actions">
        <el-button @click="goBack">返回</el-button>
      </div>
    </header>

    <section class="compare-toolbar">
      <el-select
        v-if="resultType === 'trial'"
        v-model="selectedTrialStudent"
        class="compare-student-select"
        filterable
        clearable
        placeholder="请选择 1 位考生查看标准对比"
      >
        <el-option
          v-for="student in studentOptions"
          :key="student.value"
          :label="student.label"
          :value="student.value"
        />
      </el-select>
      <el-select
        v-else
        v-model="selectedStudents"
        class="compare-student-select"
        multiple
        filterable
        clearable
        collapse-tags
        collapse-tags-tooltip
        placeholder="请选择要对比的考号"
      >
        <el-option
          v-for="student in studentOptions"
          :key="student.value"
          :label="student.label"
          :value="student.value"
        />
      </el-select>
      <el-button type="primary" :disabled="compareButtonDisabled" @click="applySelection">对比</el-button>
      <div class="compare-summary">
        <span>{{ resultTypeLabel }}</span>
        <span>{{ selectedSummaryText }}</span>
        <span>有结果 {{ comparisonRows.length }} 位</span>
      </div>
    </section>

    <el-empty v-if="!loading && compareButtonDisabled" :description="emptySelectionText" />
    <el-empty v-else-if="!loading && !comparisonRows.length" description="暂无可对比的评分结果" />

    <section v-else class="compare-content">
      <div class="compare-pager">
        <el-button size="small" :disabled="currentPage <= 1" @click="currentPage -= 1">上一页</el-button>
        <span>{{ pagerText }}</span>
        <el-button size="small" :disabled="currentPage >= totalPages" @click="currentPage += 1">下一页</el-button>
      </div>

      <div class="compare-split" :class="{ 'is-trial-standard': resultType === 'trial' }">
        <article v-for="student in pagedRows" :key="student.student_no" class="compare-student-panel">
          <div class="compare-student-head">
            <div>
              <div class="compare-student-no">{{ student.student_no }}</div>
              <div class="compare-student-meta">已评 {{ student.gradedCount }}/{{ student.questionCount }} 题</div>
            </div>
            <div class="compare-student-badges">
              <el-tag size="small" :type="student.completed ? 'success' : 'warning'" effect="light">{{ student.statusText }}</el-tag>
              <span>总分 {{ student.totalScore }}</span>
            </div>
          </div>

          <div class="compare-question-list">
            <section
              v-for="question in student.questions"
              :key="question.question_no"
              class="compare-question-item"
              :class="{ 'is-empty': !question.record }"
            >
              <template v-if="resultType === 'trial'">
                <div class="compare-question-top">
                  <span class="question-tag">Q{{ question.question_no }}</span>
                  <el-tag size="small" effect="plain" :type="question.trialAttempts?.length ? 'primary' : 'info'">试阅 {{ question.attemptCount || 0 }} 次</el-tag>
                </div>
                <div class="compare-question-title" :title="question.questionText">{{ question.questionText || '未命名题目' }}</div>
                <div class="compare-question-metrics">
                  <span><small>人工评分</small><b>{{ question.manualScoreText }}</b></span>
                  <span><small>最近系统分</small><b>{{ question.scoreText }}</b></span>
                  <span><small>版本分差</small><b :class="question.standardSpreadClass">{{ question.standardSpreadText }}</b></span>
                </div>
                <div v-if="!question.trialAttempts?.length" class="compare-standard-empty">暂无该题试阅记录</div>
                <div v-else class="compare-standard-list">
                  <div
                    v-for="attempt in question.trialAttempts"
                    :key="attempt.key"
                    class="compare-standard-row"
                  >
                    <div class="compare-standard-main">
                      <div class="compare-standard-title">{{ attempt.attemptText }}</div>
                      <div class="compare-standard-meta">{{ attempt.standardVersionText }} · {{ attempt.gradedAt }}</div>
                    </div>
                    <div class="compare-standard-score">
                      <small>系统评分</small>
                      <b>{{ attempt.scoreText }}</b>
                    </div>
                    <div class="compare-standard-score">
                      <small>与人工差</small>
                      <b :class="attempt.manualDiffClass">{{ attempt.manualDiffText }}</b>
                    </div>
                    <el-button
                      class="student-comment-button"
                      size="small"
                      type="primary"
                      text
                      @click="openComment(student.student_no, question.question_no, attempt.comment, `${attempt.attemptText} / ${attempt.standardVersionText}`)"
                    >评语</el-button>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="compare-question-top">
                  <span class="question-tag">Q{{ question.question_no }}</span>
                </div>
                <div class="compare-question-title" :title="question.questionText">{{ question.questionText || '未命名题目' }}</div>
                <div class="compare-question-metrics">
                  <span><small>人工评分</small><b>{{ question.manualScoreText }}</b></span>
                  <span><small>系统评分</small><b>{{ question.scoreText }}</b></span>
                  <span><small>评分差</small><b :class="question.manualDiffClass">{{ question.manualDiffText }}</b></span>
                </div>
                <div class="compare-question-foot">
                  <span>{{ question.record ? '正式结果' : '暂无结果' }}</span>
                  <el-button class="student-comment-button" size="small" type="primary" text @click="openComment(student.student_no, question.question_no, question.comment)">评语</el-button>
                </div>
              </template>
            </section>
          </div>
        </article>
      </div>
    </section>

    <el-dialog v-model="commentDialogVisible" :title="commentDialogTitle" width="640px" class="student-comment-dialog" append-to-body>
      <div class="student-comment-dialog-body">{{ commentDialogText || '暂无评语' }}</div>
      <template #footer>
        <el-button type="primary" @click="commentDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getLocalGradingRecords, type LocalGradingRecordItem } from '@/api/teacher-scoring';
import { getLocalPackage, type LocalPackageData } from '@/utils/local-scoring-package';
import { buildStudentScoreComparisonRows, type ScoreCompareResultType } from '@/utils/scoring-comparison';

defineOptions({
  name: 'TeacherStudentScoreCompare'
});

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const localPackage = ref<LocalPackageData | null>(null);
const gradingRecords = ref<LocalGradingRecordItem[]>([]);
const selectedStudents = ref<string[]>([]);
const selectedTrialStudent = ref('');
const currentPage = ref(1);
const pageSize = computed(() => resultType.value === 'trial' ? 1 : 2);
const commentDialogVisible = ref(false);
const commentDialogTitle = ref('评语');
const commentDialogText = ref('');

const packageId = computed(() => String(route.params.packageId || ''));
const resultType = computed<ScoreCompareResultType>(() => route.query.type === 'formal' ? 'formal' : 'trial');
const resultTypeLabel = computed(() => resultType.value === 'formal' ? '正式评阅' : '试阅');
const packageName = computed(() => localPackage.value?.package_name || '考生评分对比');
const compareIntro = computed(() => resultType.value === 'trial'
  ? '选择 1 位考生，查看该考生每道题在不同评分标准和每次试阅下的系统评分、评分差和评语。'
  : '按考号选择考生，左右分屏查看人工评分、系统评分、评分差和评语。');
const effectiveSelectedStudents = computed(() => resultType.value === 'trial'
  ? (selectedTrialStudent.value ? [selectedTrialStudent.value] : [])
  : selectedStudents.value);
const compareButtonDisabled = computed(() => resultType.value === 'trial'
  ? !selectedTrialStudent.value
  : selectedStudents.value.length < 2);
const selectedSummaryText = computed(() => resultType.value === 'trial'
  ? (selectedTrialStudent.value ? `当前考生 ${selectedTrialStudent.value}` : '未选择考生')
  : `已选 ${selectedStudents.value.length} 位`);
const emptySelectionText = computed(() => resultType.value === 'trial'
  ? '请选择 1 位考生查看不同评分标准之间的对比'
  : '请至少选择 2 位考生进行对比');
const pagerText = computed(() => resultType.value === 'trial'
  ? `第 ${currentPage.value} / ${totalPages.value} 页，每页 1 位考生`
  : `第 ${currentPage.value} / ${totalPages.value} 页，每页 2 位考生`);
const studentOptions = computed(() => (localPackage.value?.students || []).map((student) => ({
  label: student.student_no,
  value: student.student_no
})));
const comparisonRows = computed(() => buildStudentScoreComparisonRows(
  localPackage.value,
  gradingRecords.value,
  resultType.value,
  effectiveSelectedStudents.value
));
const totalPages = computed(() => Math.max(1, Math.ceil(comparisonRows.value.length / pageSize.value)));
const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return comparisonRows.value.slice(start, start + pageSize.value);
});

watch(selectedStudents, () => {
  currentPage.value = 1;
});

watch(selectedTrialStudent, () => {
  currentPage.value = 1;
});

watch(totalPages, () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value;
});

const parseSelectedStudents = () => String(route.query.students || '')
  .split(/[,?;?\s]+/)
  .map((item) => item.trim())
  .filter(Boolean);

const loadPage = async () => {
  loading.value = true;
  try {
    const found = await getLocalPackage(packageId.value);
    if (!found) {
      ElMessage.error('未找到本地试卷包，请返回试卷包详情页重新进入');
      return;
    }
    localPackage.value = found;
    const parsedStudents = parseSelectedStudents().filter((studentNo) => found.students.some((student) => student.student_no === studentNo));
    if (resultType.value === 'trial') {
      selectedTrialStudent.value = parsedStudents[0] || '';
      selectedStudents.value = [];
    } else {
      selectedStudents.value = parsedStudents;
      selectedTrialStudent.value = '';
    }
    const localPackageId = found.local_package_id || packageId.value;
    const response = await getLocalGradingRecords(
      String(route.params.subjectId),
      String(route.params.examId),
      localPackageId
    );
    if (response.code === 0 || response.code === 200) {
      gradingRecords.value = response.data || [];
    }
  } finally {
    loading.value = false;
  }
};

const applySelection = () => {
  const students = effectiveSelectedStudents.value;
  if (resultType.value === 'trial' && !students.length) {
    ElMessage.warning('请选择 1 位考生查看评分标准对比');
    return;
  }
  if (resultType.value === 'formal' && students.length < 2) {
    ElMessage.warning('请至少选择 2 位考生进行对比');
    return;
  }
  router.replace({
    name: 'teacher-student-score-compare',
    params: route.params,
    query: {
      type: resultType.value,
      students: students.join(',')
    }
  });
};

const openComment = (studentNo: string, questionNo: string, comment?: string, context?: string) => {
  commentDialogTitle.value = `评语 - ${studentNo} / Q${questionNo}${context ? ` / ${context}` : ''}`;
  commentDialogText.value = comment || '暂无评语';
  commentDialogVisible.value = true;
};

const goBack = () => {
  router.back();
};

onMounted(loadPage);
</script>

<style scoped>
.student-score-compare-page {
  min-height: 100%;
  padding: 20px;
  background: #f5f7fb;
}

.compare-header,
.compare-toolbar,
.compare-content {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
}

.compare-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
}

.compare-eyebrow {
  color: #2563eb;
  font-size: 13px;
  font-weight: 700;
}

.compare-header h2 {
  margin: 4px 0;
  color: #111827;
  font-size: 22px;
}

.compare-header p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}

.compare-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
  padding: 12px;
}

.compare-student-select {
  width: 420px;
  max-width: 100%;
}

.compare-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
  color: #64748b;
  font-size: 13px;
}

.compare-summary span {
  padding: 4px 9px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #f8fafc;
}

.compare-content {
  margin-top: 14px;
  padding: 14px;
}

.compare-pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-bottom: 12px;
  color: #64748b;
  font-size: 13px;
}

.compare-split {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.compare-split.is-trial-standard {
  grid-template-columns: 1fr;
}

.compare-student-panel {
  min-width: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.compare-student-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid #eef2f7;
  background: #fbfdff;
}

.compare-student-no {
  color: #111827;
  font-size: 18px;
  font-weight: 800;
}

.compare-student-meta {
  margin-top: 3px;
  color: #64748b;
  font-size: 12px;
}

.compare-student-badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.compare-student-badges span {
  padding: 3px 8px;
  border: 1px solid #dbe3ef;
  border-radius: 999px;
  background: #ffffff;
}

.compare-question-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.compare-question-item {
  padding: 12px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #fbfdff;
}

.compare-question-item.is-empty {
  border-color: #e5e7eb;
  background: #f8fafc;
  color: #94a3b8;
}

.compare-question-top,
.compare-question-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.question-tag {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 12px;
  font-weight: 700;
}

.compare-question-top strong {
  color: #047857;
  font-size: 14px;
}

.compare-question-title {
  display: -webkit-box;
  min-height: 38px;
  margin-top: 8px;
  overflow: hidden;
  color: #374151;
  font-size: 13px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.compare-question-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
}

.compare-question-metrics span {
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.compare-question-metrics small,
.compare-question-metrics b {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compare-question-metrics small {
  color: #64748b;
  font-size: 11px;
}

.compare-question-metrics b {
  margin-top: 2px;
  color: #111827;
  font-size: 13px;
}

.compare-question-foot {
  margin-top: 10px;
  color: #64748b;
  font-size: 12px;
}

.compare-standard-empty {
  margin-top: 12px;
  padding: 14px;
  border: 1px dashed #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
  color: #64748b;
  text-align: center;
  font-size: 13px;
}

.compare-standard-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.compare-standard-row {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) 96px 96px auto;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.compare-standard-main {
  min-width: 0;
}

.compare-standard-title {
  color: #111827;
  font-size: 13px;
  font-weight: 700;
}

.compare-standard-meta {
  margin-top: 3px;
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compare-standard-score {
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.compare-standard-score small,
.compare-standard-score b {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compare-standard-score small {
  color: #64748b;
  font-size: 11px;
}

.compare-standard-score b {
  margin-top: 2px;
  color: #111827;
  font-size: 13px;
}

.student-comment-button {
  min-width: 54px;
  padding: 4px 10px;
  border-radius: 6px;
  background: #eef6ff;
  font-weight: 600;
}

.peer-diff-positive {
  color: #047857 !important;
}

.peer-diff-negative {
  color: #b91c1c !important;
}

.peer-diff-neutral {
  color: #475569 !important;
}

.student-comment-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
}

.student-comment-dialog-body {
  max-height: 48vh;
  overflow: auto;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
  color: #1f2937;
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 900px) {
  .compare-header,
  .compare-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .compare-summary {
    margin-left: 0;
  }

  .compare-split {
    grid-template-columns: 1fr;
  }

  .compare-standard-row {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .compare-standard-score {
    display: grid;
    grid-template-columns: 80px 1fr;
    align-items: center;
  }

  .compare-standard-score b {
    margin-top: 0;
    text-align: right;
  }
}
</style>

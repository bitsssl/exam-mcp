<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="680px"
    append-to-body
    destroy-on-close
    class="parse-report-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading ?? false">
      <!-- 结构识别失败：人话报错 + 期望结构 + 目录树预览 -->
      <template v-if="recognitionError">
        <el-alert type="error" :closable="false" show-icon class="report-block">
          <template #title>试卷包结构识别失败</template>
          <div class="error-text">{{ recognitionError }}</div>
        </el-alert>
        <div v-if="expected" class="report-block">
          <div class="block-title">期望结构</div>
          <div class="expected-text">{{ expected }}</div>
        </div>
        <div v-if="treePreview.length" class="report-block">
          <div class="block-title">包内目录（前 {{ treePreview.length }} 项）</div>
          <pre class="tree-preview">{{ treePreview.join('\n') }}</pre>
        </div>
      </template>

      <template v-else-if="report">
        <!-- 概览 -->
        <div class="stat-grid">
          <div class="stat-item">
            <div class="stat-value">{{ reportData.summary.candidateCount }}</div>
            <div class="stat-label">识别考生</div>
          </div>
          <!-- 空白考生统计卡按需求隐藏，保留代码便于后续恢复展示 -->
          <div
            v-if="false"
            class="stat-item"
            :class="{ 'stat-warn': reportData.summary.blankCandidateCount > 0 }"
          >
            <div class="stat-value">{{ reportData.summary.blankCandidateCount }}</div>
            <div class="stat-label">空白考生</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ reportData.summary.questionCount }}</div>
            <div class="stat-label">题目数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ structureSourceText }}</div>
            <div class="stat-label">题目结构来源</div>
          </div>
        </div>

        <!-- 文件定位 -->
        <div class="report-block">
          <div class="block-title">文件定位</div>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="答案卷">
              {{ reportData.files.answerKey || '未找到（请上传参考答案和评分标准）' }}
            </el-descriptions-item>
            <el-descriptions-item label="空白试卷">
              {{ reportData.files.blankPaper || '未提供' }}
            </el-descriptions-item>
            <!-- 素材/附加文件统计按需求隐藏，保留代码便于后续恢复展示 -->
            <el-descriptions-item
              v-if="false"
              label="素材/附加文件（已豁免，不参与解析）"
            >
              {{ reportData.files.ignoredAttachmentCount || 0 }} 个
              <span
                v-if="(reportData.files.ignoredAttachments || []).length"
                class="ignored-list"
              >：{{ (reportData.files.ignoredAttachments || []).join('、') }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 异常清单 -->
        <div class="report-block">
          <div class="block-title">需关注</div>
          <template v-if="!hasIssues">
            <el-text type="success">各项检查正常，无待处理事项</el-text>
          </template>
          <template v-else>
            <el-alert
              v-if="issues.misalignedAnswerCount"
              type="warning"
              :closable="false"
              show-icon
              class="issue-alert"
            >
              <template #title>
                {{ issues.misalignedAnswerCount }} 条作答的题号未在试卷结构中找到，将转人工复核
              </template>
              <div v-if="(issues.misalignedAnswers || []).length" class="issue-detail issue-scroll">
                <span v-for="(item, index) in issues.misalignedAnswers" :key="index" class="issue-tag">
                  {{ item.candidateId }}（题{{ item.questionNo }}）
                </span>
              </div>
            </el-alert>
            <el-alert
              v-if="issues.emptyFolderCandidateCount"
              type="warning"
              :closable="false"
              show-icon
              class="issue-alert"
            >
              <template #title>
                {{ issues.emptyFolderCandidateCount }} 名考生的文件夹为空（未提交任何文件，按空白卷处理，请人工复核确认）
              </template>
              <div v-if="(issues.emptyFolderCandidates || []).length" class="issue-detail issue-scroll">
                <span v-for="(id, index) in issues.emptyFolderCandidates" :key="index" class="issue-tag">
                  {{ id }}
                </span>
              </div>
            </el-alert>
            <el-alert
              v-if="(issues.structureWarnings || []).length"
              type="info"
              :closable="false"
              show-icon
              class="issue-alert"
            >
              <template #title>结构解析提示</template>
              <div class="issue-detail">
                <div v-for="(warning, index) in issues.structureWarnings" :key="index">{{ warning }}</div>
              </div>
            </el-alert>
          </template>
        </div>
      </template>

      <el-empty
        v-else-if="!loading"
        description="暂无解析报告（该试卷包解析于报告功能上线前，或未随包生成）"
      />
    </div>
    <template #footer>
      <el-button type="primary" @click="emit('update:modelValue', false)">知道了</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ParseReportData, StructurePreviewResult } from '@/api/teacher-scoring';

defineOptions({ name: 'ParseReportDialog' });

const props = defineProps<{
  modelValue: boolean;
  title?: string;
  loading?: boolean;
  /** 完整解析报告（parse-report.json 结构） */
  report?: ParseReportData | null;
  /** 结构预检结果：识别失败时展示人话报错与目录树 */
  structure?: StructurePreviewResult | null;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
}>();

const recognitionError = computed(() => {
  if (props.structure?.status === 'error') return props.structure.error || '结构识别失败';
  return props.report?.issues?.recognitionError || null;
});
const expected = computed(() => props.structure?.expected || '');
const treePreview = computed(() => props.structure?.tree_preview || []);
const reportData = computed(() => props.report || {
  summary: { candidateCount: 0, blankCandidateCount: 0, questionCount: 0 },
  files: {},
  issues: {}
} as ParseReportData);

const issues = computed(() => props.report?.issues || {});
const hasIssues = computed(() => {
  const item = issues.value;
  return Boolean(
    item.misalignedAnswerCount
    || item.emptyFolderCandidateCount
    || (item.structureWarnings || []).length
    || item.recognitionError
  );
});

const structureSourceTextMap: Record<string, string> = {
  answer_key: '答案卷',
  blank_paper: '空白试卷',
  grading_standard_table: '评分标准表',
  student_documents: '考生文档反推'
};

const structureSourceText = computed(() => {
  const source = props.report?.summary?.structureSource;
  if (!source) return '-';
  return structureSourceTextMap[source] || source;
});
</script>

<style scoped>
.report-block {
  margin-bottom: 16px;
}

.block-title {
  margin-bottom: 8px;
  font-weight: 600;
  color: #303133;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-item {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  text-align: center;
  background: #f9fafb;
}

.stat-value {
  font-size: 22px;
  font-weight: 600;
  color: #111827;
}

.stat-warn .stat-value {
  color: #e6a23c;
}

.stat-label {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.ignored-list {
  color: #909399;
}

.issue-alert {
  margin-bottom: 10px;
}

.issue-detail {
  font-size: 12px;
  line-height: 1.6;
  color: #606266;
  word-break: break-all;
}

.issue-scroll {
  max-height: 120px;
  overflow-y: auto;
}

.issue-tag {
  display: inline-block;
  margin: 0 8px 4px 0;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.05);
  font-family: monospace;
}

.error-text {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.6;
}

.expected-text {
  padding: 10px;
  border-radius: 6px;
  background: #f5f7fa;
  font-size: 13px;
  line-height: 1.7;
  color: #606266;
}

.tree-preview {
  max-height: 220px;
  padding: 10px;
  overflow: auto;
  border-radius: 6px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-size: 12px;
  line-height: 1.6;
}

:deep(.parse-report-dialog) {
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  margin-top: 7vh;
}

:deep(.parse-report-dialog .el-dialog__body) {
  overflow-y: auto;
}
</style>

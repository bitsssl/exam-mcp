<template>
  <section class="assignment-report-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="page-header">
          <div>
            <h2>考生答案抽取报告{{ contextSuffix }}</h2>
          </div>
          <el-button @click="router.back()">返回</el-button>
        </div>
      </template>
      <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" />
      <template v-else-if="record">
        <div class="summary-grid">
          <MetricStatCard label="文本内容" :value="hasAnyTextContent ? '已获取' : '无'" :icon="Document" tone="success" />
          <MetricStatCard label="文件数" :value="record.assignment_json?.student?.fileCount || 0" :icon="Document" />
          <MetricStatCard label="异常文件" :value="record.assignment_json?.student?.abnormalFileCount || 0" :icon="WarningFilled" tone="warning" />
          <MetricStatCard label="涉及题目" :value="structureQuestionCards ? structureQuestionCards.length : (record.assignment_json?.student?.questions?.length || 0)" :icon="Collection" tone="success" />
        </div>
        <el-alert v-if="record.assignment_json?.student?.blankReason" type="info" :closable="false" :title="record.assignment_json.student.blankReason" />
        <el-alert v-if="record.error_message" type="warning" :closable="false" :title="record.error_message" />
        <div class="extracted-section">
          <div class="extracted-head"><strong>答案文本</strong></div>
          <template v-if="structureQuestionCards">
            <template v-if="structuredTextCards.length">
              <div v-for="card in structuredTextCards" :key="'content-' + card.questionNo" class="question-content-block">
                <div class="question-head"><strong>Q{{ card.questionNo }}</strong><span class="question-stem">{{ card.questionLabel }}</span></div>
                <div class="answer-text-box">
                  <div v-for="(row, rowIndex) in textContentRowsFor(card.questionNo)" :key="rowIndex" class="answer-text-line">
                    <span class="answer-text-desc">{{ row.description }}</span>
                    <span class="answer-text-content">{{ row.content }}<el-tag v-if="row.status === 'ABNORMAL'" size="small" type="warning" class="answer-abnormal-tag">异常</el-tag></span>
                  </div>
                  <div v-if="textRowsSource(textContentRowsFor(card.questionNo))" class="answer-text-source">{{ textRowsSource(textContentRowsFor(card.questionNo)) }}</div>
                </div>
              </div>
            </template>
            <div v-else class="answer-text-box answer-text-empty">无</div>
          </template>
          <template v-else-if="questionContentBlocks.length">
            <template v-if="filledContentBlocks.length">
              <div v-for="block in filledContentBlocks" :key="block.questionNo" class="question-content-block">
                <div class="question-head"><strong>Q{{ block.questionNo }}</strong><span v-if="block.sourceFile">{{ block.sourceFile }}</span></div>
                <div class="answer-text-box">
                  <div v-for="(row, rowIndex) in questionContentRows(block)" :key="rowIndex" class="answer-text-line">
                    <span class="answer-text-desc">{{ row.description }}</span>
                    <span class="answer-text-content">{{ row.content }}<el-tag v-if="row.status === 'ABNORMAL'" size="small" type="warning" class="answer-abnormal-tag">异常</el-tag></span>
                  </div>
                  <div v-if="textRowsSource(questionContentRows(block))" class="answer-text-source">{{ textRowsSource(questionContentRows(block)) }}</div>
                </div>
              </div>
            </template>
            <div v-else class="answer-text-box answer-text-empty">无</div>
          </template>
          <div v-else-if="extractionTextRows.length" class="answer-text-box">
            <div v-for="(row, rowIndex) in extractionTextRows" :key="rowIndex" class="answer-text-line">
              <span class="answer-text-desc">{{ row.description }}</span>
              <span class="answer-text-content">{{ row.content }}<el-tag v-if="row.status === 'ABNORMAL'" size="small" type="warning" class="answer-abnormal-tag">异常</el-tag></span>
            </div>
            <div v-if="textRowsSource(extractionTextRows)" class="answer-text-source">{{ textRowsSource(extractionTextRows) }}</div>
          </div>
          <div v-else class="answer-text-box answer-text-empty">无</div>
        </div>
        <div class="extracted-section">
          <div class="extracted-head"><strong>答案文件</strong></div>
          <el-table :data="fileRows" border stripe empty-text="无" class="file-table">
            <el-table-column prop="questionNo" label="题号" width="120" />
            <el-table-column prop="fileName" label="文件名" min-width="200" />
            <el-table-column prop="relativePath" label="文件路径" min-width="280" />
            <el-table-column prop="fileType" label="文件类型" width="110" />
            <el-table-column prop="subtype" label="识别情况" min-width="180" />
            <el-table-column prop="reason" label="答案文件说明" min-width="240" />
            <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag v-if="row.status" size="small" :type="row.status === 'ABNORMAL' ? 'warning' : 'success'">{{ row.status === 'ABNORMAL' ? '异常' : '正常' }}</el-tag></template></el-table-column>
          </el-table>
        </div>
      </template>
      <el-empty v-else-if="!loading" description="暂无该考生的答案抽取报告" />
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Collection, Document, WarningFilled } from '@element-plus/icons-vue'
import { getCandidateAssignments, type CandidateAssignmentRecord } from '@/api/teacher-scoring'
import { getAssignmentTextRows, getAssignmentQuestionFiles, getMatchedAssignmentQuestions, getFieldsTextRows, normalizeAssignmentQuestionCode, orderAssignmentFields, type AssignmentTextRow } from '@/utils/assignment-files'
import { isValidPaperStructure, loadDisplayStructure } from '@/utils/paper-structure'
import MetricStatCard from '@/components/MetricStatCard.vue'
import { fetchScoringContextNames } from '@/utils/scoring-context'

const route = useRoute()
const router = useRouter()
const packageId = String(route.params.packageId || '')
const contextSuffix = ref('')
const studentNo = String(route.query.student_no || '')
const loading = ref(false)
const error = ref('')
const record = ref<CandidateAssignmentRecord | null>(null)
// 阅卷标准结构快照：有快照时抽取报告按快照结构展示题目（与评阅页一致）
const structure = ref<Record<string, any> | null>(null)
const extractedContent = computed(() => (record.value?.assignment_json as any)?.student?.extractedContent || null)
// 字段展示顺序固定（大模型名称 → 大模型特点 → 选择原因 → 合适提示词）：
// assignment_json 是 MySQL 原生 JSON 列，对象键入库时会被按字节重排，
// 抽取端写的字段顺序到读取时已不可靠，只能由展示层定序（共用工具）。
const orderedExtractionFields = computed(() => orderAssignmentFields(extractedContent.value?.fields));
// 答案文本表格行（文本内容/文本来源/来源文件类型/答案内容说明）
const extractionTextRows = computed(() => getAssignmentTextRows(record.value));
// 抽取行来源去重（同一题的字段通常来自同一份文档）
const textRowsSource = (rows: Array<{ source?: string }>) => {
  const sources = Array.from(new Set(rows.map((row) => String(row.source || '').trim()).filter(Boolean)));
  return sources.length ? `来源：${sources.join('；')}` : '';
};
// 按题挂靠的抽取内容（11 系合并卷：解析阶段记录“题号→答卷文档”映射，
// 抽取时把每份文档的关键词字段/作答文本挂到对应题目）。存在时“答案文本”
// 按题分组展示——两道题都是文本题时，内容全部落在答案文本里。
const questionContentBlocks = computed<Array<{ questionNo: string; fields: Record<string, any>; sourceFile: string; sourceType: string; answerText?: string }>>(
  () => ((record.value?.assignment_json as any)?.student?.questionContents || [])
);
// 文本卷记录：按包类型判定（11 系 = 纯文本作答卷），而不是按当前考生
// 是否抽到内容——空考生也要在“答案文本”里按题目数量逐题显示“无”；
// “答案文件”大表始终展示，文本卷没有文件时逐题显示“无”。
// 文本内容是否抽取到（通用口径）：11 系的关键词字段在 extractedContent.fields，
// 数据库卷等按题拆的作答文本在 questionContents[].answerText——任一有内容即"已获取"
const hasAnyTextContent = computed(() => {
  const fields = ((record.value?.assignment_json as any)?.student?.extractedContent?.fields || {}) as Record<string, string>;
  if (Object.values(fields).some((value) => String(value || '').trim())) return true;
  const contents = ((record.value?.assignment_json as any)?.student?.questionContents || []) as Array<{ answerText?: string }>;
  return contents.some((entry) => String(entry?.answerText || '').trim());
});
const questionContentRows = (block: { fields: Record<string, any>; sourceFile: string; sourceType: string; answerText?: string }): AssignmentTextRow[] => {
  const rows = getFieldsTextRows(block.fields, block.sourceFile, block.sourceType);
  const text = String(block.answerText || '').trim();
  // 有关键词字段的题只展示字段行；表格作答等无字段题展示整段作答文本
  if (text && !rows.length) {
    rows.push({ description: '作答文本', content: text, source: block.sourceFile || '', sourceType: block.sourceType || '', status: 'OK' });
  }
  return rows;
};
// “答案文本”只展示有内容的题：全部题都没有文本时整体只显示一个“无”框，
// 有内容的题逐题带题号展示字段/作答文本行。
const textContentRowsFor = (questionNo: string): AssignmentTextRow[] => {
  const block = questionContentBlocks.value.find((block) => (
    String(block.questionNo) === String(questionNo)
    || String(block.questionNo) === String(questionNo).split('.')[0]
  ));
  return block ? questionContentRows(block) : [];
};
const structuredTextCards = computed(() => (
  structureQuestionCards.value
    ? structureQuestionCards.value.filter((card) => textContentRowsFor(card.questionNo).length)
    : []
));
const filledContentBlocks = computed(() => (
  questionContentBlocks.value.filter((block) => questionContentRows(block).length)
));
// 有快照时按快照结构出题目卡片：题号按位置推导（与阅卷标准页/评阅页同一规则），
// 抽取文件用统一的四级匹配规则对回题号。教师新增的题（后端抽取结构里还没有）
// 会显示为空文件卡片，等后端按快照抽取后自然带上归属结果。
const structureQuestionCards = computed(() => {
  if (!isValidPaperStructure(structure.value)) return null;
  const cards: Array<{ questionNo: string; questionText: string; questionLabel: string; files: any[] }> = [];
  structure.value.大题.forEach((major: any, majorIndex: number) => {
    const children = Array.isArray(major?.小题) ? major.小题 : [];
    children.forEach((question: any, questionIndex: number) => {
      const questionNo = children.length > 1 ? `${majorIndex + 1}.${questionIndex + 1}` : String(majorIndex + 1);
      const steps = Array.isArray(question?.子小题) ? question.子小题.map((step: any) => String(step?.题干 || '').trim()).filter(Boolean) : [];
      const questionText = [question?.题干, ...steps].map((value) => String(value || '').trim()).filter(Boolean).join('\n')
        || String(major?.标题 || major?.题干 || '').trim();
      const firstLine = questionText.split('\n').map((line) => line.trim()).filter(Boolean)[0] || '';
      cards.push({
        questionNo,
        questionText,
        questionLabel: firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : (firstLine || '未命名题目'),
        files: record.value ? getAssignmentQuestionFiles(record.value, questionNo, questionText) : []
      });
    });
  });
  return cards.length ? cards : null;
});
// 匹配不到任何快照题号的抽取结果归入“其它”，不丢数据
const unmatchedAssignmentQuestions = computed(() => {
  if (!structureQuestionCards.value || !record.value) return [];
  const matched = new Set<string>();
  structureQuestionCards.value.forEach((card) => {
    getMatchedAssignmentQuestions(record.value, card.questionNo, card.questionText)
      .forEach((question: any) => {
        const code = normalizeAssignmentQuestionCode(question?.questionCode);
        if (code) matched.add(code);
      });
  });
  const questions = record.value?.assignment_json?.student?.questions || [];
  return questions.filter((question: any) => !matched.has(normalizeAssignmentQuestionCode(question?.questionCode)));
});
// 答案文件大表（所有卷型都展示）：所有题目的抽取文件合并成一张表，
// 题号作为第一列；整包都没有文件时表格为空，仅显示一个“无”，
// 有文件的题才逐行展示。
const fileRows = computed<Array<Record<string, any>>>(() => {
  const rows: Array<Record<string, any>> = [];
  const pushQuestion = (questionNo: string, files: any[]) => {
    files.forEach((file) => rows.push({ questionNo, ...file }));
  };
  const student = (record.value?.assignment_json as any)?.student || {};
  if (structureQuestionCards.value) {
    structureQuestionCards.value.forEach((card) => pushQuestion(card.questionNo, card.files));
    // 匹配不到试卷结构题号的抽取结果同样并入大表，题号取抽取端原始题号
    unmatchedAssignmentQuestions.value.forEach((question: any) => {
      pushQuestion(String(question.questionLabel || question.questionCode || ''), question.files || []);
    });
  } else {
    (student.questions || []).forEach((question: any) => {
      pushQuestion(String(question.questionLabel || question.questionCode || ''), question.files || []);
    });
  }
  // 未归属文件（环境附件/素材等）并入大表：文件数统计口径 = 挂题文件 +
  // 未归属文件，表格行数与顶部“文件数”指标保持一致。
  // 内容抽取卷的旧题目级文件提取结果已在后端流水线清空
  // （candidate_assignment_pipeline._clear_text_paper_question_files），
  // 这类考试没有作答文件时本表只显示“无”。
  (student.unassignedFiles || []).forEach((file: any) => {
    rows.push({ questionNo: '未归属', ...file });
  });
  return rows;
});

onMounted(async () => {
  loading.value = true
  try {
    const localId = packageId.replace(/^local_/, '')
    // 快照拉取失败不影响报告展示（loadDisplayStructure 静默返回 null）
    const [assignmentResponse, structureValue] = await Promise.all([
      getCandidateAssignments(String(route.params.subjectId), String(route.params.examId), localId, studentNo),
      loadDisplayStructure(String(route.params.subjectId), String(route.params.examId))
    ])
    if (![0, 200].includes(assignmentResponse?.code)) throw new Error(assignmentResponse?.message || '读取答案抽取报告失败')
    record.value = assignmentResponse.data?.assignments?.[0] || null
    structure.value = structureValue
    // 标题只带考试名与考生号：科目名与考试名前缀重复（考试名已含科目语义），
    // 试卷包名与考试名相同，没必要在标题里重复三遍。
    const { examName } = await fetchScoringContextNames(
      String(route.params.subjectId), String(route.params.examId), localId
    )
    const parts = [examName]
    if (studentNo) parts.push(`考生 ${studentNo}`)
    if (parts.length) contextSuffix.value = `（${parts.join(' · ')}）`
  } catch (err: any) {
    error.value = err?.response?.data?.message || err?.message || '读取答案抽取报告失败'
    ElMessage.error(error.value)
  } finally { loading.value = false }
})
</script>

<style scoped>
.assignment-report-page { padding: 20px; font-size: 16px; }
/* 抽取内容大框（与考生评阅详情页同款样式） */
.answer-text-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid #d9e2ec;
  border-radius: 8px;
  background: #f8fafc;
}
.answer-text-line {
  font-size: 16px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.answer-text-desc {
  color: #354861;
  font-weight: 600;
  margin-right: 8px;
}
.answer-text-content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.answer-text-source {
  color: #8b97a8;
  font-size: 14px;
}
.answer-text-empty {
  color: #909399;
}
.answer-abnormal-tag {
  margin-left: 6px;
}
.page-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.page-header h2 { margin: 0; font-size: 20px; }
.page-header p { margin: 6px 0 0; color: var(--el-text-color-secondary); }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
/* 统计卡标签文字页面级放大（共享组件不动，仅本页生效） */
.summary-grid :deep(.metric-stat-content span) { font-size: 15px; }
.question-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.question-head span { color: var(--el-text-color-secondary); font-size: 15px; }
.question-head .question-stem { overflow: hidden; max-width: 52em; text-overflow: ellipsis; white-space: nowrap; }
.question-content-block { margin-bottom: 16px; }
.question-content-block .question-head { margin-bottom: 8px; }
.extracted-section { margin-top: 18px; }
.extracted-head { margin: 0 0 10px; }
.extracted-head strong { font-size: 16px; }
.extracted-section :deep(.el-table) { font-size: 16px; }
.extracted-section :deep(.el-table .el-tag) { font-size: 14px; }
.extracted-section :deep(.el-table__header-wrapper th.el-table__cell .cell) {
  color: #111827 !important;
  font-weight: 800 !important;
}
/* 单元格内容超出列宽时自动换行显示全，不再省略截断 */
.extracted-section :deep(.el-table .cell) {
  white-space: normal;
  word-break: break-all;
  line-height: 1.6;
}
@media (max-width: 760px) { .summary-grid { grid-template-columns: 1fr; } .page-header { align-items: stretch; flex-direction: column; } }
</style>

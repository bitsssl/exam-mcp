<template>
  <section class="assignment-report-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="page-header">
          <div>
            <h2>考生答案抽取报告</h2>
            <p>{{ studentNo || '考生' }} · 试卷包 {{ packageId }}</p>
          </div>
          <el-button @click="router.back()">返回</el-button>
        </div>
      </template>
      <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" />
      <template v-else-if="record">
        <div class="summary-grid">
          <MetricStatCard label="文本内容" :value="orderedExtractionFields.length ? '已获取' : '无'" :icon="Document" tone="success" />
          <MetricStatCard label="文件数" :value="record.assignment_json?.student?.fileCount || 0" :icon="Document" />
          <MetricStatCard label="异常文件" :value="record.assignment_json?.student?.abnormalFileCount || 0" :icon="WarningFilled" tone="warning" />
          <MetricStatCard label="涉及题目" :value="structureQuestionCards ? structureQuestionCards.length : (record.assignment_json?.student?.questions?.length || 0)" :icon="Collection" tone="success" />
        </div>
        <el-alert v-if="record.assignment_json?.student?.blankReason" type="info" :closable="false" :title="record.assignment_json.student.blankReason" />
        <el-alert v-if="record.error_message" type="warning" :closable="false" :title="record.error_message" />
        <div v-if="isTextRecord || !structureQuestionCards" class="extracted-section">
          <div class="extracted-head"><strong>抽取内容</strong></div>
          <template v-if="structureQuestionCards">
            <div v-for="card in structureQuestionCards" :key="'content-' + card.questionNo" class="question-content-block">
              <div class="question-head"><strong>Q{{ card.questionNo }}</strong><span class="question-stem">{{ card.questionLabel }}</span></div>
              <el-table :data="textContentRowsFor(card.questionNo)" border stripe empty-text="无">
                <el-table-column prop="content" label="文本内容" min-width="240" />
                <el-table-column prop="source" label="文本来源" min-width="260" show-overflow-tooltip />
                <el-table-column prop="sourceType" label="来源文件类型" width="120" />
                <el-table-column prop="description" label="答案内容说明" min-width="150" />
                <el-table-column label="状态" width="80"><template #default="{ row }"><el-tag v-if="row.status" size="small" :type="row.status === 'ABNORMAL' ? 'warning' : 'success'">{{ row.status === 'ABNORMAL' ? '异常' : '正常' }}</el-tag><span v-else>—</span></template></el-table-column>
              </el-table>
            </div>
          </template>
          <template v-else-if="questionContentBlocks.length">
            <div v-for="block in questionContentBlocks" :key="block.questionNo" class="question-content-block">
              <div class="question-head"><strong>Q{{ block.questionNo }}</strong><span v-if="block.sourceFile">{{ block.sourceFile }}</span></div>
              <el-table :data="questionContentRows(block)" border stripe empty-text="无">
                <el-table-column prop="content" label="文本内容" min-width="240" />
                <el-table-column prop="source" label="文本来源" min-width="260" show-overflow-tooltip />
                <el-table-column prop="sourceType" label="来源文件类型" width="120" />
                <el-table-column prop="description" label="答案内容说明" min-width="150" />
                <el-table-column label="状态" width="80"><template #default="{ row }"><el-tag v-if="row.status" size="small" :type="row.status === 'ABNORMAL' ? 'warning' : 'success'">{{ row.status === 'ABNORMAL' ? '异常' : '正常' }}</el-tag><span v-else>—</span></template></el-table-column>
              </el-table>
            </div>
          </template>
          <el-table v-else :data="extractionTextRows" border stripe empty-text="无">
            <el-table-column prop="content" label="文本内容" min-width="240" />
            <el-table-column prop="source" label="文本来源" min-width="260" show-overflow-tooltip />
            <el-table-column prop="sourceType" label="来源文件类型" width="120" />
            <el-table-column prop="description" label="答案内容说明" min-width="150" />
            <el-table-column label="状态" width="80"><template #default="{ row }"><el-tag v-if="row.status" size="small" :type="row.status === 'ABNORMAL' ? 'warning' : 'success'">{{ row.status === 'ABNORMAL' ? '异常' : '正常' }}</el-tag><span v-else>—</span></template></el-table-column>
          </el-table>
        </div>
        <template v-if="structureQuestionCards && !isTextRecord">
          <div v-for="card in structureQuestionCards" :key="card.questionNo" class="question-card">
          <div class="extracted-head"><strong>抽取文件</strong></div>
          <div class="question-head"><strong>Q{{ card.questionNo }}</strong><span class="question-stem">{{ card.questionLabel }}</span><span>{{ card.files.length }} 个文件</span></div>
          <el-table :data="card.files" border stripe empty-text="无">
            <el-table-column prop="fileName" label="文件名" min-width="220" show-overflow-tooltip />
            <el-table-column prop="relativePath" label="文件路径" min-width="280" show-overflow-tooltip />
            <el-table-column prop="fileType" label="文件类型" width="120" />
            <el-table-column prop="subtype" label="识别情况" min-width="180" show-overflow-tooltip />
            <el-table-column prop="reason" label="答案文件说明" min-width="260" show-overflow-tooltip />
            <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag size="small" :type="row.status === 'ABNORMAL' ? 'warning' : 'success'">{{ row.status === 'ABNORMAL' ? '异常' : '正常' }}</el-tag></template></el-table-column>
          </el-table>
        </div>
        </template>
        <div v-if="structureQuestionCards && !isTextRecord && unmatchedAssignmentQuestions.length" class="question-card">
          <div class="extracted-head"><strong>其它抽取结果（未匹配到试卷结构题号）</strong></div>
          <div v-for="question in unmatchedAssignmentQuestions" :key="question.questionCode" class="unmatched-block">
            <div class="question-head"><strong>{{ question.questionLabel || question.questionCode }}</strong><span>{{ question.fileCount || 0 }} 个文件</span><el-tag v-if="question.status === 'ABNORMAL'" size="small" type="warning">异常</el-tag></div>
            <el-table :data="question.files || []" border stripe empty-text="无">
              <el-table-column prop="fileName" label="文件名" min-width="220" show-overflow-tooltip />
              <el-table-column prop="relativePath" label="文件路径" min-width="280" show-overflow-tooltip />
              <el-table-column prop="fileType" label="文件类型" width="120" />
              <el-table-column prop="subtype" label="识别情况" min-width="180" show-overflow-tooltip />
              <el-table-column prop="reason" label="答案文件说明" min-width="260" show-overflow-tooltip />
              <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag size="small" :type="row.status === 'ABNORMAL' ? 'warning' : 'success'">{{ row.status === 'ABNORMAL' ? '异常' : '正常' }}</el-tag></template></el-table-column>
            </el-table>
          </div>
        </div>
        <template v-if="!structureQuestionCards && !isTextRecord">
          <div v-for="question in record.assignment_json?.student?.questions || []" :key="question.questionCode" class="question-card">
          <div class="extracted-head"><strong>抽取文件</strong></div>
          <div class="question-head"><strong>{{ question.questionLabel || question.questionCode }}</strong><span>{{ question.fileCount || 0 }} 个文件</span><el-tag v-if="question.status === 'ABNORMAL'" size="small" type="warning">异常</el-tag></div>
          <el-table :data="question.files || []" border stripe empty-text="无">
            <el-table-column prop="fileName" label="文件名" min-width="220" show-overflow-tooltip />
            <el-table-column prop="relativePath" label="文件路径" min-width="280" show-overflow-tooltip />
            <el-table-column prop="fileType" label="文件类型" width="120" />
            <el-table-column prop="subtype" label="识别情况" min-width="180" show-overflow-tooltip />
            <el-table-column prop="reason" label="答案文件说明" min-width="260" show-overflow-tooltip />
            <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag size="small" :type="row.status === 'ABNORMAL' ? 'warning' : 'success'">{{ row.status === 'ABNORMAL' ? '异常' : '正常' }}</el-tag></template></el-table-column>
          </el-table>
        </div>
        <div v-if="!(record.assignment_json?.student?.questions || []).length" class="question-card">
          <div class="extracted-head"><strong>抽取文件</strong></div>
          <el-table :data="[]" border stripe empty-text="无">
            <el-table-column prop="fileName" label="文件名" min-width="220" show-overflow-tooltip />
            <el-table-column prop="relativePath" label="文件路径" min-width="280" show-overflow-tooltip />
            <el-table-column prop="fileType" label="文件类型" width="120" />
            <el-table-column prop="subtype" label="识别情况" min-width="180" show-overflow-tooltip />
            <el-table-column prop="reason" label="答案文件说明" min-width="260" show-overflow-tooltip />
            <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag size="small" :type="row.status === 'ABNORMAL' ? 'warning' : 'success'">{{ row.status === 'ABNORMAL' ? '异常' : '正常' }}</el-tag></template></el-table-column>
          </el-table>
        </div>
        </template>
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

const route = useRoute()
const router = useRouter()
const packageId = String(route.params.packageId || '')
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
// 抽取内容表格行（文本内容/文本来源/来源文件类型/答案内容说明）
const extractionTextRows = computed(() => getAssignmentTextRows(record.value));
// 按题挂靠的抽取内容（11 系合并卷：解析阶段记录“题号→答卷文档”映射，
// 抽取时把每份文档的关键词字段/作答文本挂到对应题目）。存在时“抽取内容”
// 按题分组展示——两道题都是文本题时，内容全部落在抽取内容里。
const questionContentBlocks = computed<Array<{ questionNo: string; fields: Record<string, any>; sourceFile: string; sourceType: string; answerText?: string }>>(
  () => ((record.value?.assignment_json as any)?.student?.questionContents || [])
);
// 文本卷记录：按包类型判定（11 系 = 纯文本作答卷），而不是按当前考生
// 是否抽到内容——空考生也要按题目数量在“抽取内容”里逐题显示“无”，
// 且不再展示空的“抽取文件”卡片（抽取文件只服务文件作答卷）。
const recordPaperCode = computed(() => String((record.value?.assignment_json as any)?.paperCode || ''));
const hasTextFields = computed(() => Object.values(((record.value?.assignment_json as any)?.student?.extractedContent?.fields) || {})
  .some((value) => String(value || '').trim()));
const isTextRecord = computed(() =>
  /^11/.test(recordPaperCode.value)
  || questionContentBlocks.value.length > 0
  || hasTextFields.value
);
const questionContentRows = (block: { fields: Record<string, any>; sourceFile: string; sourceType: string; answerText?: string }): AssignmentTextRow[] => {
  const rows = getFieldsTextRows(block.fields, block.sourceFile, block.sourceType);
  const text = String(block.answerText || '').trim();
  // 有关键词字段的题只展示字段行；表格作答等无字段题展示整段作答文本
  if (text && !rows.length) {
    rows.push({ description: '作答文本', content: text, source: block.sourceFile || '', sourceType: block.sourceType || '', status: 'OK' });
  }
  return rows;
};
// “抽取内容”按题目数量逐题展示：有内容的题展示字段/作答文本行，
// 没有内容的题展示“无”（空表）。
const textContentRowsFor = (questionNo: string): AssignmentTextRow[] => {
  const block = questionContentBlocks.value.find((block) => (
    String(block.questionNo) === String(questionNo)
    || String(block.questionNo) === String(questionNo).split('.')[0]
  ));
  return block ? questionContentRows(block) : [];
};
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
  } catch (err: any) {
    error.value = err?.response?.data?.message || err?.message || '读取答案抽取报告失败'
    ElMessage.error(error.value)
  } finally { loading.value = false }
})
</script>

<style scoped>
.assignment-report-page { padding: 20px; }
.page-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.page-header h2 { margin: 0; font-size: 20px; }
.page-header p { margin: 6px 0 0; color: var(--el-text-color-secondary); }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
.question-card { margin-top: 18px; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.question-card :deep(.el-table__header-wrapper th.el-table__cell .cell) {
  color: #111827 !important;
  font-weight: 800 !important;
}
.question-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.question-head span { color: var(--el-text-color-secondary); font-size: 13px; }
.question-head .question-stem { overflow: hidden; max-width: 52em; text-overflow: ellipsis; white-space: nowrap; }
.unmatched-block { margin-bottom: 16px; }
.question-content-block { margin-bottom: 16px; }
.question-content-block .question-head { margin-bottom: 8px; }
.extracted-section { margin-top: 18px; }
.extracted-head { margin: 0 0 10px; }
.extracted-head strong { font-size: 15px; }
.question-card .extracted-head { margin-top: 12px; }
.extracted-section :deep(.el-table__header-wrapper th.el-table__cell .cell) {
  color: #111827 !important;
  font-weight: 800 !important;
}
@media (max-width: 760px) { .summary-grid { grid-template-columns: 1fr; } .page-header { align-items: stretch; flex-direction: column; } }
</style>

<template>
  <main class="formal-student-detail-page">
    <section class="formal-student-detail-panel">
      <div class="detail-page-header">
        <div>
          <h1>考生评阅详情</h1>
        </div>
        <el-button @click="goBack">返回评阅结果</el-button>
      </div>

      <div v-loading="loading" class="detail-page-content">
        <template v-if="topics.length">
          <div class="student-header">
            <div>
              <div class="student-title">
                <strong>学号：</strong>{{ studentNo }}
                <span class="score-text">评阅总分：{{ totalScoreText }}</span>
              </div>
              <div class="meta-text">
                已评 {{ summary.gradedCount }}/{{ summary.questionCount }} 题
                <template v-if="paperMaxScore">，整卷满分 {{ paperMaxScore }} 分</template>
                <el-tag size="small" :type="abnormal ? 'danger' : 'success'" effect="light">
                  {{ abnormal ? '异常' : '正常' }}
                </el-tag>
                <span v-if="answerFolderPath" class="answer-folder-line">
                  答题文件夹：<a class="answer-folder-link" :title="`点击打开 ${answerFolderPath}`" @click="openAnswerFolder">{{ answerFolderPath }}</a>
                </span>
              </div>
            </div>
          </div>

          <el-collapse :model-value="expandedNames" class="blank-paper-collapse">
            <el-collapse-item
              v-for="(topic, topicIndex) in topics"
              :key="topicIndex"
              :name="String(topicIndex + 1)"
            >
              <template #title>
                <strong>第{{ topicIndex + 1 }}大题</strong>
                <span class="section-title">{{ displayText(topic.question) || '未命名题目' }}</span>
                <el-tag size="small">{{ subQuestionCount(topic) }} 题</el-tag>
                <el-tag
                  v-if="topicGrades[topicIndex] && topicGrades[topicIndex].gradedCount"
                  class="review-status-tag"
                  size="small"
                  type="success"
                  effect="light"
                >已评阅</el-tag>
              </template>
              <div class="collapse-question-content">
                <div v-if="!(topic.sub_question || []).length" class="question-card">
                  <div class="question-head">
                    <span class="question-no">Q{{ topicIndex + 1 }}</span>
                    <strong>{{ displayText(topic.question) || '未命名题目' }}</strong>
                    <div class="question-head-actions">
                      <el-tag v-if="topicGrades[topicIndex]" size="small" type="success" effect="light">已评阅</el-tag>
                    </div>
                  </div>
                  <div v-if="topic.display_steps?.length" class="steps">
                    <div v-for="(step, stepIndex) in topic.display_steps" :key="stepIndex"><span>（{{ stepIndex + 1 }}）</span>{{ displayText(step) }}</div>
                  </div>
                  <div v-if="standaloneImages(topic).length" class="question-images">
                    <el-tag v-for="image in standaloneImages(topic)" :key="image" size="small" type="info">参考图片：{{ image.split('/').pop() }}</el-tag>
                  </div>
                  <div class="answer-panel">
                    <div class="answer-label">答案结果文件</div>
                    <el-table
                      v-if="answerFileRows(topicIndex, -1, topic).length"
                      :data="answerFileRows(topicIndex, -1, topic)"
                      size="small"
                      border
                    >
                      <el-table-column prop="fileName" label="文件名" min-width="180" show-overflow-tooltip />
                      <el-table-column prop="fileType" label="类型" width="100" />
                      <el-table-column prop="subtype" label="识别情况" min-width="150" show-overflow-tooltip />
                      <el-table-column prop="reason" label="答案文件说明" min-width="220" show-overflow-tooltip />
                      <el-table-column label="状态" width="80">
                        <template #default="{ row }">
                          <el-tag size="small" :type="row.status === 'ABNORMAL' ? 'warning' : 'success'">{{ row.status === 'ABNORMAL' ? '异常' : '正常' }}</el-tag>
                        </template>
                      </el-table-column>
                    </el-table>
                    <el-table v-else-if="questionTextRows(topic).length" :data="questionTextRows(topic)" size="small" border>
                      <el-table-column prop="content" label="文本内容" min-width="220" />
                      <el-table-column prop="source" label="文本来源" min-width="220" show-overflow-tooltip />
                      <el-table-column prop="sourceType" label="来源文件类型" width="110" />
                      <el-table-column prop="description" label="答案内容说明" min-width="140" />
                      <el-table-column label="状态" width="80"><template #default="{ row }"><el-tag size="small" :type="row.status === 'ABNORMAL' ? 'warning' : 'success'">{{ row.status === 'ABNORMAL' ? '异常' : '正常' }}</el-tag></template></el-table-column>
                    </el-table>
                    <el-empty v-else description="本题暂无答案结果文件" :image-size="44" />
                  </div>
                  <div v-if="topicGrades[topicIndex]" class="sub-score-summary">
                    <span>评阅：{{ questionScoreText(topicGrades[topicIndex]) }}</span>
                    <span>评语：{{ topicGrades[topicIndex].comments.join('\n') || '暂无评语' }}</span>
                  </div>
                </div>

                <template v-else>
                  <div
                    v-for="(subQuestion, subIndex) in topic.sub_question || []"
                    :key="subIndex"
                    class="sub-question question-card"
                  >
                    <div class="question-head">
                      <span class="question-no">Q{{ subQuestionLabel(topicIndex, subIndex) }}</span>
                      <strong>{{ displayText(subQuestion.question) || '未命名题目' }}</strong>
                      <div class="question-head-actions">
                        <el-tag v-if="subGrades.get(`${topicIndex}.${subIndex}`)" size="small" type="success" effect="light">已评阅</el-tag>
                      </div>
                    </div>
                    <div v-if="subQuestion.display_steps?.length" class="steps">
                      <div v-for="(step, stepIndex) in subQuestion.display_steps" :key="stepIndex"><span>（{{ stepIndex + 1 }}）</span>{{ displayText(step) }}</div>
                    </div>
                    <div v-if="standaloneImages(subQuestion).length" class="question-images">
                      <el-tag v-for="image in standaloneImages(subQuestion)" :key="image" size="small" type="info">参考图片：{{ image.split('/').pop() }}</el-tag>
                    </div>
                    <div class="answer-panel">
                      <div class="answer-label">答案结果文件</div>
                      <el-table
                        v-if="answerFileRows(topicIndex, subIndex, subQuestion).length"
                        :data="answerFileRows(topicIndex, subIndex, subQuestion)"
                        size="small"
                        border
                      >
                        <el-table-column prop="fileName" label="文件名" min-width="180" show-overflow-tooltip />
                        <el-table-column prop="fileType" label="类型" width="100" />
                        <el-table-column prop="subtype" label="识别情况" min-width="150" show-overflow-tooltip />
                        <el-table-column prop="reason" label="答案文件说明" min-width="220" show-overflow-tooltip />
                        <el-table-column label="状态" width="80">
                          <template #default="{ row }">
                            <el-tag size="small" :type="row.status === 'ABNORMAL' ? 'warning' : 'success'">{{ row.status === 'ABNORMAL' ? '异常' : '正常' }}</el-tag>
                          </template>
                        </el-table-column>
                      </el-table>
                      <el-table v-else-if="questionTextRows(subQuestion).length" :data="questionTextRows(subQuestion)" size="small" border>
                        <el-table-column prop="content" label="文本内容" min-width="220" />
                        <el-table-column prop="source" label="文本来源" min-width="220" show-overflow-tooltip />
                        <el-table-column prop="sourceType" label="来源文件类型" width="110" />
                        <el-table-column prop="description" label="答案内容说明" min-width="140" />
                        <el-table-column label="状态" width="80"><template #default="{ row }"><el-tag size="small" :type="row.status === 'ABNORMAL' ? 'warning' : 'success'">{{ row.status === 'ABNORMAL' ? '异常' : '正常' }}</el-tag></template></el-table-column>
                      </el-table>
                      <el-empty v-else description="本题暂无答案结果文件" :image-size="44" />
                    </div>
                    <div
                      v-if="subGrades.get(`${topicIndex}.${subIndex}`)"
                      class="sub-score-summary"
                    >
                      <span>评阅：{{ questionScoreText(subGrades.get(`${topicIndex}.${subIndex}`)) }}</span>
                      <span>评语：{{ subGrades.get(`${topicIndex}.${subIndex}`)?.comments.join('\n') || '暂无评语' }}</span>
                    </div>
                  </div>
                </template>

              </div>
            </el-collapse-item>
          </el-collapse>
        </template>
        <el-empty v-else-if="!loading" description="暂无该考生的评阅详情" />
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  getCandidateAssignments,
  getGradingStandardVersions,
  getLocalPackageResultData,
  type ExamGradingStandard,
  type LocalGradingRecordItem,
  type StudentAnswerJson
} from '@/api/teacher-scoring'
import { extractEmbeddedImagePaths, stripEmbeddedImageMarkers } from '@/utils/local-scoring-package'
import { getAssignmentFileRows, getAssignmentTextRows } from '@/utils/assignment-files'
import { findStandardPaperStructure, loadLatestStandardStructure } from '@/utils/paper-structure'
import { openStudentAnswerFolder } from '@/api/teacher-scoring'
import { splitCommentHint, type CommentSegment } from '@/utils/comment-hint'
import {
  buildFormalTopics,
  buildStandardMaxScoreMap,
  getPaperMaxScore,
  getQuestionGrade,
  getTopicGrade,
  getTopicMaxScore,
  summarizeStudentFormal,
  type FormalTopicNode,
  type QuestionGrade
} from './components/formal-results-model'

const route = useRoute()
const router = useRouter()
const loading = ref(false)

const studentNo = computed(() => String(route.params.studentNo || '').trim())

const topics = ref<FormalTopicNode[]>([])
const answerFolderPath = ref('')
const records = ref<LocalGradingRecordItem[]>([])
const maxScoreMap = ref<Map<string, number>>(new Map())

const expandedNames = computed(() => topics.value.map((_, index) => String(index + 1)))

const displayText = (value?: string) => stripEmbeddedImageMarkers(value)

const imageReference = (value: any) => {
  if (typeof value === 'string') return value.trim().replace(/^image\/?media\//i, 'media/')
  if (!value || typeof value !== 'object') return ''
  return String(value.url || value.path || value.storage_path || value.relative_path || value.file_name || value.name || '')
    .trim()
    .replace(/^image\/?media\//i, 'media/')
}

const uniqueStrings = (items: any[]) => Array.from(new Set(items.map(imageReference).filter(Boolean)))

const standaloneImages = (question: any) => {
  const embedded = new Set([
    ...extractEmbeddedImagePaths(question?.question),
    ...extractEmbeddedImagePaths(question?.answer)
  ].map((item) => item.toLowerCase()))
  return uniqueStrings(question?.images || []).filter((image) => !embedded.has(String(image).toLowerCase()))
}

const subQuestionCount = (topic: FormalTopicNode) => (topic.sub_question || []).length || 1

/** 与评阅页面一致的小题题号：仅一道小题时不带 .N 后缀 */
const subQuestionLabel = (topicIndex: number, subIndex: number) => (
  `${topicIndex + 1}${(topics.value[topicIndex]?.sub_question || []).length > 1 ? `.${subIndex + 1}` : ''}`
)

/** 各小题成绩：键为 `${topicIndex}.${subIndex}`，整题评分的小题回退大题记录 */
const subGrades = computed(() => {
  const map = new Map<string, QuestionGrade>()
  topics.value.forEach((topic, topicIndex) => {
    (topic.sub_question || []).forEach((sub, subIndex) => {
      const grade = getQuestionGrade(records.value, {
        questionNo: `${topicIndex + 1}.${subIndex + 1}`,
        topicIndex,
        subIndex,
        topicHasSubs: true
      })
      if (grade) map.set(`${topicIndex}.${subIndex}`, grade)
    })
  })
  return map
})

/** 各大题成绩与满分 */
const topicGrades = computed(() => topics.value.map((_, topicIndex) => {
  const grade = getTopicGrade(records.value, topics.value, topicIndex)
  if (!grade) return null
  return {
    ...grade,
    maxScore: getTopicMaxScore(topics.value, topicIndex, records.value, maxScoreMap.value) || grade.maxScore
  }
}))

const studentSummary = computed(() => summarizeStudentFormal(records.value, topics.value))
const summary = computed(() => ({
  gradedCount: studentSummary.value.gradedCount,
  questionCount: studentSummary.value.questionCount
}))
const totalScore = computed(() => studentSummary.value.totalScore)

const totalScoreText = computed(() => (totalScore.value === null ? '未完成' : `${totalScore.value}${paperMaxScore.value ? ` / ${paperMaxScore.value}` : ''}`))

const paperMaxScore = computed(() => getPaperMaxScore(topics.value, records.value, maxScoreMap.value))

// 异常试卷判定：评阅完成后总分为 0 分（与评阅完成报告页同一口径），
// 非零分数（含满分卷）不再标记异常。
const abnormal = computed(() => summary.value.questionCount > 0
  && summary.value.gradedCount >= summary.value.questionCount
  && totalScore.value === 0)

const commentSegments = (comments?: string[]): CommentSegment[] => splitCommentHint((comments || []).join('\n'))

const questionScoreText = (grade?: { score: number | null; maxScore: number | null }) => (
  !grade || grade.score === null ? '暂无' : `${grade.score}${grade.maxScore ? ` / ${grade.maxScore}` : ''}`
)

// 题目归属匹配（精确题号 → 前缀 → PR/DW 等编码关键词 → 大题顺序映射）
// 统一放在 utils/assignment-files.ts，与试卷包详情、试阅页共用同一套规则。
const answerFileRows = (topicIndex: number, subIndex: number, question: FormalTopicNode) => {
  const questionNo = subIndex >= 0 ? `${topicIndex + 1}.${subIndex + 1}` : `${topicIndex + 1}`
  return getAssignmentFileRows(assignment.value, questionNo, question.question)
}

// 无答案结果文件时的文本答案表格行：用归属结果里的抽取内容
// （11A 等纯文本 AI 题的字段，每字段一行）；没有抽取内容就返回空
// （显示"无"），答卷文档转换出的材料文本不冒充考生答案。
const questionTextRows = (question: FormalTopicNode) => getAssignmentTextRows(assignment.value)

const assignment = ref<any>(null)

const openAnswerFolder = async () => {
  try {
    await openStudentAnswerFolder(
      String(route.params.subjectId),
      String(route.params.examId),
      String(route.params.packageId),
      studentNo.value
    )
    ElMessage.success('已打开答题文件夹')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '打开答题文件夹失败')
  }
}

const goBack = () => router.push({
  name: 'teacher-package-formal-results',
  params: {
    subjectId: String(route.params.subjectId),
    examId: String(route.params.examId),
    packageId: String(route.params.packageId)
  },
  query: { standardId: route.query.standardId }
})

onMounted(async () => {
  if (!studentNo.value) {
    ElMessage.warning('缺少考生信息')
    goBack()
    return
  }
  loading.value = true
  try {
    const response = await getLocalPackageResultData(
      String(route.params.subjectId),
      String(route.params.examId),
      String(route.params.packageId),
      'formal',
      studentNo.value,
      route.query.standardId as string | undefined
    )
    if (![0, 200].includes(response.code)) throw new Error(response.message || '读取考生评阅详情失败')
    const student = response.data?.students?.[0]
    if (!student) throw new Error('未找到该考生的答卷')
    // 标准版本（含结构快照）先于题目树加载：题目树按任务/最新标准的快照展示结构
    let standardVersions: ExamGradingStandard[] = []
    let latestStructureFallback: Record<string, any> | null = null
    const effectiveStandardId = Number(response.data?.standard_id) || Number(route.query.standardId) || undefined
    try {
      const standardResponse = await getGradingStandardVersions(String(route.params.subjectId), String(route.params.examId))
      standardVersions = standardResponse?.data || []
      // 版本列表未返回快照字段时补拉最新标准兜底（latest 接口确认返回快照）
      if (!findStandardPaperStructure(standardVersions, effectiveStandardId)) {
        latestStructureFallback = await loadLatestStandardStructure(String(route.params.subjectId), String(route.params.examId))
      }
      maxScoreMap.value = buildStandardMaxScoreMap(standardVersions, effectiveStandardId)
    } catch {
      maxScoreMap.value = new Map()
    }
    // 试卷结构优先用阅卷标准快照（含教师新增/修正的题目），版本列表没有
    // 快照字段时用 latest 兜底，旧标准回退空白卷
    topics.value = buildFormalTopics(
      student.answer_json as StudentAnswerJson | undefined,
      latestStructureFallback
        || findStandardPaperStructure(standardVersions, effectiveStandardId)
        || response.data?.blank_paper_json || null
    )
    records.value = (response.data?.records || []).filter((record: LocalGradingRecordItem) => !record.is_trial)
    answerFolderPath.value = String(response.data?.answer_folder_path || '')

    try {
      const assignmentResponse = await getCandidateAssignments(
        String(route.params.subjectId),
        String(route.params.examId),
        String(route.params.packageId),
        studentNo.value
      )
      assignment.value = assignmentResponse.data?.assignments?.[0] || null
    } catch {
      // 旧试卷包没有归属记录时仍展示答卷和评分记录。
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '读取考生评阅详情失败')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.formal-student-detail-page {
  min-height: 100vh;
  padding: 24px;
  box-sizing: border-box;
  background: #f4f6f9;
}

.formal-student-detail-panel {
  min-height: calc(100vh - 48px);
  padding: 26px 30px 34px;
  box-sizing: border-box;
  border-radius: 12px;
  background: #fff;
}

.detail-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e5e7eb;
}

.detail-page-header h1 {
  margin: 0;
  color: #1f2937;
  font-size: 22px;
}

.detail-page-content {
  margin-top: 22px;
}

.student-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.student-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  color: #111827;
  font-size: 18px;
}

.student-title .score-text {
  margin-left: 8px;
  color: #dc2626;
  font-weight: 600;
}

.meta-text {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  color: #606266;
  font-size: 14px;
}

.blank-paper-collapse {
  --el-collapse-header-height: 54px;
  --el-collapse-header-bg-color: transparent;
  --el-collapse-content-bg-color: transparent;
  --el-collapse-border-color: transparent;
}

.blank-paper-collapse :deep(.el-collapse-item) {
  margin-bottom: 12px;
  overflow: hidden;
  border: 1px solid #dbe3ef;
  border-radius: 10px;
  background: #fff;
}

.blank-paper-collapse :deep(.el-collapse-item:last-child) {
  margin-bottom: 0;
}

.blank-paper-collapse :deep(.el-collapse-item__header) {
  padding: 0 16px;
  font-size: 15px;
  font-weight: 600;
}

.blank-paper-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: 0;
}

.blank-paper-collapse :deep(.el-collapse-item__content) {
  padding-bottom: 10px;
}

.blank-paper-collapse .section-title {
  overflow: hidden;
  flex: 1;
  margin: 0 14px;
  color: var(--el-text-color-secondary);
  font-size: 15px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.collapse-question-content {
  padding: 0 14px 2px;
}

.review-status-tag {
  margin-left: 8px;
  vertical-align: middle;
}

.question-card {
  margin: 12px 0;
  padding: 14px 0;
}

/* 分隔线只出现在相邻小题之间，大题框底部保持干净。 */
.collapse-question-content > .question-card + .question-card,
.collapse-question-content > .sub-question + .sub-question {
  border-top: 2px solid #b8c4d3;
}

.question-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  line-height: 1.6;
}

.question-head strong {
  flex: 1;
  min-width: 0;
  color: #111827;
  font-weight: 700;
  font-size: 16px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.question-head-actions {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 8px;
  margin-left: auto;
}

.question-no {
  flex: 0 0 auto;
  color: var(--el-color-primary);
  font-weight: 600;
  font-size: 15px;
}

.steps {
  margin: 10px 0 0 38px;
  color: var(--el-text-color-secondary);
  font-size: 15px;
  white-space: pre-wrap;
  line-height: 1.7;
}

.steps span {
  color: var(--el-text-color-secondary);
}

.question-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.answer-panel {
  margin-top: 14px;
  padding: 10px 0 0;
  border-top: 0;
}

.answer-label {
  margin-bottom: 6px;
  color: #374151;
  font-size: 15px;
  font-weight: 600;
}

/* 保留表格分隔线，去掉答案抽取区域的多层外框。 */
.answer-panel :deep(.el-table) {
  --el-table-border-color: #eef2f7;
  border: 0;
  border-radius: 0;
}

.answer-panel :deep(.el-table__inner-wrapper::before) {
  display: none;
}

.answer-panel :deep(.el-table__header-wrapper th.el-table__cell) {
  background: #f8fafc;
  color: #111827;
  font-size: 14px;
  font-weight: 700;
}

.answer-panel :deep(.el-table__body-wrapper td.el-table__cell),
.answer-panel :deep(.el-table__header-wrapper th.el-table__cell) {
  border-right: 0;
}

.answer-panel :deep(.el-table__body-wrapper td.el-table__cell) {
  font-size: 14px;
}

.sub-score-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin-top: 8px;
  color: #606266;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.comment-hint { color: #dc2626; }
.answer-folder-line { color: #606266; }
.answer-folder-link { color: var(--el-color-primary); cursor: pointer; text-decoration: none; overflow-wrap: anywhere; }
.answer-folder-link:hover { color: var(--el-color-primary); text-decoration: underline; }
.sub-score-summary span:first-child {
  color: #dc2626;
  font-weight: 600;
}

.sub-score-summary.sub-score-note span:first-child {
  color: #909399;
  font-weight: 400;
}

@media (max-width: 640px) {
  .formal-student-detail-page { padding: 12px; }
  .formal-student-detail-panel { padding: 20px 16px; }
  .detail-page-header { align-items: flex-start; flex-direction: column; }
  .question-head { flex-direction: column; }
}
</style>

<template>
  <main class="completion-page">
    <section class="completion-panel">
      <div class="completion-header">
        <div>
          <h1>评阅完成报告<span v-if="contextScopeLabel" class="header-context-scope">（{{ contextScopeLabel }}）</span></h1>
        </div>
        <div class="completion-actions">
          <el-button @click="goToResults">查看评阅结果</el-button>
          <el-button type="primary" @click="goBackToPackage">返回评阅页面</el-button>
        </div>
      </div>

      <div v-loading="loading" class="completion-content">
        <el-collapse v-model="expandedPanels" class="completion-collapse">
          <el-collapse-item name="graded">
            <template #title>
              <span class="panel-title">本次评阅</span>
              <span class="panel-count"><strong>{{ rows.length }}</strong> 份试卷</span>
            </template>
            <el-empty v-if="!rows.length && !loading" description="暂无本次评阅结果" :image-size="56" />
            <StudentTable v-else :rows="rows" />
          </el-collapse-item>

          <el-collapse-item name="normal">
            <template #title>
              <span class="panel-title">正常试卷</span>
              <span class="panel-count"><strong>{{ normalRows.length }}</strong> 份</span>
            </template>
            <el-empty v-if="!normalRows.length" description="本次评阅没有正常试卷" :image-size="56" />
            <StudentTable v-else :rows="normalRows" />
          </el-collapse-item>

          <el-collapse-item name="abnormal">
            <template #title>
              <span class="panel-title">0分试卷</span>
              <span class="panel-count"><strong>{{ abnormalRows.length }}</strong> 份</span>
            </template>
            <el-empty v-if="!abnormalRows.length" description="本次评阅没有0分试卷" :image-size="56" />
            <StudentTable v-else :rows="abnormalRows" />
          </el-collapse-item>
        </el-collapse>

        <el-alert
          v-if="abnormalCount"
          title="请在查看评阅结果页面的0分试卷标签中继续处理0分试卷。"
          type="warning"
          show-icon
          :closable="false"
        />
        <el-alert v-else-if="rows.length" title="本次评阅未发现0分试卷。" type="success" show-icon :closable="false" />
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElTable, ElTableColumn } from 'element-plus'
import { getCandidateAssignments, getLocalPackageResultData, type LocalGradingRecordItem } from '@/api/teacher-scoring'
import { loadDisplayStructure } from '@/utils/paper-structure'
import { fetchScoringContextNames } from '@/utils/scoring-context'
import {
  buildFormalTopics,
  extractReviewSummaryText,
  formatReviewQuestionLabel,
  summarizeStudentFormal,
  topicHasAssignmentFiles,
  type FormalTopicNode
} from './components/formal-results-model'

type CompletionRow = {
  student_no: string
  statusText: string
  scoreText: string | number
  abnormal: boolean
  /** 评阅汇总结果：每道需人工复核题的题号与复核内容（服务 review_summary），依次往下排 */
  reviewSummary: Array<{ label: string; comment: string }>
}

/** 折叠面板内的考生明细表：各面板复用同一套列定义 */
const StudentTable = defineComponent({
  props: { rows: { type: Array as () => CompletionRow[], required: true } },
  setup(props) {
    const router = useRouter()
    // 考号可点击：跳转到该考生的评阅详情页（与查看评阅结果页同一目标路由）
    const openDetail = (studentNo: string) => router.push({
      name: 'teacher-package-formal-student-detail',
      params: {
        subjectId: String(route.params.subjectId),
        examId: String(route.params.examId),
        packageId: String(route.params.packageId),
        studentNo
      },
      query: { standardId: route.query.standardId }
    })
    return () => h(ElTable, { data: props.rows, stripe: true }, {
      default: () => [
        h(ElTableColumn, { prop: 'student_no', label: '考号', minWidth: 150 }, {
          default: ({ row }: { row: CompletionRow }) => h('a', {
            class: 'student-link',
            title: '查看该考生评阅详情',
            onClick: () => openDetail(row.student_no)
          }, row.student_no)
        }),
        h(ElTableColumn, { prop: 'statusText', label: '评分状态', minWidth: 130 }),
        h(ElTableColumn, { prop: 'scoreText', label: '得分', width: 120 }),
        h(ElTableColumn, { label: '异常情况汇总', minWidth: 420 }, {
          default: ({ row }: { row: CompletionRow }) => (row.reviewSummary.length
            ? h('div', { class: 'review-summary-list' }, row.reviewSummary.map((item) => h('div', { class: 'review-summary-item', key: item.label }, [
              h('span', { class: 'review-question-no' }, item.label),
              h('span', { class: 'review-comment' }, item.comment)
            ])))
            : h('span', { class: 'normal-text' }, '无'))
        })
      ]
    })
  }
})

const route = useRoute()
const router = useRouter()
// 标题括号里用试卷包名
const contextScopeLabel = ref('')
watch(
  () => [route.params.subjectId, route.params.examId, route.params.packageId],
  async () => {
    const { packageName } = await fetchScoringContextNames(
      String(route.params.subjectId), String(route.params.examId), String(route.params.packageId)
    )
    contextScopeLabel.value = packageName
  },
  { immediate: true }
)
const loading = ref(false)
const rows = ref<CompletionRow[]>([])
const expandedPanels = ref<string[]>(['graded'])

// 答案抽取归属：studentNo -> 归属记录。用它判断每道大题是否真的交了文件，
// 把「没交文件记0分」（正常业务结果）和「有文件但机器判不了」（真正转人工）区分开。
const assignmentFileMap = ref<Record<string, any>>({})

const targetStudentNos = computed(() => String(route.query.studentNos || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean))

const normalRows = computed(() => rows.value.filter((row) => !row.abnormal))
const abnormalRows = computed(() => rows.value.filter((row) => row.abnormal))
const abnormalCount = abnormalRows.value.length

const buildRows = (students: Array<{ student_no: string }>, records: LocalGradingRecordItem[], topics: FormalTopicNode[]) =>
  students.map((student) => {
    const studentRecords = records.filter((record) => String(record.student_no) === student.student_no)
    const summary = summarizeStudentFormal(studentRecords, topics)
    // 评阅汇总结果：每道题先取最新一条记录（列表按评分时间倒序），
    // 再看该记录的 needs_manual——旧轮次的标记不得覆盖最新结果。
    const latestByQuestion = new Map<string, LocalGradingRecordItem>()
    studentRecords.forEach((record) => {
      const questionNo = String(record.question_no || '').trim()
      if (!questionNo || latestByQuestion.has(questionNo)) return
      latestByQuestion.set(questionNo, record)
    })
    // 旧的大题级整题记录（如历史流程的 question_no="4"）：当该大题已有
    // 小题级记录（4.1/4.2）时，整题记录是旧流程的遗留，不再进入汇总，
    // 避免同一大题同时出现整题与拆分两套结果。
    const subQuestionNos = [...latestByQuestion.keys()].filter((no) => no.includes('.'))
    const coveredMajors = new Set(subQuestionNos.map((no) => no.split('.')[0]))
    for (const no of [...latestByQuestion.keys()]) {
      if (!no.includes('.') && coveredMajors.has(no.split('.')[0])) {
        latestByQuestion.delete(no)
      }
    }
    // 评阅汇总结果：每道题先取最新一条记录（列表按评分时间倒序），
    // 汇总内容优先取 review_summary 字段，旧记录回退评语末尾的（复核提示：…）；
    // 「没交文件记0分」不算转人工：该大题（含全部小题）没有任何答案
    // 结果文件时，服务的需人工复核标记不进汇总（归属数据缺失时保守保留）。
    const reviewSummary = [...latestByQuestion.entries()]
      .filter(([questionNo]) => topicHasAssignmentFiles(
        assignmentFileMap.value[student.student_no],
        topics[Number(questionNo.split('.')[0]) - 1],
        questionNo.split('.')[0]
      ))
      .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
      .map(([questionNo, record]) => ({
        label: formatReviewQuestionLabel(questionNo),
        comment: String(record.review_summary || '').trim() || extractReviewSummaryText(record)
      }))
      .filter((item) => item.comment)
    // 异常试卷只放总分为 0 分的考生
    const abnormal = summary.totalScore === 0
    return {
      student_no: student.student_no,
      statusText: summary.complete ? '已完成' : `已评 ${summary.gradedCount}/${summary.questionCount}`,
      scoreText: summary.totalScore === null ? '未完成' : summary.totalScore,
      abnormal,
      reviewSummary
    }
  })

const goToResults = () => router.push({
  name: 'teacher-package-formal-results',
  params: { subjectId: String(route.params.subjectId), examId: String(route.params.examId), packageId: String(route.params.packageId) }
  , query: { standardId: route.query.standardId }
})
const goBackToPackage = () => router.push({
  name: 'teacher-package-detail',
  params: { subjectId: String(route.params.subjectId), examId: String(route.params.examId), packageId: String(route.params.packageId) },
  query: { mode: 'formal', standardId: route.query.standardId }
})

onMounted(async () => {
  loading.value = true
  try {
    const response = await getLocalPackageResultData(String(route.params.subjectId), String(route.params.examId), String(route.params.packageId), 'formal', undefined, route.query.standardId as string | undefined)
    if (![0, 200].includes(response.code)) throw new Error(response.message || '读取评阅完成报告失败')
    const availableStudents = (response.data?.students || []).map((student: any) => ({ student_no: String(student.student_no || '') })).filter((student) => student.student_no)
    const students = targetStudentNos.value.length
      ? availableStudents.filter((student) => targetStudentNos.value.includes(student.student_no))
      : availableStudents
    // 阅卷标准结构快照（含教师新增/修正的题目）优先作为题目树结构，旧标准回退空白卷
    const paperStructure = await loadDisplayStructure(
      String(route.params.subjectId),
      String(route.params.examId),
      route.query.standardId as string | undefined
    )
    const topics = buildFormalTopics(
      response.data?.students?.[0]?.answer_json,
      paperStructure || response.data?.blank_paper_json || null
    )
    // 答案抽取归属用于区分「没交文件」与「有文件判不了」；读取失败时置空，
    // 汇总按保守口径保留全部复核标记。
    try {
      const assignmentResponse = await getCandidateAssignments(String(route.params.subjectId), String(route.params.examId), String(route.params.packageId))
      const next: Record<string, any> = {}
      ;(assignmentResponse.data?.assignments || []).forEach((record: any) => {
        const studentNo = String(record.student_no || '').trim()
        if (studentNo) next[studentNo] = record
      })
      assignmentFileMap.value = next
    } catch {
      assignmentFileMap.value = {}
    }
    rows.value = buildRows(students, (response.data?.records || []).filter((record: LocalGradingRecordItem) => !record.is_trial), topics)
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '读取评阅完成报告失败')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.completion-page { min-height: 100vh; padding: 24px; box-sizing: border-box; background: #f4f6f9; }
.completion-panel { min-height: calc(100vh - 48px); padding: 26px 30px 34px; box-sizing: border-box; border-radius: 12px; background: #fff; }
.completion-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 18px; border-bottom: 1px solid #e5e7eb; }
.header-context-scope { color: inherit; font-size: inherit; font-weight: inherit; }
.completion-header h1 { margin: 0; color: #1f2937; font-size: 22px; }
.completion-header p { margin: 7px 0 0; color: #7b8798; }
.completion-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.completion-content { margin-top: 22px; display: grid; gap: 18px; }

.completion-collapse { --el-collapse-header-height: 56px; }
.completion-collapse :deep(.el-collapse-item__header) { padding: 0 6px; }
.completion-collapse :deep(.el-collapse-item__content) { padding: 6px 6px 14px; }
.panel-title { color: #253248; font-size: 17px; font-weight: 700; }
.panel-count { margin-left: 12px; color: #7b8798; font-size: 14px; }
.panel-count strong { margin-right: 2px; color: #2563eb; font-size: 18px; }
.normal-text { color: #64748b; }
/* 表格由子组件渲染，需用 :deep 让样式穿透到表格内部元素 */
:deep(.student-link) { color: var(--el-color-primary); cursor: pointer; text-decoration: none; overflow-wrap: anywhere; }
:deep(.student-link:hover) { color: var(--el-color-primary); text-decoration: underline; text-decoration-color: var(--el-color-primary); }
:deep(.review-summary-list) { display: flex; flex-direction: column; }
:deep(.review-summary-item) { display: flex; gap: 8px; align-items: flex-start; line-height: 1.6; padding: 8px 0; }
:deep(.review-summary-item + .review-summary-item) { border-top: 1px dashed #d8dee9; }
:deep(.review-question-no) { flex: 0 0 auto; color: #dc2626; font-weight: 700; }
:deep(.review-comment) { flex: 1; min-width: 0; color: #374151; white-space: pre-wrap; overflow-wrap: anywhere; }
:deep(.review-hint-text) { color: #dc2626; }
@media (max-width: 640px) { .completion-page { padding: 12px; }.completion-panel { padding: 20px 16px; }.completion-header { align-items: flex-start; flex-direction: column; } }
</style>

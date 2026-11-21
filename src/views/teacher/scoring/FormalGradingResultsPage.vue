<template>
  <main class="formal-results-page">
    <section class="formal-results-panel">
      <div class="formal-section-head">
        <div>
          <h1>正式评阅结果</h1>
          <p>分数和评语来自正式评阅记录，已持久化保存。页面会自动刷新最新结果。</p>
        </div>
        <el-button :loading="loading" @click="loadData()">刷新结果</el-button>
      </div>

      <div v-loading="loading" class="formal-results-content">
        <ScoreDistributionChart :rows="summaryRows" :max-score="paperMaxScore" />

        <div class="summary-overview-grid">
          <MetricStatCard label="试卷份数" :value="stats.paperCount" :icon="Document" />
          <MetricStatCard label="最高分" :value="stats.maxScore" :icon="Document" tone="success" />
          <MetricStatCard label="最低分" :value="stats.minScore" :icon="Document" tone="info" />
          <MetricStatCard label="平均分" :value="stats.avgScore" :icon="Document" tone="success" />
          <MetricStatCard label="异常试卷" :value="stats.abnormalCount" :icon="WarningFilled" tone="warning" />
        </div>

        <el-tabs v-model="activeTab" class="formal-tabs">
          <el-tab-pane label="汇总结果" name="summary">
            <div class="summary-section-head">
              <div>
                <h2>试卷明细</h2>
                <p>点击考号查看该考生各题的分数与评语。</p>
              </div>
              <div class="summary-head-actions">
                <el-button size="small" :icon="Download" @click="exportExcel">导出Excel</el-button>
                <el-button size="small" :icon="Download" @click="exportJson">导出JSON</el-button>
              </div>
            </div>
            <el-table ref="resultsTableRef" :data="pagedRows" stripe @filter-change="onStatusFilterChange">
              <el-table-column prop="student_no" label="考号" min-width="180" />
              <el-table-column
                prop="reviewStatus"
                :label="statusColumnLabel"
                min-width="150"
                column-key="reviewStatus"
                :filters="statusFilters"
                :filter-method="filterStatus"
                :filter-multiple="false"
              >
                <template #default="{ row }">{{ row.statusText }}</template>
              </el-table-column>
              <el-table-column prop="totalScoreText" label="分数" min-width="120" />
              <el-table-column label="操作" width="130">
                <template #default="{ row }">
                  <el-button link type="primary" @click="openDetail(row)">查看详细</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="pagination-wrap">
              <el-pagination v-model:current-page="page" :page-size="pageSize" :total="filteredRows.length" layout="total, prev, pager, next" background />
            </div>
          </el-tab-pane>

          <el-tab-pane :label="`异常试卷${abnormalRows.length ? `（${abnormalRows.length}）` : ''}`" name="exceptions">
            <div class="exception-toolbar">
              <span>异常判定：总分不超过</span>
              <el-select v-model="abnormalThreshold" size="small" class="exception-threshold-select">
                <el-option
                  v-for="option in thresholdOptions"
                  :key="option"
                  :label="`${option} 分${option >= paperMaxScore ? '（满分）' : ''}`"
                  :value="option"
                />
              </el-select>
              <span>分的考生（当前 {{ abnormalRows.length }} 份，以 10 分为一段）</span>
            </div>
            <el-empty v-if="!abnormalRows.length" description="暂无异常试卷" :image-size="56" />
            <template v-else>
              <el-table :data="pagedAbnormalRows" stripe>
                <el-table-column prop="student_no" label="考号" min-width="180" />
                <el-table-column prop="statusText" label="评分状态" min-width="150" />
                <el-table-column prop="totalScoreText" label="分数" min-width="120" />
                <el-table-column label="操作" width="130">
                  <template #default="{ row }">
                    <el-button link type="primary" @click="openDetail(row)">查看详细</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <div class="pagination-wrap">
                <el-pagination
                  v-model:current-page="exceptionPage"
                  :page-size="pageSize"
                  :total="abnormalRows.length"
                  layout="total, prev, pager, next"
                  background
                />
              </div>
            </template>
          </el-tab-pane>
        </el-tabs>
      </div>

      <el-empty v-if="!loading && !summaryRows.length" description="暂无正式评阅结果" />
    </section>

  </main>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Document, Download, WarningFilled } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import { getCandidateAssignments, getGradingStandardVersions, getLocalPackageResultData, type ExamGradingStandard, type LocalGradingRecordItem } from '@/api/teacher-scoring'
import { getAssignmentQuestionFiles, orderAssignmentFields } from '@/utils/assignment-files'
import { findStandardPaperStructure, loadLatestStandardStructure } from '@/utils/paper-structure'
import MetricStatCard from '@/components/MetricStatCard.vue'
import ScoreDistributionChart from './components/ScoreDistributionChart.vue'
import {
  buildFormalTopics,
  buildStandardMaxScoreMap,
  extractReviewSummaryText,
  formatReviewQuestionLabel,
  getPaperMaxScore,
  getQuestionGrade,
  getTopicGrade,
  recordTime,
  summarizeStudentFormal,
  topicHasAssignmentFiles,
  type FormalTopicNode
} from './components/formal-results-model'

type SummaryRow = {
  student_no: string
  totalScore: number | null
  totalScoreText: string | number
  maxTotal: number
  gradedCount: number
  questionCount: number
  statusText: string
  abnormal: boolean
  /** 评分状态筛选：ungraded=未评 / graded=已评 */
  reviewStatus: 'ungraded' | 'graded'
}

const route = useRoute()
const router = useRouter()
// 阅卷任务子菜单以 route props 传入任务绑定的科目/考试/试卷包/标准；
// 直接按参数路由访问（如从完成报告跳转）时回退到 route.params/query。
const pageProps = defineProps<{ subjectId?: string; examId?: string; packageId?: string; standardId?: string }>()
const activeSubjectId = computed(() => String(pageProps.subjectId || route.params.subjectId || ''))
const activeExamId = computed(() => String(pageProps.examId || route.params.examId || ''))
const activePackageId = computed(() => String(pageProps.packageId || route.params.packageId || ''))
const activeStandardId = computed(() => (pageProps.standardId || (route.query.standardId as string | undefined) || undefined))
const loading = ref(false)
const activeTab = ref('summary')
const page = ref(1)
const pageSize = 30
const students = ref<Array<{ student_no: string }>>([])
const records = ref<LocalGradingRecordItem[]>([])
const topics = ref<FormalTopicNode[]>([])
// 答案抽取归属：studentNo -> 归属记录（用于导出 JSON 的答案结果文件）
const assignmentFileMap = ref<Record<string, any>>({})
const assignmentsLoaded = ref(false)
const maxScoreMap = ref<Map<string, number>>(new Map())
const standardsLoaded = ref(false)
// 标准版本列表（含结构快照），先于题目树加载，供快照结构与满分口径共用
const standardVersions = ref<ExamGradingStandard[]>([])
// 版本列表未返回结构快照字段时的兜底：最新标准的快照
const latestStructureFallback = ref<Record<string, any> | null>(null)
let refreshTimer: number | null = null

const paperMaxScore = computed(() => getPaperMaxScore(topics.value, records.value, maxScoreMap.value))
// 异常线（总分不超过该分数判为异常）：教师可选，以 10 分为一段直到满分；
// 默认 0 分——只标记评阅完成后总分为 0 的试卷，与评阅完成报告页同一口径。
const abnormalThreshold = ref(0)
const thresholdOptions = computed(() => {
  const max = Math.max(10, Math.ceil(paperMaxScore.value / 10) * 10)
  const options: number[] = [0]
  for (let option = 10; option < max; option += 10) options.push(option)
  options.push(max)
  return options
})

const recordsByStudent = computed(() => {
  const grouped = new Map<string, LocalGradingRecordItem[]>()
  records.value.filter((record) => !record.is_trial).forEach((record) => {
    grouped.set(record.student_no, [...(grouped.get(record.student_no) || []), record])
  })
  return grouped
})
const summaryRows = computed<SummaryRow[]>(() => students.value.map((student) => {
  const studentRecords = recordsByStudent.value.get(student.student_no) || []
  const summary = summarizeStudentFormal(studentRecords, topics.value)
  return {
    student_no: student.student_no,
    totalScore: summary.totalScore,
    totalScoreText: summary.totalScore === null ? '未完成' : summary.totalScore,
    maxTotal: paperMaxScore.value,
    gradedCount: summary.gradedCount,
    questionCount: summary.questionCount,
    statusText: summary.complete ? '已完成' : `已评 ${summary.gradedCount}/${summary.questionCount}`,
    abnormal: summary.complete && summary.totalScore !== null && summary.totalScore <= abnormalThreshold.value,
    reviewStatus: (summary.complete ? 'graded' : 'ungraded') as SummaryRow['reviewStatus']
  }
}))
// 评分状态列筛选：未选时显示全部考生；刷新/切换页面会重置筛选
const statusFilters = [
  { text: '未评', value: 'ungraded' },
  { text: '已评', value: 'graded' }
]
const resultsTableRef = ref()
const statusFilterValues = ref<string[]>([])
const filterStatus = (value: string, row: SummaryRow) => row.reviewStatus === value
const onStatusFilterChange = (filters: Record<string, any>) => {
  const value = filters.reviewStatus
  statusFilterValues.value = Array.isArray(value) ? value : (value ? [String(value)] : [])
}
// 列头文字跟随所选状态（已评/未评），未选择时默认“全部”
const statusColumnLabel = computed(() => {
  const selected = statusFilterValues.value[0]
  const text = statusFilters.find((option) => option.value === selected)?.text || '全部'
  return `评分状态（${text}）`
})
const filteredRows = computed(() => (
  statusFilterValues.value.length
    ? summaryRows.value.filter((row) => statusFilterValues.value.includes(row.reviewStatus))
    : summaryRows.value
))
const pagedRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const abnormalRows = computed(() => summaryRows.value.filter((row) => row.abnormal))
// 异常试卷列表分页（与汇总结果表同一页大小）；阈值调整后重置到第一页
const exceptionPage = ref(1)
const pagedAbnormalRows = computed(() => abnormalRows.value.slice((exceptionPage.value - 1) * pageSize, exceptionPage.value * pageSize))
watch(abnormalRows, (rows) => { if (exceptionPage.value > Math.max(1, Math.ceil(rows.length / pageSize))) exceptionPage.value = 1 })
const stats = computed(() => {
  const complete = summaryRows.value.filter((row) => row.totalScore !== null)
  const scores = complete.map((row) => Number(row.totalScore)).filter(Number.isFinite)
  return {
    paperCount: summaryRows.value.length,
    maxScore: scores.length ? Math.max(...scores) : 0,
    minScore: scores.length ? Math.min(...scores) : 0,
    avgScore: scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)) : 0,
    abnormalCount: abnormalRows.value.length
  }
})

async function loadData(silent = false) {
  if (!silent) loading.value = true
  try {
    const response = await getLocalPackageResultData(activeSubjectId.value, activeExamId.value, activePackageId.value, 'formal', undefined, activeStandardId.value)
    if (![0, 200].includes(response.code)) throw new Error(response.message || '读取正式评阅结果失败')
    students.value = (response.data?.students || []).map((student: any) => ({ student_no: String(student.student_no || '') })).filter((student) => student.student_no)
    records.value = (response.data?.records || []).filter((record: LocalGradingRecordItem) => !record.is_trial)
    const effectiveStandardId = Number(response.data?.standard_id) || Number(activeStandardId.value) || undefined
    // 标准版本（含结构快照）先于题目树加载：题目树按任务/最新标准的快照展示结构
    if (!standardsLoaded.value) {
      standardsLoaded.value = true
      try {
        const standardResponse = await getGradingStandardVersions(activeSubjectId.value, activeExamId.value)
        standardVersions.value = standardResponse?.data || []
        // 版本列表未返回快照字段时补拉最新标准兜底（latest 接口确认返回快照）
        if (!findStandardPaperStructure(standardVersions.value, effectiveStandardId)) {
          latestStructureFallback.value = await loadLatestStandardStructure(activeSubjectId.value, activeExamId.value)
        }
      } catch {
        standardVersions.value = []
      }
    }
    maxScoreMap.value = buildStandardMaxScoreMap(standardVersions.value, effectiveStandardId)
    // 试卷结构优先用阅卷标准快照（含教师新增/修正的题目），版本列表没有
    // 快照字段时用 latest 兜底，旧标准回退空白卷；完成度按「小题记录 + 大题整题记录」口径判断
    topics.value = buildFormalTopics(
      response.data?.students?.[0]?.answer_json,
      latestStructureFallback.value
        || findStandardPaperStructure(standardVersions.value, effectiveStandardId)
        || response.data?.blank_paper_json || null
    )
    if (!assignmentsLoaded.value) {
      assignmentsLoaded.value = true
      try {
        const assignmentResponse = await getCandidateAssignments(activeSubjectId.value, activeExamId.value, activePackageId.value)
        const next: Record<string, any> = {}
        ;(assignmentResponse.data?.assignments || []).forEach((record: any) => {
          const studentNo = String(record.student_no || '').trim()
          if (studentNo) next[studentNo] = record
        })
        assignmentFileMap.value = next
      } catch {
        assignmentFileMap.value = {}
      }
    }
  } catch (error: any) {
    if (!silent) ElMessage.error(error?.response?.data?.message || error?.message || '读取正式评阅结果失败')
  } finally {
    if (!silent) loading.value = false
  }
}
function openDetail(row: SummaryRow) {
  void router.push({
    name: 'teacher-package-formal-student-detail',
    params: {
      subjectId: activeSubjectId.value,
      examId: activeExamId.value,
      packageId: activePackageId.value,
      studentNo: row.student_no
    },
    query: { standardId: activeStandardId.value }
  })
}
function exportExcel() {
  const data = summaryRows.value.map((row) => ({
    考号: row.student_no,
    评分状态: row.statusText,
    分数: row.totalScoreText,
    满分: row.maxTotal
  }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), '正式评阅结果')
  XLSX.writeFile(workbook, '正式评阅结果.xlsx')
}

// 导出 JSON（格式对齐阅卷结果交换格式：id / total_score / result[]，逐大题含小题）
function exportJson() {
  // 只导出评阅完成（全部题目均已评分）的考生，未评完的不进导出文件
  const studentRows = summaryRows.value
    .filter((row) => row.reviewStatus === 'graded')
    .slice()
    .sort((left, right) => left.student_no.localeCompare(right.student_no, undefined, { numeric: true }))
  if (!studentRows.length) {
    ElMessage.warning('暂无评阅完成的考生，未生成导出文件')
    return
  }
  const data = studentRows.map((row) => {
    const studentRecords = recordsByStudent.value.get(row.student_no) || []
    // answer 填考生抽取到的答案结果文件（没有则为空字符串）
    const answerFilesText = (questionNo: string, questionText = '') => {
      const assignment = assignmentFileMap.value[String(row.student_no || '').trim()]
      const names = getAssignmentQuestionFiles(assignment, questionNo, questionText)
        .map((file: any) => String(file?.fileName || file?.file_name || file?.name || '').trim())
        .filter(Boolean)
      return [...new Set(names)].join('；')
    }
    // 无答案结果文件时的文本作答：归属抽取内容（11A 等纯文本 AI 题），
    // 加上字段标题并按固定顺序排列，每行答案用"||"隔开：
    // 大模型名称：… || 选择原因：… || 合适提示词：…
    const extractedAnswerText = () => {
      const assignment = assignmentFileMap.value[String(row.student_no || '').trim()]
      const fields = (((assignment as any)?.assignment_json?.student?.extractedContent?.fields || {}) as Record<string, string>)
      return orderAssignmentFields(fields).map(({ field, value }) => `${field}：${value}`).join(' || ')
    }
    const questionAnswerText = (questionNo: string, questionText = '') => (
      answerFilesText(questionNo, questionText) || extractedAnswerText()
    )
    // 导出的题目文本精简：11 系题干是"材料 + 要求表"整段文本，导出时
    // 只保留首行与"要求 | 答案"要求表部分，中间用"........."省略，避免
    // 全文入表显得杂乱；不含该标记的题干（如 33A）原样保留。
    const formatExportQuestionStem = (stem: string) => {
      const text = String(stem || '')
      const markerIndex = text.indexOf('要求 | 答案')
      if (markerIndex <= 0) return text
      const firstLineEnd = text.indexOf('\n')
      const firstLine = firstLineEnd > 0 ? text.slice(0, firstLineEnd) : text.slice(0, markerIndex)
      return `${firstLine}.........${text.slice(markerIndex)}`
    }
    const totalScore = summarizeStudentFormal(studentRecords, topics.value).totalScore
    // 大题级 comment 的记录口径与评阅完成报告页完全一致：
    // 1) 每道题只取最新一条记录（按评分时间），旧轮次标记不覆盖最新结果；
    // 2) 该大题已有小题级记录（如 4.1/4.2）时，旧流程遗留的整题记录
    //    （question_no="4"）不再计入，避免遗留复核内容混进导出文件。
    const latestByQuestion = new Map<string, LocalGradingRecordItem>()
    studentRecords.forEach((rec) => {
      const no = String(rec.question_no || '').trim()
      if (!no) return
      const previous = latestByQuestion.get(no)
      if (!previous || recordTime(rec) >= recordTime(previous)) latestByQuestion.set(no, rec)
    })
    const subQuestionNos = [...latestByQuestion.keys()].filter((no) => no.includes('.'))
    const coveredMajors = new Set(subQuestionNos.map((no) => no.split('.')[0]))
    for (const no of [...latestByQuestion.keys()]) {
      if (!no.includes('.') && coveredMajors.has(no.split('.')[0])) {
        latestByQuestion.delete(no)
      }
    }
    const latestRecords = [...latestByQuestion.values()]
    const result = topics.value.map((topic, topicIndex) => {
      const subs = topic.sub_question || []
      const topicGrade = getTopicGrade(studentRecords, topics.value, topicIndex)
      // 大题级 comment：本题评分信封返回的 review_summary（服务侧复核
      // 内容汇总），按题号标注、分号隔开；没有则为空字符串。只取最新
      // 记录里 needs_manual=1 的真正复核项，且该大题没交任何答案文件
      // （记0分正常结果）时不携带复核内容。
      const topicNo = String(topicIndex + 1)
      const topicRecords = latestRecords.filter((rec) => {
        const no = String(rec.question_no || '').trim()
        return no === topicNo || no.startsWith(`${topicNo}.`)
      })
      const seenSummaries = new Set<string>()
      const topicCommentParts: string[] = []
      const topicHasFiles = topicHasAssignmentFiles(assignmentFileMap.value[String(row.student_no || '').trim()], topic, topicNo)
      topicRecords.forEach((rec) => {
        if (!topicHasFiles) return
        if (Number(rec.needs_manual) !== 1) return
        const text = extractReviewSummaryText(rec)
        if (!text || seenSummaries.has(text)) return
        seenSummaries.add(text)
        topicCommentParts.push(`${formatReviewQuestionLabel(rec.question_no || topicNo)}：${text}`)
      })
      const topicComment = topicCommentParts.join('；')
      return {
        question: String(topic.question || ''),
        answer: subs.length ? '' : questionAnswerText(String(topicIndex + 1), String(topic.question || '')),
        images: (topic.answer_images || []) as string[],
        score: topicGrade?.score ?? 0,
        comment: topicComment,
        sub_question: subs.map((sub, subIndex) => {
          const questionNo = `${topicIndex + 1}.${subIndex + 1}`
          const grade = getQuestionGrade(studentRecords, {
            questionNo,
            topicIndex,
            subIndex,
            topicHasSubs: true
          })
          return {
            question: formatExportQuestionStem(String(sub.question || '')),
            answer: questionAnswerText(questionNo, String(sub.question || '')),
            images: (sub.answer_images || []) as string[],
            score: grade?.score ?? 0,
            comment: grade?.comments.join('\n') || '',
            sub_question: [] as never[]
          }
        })
      }
    })
    return {
      id: row.student_no,
      total_score: totalScore ?? 0,
      result
    }
  })
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = '正式评阅结果.json'
  anchor.click()
  URL.revokeObjectURL(url)
  const skippedCount = summaryRows.value.length - studentRows.length
  ElMessage.success(`已导出 ${studentRows.length} 份评阅完成的考生${skippedCount ? `（另有 ${skippedCount} 份未评完，未导出）` : ''}`)
}
watch(filteredRows, (rows) => { if (page.value > Math.max(1, Math.ceil(rows.length / pageSize))) page.value = 1 })
onMounted(async () => {
  await loadData()
  refreshTimer = window.setInterval(() => void loadData(true), 3000)
})
onActivated(() => {
  // 从其它页面切回时重置筛选状态；多个阅卷任务共用本组件
  // （keepAlive），切回时静默刷新，避免展示到上一个任务的数据
  resultsTableRef.value?.clearFilter?.()
  void loadData(true)
})
onBeforeUnmount(() => { if (refreshTimer !== null) window.clearInterval(refreshTimer) })
</script>

<style scoped>
.formal-results-page { min-height: 100vh; padding: 24px; box-sizing: border-box; background: #f4f6f9; }
.formal-results-panel { width: 100%; min-height: calc(100vh - 48px); padding: 26px 30px 34px; box-sizing: border-box; background: #fff; border-radius: 12px; }
.formal-section-head, .summary-section-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.formal-section-head h1 { margin: 0; color: #1f2937; font-size: 22px; }
.formal-section-head p, .summary-section-head p { margin: 7px 0 0; color: #7b8798; }
.formal-results-content { margin-top: 20px; }
.summary-overview-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; margin: 20px 0; }
.formal-tabs { margin-top: 20px; }
.summary-section-head h2 { margin: 0; color: #253248; font-size: 18px; }
.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 16px; }
.summary-head-actions { display: flex; align-items: center; gap: 14px; }
.exception-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; color: #606266; font-size: 14px; }
.exception-threshold-select { width: 140px; }
@media (max-width: 900px) { .summary-overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .formal-results-page { padding: 12px; }.formal-results-panel { padding: 20px 16px; }.formal-section-head { align-items: flex-start; flex-direction: column; }.summary-overview-grid { grid-template-columns: 1fr; } }
</style>

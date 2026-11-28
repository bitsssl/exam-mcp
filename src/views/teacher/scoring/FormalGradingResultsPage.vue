<template>
  <main class="formal-results-page">
    <section class="formal-results-panel">
      <div class="formal-section-head">
        <div>
          <h1>正式评阅结果<span v-if="contextScopeLabel" class="header-context-scope">（{{ contextScopeLabel }}）</span></h1>
        </div>
        <el-button :loading="loading" @click="loadData()">刷新结果</el-button>
      </div>

      <div v-loading="loading" class="formal-results-content">
        <ScoreDistributionChart :rows="summaryRows" :max-score="paperMaxScore" />

        <div class="summary-overview-grid">
          <MetricStatCard label="试卷总份数" :value="stats.paperCount" stacked />
          <MetricStatCard label="已阅份数" :value="stats.reviewedCount" tone="success" stacked />
          <MetricStatCard label="最高分" :value="stats.maxScore" tone="success" stacked />
          <MetricStatCard label="最低分" :value="stats.minScore" tone="info" stacked />
          <MetricStatCard label="平均分" :value="stats.avgScore" tone="success" stacked />
          <MetricStatCard label="0分试卷" :value="stats.abnormalCount" tone="warning" stacked />
        </div>

        <el-tabs v-model="activeTab" class="formal-tabs">
          <el-tab-pane label="汇总结果" name="summary">
            <div class="summary-section-head">
              <div>
                <h2>试卷明细</h2>
                <p>点击考号查看该考生各题的分数与评语。</p>
              </div>
              <div class="summary-head-actions">
                <el-button size="small" :icon="Download" @click="openExportDialog">导出Excel</el-button>
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

          <el-tab-pane :label="`0分试卷${abnormalRows.length ? `（${abnormalRows.length}）` : ''}`" name="exceptions">
            <el-empty v-if="!abnormalRows.length" description="暂无0分试卷" :image-size="56" />
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

    <el-dialog v-model="exportDialogVisible" title="导出题号对照" width="min(520px, 92vw)" align-center>
      <p class="export-dialog-tip">左列为本系统题号。请在右侧填写对应的考试院通用阅卷系统题号；不填的题目导出后该列为空。</p>
      <div class="export-dialog-rows">
        <div v-for="qid in exportQidList" :key="qid" class="export-dialog-row">
          <span class="export-dialog-qid">Q{{ qid }}</span>
          <el-input v-model="qidMappingDraft[qid]" placeholder="考试院通用阅卷系统题号" clearable />
        </div>
        <el-empty v-if="!exportQidList.length" description="暂无评阅记录，无可对照的题号" :image-size="44" />
      </div>
      <template #footer>
        <el-button @click="exportDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!exportQidList.length" :loading="exporting" @click="confirmExport">确定导出</el-button>
      </template>
    </el-dialog>

  </main>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import { fetchScoringContextNames } from '@/utils/scoring-context'
import { getCandidateAssignments, getGradingStandardVersions, getLocalPackageResultData, type ExamGradingStandard, type LocalGradingRecordItem } from '@/api/teacher-scoring'
import api, { apiPrefix } from '@/api/index'
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
// 页面标题括号与导出文件名都用试卷包名（评阅围绕试卷包执行）；包名缺失时回退考试名
const contextScopeLabel = ref('')
const exportPackageName = ref('')
watch([activeSubjectId, activeExamId, activePackageId], async () => {
  const { examName, packageName } = await fetchScoringContextNames(
    activeSubjectId.value, activeExamId.value, activePackageId.value
  )
  contextScopeLabel.value = packageName || examName
  exportPackageName.value = packageName
}, { immediate: true })
// 导出题号对照弹窗：考试院题号与本系统 qid 不一致时，由教师逐题填写对应关系，
// 导出时以 official_qid 列追加在 qid 后面
const exportDialogVisible = ref(false)
const exporting = ref(false)
const qidMappingDraft = ref<Record<string, string>>({})
const exportQidList = computed(() => {
  const seen = new Set<string>()
  const list: string[] = []
  for (const record of records.value) {
    const qid = String(record.question_no || '').trim()
    if (qid && !seen.has(qid)) {
      seen.add(qid)
      list.push(qid)
    }
  }
  return list.sort((a, b) => {
    const [am, as] = a.split('.')
    const [bm, bs] = b.split('.')
    const amn = Number(am), bmn = Number(bm)
    if (Number.isFinite(amn) && Number.isFinite(bmn) && amn !== bmn) return amn - bmn
    return a.localeCompare(b, undefined, { numeric: true })
  })
})
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
// 0分试卷：评阅完成后总分为 0 的考生，与评阅完成报告页同一口径

const recordsByStudent = computed(() => {
  const grouped = new Map<string, LocalGradingRecordItem[]>()
  records.value.filter((record) => !record.is_trial).forEach((record) => {
    grouped.set(record.student_no, [...(grouped.get(record.student_no) || []), record])
  })
  return grouped
})
// 考生答案文本（导出 Excel/JSON 共用）：先取归属抽取的答案结果文件名，
// 没有结果文件时回退归属抽取的文本作答（11A 等纯文本 AI 题）
const answerFilesTextFor = (studentNo: string, questionNo: string, questionText = '') => {
  const assignment = assignmentFileMap.value[String(studentNo || '').trim()]
  const names = getAssignmentQuestionFiles(assignment, questionNo, questionText)
    .map((file: any) => String(file?.fileName || file?.file_name || file?.name || '').trim())
    .filter(Boolean)
  return [...new Set(names)].join('；')
}
const extractedAnswerTextFor = (studentNo: string) => {
  const assignment = assignmentFileMap.value[String(studentNo || '').trim()]
  const fields = (((assignment as any)?.assignment_json?.student?.extractedContent?.fields || {}) as Record<string, string>)
  return orderAssignmentFields(fields).map(({ field, value }) => `${field}：${value}`).join(' || ')
}
const questionAnswerTextFor = (studentNo: string, questionNo: string, questionText = '') => (
  answerFilesTextFor(studentNo, questionNo, questionText) || extractedAnswerTextFor(studentNo)
)
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
    abnormal: summary.complete && summary.totalScore !== null && summary.totalScore === 0,
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
// 0分试卷列表分页（与汇总结果表同一页大小）
const exceptionPage = ref(1)
const pagedAbnormalRows = computed(() => abnormalRows.value.slice((exceptionPage.value - 1) * pageSize, exceptionPage.value * pageSize))
watch(abnormalRows, (rows) => { if (exceptionPage.value > Math.max(1, Math.ceil(rows.length / pageSize))) exceptionPage.value = 1 })
const stats = computed(() => {
  const complete = summaryRows.value.filter((row) => row.totalScore !== null)
  const scores = complete.map((row) => Number(row.totalScore)).filter(Number.isFinite)
  return {
    paperCount: summaryRows.value.length,
    reviewedCount: summaryRows.value.filter((row) => row.gradedCount > 0).length,
    maxScore: scores.length ? Math.max(...scores) : 0,
    minScore: scores.length ? Math.min(...scores) : 0,
    avgScore: scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)) : 0,
    abnormalCount: abnormalRows.value.length
  }
})

async function loadData(silent = false) {
  // keepAlive 页签切回/路由切换瞬间 route.params 可能还没有本题的 ID，
  // 拼出 subjects//exams// 空段 URL 会 404，此时直接跳过本次刷新。
  if (!activeSubjectId.value || !activeExamId.value || !activePackageId.value) return
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
const openExportDialog = () => {
  qidMappingDraft.value = {}
  exportDialogVisible.value = true
}

const confirmExport = async () => {
  const mapping: Record<string, string> = {}
  for (const [qid, value] of Object.entries(qidMappingDraft.value)) {
    const trimmed = String(value || '').trim()
    if (trimmed) mapping[qid] = trimmed
  }
  exportDialogVisible.value = false
  await exportExcel(mapping)
}

async function exportExcel(qidMapping: Record<string, string> = {}) {
  // 导出改由后端直接读数据库生成 Excel 文件（不再用页面快照），
  // 每行 = 一个考生的一道题：id(考号)/qid(题目id)/official_qid(考试院题号，
  // 由教师弹窗填写)/answer(考生答案)/comment(评语)。
  exporting.value = true
  try {
    const params: Record<string, string> = {}
    if (activeStandardId.value) params.standard_id = activeStandardId.value
    const mappingEntries = Object.entries(qidMapping).filter(([, value]) => String(value || '').trim())
    if (mappingEntries.length) params.qid_mapping = JSON.stringify(Object.fromEntries(mappingEntries))
    const response = await api.get(
      `${apiPrefix}/teacher-scoring/subjects/${activeSubjectId.value}/exams/${activeExamId.value}/local-packages/${activePackageId.value}/export-excel`,
      {
        params,
        responseType: 'blob'
      }
    );
    const blob = new Blob([response.data as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportPackageName.value || contextScopeLabel.value || '正式评阅结果'}（评阅）.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    ElMessage.success('正式评阅结果已导出');
  } catch (error: any) {
    let message = error?.message || '导出失败';
    const data = error?.response?.data;
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text());
        message = parsed.message || message;
      } catch { /* 保持默认提示 */ }
    } else if (data?.message) {
      message = data.message;
    }
    ElMessage.error(message);
  } finally {
    exporting.value = false
  }
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
    // 考生答案取数与导出 Excel 同一套助手：答案结果文件 → 归属抽取文本
    const questionAnswerText = (questionNo: string, questionText = '') => questionAnswerTextFor(row.student_no, questionNo, questionText)
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
        // 大题级不再导出 needs_review/review_summary：复核内容只保留在
        // 小题级字段里，避免大题与其第一道小题之间出现冗余字段。
        sub_question: subs.map((sub, subIndex) => {
          const questionNo = `${topicIndex + 1}.${subIndex + 1}`
          const grade = getQuestionGrade(studentRecords, {
            questionNo,
            topicIndex,
            subIndex,
            topicHasSubs: true
          })
          const subRecord = latestRecords.find((rec) => String(rec.question_no || '').trim() === questionNo)
          const subReviewSummary = String(subRecord?.review_summary || '').trim()
          return {
            question: formatExportQuestionStem(String(sub.question || '')),
            answer: questionAnswerText(questionNo, String(sub.question || '')),
            images: (sub.answer_images || []) as string[],
            score: grade?.score ?? 0,
            comment: grade?.comments.join('\n') || '',
            // needs_review 与 review_summary 口径一致：记录标记为需复核
            // 或复核内容非空都视为 1（兼容库里"有复核内容但标志为 0"的
            // 旧记录，无需重新评阅即可导出一致口径）。
            needs_review: (Number(subRecord?.needs_review || 0) === 1 || subReviewSummary) ? 1 : 0,
            review_summary: subReviewSummary,
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
  anchor.download = `${exportPackageName.value || contextScopeLabel.value || '正式评阅结果'}（评阅）.json`
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
.header-context-scope { color: inherit; font-size: inherit; font-weight: inherit; }
.export-dialog-tip { margin: 0 0 14px; color: #354861; font-size: 14px; line-height: 1.6; }
.export-dialog-rows { max-height: 46vh; overflow: auto; display: flex; flex-direction: column; gap: 12px; }
.export-dialog-row { display: flex; align-items: center; gap: 14px; }
.export-dialog-qid { flex: 0 0 72px; color: #354861; font-weight: 600; }
.export-dialog-row :deep(.el-input) { flex: 1; }
.formal-section-head p, .summary-section-head p { margin: 7px 0 0; color: #7b8798; }
.formal-results-content { margin-top: 20px; }
.summary-overview-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin: 20px 0; }
.formal-tabs { margin-top: 20px; }
.summary-section-head h2 { margin: 0; color: #253248; font-size: 18px; }
.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 16px; }
.summary-head-actions { display: flex; align-items: center; gap: 14px; }
@media (max-width: 900px) { .summary-overview-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .formal-results-page { padding: 12px; }.formal-results-panel { padding: 20px 16px; }.formal-section-head { align-items: flex-start; flex-direction: column; }.summary-overview-grid { grid-template-columns: 1fr; } }
</style>

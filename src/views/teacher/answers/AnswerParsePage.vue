<template>
  <section class="answer-parse-page">
    <el-card shadow="never">
      <template #header><div class="page-header"><div><h2>答案抽取</h2><p>点击每个答卷包的抽取按钮，生成考生题目归属及答案文件结果。</p></div><el-button :icon="Refresh" @click="refresh">刷新</el-button></div></template>
      <div class="list-toolbar">
        <el-input v-model="keyword" clearable :prefix-icon="Search" placeholder="搜索试卷包、科目或考试" aria-label="搜索试卷包、科目或考试" />
      </div>
      <el-table v-loading="loading" :data="filteredRows" stripe empty-text="暂无已解析答卷包，请先在答卷上传页面新增答卷包" row-key="upload_id" @expand-change="handleExpand">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="candidate-panel">
              <div class="candidate-panel-head">
                <span>考生答案抽取</span>
                <el-button link type="primary" :loading="assignmentLoading[row.upload_id]" @click="loadAssignments(row)">刷新结果</el-button>
              </div>
              <el-table v-loading="assignmentLoading[row.upload_id]" :data="pagedAssignments(row)" size="small" stripe>
                <el-table-column prop="student_no" label="考生" min-width="220" />
                <el-table-column label="抽取状态" width="130"><template #default="{ row: candidate }"><el-tag size="small" :type="candidate.status === 'blank' || candidate.assignment_json?.student?.isBlank ? 'info' : candidate.status === 'success' ? 'success' : 'warning'">{{ candidate.status === 'blank' || candidate.assignment_json?.student?.isBlank ? '空白试卷' : candidate.status === 'success' ? '完成' : candidate.status === 'partial' ? '部分异常' : '失败' }}</el-tag></template></el-table-column>
                <el-table-column label="文本内容" width="100" align="center"><template #default="{ row: candidate }">{{ hasTextContent(candidate) ? '已获取' : '无' }}</template></el-table-column>
                <el-table-column label="文件数" width="100"><template #default="{ row: candidate }">{{ candidate.assignment_json?.student?.fileCount || 0 }}</template></el-table-column>
                <el-table-column label="异常文件" width="110"><template #default="{ row: candidate }">{{ candidate.assignment_json?.student?.abnormalFileCount || 0 }}</template></el-table-column>
                <el-table-column label="操作" width="180" fixed="right"><template #default="{ row: candidate }"><el-button link type="primary" @click="viewAssignmentReport(row, candidate)">查看答案抽取</el-button></template></el-table-column>
              </el-table>
              <el-pagination
                v-if="(assignmentMap[row.upload_id] || []).length > pageSize"
                class="candidate-pagination"
                layout="total, prev, pager, next"
                :page-size="pageSize"
                :total="(assignmentMap[row.upload_id] || []).length"
                :current-page="assignmentPage[row.upload_id] || 1"
                @current-change="(page) => changeAssignmentPage(row.upload_id, page)"
              />
              <el-empty v-if="!assignmentLoading[row.upload_id] && !(assignmentMap[row.upload_id] || []).length" description="暂无考生答案抽取结果" />
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="package_name" label="试卷包名称" min-width="220" />
        <el-table-column prop="subject_name" label="科目" min-width="160" />
        <el-table-column prop="exam_name" label="考试" min-width="180" />
        <el-table-column prop="uploaded_at" label="上传时间" min-width="180" />
        <el-table-column label="答案抽取状态" width="150" align="center"><template #default="{ row }"><el-tooltip v-if="row.assignment_status === 'failed'" :content="row.assignment_error || '答案抽取失败'"><el-tag type="danger">抽取失败</el-tag></el-tooltip><el-tag v-else-if="row.assignment_status === 'extracting'" type="primary"><el-icon class="is-loading"><Loading /></el-icon> 正在抽取</el-tag><el-tag v-else-if="row.assignment_status === 'extracted'" type="success">抽取成功</el-tag><el-tag v-else type="info">待抽取</el-tag></template></el-table-column>
        <el-table-column label="操作" width="150" fixed="right" align="center"><template #default="{ row }"><el-button type="primary" size="small" :loading="extracting[row.upload_id] || row.assignment_status === 'extracting'" :disabled="row.assignment_status === 'extracting'" @click="extractAssignments(row)">{{ row.assignment_status === 'extracted' ? '重新抽取' : row.assignment_status === 'failed' ? '重试抽取' : '答案抽取' }}</el-button></template></el-table-column>
      </el-table>
    </el-card>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Loading, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { extractAnswerUploadAssignments, getAnswerUploads, getCandidateAssignments, type CandidateAssignmentRecord } from '@/api/teacher-scoring'
import type { AnswerUploadItem } from './upload-types'
import { useRouter } from 'vue-router'
import { notifyAnswerUploadsChanged, subscribeAnswerUploadsChanged } from './answer-upload-events'
import { loadDisplayStructure } from '@/utils/paper-structure'
const router = useRouter()
const rows = ref<AnswerUploadItem[]>([])
const keyword = ref('')
const filteredRows = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return rows.value.filter((row) => row.status === 'parsed' && (
    !query || [row.package_name, row.subject_name, row.subject_no, row.exam_name]
      .some((value) => String(value || '').toLowerCase().includes(query))
  ))
})
const loading = ref(false)
const pageSize = 20
const assignmentMap = ref<Record<number, CandidateAssignmentRecord[]>>({})
const assignmentLoading = ref<Record<number, boolean>>({})
const assignmentPage = ref<Record<number, number>>({})
const extracting = ref<Record<number, boolean>>({})
let unsubscribeAnswerUploadsChanged: (() => void) | undefined
onMounted(() => {
  unsubscribeAnswerUploadsChanged = subscribeAnswerUploadsChanged(() => void refresh())
  void refresh()
})
onBeforeUnmount(() => unsubscribeAnswerUploadsChanged?.())
async function refresh() {
  loading.value = true
  try {
    const response = await getAnswerUploads()
    if (response.code !== 0 && response.code !== 200) throw new Error(response.message || '获取答卷包失败')
    rows.value = response.data || []
  } catch (error: any) { ElMessage.error(error?.response?.data?.message || error?.message || '获取答卷包失败') }
  finally { loading.value = false }
}
async function handleExpand(row: any, expandedRows: any[]) {
  if (expandedRows.some((item) => item.upload_id === row.upload_id)) await loadAssignments(row)
}
async function loadAssignments(row: any) {
  if (!row.local_package_id || row.assignment_status !== 'extracted' || assignmentLoading.value[row.upload_id]) return
  assignmentLoading.value = { ...assignmentLoading.value, [row.upload_id]: true }
  try {
    const response = await getCandidateAssignments(String(row.subject_id), String(row.exam_id), String(row.local_package_id))
    if (![0, 200].includes(response?.code)) throw new Error(response?.message || '读取答案抽取列表失败')
    assignmentMap.value = { ...assignmentMap.value, [row.upload_id]: response.data?.assignments || [] }
    assignmentPage.value = { ...assignmentPage.value, [row.upload_id]: 1 }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '读取答案抽取列表失败')
  } finally {
    assignmentLoading.value = { ...assignmentLoading.value, [row.upload_id]: false }
  }
}
async function extractAssignments(row: AnswerUploadItem) {
  if (extracting.value[row.upload_id] || row.assignment_status === 'extracting') return
  extracting.value = { ...extracting.value, [row.upload_id]: true }
  rows.value = rows.value.map((item) => item.upload_id === row.upload_id ? { ...item, assignment_status: 'extracting', assignment_error: null } : item)
  try {
    // 抽取请求带上阅卷标准结构快照（含教师新增/修正的题目），题目归属按快照
    // 结构执行；快照取不到就不传，抽取按原有规则执行，绝不因此阻断。
    const paperStructure = await loadDisplayStructure(String(row.subject_id), String(row.exam_id))
    const response = await extractAnswerUploadAssignments(row.upload_id, paperStructure ? { paper_structure_json: paperStructure } : undefined)
    if (![0, 200].includes(response?.code)) throw new Error(response?.message || '答案抽取失败')
    ElMessage.success('答案抽取成功')
    assignmentMap.value = { ...assignmentMap.value, [row.upload_id]: [] }
    await refresh()
    const updatedRow = rows.value.find((item) => item.upload_id === row.upload_id)
    if (updatedRow) await loadAssignments(updatedRow)
    notifyAnswerUploadsChanged()
  } catch (error: any) {
    const message = error?.response?.data?.message || error?.message || '答案抽取失败'
    rows.value = rows.value.map((item) => item.upload_id === row.upload_id ? { ...item, assignment_status: 'failed', assignment_error: message } : item)
    ElMessage.error(message)
  } finally {
    extracting.value = { ...extracting.value, [row.upload_id]: false }
  }
}
function pagedAssignments(row: any) {
  const records = assignmentMap.value[row.upload_id] || []
  const page = assignmentPage.value[row.upload_id] || 1
  return records.slice((page - 1) * pageSize, page * pageSize)
}
// 是否抽取到文本内容（通用口径）：11 系的关键词字段在
// extractedContent.fields，数据库卷等按题拆的作答文本在
// questionContents[].answerText——任一有非空内容即"已获取"。
function hasTextContent(candidate: CandidateAssignmentRecord) {
  if (hasExtractedFields(candidate)) return true
  const contents = ((candidate.assignment_json as any)?.student?.questionContents || []) as Array<{ answerText?: string }>
  return contents.some((entry) => String(entry?.answerText || '').trim())
}
function hasExtractedFields(candidate: CandidateAssignmentRecord) {
  const fields = ((candidate.assignment_json as any)?.student?.extractedContent?.fields || {}) as Record<string, string>
  return Object.values(fields).some((value) => String(value || '').trim())
}
function changeAssignmentPage(uploadId: number, page: number) {
  assignmentPage.value = { ...assignmentPage.value, [uploadId]: page }
}
function viewAssignmentReport(uploadRow: any, candidate: CandidateAssignmentRecord) {
  router.push({
    name: 'answer-candidate-assignment-report',
    params: { subjectId: uploadRow.subject_id, examId: uploadRow.exam_id, packageId: `local_${uploadRow.local_package_id}` },
    query: { student_no: candidate.student_no }
  })
}
</script>
<style scoped>.answer-parse-page{padding:20px}.page-header{display:flex;justify-content:space-between;align-items:center;gap:16px}.page-header h2{margin:0}.page-header p{margin:6px 0 0;color:var(--el-text-color-secondary)}.list-toolbar{margin-bottom:18px}.list-toolbar .el-input{width:min(300px,100%)}@media(max-width:600px){.page-header{align-items:stretch;flex-direction:column}}</style>

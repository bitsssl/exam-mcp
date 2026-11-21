<template>
  <section class="answer-upload-page">
    <el-card shadow="never" class="answer-upload-card">
      <template #header>
        <div class="page-header">
          <div><h2>答卷上传</h2><p>新增答卷包后，系统自动解析试卷数量、空白试卷数量和空白考生号。</p></div>
          <el-button type="primary" :icon="Plus" @click="uploadVisible = true">上传新试卷包</el-button>
        </div>
      </template>
      <div class="list-toolbar">
        <el-input v-model="keyword" clearable :prefix-icon="Search" placeholder="搜索试卷包、科目或考试" aria-label="搜索试卷包、科目或考试" />
      </div>
      <el-table v-loading="loading" :data="displayRows" stripe empty-text="暂无已上传答卷包">
        <el-table-column prop="package_name" label="试卷包名称" min-width="220" />
        <el-table-column prop="subject_name" label="科目" min-width="150" />
        <el-table-column prop="exam_name" label="考试" min-width="170" />
        <el-table-column prop="uploaded_at" label="上传时间" min-width="170" />
        <el-table-column label="上传/解析状态" width="170"><template #default="{ row }"><el-tooltip v-if="row.status === 'failed'" :content="row.parse_error || '解析失败'"><el-tag type="danger">解析失败</el-tag></el-tooltip><el-tag v-else-if="row.status === 'uploading'" type="primary"><el-icon class="is-loading"><Loading /></el-icon> 正在上传</el-tag><el-tag v-else-if="row.status === 'parsing'" type="primary"><el-icon class="is-loading"><Loading /></el-icon> 正在解析试卷</el-tag><el-tag v-else :type="row.status === 'parsed' ? 'success' : 'warning'">{{ row.status === 'parsed' ? '解析完成' : '等待解析' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="220" fixed="right"><template #default="{ row }"><el-button v-if="row.status === 'parsed' && row.local_package_id" link type="primary" @click="viewReport(row)">查看解析报告</el-button><el-button link type="danger" :disabled="row.status === 'uploading' || row.status === 'parsing'" :loading="deletingId === row.upload_id && !!row.upload_id" @click="remove(row)">删除试卷</el-button></template></el-table-column>
      </el-table>
    </el-card>
    <UploadPackageDrawer v-model="uploadVisible" @submitted="handleUploadSubmitted" />
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading, Plus, Search } from '@element-plus/icons-vue'
import UploadPackageDrawer from './UploadPackageDrawer.vue'
import { startPackageUpload, uploadJobs } from './upload-jobs'
import type { AnswerUploadDisplayItem, AnswerUploadItem, PackageUploadRequest } from './upload-types'
import { deleteAnswerUpload, getAnswerUploads } from '@/api/teacher-scoring'
import { useRouter } from 'vue-router'
import { notifyAnswerUploadsChanged, subscribeAnswerUploadsChanged } from './answer-upload-events'
const router = useRouter()
const uploadVisible = ref(false)
const rows = ref<AnswerUploadItem[]>([])
const keyword = ref('')
const displayRows = computed<AnswerUploadDisplayItem[]>(() => {
  const serverIds = new Set(rows.value.map((row) => row.upload_id))
  const activeJobs = new Map(uploadJobs.value.filter((job) => job.upload_id).map((job) => [job.upload_id, job]))
  const serverRows = rows.value.map((row) => {
    const job = activeJobs.get(row.upload_id)
    if (!job) return row
    return { ...row, status: job.parse_state === 'parsing' ? 'parsing' : job.parse_state === 'failed' ? 'failed' : row.status, parse_error: job.parse_error || row.parse_error }
  })
  const jobs = uploadJobs.value.filter((job) => !job.upload_id || !serverIds.has(job.upload_id)).map((job) => ({
    ...job,
    status: job.parse_state === 'uploading' ? 'uploading' : job.parse_state === 'parsing' ? 'parsing' : job.parse_state === 'failed' ? 'failed' : 'uploaded'
  }))
  const query = keyword.value.trim().toLowerCase()
  return [...jobs, ...serverRows].filter((row) =>
    !query || [row.package_name, row.subject_name, row.subject_no, row.exam_name]
      .some((value) => String(value || '').toLowerCase().includes(query))
  )
})
const loading = ref(false)
const deletingId = ref<number | null>(null)
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
    if (![0, 200].includes(response?.code)) throw new Error(response?.message || '获取答卷包失败')
    rows.value = response.data || []
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '获取答卷包失败')
  } finally { loading.value = false }
}
function handleUploadSubmitted(request: PackageUploadRequest) {
  startPackageUpload(request, (error?: string, phase?: 'uploaded' | 'parsed') => {
    notifyAnswerUploadsChanged()
    void refresh()
    if (phase === 'uploaded') return
    if (error) ElMessage.error(error)
    else if (phase === 'parsed') ElMessage.success('答卷包解析完成，报告已生成')
  })
}
function viewReport(row: AnswerUploadDisplayItem) {
  if (!row.local_package_id || !row.subject_id || !row.exam_id) return
  router.push({
    name: 'answer-parse-report',
    params: { subjectId: row.subject_id, examId: row.exam_id, packageId: `local_${row.local_package_id}` }
  })
}
async function remove(row: AnswerUploadDisplayItem) {
  try {
    await ElMessageBox.confirm(`确定删除答卷包“${row.package_name}”吗？删除后不可恢复。`, '删除答卷包', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    if (!('upload_id' in row) || !row.upload_id) {
      const packageId = 'package_id' in row ? row.package_id : undefined
      uploadJobs.value = uploadJobs.value.filter((job) => job.package_id !== packageId)
      notifyAnswerUploadsChanged()
      return
    }
    deletingId.value = row.upload_id
    const response = await deleteAnswerUpload(row.upload_id)
    if (![0, 200].includes(response?.code)) throw new Error(response?.message || '删除答卷包失败')
    uploadJobs.value = uploadJobs.value.filter((job) => job.upload_id !== row.upload_id)
    notifyAnswerUploadsChanged()
    ElMessage.success('答卷包已删除')
    await refresh()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error?.response?.data?.message || error?.message || '删除答卷包失败')
  } finally { deletingId.value = null }
}
</script>
<style scoped>
.answer-upload-page{padding:20px;color:var(--el-text-color-primary);font-size:14px}.answer-upload-card{border-radius:8px;border-color:var(--el-border-color-lighter)}.page-header{display:flex;align-items:center;justify-content:space-between;gap:16px}.page-header h2{margin:0;font-size:20px;font-weight:600;line-height:1.4}.page-header p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:14px;line-height:1.6}.list-toolbar{margin-bottom:18px}.list-toolbar .el-input{width:min(300px,100%)}@media(max-width:600px){.page-header{align-items:stretch;flex-direction:column}}
</style>

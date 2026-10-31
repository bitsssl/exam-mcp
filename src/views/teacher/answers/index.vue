<template>
  <section class="answer-upload-page">
    <el-card shadow="never" class="answer-upload-card">
      <template #header>
        <div class="page-header">
          <div>
            <h2>答卷管理</h2>
            <p>管理各科目与考试上传的考生试卷包及解析状态。</p>
          </div>
          <el-button type="primary" :icon="Plus" @click="uploadVisible = true">上传新试卷包</el-button>
        </div>
      </template>

      <div class="filters">
        <el-input v-model="keyword" clearable :prefix-icon="Search" placeholder="搜索试卷包名称、考试名称" class="keyword-input" @keyup.enter="loadPackages" @clear="loadPackages" />
        <el-select v-model="subjectFilter" clearable placeholder="全部科目" @change="onSubjectFilterChange">
          <el-option v-for="subject in subjects" :key="subject.subject_id" :label="`${subject.subject_no} · ${subject.subject_name}`" :value="subject.subject_id" />
        </el-select>
        <el-select v-model="examFilter" clearable placeholder="全部考试" :disabled="!subjectFilter" @change="loadPackages">
          <el-option v-for="exam in filterExams" :key="exam.id" :label="exam.exam_name" :value="exam.id" />
        </el-select>
        <el-select v-model="statusFilter" clearable placeholder="全部状态" @change="resetPage">
          <el-option label="解析成功" value="success" /><el-option label="解析中" value="pending" /><el-option label="解析失败" value="failed" />
        </el-select>
        <div class="filter-actions">
          <el-button :icon="Refresh" :loading="loading" @click="loadPackages">刷新</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="pagedPackages" row-key="package_id" empty-text="暂无试卷包，请先上传考生试卷包" stripe>
        <el-table-column prop="package_name" label="试卷包名称" min-width="210" show-overflow-tooltip />
        <el-table-column label="关联科目" min-width="160">
          <template #default="{ row }">{{ row.subject_no ? `${row.subject_no} · ` : '' }}{{ row.subject_name || '—' }}</template>
        </el-table-column>
        <el-table-column prop="exam_name" label="关联考试" min-width="160" show-overflow-tooltip />
        <el-table-column label="上传时间" min-width="170">
          <template #default="{ row }">{{ formatPackageUploadedAt(row.uploaded_at) }}</template>
        </el-table-column>
        <el-table-column label="答卷数量" width="110" align="center"><template #default="{ row }">{{ row.student_count ?? '—' }}</template></el-table-column>
        <el-table-column label="解析状态" width="130" align="center">
          <template #default="{ row }">
            <el-tooltip v-if="row.parse_error" :content="row.parse_error" placement="top">
              <el-tag type="danger" effect="light">{{ getPackageParseLabel(row) }}</el-tag>
            </el-tooltip>
            <el-tag v-else-if="getPackageParseState(row) === 'success'" type="success" effect="light">{{ getPackageParseLabel(row) }}</el-tag>
            <el-tag v-else type="warning" effect="light"><el-icon class="parse-loading-icon"><Loading /></el-icon>{{ getPackageParseLabel(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="getPackageParseState(row) !== 'success'" @click="openPackage(row)">查看试卷</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-row">
        <span class="result-count">共 {{ filteredPackages.length }} 个试卷包</span>
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[10, 20, 50]" :total="filteredPackages.length" layout="sizes, prev, pager, next" background />
      </div>
    </el-card>

    <UploadPackageDrawer v-model="uploadVisible" @submitted="handleUploadSubmitted" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Loading, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { getAllExams, getAllPackages, getSubjects, type ExamItem, type ExamPackageItem, type SubjectItem } from '@/api/teacher-scoring'
import UploadPackageDrawer from './UploadPackageDrawer.vue'
import { formatPackageUploadedAt, getPackageParseLabel, getPackageParseState } from './package-status'
import { startPackageUpload, uploadJobs } from './upload-jobs'
import type { PackageUploadRequest } from './upload-types'

const router = useRouter()
const loading = ref(false)
const uploadVisible = ref(false)
const keyword = ref('')
const subjectFilter = ref<number>()
const examFilter = ref<number>()
const statusFilter = ref('')
const page = ref(1)
const pageSize = ref(10)
const subjects = ref<SubjectItem[]>([])
const allExams = ref<ExamItem[]>([])
const packages = ref<ExamPackageItem[]>([])
const filterExams = computed(() => subjectFilter.value ? allExams.value.filter((item) => item.subject_id === subjectFilter.value) : allExams.value)
const displayPackages = computed(() => {
  const serverPackageIds = new Set(packages.value.map((item) => String(item.package_id)))
  const currentJobs = uploadJobs.value.filter((job) => job.parse_state !== 'success' || !serverPackageIds.has(String(job.package_id)))
  return [...currentJobs, ...packages.value]
})
const filteredPackages = computed(() => statusFilter.value ? displayPackages.value.filter((item) => getPackageParseState(item) === statusFilter.value) : displayPackages.value)
const pagedPackages = computed(() => filteredPackages.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

onMounted(async () => {
  await Promise.all([loadFilters(), loadPackages()])
})

async function loadFilters() {
  try {
    const [subjectResponse, examResponse] = await Promise.all([getSubjects(), getAllExams()])
    if ([0, 200].includes(subjectResponse?.code)) subjects.value = subjectResponse.data || []
    if ([0, 200].includes(examResponse?.code)) allExams.value = examResponse.data || []
  } catch { ElMessage.error('加载科目与考试筛选项失败') }
}

async function loadPackages() {
  loading.value = true
  page.value = 1
  try {
    const response = await getAllPackages({ keyword: keyword.value.trim() || undefined, subject_id: subjectFilter.value, exam_id: examFilter.value })
    if (response?.code !== 0 && response?.code !== 200) throw new Error(response?.message || '获取试卷包失败')
    packages.value = response.data || []
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '获取试卷包失败') }
  finally { loading.value = false }
}

function onSubjectFilterChange() { examFilter.value = undefined; void loadPackages() }
function resetPage() { page.value = 1 }
function handleUploadSubmitted(request: PackageUploadRequest) {
  startPackageUpload(request, () => { void loadPackages() })
  page.value = 1
}
function openPackage(item: ExamPackageItem) {
  if (!item.subject_id) { ElMessage.warning('试卷包缺少科目信息，无法打开详情'); return }
  router.push(`/teacher/scoring/subjects/${item.subject_id}/exams/${item.exam_id}/packages/${item.package_id}`)
}
</script>

<style scoped>
.answer-upload-page { padding: 20px; color: var(--el-text-color-primary); font-size: 14px; }
.answer-upload-card { border-radius: 8px; border-color: var(--el-border-color-lighter); }
.page-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.page-header h2 { margin: 0; color: var(--el-text-color-primary); font-size: 20px; font-weight: 600; line-height: 1.4; }
.page-header p { margin: 6px 0 0; color: var(--el-text-color-secondary); font-size: 14px; line-height: 1.6; }
.filters { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.keyword-input { width: min(320px, 100%); }
.filters > .el-select { width: 185px; }
.filter-actions { display: flex; gap: 10px; margin-left: auto; }
.pagination-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding-top: 18px; }
.result-count { color: var(--el-text-color-secondary); font-size: 13px; }
.parse-loading-icon { margin-right: 4px; animation: parse-spin 1s linear infinite; }
@keyframes parse-spin { to { transform: rotate(360deg); } }
@media (max-width: 900px) { .filter-actions { margin-left: 0; } }
@media (max-width: 600px) { .page-header { align-items: stretch; flex-direction: column; } .filters > *, .filters > .el-select, .keyword-input { width: 100%; } .pagination-row { align-items: flex-start; flex-direction: column; } }
</style>

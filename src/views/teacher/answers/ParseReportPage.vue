<template>
  <section class="parse-report-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="page-header">
          <div><h2>答卷解析报告{{ contextSuffix }}</h2></div>
          <el-button @click="router.back()">返回</el-button>
        </div>
      </template>
      <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" />
      <template v-else-if="report">
        <div class="stat-grid">
          <MetricStatCard label="识别考生" :value="report.summary?.candidateCount || 0" :icon="User" />
          <MetricStatCard label="题目数" :value="report.summary?.questionCount || 0" :icon="Collection" tone="success" />
          <MetricStatCard label="题号异常" :value="report.issues?.misalignedAnswerCount || 0" :icon="WarningFilled" tone="warning" />
          <MetricStatCard label="空文件夹考生" :value="report.issues?.emptyFolderCandidateCount || 0" :icon="FolderOpened" tone="info" />
        </div>
        <section class="report-block"><h3>异常与提示</h3><el-empty v-if="!hasIssues" description="各项检查正常，无待处理事项" /><el-alert v-else v-for="(item, index) in issueTexts" :key="index" type="warning" :closable="false" class="issue-item" :title="item" /></section>
        <section class="report-block"><h3>空白试卷考生号</h3><el-empty v-if="!blankCandidateNos.length" description="未发现空白试卷考生" :image-size="48" /><div v-else class="blank-candidate-list"><template v-for="(candidateNo, index) in blankCandidateNos" :key="candidateNo"><a href="" class="candidate-folder-link" :title="`打开考生 ${candidateNo} 的 KS 文件夹`" @click.prevent="openCandidateFolder(candidateNo)">{{ candidateNo }}</a><span v-if="index < blankCandidateNos.length - 1">、</span></template></div></section>
        <section v-if="structure?.tree_preview?.length" class="report-block"><h3>目录预览</h3><pre class="tree-preview">{{ structure.tree_preview.join('\n') }}</pre></section>
      </template>
      <el-empty v-else-if="!loading" description="暂无答卷解析报告" />
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Collection, FolderOpened, User, WarningFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getLocalPackageStructure, openStudentAnswerFolder, type ParseReportData, type StructurePreviewResult } from '@/api/teacher-scoring'
import MetricStatCard from '@/components/MetricStatCard.vue'
import { fetchScoringContextNames } from '@/utils/scoring-context'

const route = useRoute(); const router = useRouter()
const packageId = String(route.params.packageId || '').replace(/^local_/, '')
const contextSuffix = ref(''); const loading = ref(false); const error = ref('')
const report = ref<ParseReportData | null>(null); const structure = ref<StructurePreviewResult | null>(null)
const issues = computed(() => report.value?.issues || {})
const blankCandidateNos = computed(() => issues.value.emptyFolderCandidates || [])
const hasIssues = computed(() => Boolean(issues.value.misalignedAnswerCount || issues.value.emptyFolderCandidateCount || issues.value.structureWarnings?.length || issues.value.recognitionError))
const issueTexts = computed(() => {
  const result: string[] = []
  if (issues.value.emptyFolderCandidateCount) result.push(`${issues.value.emptyFolderCandidateCount} 名考生文件夹为空，已按空白试卷保留`)
  if (issues.value.misalignedAnswerCount) result.push(`${issues.value.misalignedAnswerCount} 条作答题号未在试卷结构中找到`)
  if (issues.value.emptyFolderCandidateCount) result.push(`${issues.value.emptyFolderCandidateCount} 名考生文件夹为空`)
  result.push(...(issues.value.structureWarnings || []))
  if (issues.value.recognitionError) result.push(issues.value.recognitionError)
  return result
})
onMounted(async () => {
  loading.value = true
  try {
    const response = await getLocalPackageStructure(String(route.params.subjectId), String(route.params.examId), packageId)
    if (![0, 200].includes(response.code)) throw new Error(response.message || '获取答卷解析报告失败')
    structure.value = response.data; report.value = response.data?.parse_report || null
    const { packageName } = await fetchScoringContextNames(
      String(route.params.subjectId), String(route.params.examId), packageId
    )
    if (packageName) contextSuffix.value = `（${packageName}）`
  } catch (err: any) { error.value = err?.response?.data?.message || err?.message || '获取答卷解析报告失败' }
  finally { loading.value = false }
})

const openCandidateFolder = async (studentNo: string) => {
  try {
    const response = await openStudentAnswerFolder(
      String(route.params.subjectId),
      String(route.params.examId),
      packageId,
      studentNo
    )
    ElMessage.success(response?.message || '已打开考生 KS 文件夹')
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || err?.message || '打开考生 KS 文件夹失败')
  }
}
</script>

<style scoped>
.parse-report-page { padding: 20px; }
.page-header { display:flex; align-items:center; justify-content:space-between; gap:16px; }
.page-header h2 { margin:0; } .page-header p { margin:6px 0 0; color:var(--el-text-color-secondary); }
.stat-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:20px; }
.report-block { margin-top:20px; } .report-block h3 { margin:0 0 10px; font-size:15px; } .issue-item { margin-bottom:8px; }
.blank-candidate-list { padding: 12px 16px; line-height: 1.8; word-break: break-all; color: var(--el-text-color-primary); }
.candidate-folder-link { color: var(--el-color-primary); cursor: pointer; text-decoration: none; }
.candidate-folder-link:hover { color: var(--el-color-primary-light-3); text-decoration: underline; }
.tree-preview { padding:12px; overflow:auto; border-radius:6px; background:#f8fafc; font-size:12px; }
@media(max-width:1100px){.stat-grid{grid-template-columns:repeat(3,minmax(0,1fr));}}
@media(max-width:760px){.stat-grid{grid-template-columns:1fr;}.page-header{align-items:stretch;flex-direction:column;}}
</style>

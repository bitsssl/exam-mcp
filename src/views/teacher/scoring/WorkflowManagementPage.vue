<template>
  <main class="workflow-management">
    <el-card shadow="never" class="list-card">
      <template #header>
        <div class="page-header">
          <div>
            <h2>{{ title }}</h2>
            <p>{{ description }}</p>
          </div>
          <el-button type="primary" :icon="Plus" @click="createNew">{{ createLabel }}</el-button>
        </div>
      </template>

      <div class="workspace">
        <div class="filters">
          <el-input v-model="keyword" clearable :prefix-icon="Search" :placeholder="searchPlaceholder" />
          <el-select v-model="subjectFilter" clearable placeholder="全部科目">
            <el-option v-for="subject in subjects" :key="subject.subject_id" :label="`${subject.subject_no} · ${subject.subject_name}`" :value="subject.subject_id" />
          </el-select>
          <el-select v-if="isStandards" v-model="typeFilter" clearable placeholder="全部题型">
            <el-option label="简答题" value="short_answer" /><el-option label="图片题" value="image" /><el-option label="操作题" value="operation" /><el-option label="代码题" value="code" /><el-option label="文件题" value="file" />
          </el-select>
          <el-select v-if="!isStandards && !isTemplates" v-model="statusFilter" clearable placeholder="全部状态">
            <el-option v-for="item in statusOptions" :key="item" :label="item" :value="item" />
          </el-select>
          <el-button text :icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
        </div>

        <el-table v-loading="loading" :data="pagedRows" row-key="key" :preserve-expanded-content="hasStudentExpand" :expand-row-keys="hasStudentExpand && expandedTaskKey ? [expandedTaskKey] : []" @expand-change="handleTaskExpand">
          <el-table-column v-if="hasStudentExpand" type="expand" width="48">
            <template #default="{ row }">
              <div class="student-expand-transition" :class="{ 'is-open': expandedTaskKey === row.key }">
                <div class="student-expand-content">
                  <div class="student-expand-title">考生试卷</div>
                  <div v-if="row.studentsLoading" class="student-expand-state"><el-icon class="is-loading"><Refresh /></el-icon> 正在读取考生列表…</div>
                  <el-empty v-else-if="!row.studentNos?.length" description="该试卷包没有可展示的考生" :image-size="54" />
                  <StudentNoVirtualGrid v-else :student-nos="row.studentNos" :completed-student-nos="row.completedStudentNos || []" />
                </div>
              </div>
            </template>
          </el-table-column>
          <template v-if="isStandards">
            <el-table-column type="expand" width="48">
              <template #default="{ row }">
                <div class="standard-expand-content">
                  <div v-for="version in row.versions || []" :key="version.standard_id" class="standard-version-row">
                    <div><strong>阅卷标准-V{{ version.version_no }}</strong><span>{{ formatDate(version.created_at) }}</span></div>
                    <el-button link type="primary" @click="viewStandardVersion(row, version)">查看</el-button>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="标准名称" min-width="230"><template #default="{ row }"><div class="primary-cell">{{ row.name }}</div><div class="muted-cell">{{ row.items.length }} 道题 · {{ row.examName }}</div></template></el-table-column>
            <el-table-column label="科目" min-width="140"><template #default="{ row }">{{ row.subjectLabel }}</template></el-table-column>
            <el-table-column label="创建时间" min-width="145"><template #default="{ row }">{{ formatDate(row.createdAt) }}</template></el-table-column>
            <el-table-column label="操作" width="175" fixed="right"><template #default="{ row }"><el-button link type="primary" @click.stop="editStandard(row)">编辑</el-button><el-button link @click.stop="viewStandard(row)">查看</el-button><el-button link type="danger" @click.stop="removeStandard(row)">删除</el-button></template></el-table-column>
          </template>
          <template v-else-if="isTemplates">
            <el-table-column label="模板名称" min-width="190"><template #default="{ row }"><div class="primary-cell">{{ row.template.template_name }}</div><div class="muted-cell">{{ row.examName }}</div></template></el-table-column>
            <el-table-column label="科目" min-width="140"><template #default="{ row }">{{ row.subjectLabel }}</template></el-table-column>
            <el-table-column label="关联标准" min-width="180"><template #default="{ row }">{{ row.standardLabel }}</template></el-table-column>
            <el-table-column label="创建时间" min-width="150"><template #default="{ row }">{{ formatDate(row.template.created_at) }}</template></el-table-column>
            <el-table-column label="操作" width="190" fixed="right"><template #default="{ row }"><el-button link @click.stop="viewTemplate(row)">查看</el-button><el-button link type="primary" @click.stop="editTemplate(row)">编辑</el-button><el-button link type="danger" @click.stop="removeTemplate(row)">删除</el-button></template></el-table-column>
          </template>
          <template v-else>
            <el-table-column label="任务名称" min-width="210"><template #default="{ row }"><div class="primary-cell">{{ row.name }}</div><div class="muted-cell">阅卷标准 V{{ row.standardVersionNo || 1 }}</div></template></el-table-column>
            <el-table-column label="关联考试" min-width="170"><template #default="{ row }">{{ row.examName }}</template></el-table-column>
            <el-table-column label="科目" min-width="140"><template #default="{ row }">{{ row.subjectLabel }}</template></el-table-column>
            <el-table-column label="创建时间" min-width="155"><template #default="{ row }">{{ formatDate(row.createdAt) }}</template></el-table-column>
            <el-table-column :label="isTrialGrading ? '试题数量' : '试卷数量'" width="105"><template #default="{ row }">{{ isTrialGrading ? row.totalQuestionCount : row.studentCount }} {{ isTrialGrading ? '道' : '份' }}</template></el-table-column>
            <el-table-column v-if="!isTrialGrading" label="当前进度" min-width="190"><template #default="{ row }"><div class="grading-progress"><el-progress :percentage="row.progress" :stroke-width="8" /><span>{{ isFormalGrading ? `${row.completedCount}/${row.studentCount}` : `${row.gradedQuestionCount}/${row.totalQuestionCount}` }}</span></div></template></el-table-column>
            <el-table-column v-if="!isTrialGrading" label="状态" width="110"><template #default="{ row }"><el-tag :type="row.progress === 100 ? 'success' : 'warning'">{{ row.progress === 100 ? '已完成' : '未完成' }}</el-tag></template></el-table-column>
            <el-table-column label="操作" width="300" fixed="right">
              <template #default="{ row }">
                <div class="task-actions">
                  <el-button v-if="isTrialGrading || !isFormalGrading" link type="primary" @click.stop="openTaskScoring(row, 'trial')">进入试阅</el-button>
                  <el-button v-if="isFormalGrading || !isTrialGrading" link type="success" @click.stop="openTaskScoring(row, 'formal')">进入评阅</el-button>
                  <el-button class="standard-view-button" link type="primary" @click.stop="viewTaskStandard(row)">查看阅卷标准</el-button>
                  <el-button v-if="isTrialGrading || isFormalGrading" link type="primary" @click.stop="openSwitchStandard(row)">切换阅卷标准</el-button>
                  <el-button link type="danger" @click.stop="removeTask(row)">删除</el-button>
                </div>
              </template>
            </el-table-column>
          </template>
          <template #empty><el-empty :description="emptyText" /></template>
        </el-table>
        <div class="pagination"><span>共 {{ filteredRows.length }} 条</span><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="filteredRows.length" layout="prev, pager, next" small /></div>
      </div>
    </el-card>
    <el-dialog v-model="taskDialogVisible" :title="taskDialogTitle" width="min(760px, 94vw)" align-center append-to-body destroy-on-close class="grading-task-dialog">
      <el-form label-position="top" class="grading-task-form">
        <el-form-item label="要进行评分的试卷" required>
          <el-select v-model="taskForm.packageKey" filterable class="full-width" placeholder="选择已上传并解析的试卷包" @change="handleTaskPackageChange">
            <el-option v-for="item in gradingPackageOptions" :key="item.key" :label="`${item.subjectLabel} / ${item.examName} / ${item.package_name}（${item.student_count} 份）`" :value="item.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="阅卷标准" required>
          <el-select v-model="taskForm.standardId" filterable class="full-width" placeholder="请选择该考试的阅卷标准" :disabled="!taskForm.packageKey || taskOptionLoading">
            <el-option v-for="item in taskStandardOptions" :key="item.standard_id" :label="taskStandardLabel(item)" :value="item.standard_id" />
          </el-select>
        </el-form-item>
        <el-alert v-if="taskOptionLoading" title="正在读取所选考试的阅卷标准" type="info" :closable="false" show-icon />
        <el-alert v-else-if="taskForm.packageKey && !taskStandardOptions.length" title="所选考试需要先配置阅卷标准" type="warning" :closable="false" show-icon />
      </el-form>
      <template #footer>
        <el-button @click="taskDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="taskSaving" :disabled="!taskForm.packageKey || !taskForm.standardId" @click="saveGradingTask">保存</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="switchStandardVisible" title="切换阅卷标准" width="min(560px, 94vw)" align-center append-to-body destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="选择要使用的阅卷标准" required>
          <el-select v-model="switchStandardId" filterable class="full-width" :loading="switchStandardLoading" placeholder="请选择该考试的阅卷标准">
            <el-option v-for="item in switchStandardOptions" :key="item.standard_id" :label="switchStandardLabel(item)" :value="item.standard_id" />
          </el-select>
        </el-form-item>
        <el-alert type="warning" :closable="false" show-icon title="切换后任务将使用新标准评阅；已产生的评阅记录保留在原标准下，任务进度按新标准重新统计。" />
      </el-form>
      <template #footer>
        <el-button @click="switchStandardVisible = false">取消</el-button>
        <el-button type="primary" :loading="switchStandardSaving" :disabled="!switchStandardId" @click="confirmSwitchStandard">确定切换</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="standardCreateVisible" title="选择科目和考试" width="520px" align-center append-to-body destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="科目" required>
          <el-select v-model="standardCreateSubjectId" class="full-width" filterable placeholder="请选择科目" @change="onStandardCreateSubjectChange">
            <el-option v-for="subject in subjects" :key="subject.subject_id" :label="`${subject.subject_no} · ${subject.subject_name}`" :value="subject.subject_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="考试" required>
          <el-select v-model="standardCreateExamId" class="full-width" filterable placeholder="请选择考试" :disabled="!standardCreateSubjectId" :loading="standardCreateExamLoading">
            <el-option v-for="exam in standardCreateExams" :key="exam.id" :label="exam.exam_name" :value="exam.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="standardCreateVisible = false">取消</el-button><el-button type="primary" :loading="standardCreateLoading" :disabled="!standardCreateSubjectId || !standardCreateExamId" @click="confirmStandardCreate">下一步</el-button></template>
    </el-dialog>
    <el-dialog v-model="standardDialogVisible" :title="standardDialogRow?.name || '阅卷标准详情'" width="min(1180px, 94vw)" align-center append-to-body class="standard-detail-dialog" destroy-on-close>
      <div v-if="standardDialogRow" class="standard-detail-meta">
        <el-tag effect="plain">{{ standardDialogRow.subjectLabel }}</el-tag><el-tag effect="plain">{{ standardDialogRow.examName }}</el-tag>
        <span>共 {{ standardDialogRow.items.length }} 道题</span>
      </div>
      <el-scrollbar max-height="65vh">
        <section v-for="item in standardDialogRow?.items || []" :key="item.item_id || item.question_no" class="standard-question">
          <header><strong>Q{{ item.question_no }}</strong><el-tag size="small" effect="plain">{{ questionType(item.question_type) }}</el-tag><el-tag size="small" type="primary" effect="plain">V{{ item.question_version_no || 1 }}</el-tag><span class="standard-question-score">总分：{{ item.max_score ?? '未设置' }}{{ item.max_score != null ? ' 分' : '' }}</span></header>
          <div v-if="item.question_text" class="standard-question-text">{{ item.question_text }}</div>
          <div class="standard-question-service"><strong>评分服务</strong><span>{{ serviceNames(item) }}</span></div>
          <div class="standard-answer"><strong>参考答案</strong><p>{{ item.reference_answer || '暂无参考答案' }}</p></div>
          <div class="standard-answer"><strong>评分标准</strong><p>{{ item.grading_criteria || '暂无评分标准' }}</p></div>
        </section>
      </el-scrollbar>
      <template #footer><el-button @click="standardDialogVisible = false">关闭</el-button></template>
    </el-dialog>
  </main>
</template>

<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import StudentNoVirtualGrid from './components/StudentNoVirtualGrid.vue'
import { createGradingTask, deleteGradingStandard, deleteGradingTask, deleteGradingTemplate, getAllPackages, getExams, getGradingStandardVersions, getGradingTasks, getGradingTemplates, getLocalPackage, getSubjects, switchGradingTaskStandard, type ExamGradingStandard, type ExamGradingTemplate, type ExamItem, type SubjectItem } from '@/api/teacher-scoring'
import { refreshGradingTaskSubMenus } from '@/router/core/MenuProcessor'
import { listServices } from '@/api/mcp'
import type { McpServiceInfo } from '@/types/marketplace'
import { listLocalPackages } from '@/utils/local-scoring-package'

type ModuleKey = 'standards' | 'templates' | 'grading' | 'grading-trial' | 'grading-formal'
type Row = Record<string, any> & { key: string; subjectId: number; examId: number; examName: string; subjectLabel: string }
const route = useRoute(); const router = useRouter()
const moduleKey = computed(() => String(route.meta.workflowModule || 'standards') as ModuleKey)
const isStandards = computed(() => moduleKey.value === 'standards'); const isTemplates = computed(() => moduleKey.value === 'templates')
const isTrialGrading = computed(() => moduleKey.value === 'grading-trial')
const isFormalGrading = computed(() => moduleKey.value === 'grading-formal')
const isGrading = computed(() => ['grading', 'grading-trial', 'grading-formal'].includes(moduleKey.value))
// 试阅只用于临时检查，不需要展开考生试卷；正式评阅仍保留任务下的考生展开列表。
const hasStudentExpand = computed(() => isFormalGrading.value || moduleKey.value === 'grading')
const title = computed(() => isStandards.value ? '阅卷标准管理' : isTemplates.value ? '阅卷模板管理' : isTrialGrading.value ? '试阅' : isFormalGrading.value ? '评阅' : '阅卷管理')
const description = computed(() => isStandards.value ? '集中查看各科目考试的评分标准与版本。' : isTemplates.value ? '查看并复用已创建的阅卷模板。' : isTrialGrading.value ? '创建并进入试阅任务，检查评分标准和阅卷效果。' : isFormalGrading.value ? '创建并进入正式评阅任务，处理考生答卷。' : '统一查看试卷包阅卷任务进度，进入任务继续阅卷。')
const createLabel = computed(() => isStandards.value ? '新建标准' : isTemplates.value ? '新建模板' : '新增阅卷任务')
const taskDialogTitle = computed(() => isTrialGrading.value ? '新增试阅任务' : isFormalGrading.value ? '新增评阅任务' : '新建阅卷任务')
const searchPlaceholder = computed(() => isStandards.value ? '搜索标准名称、知识点' : isTemplates.value ? '搜索模板名称、考试名称' : '搜索任务名称、考试名称')
const statusOptions = computed(() => isStandards.value ? ['已启用'] : isTemplates.value ? ['可用'] : ['未完成', '已完成'])
const subjects = ref<SubjectItem[]>([]); const rows = ref<Row[]>([]); const loading = ref(false)
const gradingPackageOptions = ref<any[]>([])
const expandedTaskKey = ref('')
const taskDialogVisible = ref(false); const taskOptionLoading = ref(false); const taskSaving = ref(false)
const standardCreateVisible = ref(false); const standardCreateLoading = ref(false); const standardCreateExamLoading = ref(false)
const standardCreateSubjectId = ref<number>(); const standardCreateExamId = ref<number>(); const standardCreateExams = ref<ExamItem[]>([])
const taskStandardOptions = ref<ExamGradingStandard[]>([])
const taskForm = ref({ packageKey: '', standardId: undefined as number | undefined })
const gradingServices = ref<McpServiceInfo[]>([])
const keyword = ref(''); const subjectFilter = ref<number>(); const typeFilter = ref(''); const statusFilter = ref(''); const standardDialogVisible = ref(false); const standardDialogRow = ref<Row>(); const page = ref(1); const pageSize = ref(10)
const emptyText = computed(() => loading.value ? '正在加载' : '暂无数据')
const filteredRows = computed(() => rows.value.filter((row) => {
  const q = keyword.value.trim().toLowerCase()
  const searchable = [row.name, row.examName, row.subjectLabel, row.template?.template_name, ...(row.items || []).map((item: any) => item.question_text), ...(row.items || []).map((item: any) => item.reference_answer)].join(' ').toLowerCase()
  if (q && !searchable.includes(q)) return false
  if (subjectFilter.value && row.subjectId !== subjectFilter.value) return false
  if (typeFilter.value && !(row.items || []).some((item: any) => item.question_type === typeFilter.value)) return false
  const status = row.progress === 100 ? '已完成' : '未完成'
  if (statusFilter.value && status !== statusFilter.value) return false
  return true
}))
const pagedRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
watch([keyword, subjectFilter, typeFilter, statusFilter], () => { page.value = 1 })

const examLabel = (exam: ExamItem, subject: SubjectItem) => ({ exam, subject, subjectLabel: `${subject.subject_no} · ${subject.subject_name}` })
async function loadGradingPackageOptions() {
  const response = await getAllPackages()
  if (![0, 200].includes(response?.code)) throw new Error(response?.message || '读取已上传试卷包失败')
  const localPackages = (response.data || [])
    .filter((pkg: any) => pkg.isLocal && pkg.local_package_id != null)
    .map((pkg: any) => ({
      ...pkg,
      key: `${pkg.subject_id}:${pkg.exam_id}:${pkg.local_package_id}`,
      subjectId: Number(pkg.subject_id),
      examId: Number(pkg.exam_id),
      examName: pkg.exam_name || '',
      subjectLabel: `${pkg.subject_no || ''} · ${pkg.subject_name || ''}`.trim(),
      uploaded_at: pkg.uploaded_at || pkg.created_at
    }))
    .sort((left: any, right: any) => String(right.uploaded_at || '').localeCompare(String(left.uploaded_at || '')))

  const latestByPackage = new Map<string, any>()
  localPackages.forEach((pkg: any) => {
    const baseName = String(pkg.package_name || '')
      .replace(/（解析于\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}）$/, '')
      .trim()
    const identity = `${pkg.subjectId}:${pkg.examId}:${baseName.toLocaleLowerCase()}`
    if (!latestByPackage.has(identity)) latestByPackage.set(identity, pkg)
  })
  return [...latestByPackage.values()]
}
async function loadData() {
  loading.value = true
  try {
    const subjectResponse = await getSubjects()
    if (![0, 200].includes(subjectResponse?.code)) throw new Error(subjectResponse?.message || '读取科目失败')
    subjects.value = subjectResponse.data || []
    const examsBySubject = await Promise.all(subjects.value.map(async (subject) => {
      const response = await getExams(subject.subject_id)
      return { subject, exams: response?.data || [] as ExamItem[] }
    }))
    const pairs = examsBySubject.flatMap(({ subject, exams }) => exams.map((exam: ExamItem) => examLabel(exam, subject)))
    const nextRows: Row[] = []
    if (isStandards.value) {
      const results = await Promise.all(pairs.map(async ({ exam, subject, subjectLabel }) => {
        try { const response = await getGradingStandardVersions(subject.subject_id, exam.id); return { exam, subject, subjectLabel, versions: response?.data || [] } }
        catch { return { exam, subject, subjectLabel, versions: [] } }
      }))
      results.forEach(({ exam, subject, subjectLabel, versions }) => {
        const latest = versions[0]
        if (!latest) return
        nextRows.push({ key: `s-${subject.subject_id}-${exam.id}`, standard_id: latest.standard_id, subjectId: subject.subject_id, examId: exam.id, examName: exam.exam_name, subjectLabel, createdAt: latest.created_at, items: latest.standard_items || [], versions, name: `${exam.exam_name}阅卷标准` })
      })
    } else if (isTemplates.value) {
      const results = await Promise.all(pairs.map(async ({ exam, subject, subjectLabel }) => {
        try { const response = await getGradingTemplates(subject.subject_id, exam.id); return { exam, subject, subjectLabel, templates: response?.data || [] } }
        catch { return { exam, subject, subjectLabel, templates: [] } }
      }))
      results.forEach(({ exam, subject, subjectLabel, templates }) => templates.forEach((template: any) => nextRows.push({ key: `t-${template.template_id}`, subjectId: subject.subject_id, examId: exam.id, examName: exam.exam_name, subjectLabel, template, name: template.template_name, standardLabel: `${template.template_items?.length || 0} 道题已关联标准`, mode: 'AI 辅助阅卷' })))
    } else {
      // 使用上传页登记在后端的试卷包记录，不依赖浏览器 IndexedDB 缓存。
      const packageOptions = await loadGradingPackageOptions()
      gradingPackageOptions.value = packageOptions
      const taskResponse = await getGradingTasks()
      if (![0, 200].includes(taskResponse?.code)) throw new Error(taskResponse?.message || '读取阅卷任务失败')
      const taskItems = await Promise.all((taskResponse.data || []).map(async (task: any) => {
        const packageOption = packageOptions.find((item: any) => Number(item.local_package_id) === Number(task.local_package_id) && Number(item.examId) === Number(task.exam_id))
        const questionNos: string[] = [...new Set<string>((task.template_items || []).map((item: any) => String(item.question_no || '').trim()).filter(Boolean))]
        const completedStudentNos: string[] = task.completed_student_nos || []
        const studentCount = Number(task.student_count || packageOption?.student_count || 0)
        const completedCount = Math.min(studentCount, Number(task.completed_count ?? completedStudentNos.length))
        const totalQuestionCount = Number(task.total_question_count ?? studentCount * questionNos.length)
        const gradedQuestionCount = Math.min(totalQuestionCount, Number(task.graded_question_count ?? 0))
        return {
          key: `g-${task.task_id}`, taskId: task.task_id,
          subjectId: task.subject_id, examId: task.exam_id,
          examName: task.exam_name || packageOption?.examName || '',
          subjectLabel: task.subject_no ? `${task.subject_no} · ${task.subject_name}` : packageOption?.subjectLabel || '',
          name: task.package_name || packageOption?.package_name || task.exam_name || '阅卷任务',
          templateName: task.template_name || '', createdAt: task.created_at,
          studentCount, completedCount,
          gradedQuestionCount, totalQuestionCount,
          progress: isFormalGrading.value
            ? (studentCount ? Math.round(completedCount / studentCount * 100) : 0)
            : (totalQuestionCount ? Math.round(gradedQuestionCount / totalQuestionCount * 100) : 0),
          packageId: task.local_package_id,
          standardId: task.standard_id,
          standardVersionNo: task.standard_version_no,
          packageKey: packageOption?.key,
          questionNos,
          completedStudentNos,
          studentNos: undefined,
          recordsLoaded: true
        }
      }))
      nextRows.push(...taskItems)
    }
    rows.value = nextRows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    if (hasStudentExpand.value && expandedTaskKey.value) {
      const expandedRow = rows.value.find((row) => row.key === expandedTaskKey.value)
      if (expandedRow) await loadTaskStudents(expandedRow, true)
      else expandedTaskKey.value = ''
    }
  } catch (error) { ElMessage.error(error instanceof Error ? error.message : '加载列表失败') }
  finally { loading.value = false }
}

const editStandard = (row: Row) => { void openEditorForExam(row.subjectId, row.examId, true) }
const viewStandard = async (row: Row) => {
  try {
    const versionsResponse = await getGradingStandardVersions(row.subjectId, row.examId)
    const versions = versionsResponse?.data || []
    const latest = versions[0]
    if (!latest) {
      ElMessage.warning('该考试暂无阅卷标准，请刷新列表')
      return
    }
    row.standard_id = latest.standard_id
    row.createdAt = latest.created_at
    row.items = latest.standard_items || []
    row.versions = versions
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '读取最新阅卷标准失败')
    return
  }
  try {
    const servicesResponse = await listServices(undefined, true)
    const serviceData: any = servicesResponse?.data
    gradingServices.value = Array.isArray(serviceData) ? serviceData : (serviceData?.items || [])
  } catch {
    // The service ID remains visible if service names cannot be loaded.
    gradingServices.value = []
  }
  standardDialogRow.value = row
  standardDialogVisible.value = true
}
const viewStandardVersion = async (row: Row, version: ExamGradingStandard) => {
  try {
    const servicesResponse = await listServices(undefined, true)
    const serviceData: any = servicesResponse?.data
    gradingServices.value = Array.isArray(serviceData) ? serviceData : (serviceData?.items || [])
  } catch {
    gradingServices.value = []
  }
  standardDialogRow.value = { ...row, standard_id: version.standard_id, createdAt: version.created_at, items: version.standard_items || [] }
  standardDialogVisible.value = true
}
async function removeStandard(row: Row) {
  const runDelete = (cascade: boolean) => deleteGradingStandard(row.subjectId, row.examId, row.standard_id, { cascade })
  try {
    await ElMessageBox.confirm(`确定删除“${row.name}”当前整套阅卷标准吗？`, '删除阅卷标准', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    let response = await runDelete(false)
    // 版本间复用题目导致单版本删除被拒（409“已被其他版本复用”）：
    // 询问教师后按考试级联删除全部标准版本
    if (![0, 200].includes(response?.code) && String(response?.message || '').includes('复用')) {
      let versionCount = 0
      try {
        const versions = await getGradingStandardVersions(row.subjectId, row.examId)
        versionCount = (versions?.data || []).length
      } catch { versionCount = 0 }
      await ElMessageBox.confirm(
        `该标准题目被其它版本复用，无法单版本删除。是否级联删除该考试下的全部标准版本${versionCount > 1 ? `（共 ${versionCount} 个版本）` : ''}？`,
        '级联删除阅卷标准',
        { type: 'warning', confirmButtonText: '级联删除', cancelButtonText: '取消' }
      )
      response = await runDelete(true)
    }
    if (![0, 200].includes(response?.code)) throw new Error(response?.message || '删除阅卷标准失败')
    const deletedCount = (response?.data?.deleted_standard_ids || []).length
    ElMessage.success(deletedCount > 1 ? `已级联删除 ${deletedCount} 个标准版本` : '阅卷标准已删除')
    await loadData()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error?.response?.data?.message || error?.message || '删除阅卷标准失败')
  }
}
// 切换阅卷任务绑定的阅卷标准：试阅/评阅任务列表操作列入口。
// 切换后任务使用新标准评阅；已评记录保留在原标准下，进度按新标准统计。
const switchStandardVisible = ref(false)
const switchStandardRow = ref<Row | null>(null)
const switchStandardOptions = ref<ExamGradingStandard[]>([])
const switchStandardLoading = ref(false)
const switchStandardSaving = ref(false)
const switchStandardId = ref<number | undefined>()

const switchStandardLabel = (item: ExamGradingStandard) => {
  const currentMark = Number(switchStandardRow.value?.standard_id || 0) === Number(item.standard_id) ? '（当前使用）' : ''
  return `阅卷标准 V${item.version_no || 1} · ${item.standard_items?.length || 0} 道题 · ${formatDate(item.created_at)}${currentMark}`
}

const openSwitchStandard = async (row: Row) => {
  switchStandardRow.value = row
  switchStandardId.value = Number(row.standardId) || undefined
  switchStandardOptions.value = []
  switchStandardVisible.value = true
  switchStandardLoading.value = true
  try {
    // 任务行字段为驼峰命名（taskId/subjectId/examId），下划线字段不存在
    const response = await getGradingStandardVersions(String(row.subjectId), String(row.examId))
    switchStandardOptions.value = response?.data || []
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '获取阅卷标准失败')
  } finally {
    switchStandardLoading.value = false
  }
}

const confirmSwitchStandard = async () => {
  const row = switchStandardRow.value
  if (!row || !switchStandardId.value) return
  switchStandardSaving.value = true
  try {
    const response = await switchGradingTaskStandard(row.taskId, switchStandardId.value)
    if (![0, 200].includes(response?.code)) throw new Error(response?.message || '切换阅卷标准失败')
    ElMessage.success(response?.message || '阅卷标准已切换，任务将使用新标准评阅')
    switchStandardVisible.value = false
    await loadData()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '切换阅卷标准失败')
  } finally {
    switchStandardSaving.value = false
  }
}
const createNew = async () => {
  if (isGrading.value) {
    taskForm.value = { packageKey: '', standardId: undefined }
    taskStandardOptions.value = []
    taskDialogVisible.value = true
    try {
      gradingPackageOptions.value = await loadGradingPackageOptions()
      if (!gradingPackageOptions.value.length) ElMessage.info('请先在答卷上传页面完成试卷包上传和解析')
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message || error?.message || '读取已上传试卷包失败')
    }
    return
  }
  if (isStandards.value) {
    standardCreateSubjectId.value = undefined
    standardCreateExamId.value = undefined
    standardCreateExams.value = []
    standardCreateVisible.value = true
    return
  }
  if (isStandards.value || isTemplates.value) {
    const target = rows.value[0]
      ? { subjectId: rows.value[0].subjectId, examId: rows.value[0].examId }
      : await findExamWithPackage()
    if (!target) return ElMessage.info('请先创建科目和考试，并上传解析完成的试卷包')
    const pkg = await newestPackage(target.subjectId, target.examId)
    if (!pkg) return ElMessage.info('请先上传并解析试卷包')
    if (isStandards.value) {
      router.push({ name: 'teacher-grading-standards', params: target, query: { packageId: String(pkg.local_package_id || pkg.package_id) } })
      return
    }
    router.push({ name: 'teacher-grading-templates', params: target, query: { packageId: String(pkg.local_package_id || pkg.package_id) } })
    return
  }
  const task = rows.value[0]
  if (task) openTask(task)
  else router.push('/answers/upload')
}
async function onStandardCreateSubjectChange(subjectId: number) {
  standardCreateExamId.value = undefined
  standardCreateExams.value = []
  if (!subjectId) return
  standardCreateExamLoading.value = true
  try {
    const response = await getExams(subjectId)
    standardCreateExams.value = response?.data || []
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '读取考试失败')
  } finally { standardCreateExamLoading.value = false }
}
async function confirmStandardCreate() {
  if (!standardCreateSubjectId.value || !standardCreateExamId.value) return
  standardCreateLoading.value = true
  try {
    standardCreateVisible.value = false
    const subject = subjects.value.find((item) => item.subject_id === standardCreateSubjectId.value)
    const exam = standardCreateExams.value.find((item) => item.id === standardCreateExamId.value)
    await router.push({
      name: 'teacher-grading-standards',
      params: { subjectId: standardCreateSubjectId.value, examId: standardCreateExamId.value },
      query: { subjectName: subject?.subject_name || '', examName: exam?.exam_name || '' }
    })
  } finally { standardCreateLoading.value = false }
}

async function handleTaskPackageChange(packageKey: string) {
  taskForm.value.standardId = undefined
  taskStandardOptions.value = []
  const selected = gradingPackageOptions.value.find((item) => item.key === packageKey)
  if (!selected) return
  taskOptionLoading.value = true
  try {
    const standardsResponse = await getGradingStandardVersions(selected.subjectId, selected.examId)
    taskStandardOptions.value = standardsResponse?.data || []
    if (taskStandardOptions.value[0]) taskForm.value.standardId = taskStandardOptions.value[0].standard_id
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '读取阅卷标准失败')
  } finally {
    taskOptionLoading.value = false
  }
}

async function saveGradingTask() {
  const selected = gradingPackageOptions.value.find((item) => item.key === taskForm.value.packageKey)
  if (!selected || !taskForm.value.standardId) return
  taskSaving.value = true
  try {
    const response = await createGradingTask({
      subject_id: selected.subjectId,
      exam_id: selected.examId,
      local_package_id: selected.local_package_id,
      standard_id: taskForm.value.standardId
    })
    if (![0, 200].includes(response?.code)) throw new Error(response?.message || '创建阅卷任务失败')
    ElMessage.success('阅卷任务已创建')
    taskDialogVisible.value = false
    // 同步刷新「查看评阅结果」的按任务子菜单（新增任务即刻可从菜单进入）
    void refreshGradingTaskSubMenus(router).catch(() => undefined)
    await loadData()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '创建阅卷任务失败')
  } finally {
    taskSaving.value = false
  }
}

async function handleTaskExpand(row: any, expandedRows: any[]) {
  if (!hasStudentExpand.value) return
  const isExpanded = expandedRows.some((expandedRow) => expandedRow.key === row.key)
  if (!isExpanded) {
    if (expandedTaskKey.value === row.key) expandedTaskKey.value = ''
    return
  }
  expandedTaskKey.value = row.key
  await loadTaskStudents(row)
}

async function loadTaskStudents(row: any, force = false) {
  if (row.studentNos && !force) return
  row.studentsLoading = true
  try {
    const response = await getLocalPackage(row.subjectId, row.examId, row.packageId)
    const students = response?.data?.parsed_students || response?.data?.students || []
    row.studentNos = [...new Set<string>(students.map((student: any) => String(
      student?.student_no ?? student?.studentNo ?? student?.studentId ?? student?.id ?? student?.answer_json?.student_no ?? ''
    ).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '读取考生列表失败')
    row.studentNos = []
  } finally {
    row.studentsLoading = false
  }
}
async function newestPackage(subjectId: number, examId: number) {
  const packages = await listLocalPackages(String(subjectId), String(examId))
  return [...packages].sort((a, b) => String(b.uploaded_at || '').localeCompare(String(a.uploaded_at || '')))[0]
}
async function findExamWithPackage() {
  for (const subject of subjects.value) {
    const response = await getExams(subject.subject_id)
    for (const exam of response?.data || []) {
      if ((await listLocalPackages(String(subject.subject_id), String(exam.id))).length) return { subjectId: subject.subject_id, examId: exam.id }
    }
  }
  return undefined
}
async function openEditorForExam(subjectId: number, examId: number, editing = false) {
  const first = await newestPackage(subjectId, examId)
  const subject = subjects.value.find((item) => item.subject_id === subjectId)
  const examResponse = await getExams(subjectId)
  const exam = (examResponse?.data || []).find((item: ExamItem) => item.id === examId)
  router.push({ name: 'teacher-grading-standards', params: { subjectId, examId }, query: { subjectName: subject?.subject_name || '', examName: exam?.exam_name || '', ...(first ? { packageId: String(first.local_package_id || first.package_id) } : {}), ...(editing ? { mode: 'edit' } : {}) } })
}
const editTemplate = (row: Row) => router.push({ name: 'teacher-grading-templates', params: { subjectId: row.subjectId, examId: row.examId }, query: { templateId: String(row.template.template_id), edit: '1' } })
const viewTemplate = (row: Row) => router.push({ name: 'teacher-grading-templates', params: { subjectId: row.subjectId, examId: row.examId }, query: { readonly: '1', templateId: String(row.template.template_id) } })
async function removeTemplate(row: Row) {
  try {
    await ElMessageBox.confirm(`确定删除阅卷模板“${row.template?.template_name || row.name}”吗？删除后不可恢复。`, '删除阅卷模板', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    const response = await deleteGradingTemplate(row.subjectId, row.examId, row.template.template_id)
    if (![0, 200].includes(response?.code)) throw new Error(response?.message || '删除阅卷模板失败')
    ElMessage.success('阅卷模板已删除')
    await loadData()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error?.response?.data?.message || error?.message || '删除阅卷模板失败')
  }
}
async function removeTask(row: Row) {
  try {
    await ElMessageBox.confirm(
      `确定删除阅卷任务“${row.name}”吗？对应的试阅结果和正式评阅结果也会一并删除。`,
      '删除阅卷任务',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    const response = await deleteGradingTask(row.taskId)
    if (![0, 200].includes(response?.code)) throw new Error(response?.message || '删除阅卷任务失败')
    ElMessage.success('阅卷任务及其评阅结果已删除')
    // 同步刷新「查看评阅结果」的按任务子菜单（被删任务的子菜单即刻移除）
    void refreshGradingTaskSubMenus(router).catch(() => undefined)
    await loadData()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error?.response?.data?.message || error?.message || '删除阅卷任务失败')
  }
}
const openTask = (row: Row) => router.push({ name: 'teacher-package-detail', params: { subjectId: row.subjectId, examId: row.examId, packageId: String(row.packageId) } })
const viewTaskStandard = (row: Row) => router.push({
  name: 'teacher-grading-standards',
  params: { subjectId: row.subjectId, examId: row.examId },
  query: {
    view: '1',
    standardId: String(row.standardId || ''),
    standardVersionNo: row.standardVersionNo ? String(row.standardVersionNo) : undefined,
    examName: row.examName,
    returnTo: isTrialGrading.value ? '/grading/trial' : isFormalGrading.value ? '/grading/formal' : '/grading-standards'
  }
})
const openTaskScoring = (row: Row, mode: 'trial' | 'formal') => router.push({
  name: 'teacher-package-detail',
  params: { subjectId: row.subjectId, examId: row.examId, packageId: String(row.packageId) },
  query: {
    mode,
    // 阅卷任务创建时已经绑定了具体阅卷标准版本；进入评分页时必须继续携带，
    // 否则评分页会回退到该考试的最新版本。
    standardId: row.standardId ? String(row.standardId) : undefined
  }
})
const questionType = (value: string) => ({ short_answer: '简答题', image: '图片题', operation: '操作题', code: '代码题', file: '文件题' } as Record<string, string>)[value] || value || '未设置'
const serviceNames = (item: any) => {
  if (item.mcp_service_name) return item.mcp_service_name
  const ids = String(item.mcp_service_id ?? '').split(',').map((value) => value.trim()).filter(Boolean)
  if (!ids.length) return '未设置'
  return ids.map((id) => {
    const service = gradingServices.value.find((candidate) => String(candidate.service_uuid || candidate.id) === id)
    return service?.service_name || service?.name || service?.module_name || id
  }).join('、')
}
const formatDate = (value?: string) => value ? String(value).replace('T', ' ').slice(0, 16) : '—'
const taskStandardLabel = (item: ExamGradingStandard) => {
  const selectedPackage = gradingPackageOptions.value.find((packageItem) => packageItem.key === taskForm.value.packageKey)
  const standardName = selectedPackage?.examName ? `${selectedPackage.examName}阅卷标准` : '阅卷标准'
  return `${standardName} · V${item.version_no || 1} · ${item.standard_items?.length || 0} 道题 · ${formatDate(item.created_at)}`
}
onActivated(loadData)
</script>

<style scoped>
.workflow-management{padding:20px;min-height:100%;color:var(--el-text-color-primary);font-size:14px}
.list-card{border-radius:8px;border-color:var(--el-border-color-lighter)}
.page-header{display:flex;align-items:center;justify-content:space-between;gap:16px}
.page-header h2{margin:0;color:var(--el-text-color-primary);font-size:20px;font-weight:600;line-height:1.4}.page-header p{margin:6px 0 0;color:var(--el-text-color-secondary);font-size:14px;line-height:1.6}
.workspace{display:grid;grid-template-columns:minmax(0,1fr)}
.filters{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px}.filters .el-input{width:260px}.filters .el-select{width:160px}.filters>.el-button{margin-left:auto}
.task-actions{display:flex;flex-direction:column;align-items:flex-start;gap:4px}.task-actions :deep(.el-button + .el-button){margin-left:0}.task-actions :deep(.standard-view-button){color:var(--el-color-primary)!important;background:transparent!important}.task-actions :deep(.standard-view-button:hover){color:var(--el-color-primary-light-3)!important;background:transparent!important}
.primary-cell{font-weight:550;color:var(--el-text-color-primary)}.muted-cell{margin-top:5px;color:var(--el-text-color-secondary);font-size:12px}.truncate{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pagination{display:flex;justify-content:space-between;align-items:center;margin-top:18px;color:var(--el-text-color-secondary);font-size:13px}
.full-width{width:100%}.grading-task-form{padding:4px 8px 0}.grading-task-form :deep(.el-form-item){margin-bottom:22px}.grading-progress{display:flex;align-items:center;gap:10px}.grading-progress :deep(.el-progress){flex:1}.grading-progress>span{flex:none;color:var(--el-text-color-regular);font-size:13px;white-space:nowrap}.student-expand-transition{max-height:0;overflow:hidden;transition:max-height 300ms ease}.student-expand-transition.is-open{max-height:360px}.student-expand-content{min-height:324px;padding:12px 24px 12px;background:#fafafa;box-sizing:border-box}.student-expand-title{margin:0 0 10px;color:var(--el-text-color-primary);font-size:13px;font-weight:600}.student-expand-state{display:flex;align-items:center;justify-content:center;gap:8px;height:280px;color:var(--el-text-color-secondary);font-size:13px}.workflow-management :deep(tr:has(> td.el-table__expanded-cell)){display:table-row!important}.workflow-management :deep(td.el-table__expanded-cell){padding:0!important;border-bottom:0!important}.workflow-management :deep(td.el-table__expanded-cell>.cell){padding:0!important}.workflow-management :deep(.el-table__expand-icon){transition:transform 300ms ease}.workflow-management :deep(.el-table__expand-icon--expanded){transform:rotate(90deg)}
.standard-detail-dialog :deep(.el-dialog){max-height:88vh;margin:0 auto}.standard-detail-dialog :deep(.el-dialog__body){padding:12px 26px 8px}.standard-detail-meta{display:flex;align-items:center;gap:10px;margin-bottom:18px;color:var(--el-text-color-secondary)}.workflow-management :deep(td.el-table__expanded-cell){padding:0!important;border-bottom:0!important;background:var(--el-fill-color-light)}.workflow-management :deep(td.el-table__expanded-cell>.cell){padding:0!important}.standard-expand-content{padding:10px 28px 10px 72px;background:var(--el-fill-color-light)}.standard-version-row{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--el-border-color-lighter);background:transparent;box-shadow:none}.standard-version-row:last-child{border-bottom:0}.standard-version-row>div{display:flex;align-items:center;gap:16px}.standard-version-row small{color:var(--el-text-color-secondary)}.standard-question{padding:18px 4px;border-bottom:1px solid var(--el-border-color-lighter)}.standard-question>header{display:flex;align-items:center;gap:10px}.standard-question>header>strong{font-size:16px}.standard-question-score{margin-left:auto;color:var(--el-text-color-secondary)}.standard-question-service{display:flex;align-items:flex-start;gap:12px;margin:18px 0 22px;padding:12px 14px;color:var(--el-text-color-regular);font-size:13px;line-height:1.6;background:var(--el-fill-color-light);border-radius:6px}.standard-question-service strong{flex:none;color:var(--el-text-color-secondary);font-weight:500}.standard-question-text{margin:14px 0;padding:12px;background:var(--el-fill-color-light);border-radius:6px;white-space:pre-wrap;line-height:1.65}.standard-answer{margin-top:18px}.standard-answer strong{font-size:13px}.standard-answer p{margin:8px 0 0;white-space:pre-wrap;line-height:1.7;color:var(--el-text-color-regular)}
@media(max-width:720px){.workflow-management{padding:16px 12px}.page-header{align-items:stretch;flex-direction:column}.filters{align-items:stretch}.filters .el-input,.filters .el-select{width:100%}.filters>.el-button{margin-left:0}}
</style>

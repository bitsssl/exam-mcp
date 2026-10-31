<template>
  <div class="workflow-entry-page">
    <el-card shadow="never">
      <template #header>
        <div class="entry-header">
          <div>
            <h2>{{ moduleTitle }}</h2>
            <p>{{ moduleDescription }}</p>
          </div>
          <el-tag effect="plain">阅卷业务</el-tag>
        </div>
      </template>

      <el-steps :active="activeStep" finish-status="success" align-center class="entry-steps">
        <el-step title="选择科目" />
        <el-step title="选择考试" />
        <el-step title="进入模块" />
      </el-steps>

      <el-form label-position="top" class="entry-form">
        <el-form-item label="科目">
          <el-select
            v-model="subjectId"
            filterable
            placeholder="请选择科目"
            :loading="subjectsLoading"
            @change="handleSubjectChange"
          >
            <el-option
              v-for="subject in subjects"
              :key="subject.subject_id"
              :label="`${subject.subject_no} · ${subject.subject_name}`"
              :value="subject.subject_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="考试">
          <el-select
            v-model="examId"
            filterable
            placeholder="请先选择科目，再选择考试"
            :loading="examsLoading"
            :disabled="!subjectId"
          >
            <el-option
              v-for="exam in exams"
              :key="exam.id"
              :label="exam.exam_name"
              :value="exam.id"
            />
          </el-select>
        </el-form-item>
        <el-button type="primary" :disabled="!subjectId || !examId" @click="openModule">
          进入{{ moduleAction }}
        </el-button>
      </el-form>

      <el-alert
        class="entry-hint"
        type="info"
        :closable="false"
        show-icon
        :title="moduleHint"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getExams, getSubjects, type ExamItem, type SubjectItem } from '@/api/teacher-scoring'

type WorkflowModule = 'answers' | 'standards' | 'templates' | 'grading'

const route = useRoute()
const router = useRouter()
const moduleKey = computed(() => String(route.meta.workflowModule || 'answers') as WorkflowModule)
const moduleCopy: Record<WorkflowModule, { title: string; description: string; action: string; hint: string; destination: (subject: number, exam: number) => string }> = {
  answers: {
    title: '答卷管理',
    description: '按科目和考试查找已上传的试卷包、答卷文件及解析结果。',
    action: '答卷管理',
    hint: '选择考试后进入试卷包列表，可查看学生答卷和文件解析报告。',
    destination: (subject, exam) => `/teacher/scoring/subjects/${subject}/exams/${exam}`
  },
  standards: {
    title: '阅卷标准管理',
    description: '为考试题目维护参考答案、评分细则和对应 MCP 服务。',
    action: '阅卷标准',
    hint: '阅卷标准按考试维护；进入后可新增、修改和管理标准版本。',
    destination: (subject, exam) => `/teacher/scoring/subjects/${subject}/exams/${exam}/grading-standards`
  },
  templates: {
    title: '阅卷模板管理',
    description: '将题目阅卷标准组织成可复用的阅卷模板。',
    action: '阅卷模板',
    hint: '阅卷模板关联到具体考试，进入后可创建、复制和维护模板。',
    destination: (subject, exam) => `/teacher/scoring/subjects/${subject}/exams/${exam}/grading-templates`
  },
  grading: {
    title: '阅卷管理',
    description: '从考试进入试卷包，执行试阅、正式阅卷、结果对比和人工复核。',
    action: '阅卷工作台',
    hint: '阅卷前先准备评分标准和模板；正式结果支持统计、异常查看与人工复核。',
    destination: (subject, exam) => `/teacher/scoring/subjects/${subject}/exams/${exam}`
  }
}

const moduleInfo = computed(() => moduleCopy[moduleKey.value] || moduleCopy.answers)
const moduleTitle = computed(() => moduleInfo.value.title)
const moduleDescription = computed(() => moduleInfo.value.description)
const moduleAction = computed(() => moduleInfo.value.action)
const moduleHint = computed(() => moduleInfo.value.hint)
const activeStep = computed(() => examId.value ? 2 : subjectId.value ? 1 : 0)
const subjects = ref<SubjectItem[]>([])
const exams = ref<ExamItem[]>([])
const subjectsLoading = ref(false)
const examsLoading = ref(false)
const subjectId = ref<number>()
const examId = ref<number>()

onMounted(loadSubjects)

async function loadSubjects() {
  subjectsLoading.value = true
  try {
    const response = await getSubjects()
    if (response?.code !== 0 && response?.code !== 200) throw new Error(response?.message || '获取科目失败')
    subjects.value = response.data || []
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '获取科目失败')
  } finally {
    subjectsLoading.value = false
  }
}

async function handleSubjectChange(value: number) {
  examId.value = undefined
  exams.value = []
  examsLoading.value = true
  try {
    const response = await getExams(value)
    if (response?.code !== 0 && response?.code !== 200) throw new Error(response?.message || '获取考试失败')
    exams.value = response.data || []
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '获取考试失败')
  } finally {
    examsLoading.value = false
  }
}

function openModule() {
  if (!subjectId.value || !examId.value) return
  router.push(moduleInfo.value.destination(subjectId.value, examId.value))
}
</script>

<style scoped>
.workflow-entry-page { padding: 24px; }
.entry-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.entry-header h2 { margin: 0; font-size: 20px; color: var(--el-text-color-primary); }
.entry-header p { margin: 8px 0 0; color: var(--el-text-color-secondary); }
.entry-steps { max-width: 760px; margin: 28px auto 36px; }
.entry-form { max-width: 520px; margin: 0 auto; }
.entry-form .el-select { width: 100%; }
.entry-form > .el-button { width: 100%; margin-top: 8px; }
.entry-hint { max-width: 760px; margin: 32px auto 8px; }
</style>

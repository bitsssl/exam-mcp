<template>
  <section class="blank-paper-structure-page">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="page-header">
          <div>
            <h2>试卷结构</h2>
            <p>{{ subjectName }} · {{ examName }} · 来源：{{ structureSourceText }}</p>
          </div>
          <el-button @click="router.back()">返回</el-button>
        </div>
      </template>
      <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" />
      <template v-else-if="questions.length">
        <el-collapse v-model="expandedSections">
          <el-collapse-item v-for="section in majorSections" :key="section.index" :name="String(section.index)">
            <template #title><strong>第{{ section.index }}大题</strong><span class="section-title">{{ section.title }}</span><el-tag size="small">{{ section.questions.length }} 题</el-tag></template>
            <div v-for="question in section.questions" :key="question.key" class="question-card">
              <div class="question-head"><span class="question-no">Q{{ question.no }}</span><strong>{{ question.title || '未命名题目' }}</strong></div>
              <div v-if="question.steps.length" class="steps"><div v-for="(step, index) in question.steps" :key="index"><span>（{{ index + 1 }}）</span>{{ step }}</div></div>
              <div v-if="question.images.length" class="question-images"><el-tag v-for="image in question.images" :key="image" size="small" type="info">参考图片：{{ image }}</el-tag></div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </template>
      <el-empty v-else-if="!loading" description="当前考试暂无解析完成的空白试卷结构，请先在考试管理上传空白试卷" />
    </el-card>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getExam, getSubject } from '@/api/teacher-scoring'
import { isValidPaperStructure, loadDisplayStructure } from '@/utils/paper-structure'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const error = ref('')
const exam = ref<any>(null)
const subject = ref<any>(null)
// 阅卷标准结构快照：有快照时本页展示快照结构（含教师新增/修正的题目）
const structure = ref<Record<string, any> | null>(null)
const expandedSections = ref<string[]>([])
const subjectName = computed(() => subject.value?.subject_name || '科目')
const examName = computed(() => exam.value?.exam_name || '考试')
const structureSourceText = computed(() => (isValidPaperStructure(structure.value) ? '阅卷标准快照' : '考试空白试卷'))
const majorSections = computed(() => {
  // 优先用阅卷标准结构快照，没有快照的旧数据回退考试空白试卷
  const paper = isValidPaperStructure(structure.value) ? structure.value : exam.value?.blank_paper_json
  const majors = Array.isArray(paper?.大题)
    ? paper.大题
    : Object.values(paper || {}).find((value: any) => Array.isArray(value)) || []
  return majors.map((major: any, majorIndex: number) => {
    const children = Array.isArray(major?.小题)
      ? major.小题
      : Object.values(major || {}).find((value: any) => Array.isArray(value)) || []
    return {
      index: majorIndex + 1,
      title: String(major?.题干 || major?.标题 || '').trim(),
      questions: children.map((question: any, questionIndex: number) => ({
        key: `${majorIndex + 1}-${questionIndex + 1}`,
        no: children.length > 1 ? `${majorIndex + 1}.${questionIndex + 1}` : String(majorIndex + 1),
        title: String(question?.题干 || question?.标题 || '').trim(),
        steps: Array.isArray(question?.子小题) ? question.子小题.map((step: any) => String(step?.题干 || step?.标题 || '').trim()).filter(Boolean) : [],
        images: Array.isArray(question?.参考图片) ? question.参考图片.map((image: any) => String(image || '').trim()).filter(Boolean) : []
      }))
    }
  })
})
const questions = computed(() => majorSections.value.flatMap((section: any) => section.questions))

onMounted(async () => {
  loading.value = true
  try {
    const [examResponse, subjectResponse, structureValue] = await Promise.all([
      getExam(String(route.params.subjectId), String(route.params.examId)),
      getSubject(String(route.params.subjectId)),
      // 快照拉取失败不影响页面（静默回退空白试卷）
      loadDisplayStructure(String(route.params.subjectId), String(route.params.examId))
    ])
    if (![0, 200].includes(examResponse?.code)) throw new Error(examResponse?.message || '读取空白试卷结构失败')
    exam.value = examResponse.data
    subject.value = subjectResponse.data
    structure.value = structureValue
    expandedSections.value = majorSections.value.map((section: any) => String(section.index))
  } catch (err: any) {
    error.value = err?.response?.data?.message || err?.message || '读取空白试卷结构失败'
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.blank-paper-structure-page { padding: 20px; }
.page-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.page-header h2 { margin: 0; font-size: 20px; }
.page-header p { margin: 6px 0 0; color: var(--el-text-color-secondary); }
.section-title { overflow: hidden; flex: 1; margin: 0 14px; white-space: nowrap; text-overflow: ellipsis; color: var(--el-text-color-secondary); }
.question-card { margin: 12px 0; padding: 14px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; }
.question-head { display: flex; align-items: flex-start; gap: 10px; line-height: 1.6; }
.question-head strong { flex: 1; min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-weight: 600; }
.question-no { flex: 0 0 auto; color: var(--el-color-primary); font-weight: 600; }
.steps { margin: 10px 0 0 38px; color: var(--el-text-color-regular); white-space: pre-wrap; line-height: 1.7; }
.steps span { color: var(--el-text-color-secondary); }
.question-images { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
@media (max-width: 760px) { .page-header { align-items: stretch; flex-direction: column; } }
</style>

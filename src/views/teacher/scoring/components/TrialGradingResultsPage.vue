<template>
  <main class="temporary-trial-page">
    <el-card shadow="never" class="trial-result-card">
      <template #header>
        <div class="page-heading">
          <div>
            <h1>试阅评分结果</h1>
            <p>本页结果仅在当前页面临时展示，返回后不会保存。</p>
          </div>
          <div class="heading-actions">
            <el-statistic v-if="currentQuestion" class="top-average-stat" title="本题平均分" :value="averageScore" :precision="2">
              <template #suffix><span v-if="currentQuestion?.max_score != null">/ {{ currentQuestion.max_score }}</span></template>
            </el-statistic>
            <el-button class="export-excel-button" type="primary" :icon="Download" @click="exportExcel">导出 Excel 表格</el-button>
            <el-button :icon="Download" type="primary" @click="exportJson">导出评分 JSON</el-button>
            <el-button type="primary" :icon="Document" @click="exportReport">导出试阅报告</el-button>
            <el-button @click="$emit('back')">返回</el-button>
          </div>
        </div>
      </template>

      <div v-if="currentStudent" class="result-content">
        <div class="trial-split-layout">
          <section class="score-panel" aria-label="试阅评分结果">
            <div class="panel-heading score-panel-heading">
              <div>
                <span class="panel-eyebrow">评分结果</span>
                <h2>{{ currentStudent.student_no || '当前考生' }}</h2>
              </div>
              <div class="student-navigation student-navigation-top">
                <el-button size="small" :icon="ArrowLeft" :disabled="currentIndex <= 0" @click="currentIndex -= 1">上一位考生</el-button>
                <span>{{ currentIndex + 1 }} / {{ rows.length }} 位</span>
                <el-button size="small" :icon="ArrowRight" :disabled="currentIndex >= rows.length - 1" @click="currentIndex += 1">下一位考生</el-button>
              </div>
            </div>
            <div class="score-details">
              <div class="score-line">
                <span class="score-label">得分</span>
                <strong class="score-value">{{ currentScore === null ? '评分失败或未返回分数' : `${currentScore}${currentQuestion.max_score == null ? '' : ` / ${currentQuestion.max_score}`}` }}</strong>
              </div>
              <div class="comment-line">
                <span class="score-label">评语</span>
                <div class="comment-text">{{ currentComment || currentQuestion.error || '暂无评语' }}</div>
              </div>
            </div>

            <el-alert v-if="currentQuestion.error" class="result-error" type="error" :closable="false" show-icon :title="currentQuestion.error" />

          </section>

          <section class="question-panel" aria-label="当前考生试题">
            <div class="question-navigation" v-if="currentStudent.questions.length > 1">
              <span>本考生题目</span>
              <el-button size="small" :icon="ArrowLeft" :disabled="questionIndex <= 0" @click="questionIndex -= 1">上一题</el-button>
              <span class="question-position">{{ questionIndex + 1 }} / {{ currentStudent.questions.length }}</span>
              <el-button size="small" :icon="ArrowRight" :disabled="questionIndex >= currentStudent.questions.length - 1" @click="questionIndex += 1">下一题</el-button>
            </div>
            <div class="question-body">
              <div class="question-block">
                <div class="block-label">题目</div>
                <div class="question-text"><strong>Q{{ currentQuestion?.question_no || currentQuestion?.question_label }}</strong><br>{{ currentQuestionStem || '暂无题目内容' }}</div>
              </div>
              <div v-if="currentTextAnswerRows.length" class="question-block answer-block">
                <div class="block-label">答案结果文本</div>
                <div class="answer-text">{{ currentTextAnswerText }}</div>
              </div>
              <div v-else-if="currentAnswerText && !hasAnyTextAnswerRows" class="question-block answer-block">
                <div class="block-label">考生答案</div>
                <div class="answer-text">{{ currentAnswerText }}</div>
              </div>
              <div class="question-block answer-files-block">
                <div class="block-label">答案结果文件</div>
                <div v-if="displayAnswerFileNames.length" class="answer-file-list">
                  <div v-for="fileName in displayAnswerFileNames" :key="fileName" class="answer-file-item">
                    {{ fileName }}
                  </div>
                </div>
                <div v-else class="answer-file-empty">无</div>
              </div>
              <div v-if="currentQuestionStandard" class="question-block standard-block">
                <div class="block-label">评阅标准</div>
                <div class="standard-text">{{ currentQuestionStandard }}</div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <el-empty v-else description="暂无试阅评分结果" />
    </el-card>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Document, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  AlignmentType,
  BorderStyle,
  Document as WordDocument,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} from 'docx'
import * as XLSX from 'xlsx'

defineEmits<{ back: [] }>()
const props = defineProps<{
  rows: Array<Record<string, any>>
  /** 文本作答内容行（按 考生号__题号 索引）：来自归属结果的抽取字段，由父页面传入 */
  textAnswerRows?: Record<string, Array<import('@/utils/assignment-files').AssignmentTextRow>>
  /** 是否为文本卷（包内任一考生抽到文本内容）：文本卷不显示考生答案材料块 */
  isTextPackage?: boolean
}>()
const currentIndex = ref(0)
const questionIndex = ref(0)
const sourceRows = computed(() => props.rows || [])
const questionRows = computed(() => {
  const groups = new Map<string, Array<Record<string, any>>>()
  sourceRows.value.forEach((row) => {
    const key = `${row.student_no || ''}__${row.question_no || row.question_label || ''}`
    groups.set(key, [...(groups.get(key) || []), row])
  })
  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0]
    const scores = group.map((row) => extractScore(row.result)).filter((score): score is number => score !== null)
    const comments = [...new Set(group.map((row) => extractComment(row.result) || row.error || '').filter(Boolean))]
    return {
      ...group[0],
      result: {
        score: scores.length ? Number(scores.reduce((sum, score) => sum + score, 0).toFixed(2)) : null,
        comment: comments.join('\n'),
        service_results: group.map((row) => ({ service_uuid: row.service_uuid, result: row.result, error: row.error }))
      },
      error: group.every((row) => row.error) ? group.map((row) => row.error).filter(Boolean).join('\n') : undefined
    }
  })
})
const rows = computed(() => {
  const students = new Map<string, Array<Record<string, any>>>()
  questionRows.value.forEach((row) => {
    const studentNo = String(row.student_no || '未标识考生')
    students.set(studentNo, [...(students.get(studentNo) || []), row])
  })
  return [...students.entries()].map(([student_no, questions]) => ({ student_no, questions }))
})
const currentStudent = computed(() => rows.value[currentIndex.value])
const currentQuestion = computed(() => currentStudent.value?.questions[questionIndex.value])
watch(currentIndex, () => { questionIndex.value = 0 })
const currentQuestionParts = computed(() => {
  const text = String(currentQuestion.value?.question_text || '').trim()
  const marker = text.search(/\n\n【(?:试阅采用的评阅标准|本题评阅标准)】\n?/)
  if (marker < 0) return { stem: text, standard: '' }
  const standardStart = text.indexOf('【', marker + 2)
  return {
    stem: text.slice(0, marker).trim(),
    standard: text.slice(standardStart).trim()
  }
})
const currentQuestionStem = computed(() => {
  // 题目段只保留题干：把拼装在后面的「作答：…」文本剥离，避免答卷
  // 文档转换出的材料文字混进题目展示区。
  const stem = currentQuestionParts.value.stem
  return stem.split(/\n作答[:：]/)[0].trim()
})
const currentQuestionStandard = computed(() => currentQuestionParts.value.standard)
const currentAnswerText = computed(() => String(currentQuestion.value?.answer_text || '').trim())
// 文本作答内容行：考生号__题号 与分组键一致
const currentTextAnswerRows = computed(() => {
  const current = currentQuestion.value
  if (!current) return []
  const key = `${String(current.student_no || '')}__${String(current.question_no || current.question_label || '')}`
  return props.textAnswerRows?.[key] || []
})
// 文本作答直接放文本内容：每行答案用"；"隔开（与导出 JSON 口径一致）
const currentTextAnswerText = computed(() => currentTextAnswerRows.value.map(({ content }) => content).join('；'))
// 文本卷判定：包内任一考生抽到文本内容即为文本卷——文本卷不显示
// 「考生答案」材料块，答案结果文件固定为"无"（评分请求已不再携带
// 杂项文件；个别未填答案的考生也不该显示材料文字）。
const hasAnyTextAnswerRows = computed(() => Boolean(props.isTextPackage) || Object.values(props.textAnswerRows || {}).some((rows) => rows.length))
const displayAnswerFileNames = computed(() => (hasAnyTextAnswerRows.value ? [] : currentAnswerFileNames.value))
const currentAnswerFileNames = computed(() => {
  const value = currentQuestion.value?.answer_file_names || currentQuestion.value?.answer_files || currentQuestion.value?.answer_result_files
  const values = Array.isArray(value) ? value : (value && typeof value === 'object' ? Object.values(value) : [])
  return [...new Set(values.map((item: any) => {
    if (typeof item === 'string') return item.trim()
    return String(item?.fileName || item?.file_name || item?.name || item?.relative_path || item?.path || '').trim()
  }).filter(Boolean))]
})
const scoreForRow = (row: Record<string, any>) => {
  const score = extractScore(row.result)
  const maxScore = Number(row.max_score)
  return score !== null && Number.isFinite(maxScore) && maxScore >= 0 ? Math.min(score, maxScore) : score
}
const scores = computed(() => questionRows.value
  .filter((row) => String(row.question_no || row.question_label || '') === String(currentQuestion.value?.question_no || currentQuestion.value?.question_label || ''))
  .map(scoreForRow)
  .filter((score): score is number => score !== null))
const averageScore = computed(() => scores.value.length
  ? Number((scores.value.reduce((sum, score) => sum + score, 0) / scores.value.length).toFixed(2))
  : 0)
const currentScore = computed(() => currentQuestion.value ? scoreForRow(currentQuestion.value) : null)
const currentComment = computed(() => currentQuestion.value
  ? extractComment(currentQuestion.value.result) || String(currentQuestion.value.grading_desc || currentQuestion.value.grading_record?.grading_desc || '').trim()
  : '')

function extractScore(value: any, depth = 0): number | null {
  if (depth > 5 || value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const text = value.trim()
    const direct = Number(text)
    if (text && Number.isFinite(direct)) return direct
    try { return extractScore(JSON.parse(text), depth + 1) } catch { return null }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const score = extractScore(item, depth + 1)
      if (score !== null) return score
    }
    return null
  }
  if (typeof value === 'object') {
    for (const key of ['score', '得分', '总分', '分数', 'final_score', 'total_score']) {
      if (value[key] !== undefined) {
        const score = extractScore(value[key], depth + 1)
        if (score !== null) return score
      }
    }
    for (const key of ['score_data', 'result', 'data', 'output', 'evaluation', 'response', 'content']) {
      if (value[key] !== undefined) {
        const score = extractScore(value[key], depth + 1)
        if (score !== null) return score
      }
    }
  }
  return null
}

function extractComment(value: any, depth = 0): string {
  if (depth > 5 || value == null) return ''
  if (typeof value === 'string') {
    try { return extractComment(JSON.parse(value), depth + 1) || value } catch { return value }
  }
  if (Array.isArray(value)) return value.map((item) => extractComment(item, depth + 1)).filter(Boolean).join('\n')
  if (typeof value === 'object') {
    for (const key of ['comment', 'comments', 'grading_desc', 'grading_reason', 'score_reason', 'reasoning', 'explanation', 'remark', '评语', '评分说明', '评分理由', '说明', 'feedback', 'reason', '评价']) {
      const text = value[key]
      if (typeof text === 'string' && text.trim()) return text.trim()
    }
    // MCP 评分信封通常把逐项评语放在 items/deductions 中，
    // 不能只查顶层 comment，否则 1.1 这类结果会显示“暂无评语”。
    const nestedComments: string[] = []
    for (const key of [
      'score_data',
      'result',
      'data',
      'output',
      'evaluation',
      'response',
      'content',
      'items',
      'deductions',
      'service_results'
    ]) {
      if (value[key] !== undefined) {
        const comment = extractComment(value[key], depth + 1)
        if (comment) nestedComments.push(comment)
      }
    }
    return [...new Set(nestedComments)].join('\n')
  }
  return ''
}

const getExportQuestionParts = (row: Record<string, any>) => {
  const text = String(row.question_text || '').trim()
  const marker = text.search(/\n\n【(?:试阅采用的评阅标准|本题评阅标准)】\n?/)
  const stem = marker >= 0 ? text.slice(0, marker).trim() : text
  const standard = marker >= 0
    ? text.slice(text.indexOf('【', marker + 2)).trim().replace(/^【(?:试阅采用的评阅标准|本题评阅标准)】\s*/, '')
    : ''
  const questionMarker = stem.indexOf('题目：')
  const answerMarker = stem.indexOf('\n作答：', questionMarker >= 0 ? questionMarker : 0)
  const questionText = questionMarker >= 0
    ? stem.slice(questionMarker + '题目：'.length, answerMarker >= 0 ? answerMarker : undefined).trim()
    : stem
  return { questionText, standard }
}

function exportExcel() {
const data = questionRows.value.map((row) => ({
    考生号: row.student_no || '',
    题号: row.question_no || '',
    试题: row.question_label || row.question_no || '',
    得分: extractScore(row.result) ?? '',
    满分: row.max_score ?? '',
    评语: extractComment(row.result) || row.grading_desc || row.grading_record?.grading_desc || row.error || ''
  }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), '试阅结果')
  XLSX.writeFile(workbook, '临时试阅评分结果.xlsx')
}

function exportJson() {
  const exportRows = questionRows.value
    .map((row) => {
      const parts = getExportQuestionParts(row)
      return {
        考号: String(row.student_no || '').trim(),
        题号: String(row.question_no || row.question_label || '').trim(),
        题干: parts.questionText,
        标准: parts.standard,
        得分: extractScore(row.result),
        评语: extractComment(row.result) || String(row.grading_desc || row.grading_record?.grading_desc || row.error || '').trim()
      }
    })
  const grouped = new Map<string, Array<Omit<(typeof exportRows)[number], '考号'>>>()
  exportRows.forEach((row) => {
    const studentNo = row.考号
    const questions = grouped.get(studentNo) || []
    const { 考号: _studentNo, ...question } = row
    questions.push(question)
    grouped.set(studentNo, questions)
  })
  const data = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([studentNo, questions]) => ({
      考号: studentNo,
      题目: questions.sort((left, right) => left.题号.localeCompare(right.题号, undefined, { numeric: true }))
    }))
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = '临时试阅评分结果.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

// 考生得分和评语用小表格框起来，其余内容保持纯文字
const reportBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'D9E2F3' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D9E2F3' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'D9E2F3' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'D9E2F3' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'D9E2F3' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'D9E2F3' }
}

const reportCellParagraphs = (value: unknown, bold = false) => {
  const lines = String(value ?? '').split(/\r?\n/)
  return (lines.length ? lines : ['']).map((line) => new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: line || ' ', bold, font: 'Microsoft YaHei', size: 21 })]
  }))
}

const reportCell = (value: unknown, options: { label?: boolean; width?: number } = {}) => new TableCell({
  width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
  shading: options.label ? { type: ShadingType.CLEAR, fill: 'EEF4FB' } : undefined,
  verticalAlign: VerticalAlign.CENTER,
  borders: reportBorders,
  children: reportCellParagraphs(value, Boolean(options.label))
})

const reportFieldTable = (fields: Array<[string, unknown]>) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: reportBorders,
  rows: fields.map(([label, value]) => new TableRow({
    children: [reportCell(label, { label: true, width: 18 }), reportCell(value, { width: 82 })]
  }))
})

const downloadDocx = async (doc: WordDocument) => {
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = '试阅评分报告.docx'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

async function exportReport() {
  const reportRows = questionRows.value.map((row) => {
    const parts = getExportQuestionParts(row)
    const score = extractScore(row.result)
    return {
      studentNo: String(row.student_no || '').trim() || '未标识考生',
      questionNo: String(row.question_no || row.question_label || '').trim(),
      questionText: parts.questionText || '暂无题目内容',
      standard: parts.standard || String(row.standard || row.grading_criteria || '').trim() || '暂无评阅标准',
      score,
      maxScore: row.max_score,
      comment: extractComment(row.result) || String(row.grading_desc || row.grading_record?.grading_desc || row.error || '').trim() || '暂无评语'
    }
  })

  // 按题组织：一道题写完（题目 → 评阅标准 → 各考生得分评语）再写下一道
  const questionGroups = new Map<string, typeof reportRows>()
  reportRows.forEach((row) => {
    questionGroups.set(row.questionNo, [...(questionGroups.get(row.questionNo) || []), row])
  })
  const sortedQuestions = [...questionGroups.entries()].sort(([left], [right]) => (
    left.localeCompare(right, undefined, { numeric: true })
  ))

  // 纯文字排版：加粗标签 + 正文（支持多行），不用表格框起来
  const reportLabeledParagraph = (label: string, value: string, spacing: { before?: number; after?: number } = {}) => {
    const lines = String(value ?? '').split(/\r?\n/)
    return new Paragraph({
      spacing: { after: 80, ...spacing },
      children: [
        new TextRun({ text: `${label}：`, bold: true, font: 'Microsoft YaHei', size: 21 }),
        ...lines.map((line, index) => new TextRun({ text: line || ' ', font: 'Microsoft YaHei', size: 21, break: index > 0 ? 1 : undefined }))
      ]
    })
  }

  const generatedAt = new Date().toLocaleString('zh-CN', { hour12: false })
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: '试阅评分报告', bold: true, font: 'Microsoft YaHei', size: 32 })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [new TextRun({ text: `生成时间：${generatedAt}　|　结果仅用于本次试阅，未写入正式评分记录`, font: 'Microsoft YaHei', size: 20, color: '6B7280' })]
    })
  ]

  sortedQuestions.forEach(([questionNo, rows], questionIndex) => {
    const first = rows[0]
    children.push(new Paragraph({
      spacing: { before: questionIndex === 0 ? 120 : 360, after: 120 },
      children: [new TextRun({ text: `题目 Q${questionNo}`, bold: true, font: 'Microsoft YaHei', size: 26 })]
    }))
    children.push(reportLabeledParagraph('题目', first.questionText))
    children.push(reportLabeledParagraph('评阅标准', first.standard, { after: 160 }))
    children.push(new Paragraph({
      spacing: { before: 160, after: 100 },
      children: [new TextRun({ text: '试阅考生', bold: true, font: 'Microsoft YaHei', size: 22 })]
    }))
    rows
      .slice()
      .sort((left, right) => left.studentNo.localeCompare(right.studentNo, undefined, { numeric: true }))
      .forEach((row) => {
        children.push(reportLabeledParagraph('考号', row.studentNo, { after: 60 }))
        children.push(reportFieldTable([
          ['得分', row.score === null ? '未返回' : `${row.score}${row.maxScore == null ? '' : ` / ${row.maxScore}`}`],
          ['评语', row.comment]
        ]))
        children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: '', size: 2 })] }))
      })
  })

  try {
    const doc = new WordDocument({
      styles: {
        default: {
          document: {
            run: { font: 'Microsoft YaHei', size: 21 },
            paragraph: { spacing: { after: 100 } }
          }
        }
      },
      sections: [{
        properties: {
          page: {
            margin: { top: 900, right: 900, bottom: 900, left: 900 }
          }
        },
        children
      }]
    })
    await downloadDocx(doc)
  } catch (error) {
    console.error('导出试阅评分报告失败', error)
    ElMessage.error('导出试阅评分报告失败，请稍后重试')
  }
}
</script>

<style scoped>
.temporary-trial-page { width: 100%; min-height: 100vh; padding: 28px 32px; box-sizing: border-box; background: #f4f6f9; }
.trial-result-card { width: 100%; min-height: calc(100vh - 56px); margin: 0; box-sizing: border-box; }
.page-heading, .heading-actions, .result-overview, .question-info, .student-navigation { display: flex; align-items: center; }
.page-heading, .result-overview { justify-content: space-between; gap: 20px; }
.page-heading h1 { margin: 0; font-size: 22px; color: var(--el-text-color-primary); }
.page-heading p { margin: 7px 0 0; color: var(--el-text-color-secondary); }
.heading-actions, .question-info { gap: 10px; flex-wrap: wrap; }
.top-average-stat { min-width: 108px; margin-right: 2px; text-align: right; }
.top-average-stat :deep(.el-statistic__head) { margin-bottom: 2px; color: var(--el-text-color-secondary); font-size: 12px; }
.top-average-stat :deep(.el-statistic__content) { color: var(--el-color-primary); font-size: 18px; font-weight: 700; }
.export-excel-button { margin-left: 12px; }
/* 得分面板在左（大），题目面板在右（小），比例不变 */
.trial-split-layout { display: grid; grid-template-columns: minmax(440px, 1.35fr) minmax(300px, 0.9fr); gap: 20px; align-items: stretch; }
.question-panel, .score-panel { min-width: 0; padding: 22px; border: 1px solid var(--el-border-color-lighter); border-radius: 12px; background: var(--el-bg-color); box-sizing: border-box; }
.question-panel { background: linear-gradient(145deg, var(--el-bg-color) 0%, var(--el-fill-color-lighter) 100%); }
.score-panel { box-shadow: 0 8px 24px rgba(31, 56, 88, 0.06); }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-bottom: 18px; border-bottom: 1px solid var(--el-border-color-lighter); }
.panel-heading h2 { margin: 5px 0 0; color: var(--el-text-color-primary); font-size: 19px; line-height: 1.35; }
.panel-eyebrow { color: var(--el-text-color-secondary); font-size: 12px; letter-spacing: 0.04em; }
.question-body { padding-top: 18px; }
.question-block + .question-block { margin-top: 18px; }
.block-label { margin-bottom: 8px; color: var(--el-text-color-secondary); font-size: 13px; font-weight: 600; }
.question-block:first-child .block-label,
.standard-block .block-label {
  color: var(--el-text-color-primary);
  font-size: 17px;
  font-weight: 800;
}
.question-text, .answer-text { white-space: pre-wrap; word-break: break-word; line-height: 1.8; color: var(--el-text-color-primary); }
.question-text { font-size: 16px; }
.answer-text { padding: 14px 16px; border-radius: 8px; background: rgba(64, 158, 255, 0.06); color: var(--el-text-color-regular); }
.answer-files-block { margin-top: 22px; }
.answer-files-block .block-label { color: var(--el-text-color-primary); font-size: 16px; font-weight: 700; }
.answer-file-list { display: flex; flex-direction: column; gap: 6px; padding: 12px 16px; border-left: 3px solid var(--el-color-primary); border-radius: 4px; background: var(--el-color-primary-light-9); color: var(--el-text-color-primary); font-size: 16px; font-weight: 700; line-height: 1.7; }
.answer-file-item { overflow-wrap: anywhere; }
.answer-file-empty { padding: 10px 16px; border-left: 3px solid var(--el-border-color); border-radius: 4px; background: var(--el-fill-color-lighter); color: var(--el-text-color-secondary); font-size: 15px; line-height: 1.7; }
.standard-block { margin-top: 22px; }
.standard-text { white-space: pre-wrap; word-break: break-word; line-height: 1.8; color: var(--el-text-color-regular); }
.student-navigation { justify-content: flex-end; gap: 8px; margin: 0; flex-wrap: wrap; }
.student-navigation-top { flex: 0 0 auto; }
.question-navigation { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 14px 0; color: var(--el-text-color-secondary); }
.student-navigation span { min-width: 80px; text-align: center; color: var(--el-text-color-secondary); }
.score-details { margin: 20px 0 16px; }
.score-line, .comment-line { display: flex; align-items: flex-start; gap: 18px; }
.comment-line { margin-top: 28px; }
.score-label { flex: 0 0 48px; color: #1f2937; font-size: 15px; font-weight: 700; line-height: 1.7; }
.score-line .score-value { line-height: 1.7; }
.comment-line .comment-text { flex: 1; min-width: 0; }
.score-value { color: var(--el-color-primary); font-size: 20px; }
.comment-text { white-space: pre-wrap; line-height: 1.7; }
.result-error { margin-top: 12px; }
@media (max-width: 1100px) { .trial-split-layout { grid-template-columns: minmax(360px, 1.1fr) minmax(280px, 0.9fr); } }
@media (max-width: 860px) { .trial-split-layout { grid-template-columns: 1fr; }.score-panel { order: 2; } }
@media (max-width: 760px) { .temporary-trial-page { padding: 12px; }.page-heading { align-items: stretch; flex-direction: column; }.heading-actions { align-items: stretch; flex-direction: column; }.top-average-stat { margin-right: 0; text-align: left; }.export-excel-button { margin-left: 0; }.panel-heading { align-items: stretch; flex-direction: column; }.score-line, .comment-line { gap: 12px; } }
</style>

/**
 * 正式评阅结果的共享题目口径。
 *
 * 评分服务侧的保存规则（以此为准，系统侧适配它）：
 * - 小题级目标按小题保存记录（question_no 如 2.1）；
 * - 大题级评分服务对整道大题只返回一个总分时，仅在大题层级保存一条记录
 *   （question_no 如 2），该记录覆盖大题下所有小题，总分只计一次；
 * - 没有小题的大题按大题号保存（历史记录可能存成 N.1）。
 * 结果页/详情页统一按「试卷结构 + 上述记录规则」判断已评与总分，
 * 不再用阅卷模板题号做完成度判断（模板题号与实际保存口径不一致时，
 * 考生会永远显示“已评 x/N”，柱状图也永远没有数据）。
 */
import { buildBlankPaperQuestions } from '@/utils/blank-paper-display'
import { getQuestionList } from '@/utils/local-scoring-package'
import { getAssignmentQuestionFiles } from '@/utils/assignment-files'
import type { LocalGradingRecordItem, StudentAnswerJson } from '@/api/teacher-scoring'

export type FormalTopicNode = {
  question?: string
  display_steps?: string[]
  images?: string[]
  answer?: string
  sub_question?: FormalTopicNode[]
  is_background?: boolean
  [key: string]: any
}

/** 一道参与评分的题目：小题，或无小题大题的整题 */
export type FormalQuestionRef = {
  questionNo: string
  topicIndex: number
  subIndex: number
  topicHasSubs: boolean
}

export type QuestionGrade = {
  score: number | null
  maxScore: number | null
  comments: string[]
  versionNo: number | null
  wholeTopic: boolean
  records: LocalGradingRecordItem[]
}

export type TopicGrade = {
  score: number | null
  maxScore: number | null
  comments: string[]
  wholeTopic: boolean
  gradedCount: number
  questionCount: number
}

export type StudentFormalSummary = {
  totalScore: number | null
  gradedCount: number
  questionCount: number
  complete: boolean
}

/** 用考生答卷 + 空白卷结构合成展示用的大题/小题树 */
export const buildFormalTopics = (
  answerJson: StudentAnswerJson | null | undefined,
  blankPaperJson?: Record<string, any> | null
): FormalTopicNode[] =>
  buildBlankPaperQuestions(getQuestionList(answerJson || null), blankPaperJson || null) as FormalTopicNode[]

/** 某道大题下参与评分的题目（全部小题，保留下标使题号不变） */
export const topicQuestionRefs = (topic: FormalTopicNode, topicIndex: number): FormalQuestionRef[] => {
  const subs = topic.sub_question || []
  if (!subs.length) {
    return [{ questionNo: String(topicIndex + 1), topicIndex, subIndex: -1, topicHasSubs: false }]
  }
  return subs.map((sub, subIndex) => ({
    questionNo: `${topicIndex + 1}.${subIndex + 1}`,
    topicIndex,
    subIndex,
    topicHasSubs: true
  }))
}

export const buildFormalQuestionRefs = (topics: FormalTopicNode[]): FormalQuestionRef[] =>
  topics.flatMap((topic, topicIndex) => topicQuestionRefs(topic, topicIndex))

export const normalizeResultQuestionNo = (value: unknown) => String(value || '').trim().replace(/^q/i, '')

/** 评分记录是否覆盖某道评分题目（大题级整题记录覆盖该大题全部小题） */
export const recordCoversQuestion = (recordQuestionNo: unknown, ref: FormalQuestionRef) => {
  const recordNo = normalizeResultQuestionNo(recordQuestionNo)
  if (!recordNo) return false
  if (recordNo === ref.questionNo) return true
  if (ref.topicHasSubs) {
    return !recordNo.includes('.') && recordNo === ref.questionNo.split('.')[0]
  }
  // 无小题大题的历史记录可能存成 N.1
  return recordNo === `${ref.questionNo}.1`
}

export const recordTime = (record: LocalGradingRecordItem) =>
  new Date(record.graded_at || record.updated_at || '').getTime() || 0

const numericScore = (value: unknown) => {
  const score = Number(value)
  return Number.isFinite(score) ? score : null
}

/** 按服务取最新记录后汇总：多服务分工评阅时分数相加、评语去重合并 */
export const aggregateRecords = (records: LocalGradingRecordItem[]) => {
  const byService = new Map<string, LocalGradingRecordItem>()
  records.forEach((record) => {
    const key = String(record.mcp_service_id ?? record.mcp_service_name ?? '')
    const previous = byService.get(key)
    if (!previous || recordTime(record) >= recordTime(previous)) byService.set(key, record)
  })
  const latest = [...byService.values()]
  const scores = latest.map((record) => numericScore(record.score)).filter((score): score is number => score !== null)
  const maxScores = latest
    .map((record) => numericScore(record.max_score))
    .filter((score): score is number => score !== null && score > 0)
  const comments = [...new Set(latest.map((record) => String(record.grading_desc || '').trim()).filter(Boolean))]
  const versions = latest.map((record) => Number(record.question_version_no || 0)).filter((value) => value > 0)
  return {
    score: scores.length ? Number(scores.reduce((sum, score) => sum + score, 0).toFixed(2)) : null,
    maxScore: maxScores.length ? Math.max(...maxScores) : null,
    comments,
    versionNo: versions.length ? Math.max(...versions) : null,
    records: latest
  }
}

/** 评分信封的 review_summary（服务返回的复核内容汇总）：新信封顶层字段；旧信封回退评语末尾的（复核提示：…） */
export const extractReviewSummaryText = (record: LocalGradingRecordItem): string => {
  let raw = record.mcp_raw_json
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { raw = null }
  }
  const summary = String((raw as any)?.review_summary || '').trim()
  if (summary) return summary
  const desc = String(record.grading_desc || '').trim()
  const hint = desc.match(/（复核提示：([\s\S]*?)）\s*$/)
  return hint ? hint[1].replace(/\s+/g, ' ').trim() : ''
}

/** 复核内容的题号标注：整题记录（无小题号）按第一小题标注，如 4 -> Q4.1 */
export const formatReviewQuestionLabel = (questionNo: unknown): string => {
  const no = String(questionNo || '').trim()
  return `Q${no.includes('.') ? no : `${no}.1`}`
}

/**
 * 「没交文件记0分」（正常业务结果）与「有文件但机器判不了」（真正转人工）
 * 的区分：考生在某道大题（含全部小题与大题本身）下没有任何答案结果文件时，
 * 评分服务对该大题给出的「需人工复核/转人工」标记属于没交文件的正常结果，
 * 不应再按转人工展示。归属数据缺失（没有该考生的抽取记录，或抽取结果里
 * 没有题目列表）时无法判断是否真的没交，保守返回 true（保留复核标记）。
 */
export const topicHasAssignmentFiles = (
  assignment: Record<string, any> | null | undefined,
  topic: FormalTopicNode | undefined,
  majorNo: string
): boolean => {
  const questions = assignment?.assignment_json?.student?.questions
  if (!Array.isArray(questions)) return true
  const subs = topic?.sub_question || []
  const probes: Array<{ questionNo: string; questionText: string }> = subs.length
    ? subs.map((sub, subIndex) => ({ questionNo: `${majorNo}.${subIndex + 1}`, questionText: String(sub.question || '') }))
    : []
  // 大题本身也查一次：归属结果可能把文件直接挂在大题号（如 Q3 / Q3_3DSMAX）下
  probes.push({ questionNo: majorNo, questionText: String(topic?.question || '') })
  return probes.some((probe) => getAssignmentQuestionFiles(assignment, probe.questionNo, probe.questionText).length > 0)
}

/** 某道评分题目的成绩：优先小题级记录，缺失时回退大题级整题记录 */
export const getQuestionGrade = (records: LocalGradingRecordItem[], ref: FormalQuestionRef): QuestionGrade | null => {
  const exact = records.filter((record) => normalizeResultQuestionNo(record.question_no) === ref.questionNo)
  const covering = exact.length
    ? exact
    : records.filter((record) => recordCoversQuestion(record.question_no, ref))
  if (!covering.length) return null
  const aggregated = aggregateRecords(covering)
  const wholeTopic = !exact.length
    && ref.topicHasSubs
    && covering.some((record) => !normalizeResultQuestionNo(record.question_no).includes('.'))
  return { ...aggregated, wholeTopic }
}

const topicLevelRecords = (records: LocalGradingRecordItem[], topic: FormalTopicNode, topicIndex: number) => {
  const hasSubs = (topic.sub_question || []).length > 0
  if (!hasSubs) {
    return records.filter((record) => recordCoversQuestion(record.question_no, {
      questionNo: String(topicIndex + 1),
      topicIndex,
      subIndex: -1,
      topicHasSubs: false
    }))
  }
  return records.filter((record) => normalizeResultQuestionNo(record.question_no) === String(topicIndex + 1))
}

/**
 * 大题成绩：各小题优先用自己的记录；没有记录的小题回退大题级整题记录，
 * 整题分数在大题内只计一次，避免把大题总分复制到每道小题导致翻倍。
 */
export const getTopicGrade = (
  records: LocalGradingRecordItem[],
  topics: FormalTopicNode[],
  topicIndex: number
): TopicGrade | null => {
  const topic = topics[topicIndex]
  if (!topic) return null
  const refs = topicQuestionRefs(topic, topicIndex)
  const hasSubs = (topic.sub_question || []).length > 0

  if (!hasSubs) {
    const aggregated = aggregateRecords(topicLevelRecords(records, topic, topicIndex))
    return {
      score: aggregated.score,
      maxScore: aggregated.maxScore,
      comments: aggregated.comments,
      wholeTopic: false,
      gradedCount: aggregated.score !== null ? 1 : 0,
      questionCount: 1
    }
  }

  let gradedCount = 0
  let score = 0
  let hasScore = false
  const coveredByExact = new Set<string>()
  refs.forEach((ref) => {
    const exact = records.filter((record) => normalizeResultQuestionNo(record.question_no) === ref.questionNo)
    if (!exact.length) return
    coveredByExact.add(ref.questionNo)
    gradedCount += 1
    const aggregated = aggregateRecords(exact)
    if (aggregated.score !== null) {
      score += aggregated.score
      hasScore = true
    }
  })
  const topicRecords = topicLevelRecords(records, topic, topicIndex)
  const topicAggregated = topicRecords.length ? aggregateRecords(topicRecords) : null
  const fallbackRefs = refs.filter((ref) => !coveredByExact.has(ref.questionNo))
  if (topicAggregated && fallbackRefs.length) {
    gradedCount += fallbackRefs.length
    if (topicAggregated.score !== null) {
      score += topicAggregated.score
      hasScore = true
    }
  }
  return {
    score: hasScore ? Number(score.toFixed(2)) : null,
    maxScore: topicAggregated?.maxScore ?? null,
    comments: topicAggregated?.comments || [],
    wholeTopic: Boolean(topicAggregated && fallbackRefs.length),
    gradedCount,
    questionCount: refs.length
  }
}

/** 考生的正式评阅汇总：已评题数按题目口径，总分按大题口径累计 */
export const summarizeStudentFormal = (
  records: LocalGradingRecordItem[],
  topics: FormalTopicNode[]
): StudentFormalSummary => {
  const refs = buildFormalQuestionRefs(topics)
  let gradedCount = 0
  refs.forEach((ref) => {
    if (getQuestionGrade(records, ref)) gradedCount += 1
  })
  let totalScore = 0
  let hasScore = false
  topics.forEach((_, topicIndex) => {
    const topicGrade = getTopicGrade(records, topics, topicIndex)
    if (topicGrade && topicGrade.score !== null) {
      totalScore += topicGrade.score
      hasScore = true
    }
  })
  return {
    totalScore: hasScore ? Number(totalScore.toFixed(2)) : null,
    gradedCount,
    questionCount: refs.length,
    complete: refs.length > 0 && gradedCount >= refs.length
  }
}

/** 阅卷标准题号 -> 满分（评分服务按标准内满分执行，优先级最高） */
export const buildStandardMaxScoreMap = (standards: any[], standardId?: number | string | null) => {
  const list = Array.isArray(standards) ? standards : []
  const target = standardId !== undefined && standardId !== null && String(standardId) !== ''
    ? list.find((standard) => Number(standard.standard_id) === Number(standardId))
    : null
  const source = target || list[list.length - 1]
  const map = new Map<string, number>()
  ;(source?.standard_items || []).forEach((item: any) => {
    const questionNo = normalizeResultQuestionNo(item.question_no)
    const score = Number(item.max_score)
    if (questionNo && Number.isFinite(score) && score > 0) {
      map.set(questionNo, Math.max(map.get(questionNo) || 0, score))
    }
  })
  return map
}

/**
 * 大题满分按阅卷标准汇总，保证整卷满分与试卷声明（如 100 分制）一致：
 * - 必做题：该大题全部小题的标准满分之和（含“背景资料”小题——它同样
 *   占用卷面分值，如第四大题 4.1+4.2=20 分）；
 * - 选做题（题干含“二选一/三选一”等）：考生只做其中一道，按单题最高
 *   满分计入，如第二大题 2 选 1 记 25 分、第三大题 3 选 1 记 20 分；
 * - 标准缺失时回退：题干声明的分值（“本题25分/共35分”）→ 大题级评分
 *   记录的满分 → 小题级评分记录满分之和。
 */
const ELECTIVE_TOPIC_PATTERN = /(?:[一二三四五]|\d+)\s*选一/

const isElectiveTopic = (topic: FormalTopicNode) => ELECTIVE_TOPIC_PATTERN.test(String(topic?.question || ''))

const parseDeclaredTopicScore = (topic: FormalTopicNode): number | null => {
  const matches = Array.from(String(topic?.question || '').matchAll(/(?<![A-Za-z0-9])(\d+(?:\.\d+)?)\s*分/g))
  if (!matches.length) return null
  const score = Number(matches[matches.length - 1][1])
  return Number.isFinite(score) && score > 0 ? score : null
}

export const getTopicMaxScore = (
  topics: FormalTopicNode[],
  topicIndex: number,
  allRecords: LocalGradingRecordItem[],
  maxScoreMap: Map<string, number>
) => {
  const topic = topics[topicIndex]
  if (!topic) return 0
  const refs = topicQuestionRefs(topic, topicIndex)
  const subs = topic.sub_question || []
  const subQuestionNos = subs.length
    ? subs.map((_, subIndex) => `${topicIndex + 1}.${subIndex + 1}`)
    : [String(topicIndex + 1)]
  const standardScores = subQuestionNos.map((questionNo) => Number(maxScoreMap.get(questionNo)))
  const knownScores = standardScores.filter((score) => Number.isFinite(score))
  if (knownScores.length && isElectiveTopic(topic)) {
    return Math.max(...knownScores)
  }
  if (subQuestionNos.length && standardScores.every((score) => Number.isFinite(score))) {
    return standardScores.reduce<number>((sum, score) => sum + (score || 0), 0)
  }
  const declaredScore = parseDeclaredTopicScore(topic)
  if (declaredScore !== null) return declaredScore
  const topicAggregated = aggregateRecords(topicLevelRecords(allRecords, topic, topicIndex))
  if (topicAggregated.maxScore) return topicAggregated.maxScore
  return refs.reduce<number>((sum, ref) => {
    const exact = allRecords.filter((record) => normalizeResultQuestionNo(record.question_no) === ref.questionNo)
    return sum + (aggregateRecords(exact).maxScore || 0)
  }, 0)
}

/** 整卷满分：各大题满分之和 */
export const getPaperMaxScore = (
  topics: FormalTopicNode[],
  allRecords: LocalGradingRecordItem[],
  maxScoreMap: Map<string, number>
) => topics.reduce<number>((sum, _, topicIndex) => sum + getTopicMaxScore(topics, topicIndex, allRecords, maxScoreMap), 0)

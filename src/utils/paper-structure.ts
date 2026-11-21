/**
 * 阅卷标准结构快照（paper_structure_json）的解析工具。
 *
 * 快照是教师保存阅卷标准时冻结的完整试卷结构（含新增题目与修正后的题干），
 * 上传/抽取/试阅/评阅/结果页显示试卷结构时优先用它；快照不可用的旧标准
 * 回退到空白卷（blank_paper_json），保持原有展示。
 */
import {
  getGradingStandardVersions,
  getLatestGradingStandard,
  type ExamGradingStandard
} from '@/api/teacher-scoring'

/** 快照是否可用：必须是带非空「大题」数组的完整结构 */
export const isValidPaperStructure = (
  structure?: Record<string, any> | null
): structure is Record<string, any> => {
  return Boolean(
    structure && Array.isArray((structure as any).大题) && (structure as any).大题.length
  )
}

/**
 * 从标准列表里解析可用的结构快照。
 * 优先级：任务绑定标准（preferredStandardId）> 版本号最高 > 其余；
 * 全部没有可用快照时返回 null（由调用方回退空白卷）。
 */
export const findStandardPaperStructure = (
  standards?: Array<ExamGradingStandard | null | undefined>,
  preferredStandardId?: number | string | null
): Record<string, any> | null => {
  const list = (standards || []).filter(Boolean) as ExamGradingStandard[]
  if (!list.length) return null
  const preferred =
    preferredStandardId !== undefined &&
    preferredStandardId !== null &&
    String(preferredStandardId) !== ''
      ? list.find((standard) => String(standard.standard_id) === String(preferredStandardId)) ||
        null
      : null
  const rest = list
    .filter((standard) => standard !== preferred)
    .sort((a, b) => Number(b.version_no || 0) - Number(a.version_no || 0))
  for (const standard of [preferred, ...rest].filter(Boolean) as ExamGradingStandard[]) {
    if (isValidPaperStructure(standard.paper_structure_json))
      return standard.paper_structure_json as Record<string, any>
  }
  return null
}

/**
 * 按科目/考试拉取最新标准的结构快照。
 * getLatestGradingStandard（阅卷标准编辑页回填快照用的同一接口）确认返回
 * paper_structure_json；任何失败都静默返回 null——快照缺失绝不能阻断主流程。
 */
export const loadLatestStandardStructure = async (
  subjectId: number | string,
  examId: number | string
): Promise<Record<string, any> | null> => {
  try {
    const response = await getLatestGradingStandard(subjectId, examId)
    if (isValidPaperStructure(response?.data?.paper_structure_json)) {
      return response.data.paper_structure_json as Record<string, any>
    }
  } catch {
    // 静默：快照缺失时由调用方回退空白卷
  }
  return null
}

/**
 * 按科目/考试拉取展示用结构快照（上传/抽取等没有现成标准列表的页面用）。
 * 指定标准版本时先按版本列表取该版本的快照；取不到（或未指定版本）时补拉
 * 最新标准兜底——版本列表接口是否返回快照字段由后端决定，latest 接口确认返回。
 * 任何失败都静默返回 null，绝不阻断上传/抽取主流程。
 */
export const loadDisplayStructure = async (
  subjectId: number | string,
  examId: number | string,
  preferredStandardId?: number | string | null
): Promise<Record<string, any> | null> => {
  if (
    preferredStandardId !== undefined &&
    preferredStandardId !== null &&
    String(preferredStandardId) !== ''
  ) {
    try {
      const versionsResponse = await getGradingStandardVersions(subjectId, examId)
      const found = findStandardPaperStructure(versionsResponse?.data, preferredStandardId)
      if (found) return found
    } catch {
      // 静默，落到最新标准兜底
    }
  }
  return loadLatestStandardStructure(subjectId, examId)
}

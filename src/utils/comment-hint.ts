/**
 * 评语末尾“复核提示”的解析约定。
 *
 * 平台保存评分记录时，若服务信封 needs_review 非空，会把提示文本以
 * “（复核提示：…）”追加在评语末尾（另起一行）。展示评语时用本工具分段：
 * 正文正常显示，复核提示部分标红，让教师一眼区分评分说明与复核原因。
 */
const HINT_MARKER = '（复核提示：'

export type CommentSegment = { text: string; hint: boolean }

export const splitCommentHint = (text?: string | null): CommentSegment[] => {
  const value = String(text || '')
  const index = value.indexOf(HINT_MARKER)
  if (index < 0) {
    return value ? [{ text: value, hint: false }] : []
  }
  const segments: CommentSegment[] = []
  const main = value.slice(0, index).trimEnd()
  if (main) segments.push({ text: main, hint: false })
  const hint = value.slice(index).trim()
  if (hint) segments.push({ text: hint, hint: true })
  return segments
}

import type { ExamPackageItem } from '@/api/teacher-scoring'

export type PackageParseState = 'success' | 'pending' | 'failed'

export function getPackageParseState(item: ExamPackageItem): PackageParseState {
  if (item.parse_state) return item.parse_state
  if (item.parse_error) return 'failed'
  return item.extract_path ? 'success' : 'pending'
}

export function getPackageParseLabel(item: ExamPackageItem) {
  const state = getPackageParseState(item)
  if (state === 'success') return '解析成功'
  if (state === 'failed') return '解析失败'
  return '解析中'
}

export function formatPackageUploadedAt(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

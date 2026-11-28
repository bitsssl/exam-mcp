import { getExams, getLocalPackage, getSubjects } from '@/api/teacher-scoring'

/** 包名展示名里的“（解析于 …）”时间戳后缀：标题括号里不需要重复时间信息 */
export const stripParseTimestampSuffix = (value: string | undefined | null) =>
  String(value || '')
    .replace(/（解析于\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}）$/, '')
    .trim()

const nameCache = new Map<string, string>()
// 进行中的请求共享：多个页面同时挂载时只发一次请求，
// 后来的直接等同一个结果——避免拿到占位空串导致上下文显示不全
const inflight = new Map<string, Promise<string>>()

const cachedOrFetch = async (key: string, loader: () => Promise<string>): Promise<string> => {
  const cached = nameCache.get(key)
  if (cached) return cached
  const existing = inflight.get(key)
  if (existing) return existing
  const promise = (async () => {
    try {
      const value = await loader()
      // 成功才缓存；失败的空值不缓存，下次挂载自动重试
      if (value) nameCache.set(key, value)
      return value
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, promise)
  return promise
}

/**
 * 按科目/考试/试卷包 ID 解析展示名称（科目名、考试名、试卷包名）。
 * 名称按 ID 缓存：多个页面多次挂载不重复请求。
 */
export async function fetchScoringContextNames(
  subjectId: number | string | undefined,
  examId: number | string | undefined,
  packageId: number | string | undefined
): Promise<{ subjectName: string; examName: string; packageName: string }> {
  const sid = String(subjectId ?? '').trim()
  const eid = String(examId ?? '').trim()
  const pid = String(packageId ?? '').trim().replace(/^local_/, '')

  const subjectName = sid
    ? await cachedOrFetch(`subject:${sid}`, async () => {
      const response = await getSubjects()
      if (![0, 200].includes(response.code)) return ''
      return String(
        (response.data || []).find((subject: any) => String(subject.subject_id) === sid)?.subject_name || ''
      )
    })
    : ''

  const examName = sid && eid
    ? await cachedOrFetch(`exam:${sid}:${eid}`, async () => {
      const response = await getExams(sid)
      if (![0, 200].includes(response.code)) return ''
      return String((response.data || []).find((exam: any) => String(exam.id ?? exam.exam_id ?? '') === eid)?.exam_name || '')
    })
    : ''

  const packageName = sid && eid && pid
    ? stripParseTimestampSuffix(
      await cachedOrFetch(`package:${sid}:${eid}:${pid}`, async () => {
        const response = await getLocalPackage(sid, eid, pid, { quiet404: true } as any)
        if (![0, 200].includes(response.code)) return ''
        return String(response.data?.package_name || '')
      })
    )
    : ''

  return { subjectName, examName, packageName }
}

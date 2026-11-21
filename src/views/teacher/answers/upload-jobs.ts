import { shallowRef } from 'vue'
import type { ExamPackageItem } from '@/api/teacher-scoring'
import { parseAnswerUpload, uploadAnswerPackage } from '@/api/teacher-scoring'
import type { PackageUploadRequest } from './upload-types'
import { notifyAnswerUploadsChanged } from './answer-upload-events'
import { loadDisplayStructure } from '@/utils/paper-structure'

export type UploadParseState = 'uploading' | 'uploaded' | 'pending' | 'parsing' | 'success' | 'failed'
export type UploadJob = Omit<ExamPackageItem, 'parse_state'> & {
  parse_state: UploadParseState
  parse_error?: string
  upload_id?: number
}

export const uploadJobs = shallowRef<UploadJob[]>([])

export function startPackageUpload(request: PackageUploadRequest, onFinished: (error?: string, phase?: 'uploaded' | 'parsed') => void) {
  const jobId = `upload_${Date.now()}_${Math.random().toString(16).slice(2)}`
  const job: UploadJob = {
    package_id: jobId,
    package_name: request.packageName,
    file_path: '',
    subject_id: Number(request.subjectId),
    subject_no: request.subjectNo,
    subject_name: request.subjectName,
    exam_id: Number(request.examId),
    exam_name: request.examName,
    uploaded_at: new Date().toISOString(),
    parse_state: 'uploading'
  }
  uploadJobs.value = [job, ...uploadJobs.value]

  window.setTimeout(() => void saveUpload(jobId, request, onFinished), 0)
}

async function saveUpload(jobId: string, request: PackageUploadRequest, onFinished: (error?: string, phase?: 'uploaded' | 'parsed') => void) {
  try {
    const response = await uploadAnswerPackage({ subjectId: request.subjectId, examId: request.examId, packageName: request.packageName, files: request.files, folderPaths: request.folderPaths })
    const uploadId = response?.data?.upload_id
    updateJob(jobId, { parse_state: 'pending', upload_id: uploadId })
    onFinished(undefined, 'uploaded')
    notifyAnswerUploadsChanged()
    if (!uploadId) throw new Error('上传成功但未返回上传记录ID，无法启动试卷解析')
    updateJob(jobId, { parse_state: 'parsing' })
    notifyAnswerUploadsChanged()
    // 解析请求带上阅卷标准结构快照（含教师新增/修正的题目），后端优先按快照
    // 识别结构；快照取不到就不传，解析按原有逻辑执行，绝不因此阻断上传。
    const paperStructure = await loadDisplayStructure(request.subjectId, request.examId)
    await parseAnswerUpload(uploadId, paperStructure ? { paper_structure_json: paperStructure } : undefined)
    updateJob(jobId, { parse_state: 'success' })
    notifyAnswerUploadsChanged()
    onFinished(undefined, 'parsed')
  } catch (error: any) {
    const message = error?.response?.data?.message || error?.message || '试卷包上传或解析失败'
    updateJob(jobId, { parse_state: 'failed', parse_error: message })
    notifyAnswerUploadsChanged()
    onFinished(message, 'parsed')
  }
}

function updateJob(jobId: string, patch: Partial<UploadJob>) {
  uploadJobs.value = uploadJobs.value.map((job) => job.package_id === jobId ? { ...job, ...patch } : job)
}

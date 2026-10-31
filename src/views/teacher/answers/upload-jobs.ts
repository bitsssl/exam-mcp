import { shallowRef } from 'vue'
import type { ExamPackageItem } from '@/api/teacher-scoring'
import { createLocalPackageFromFolder } from '@/utils/local-scoring-package'
import type { PackageUploadRequest } from './upload-types'

export type UploadParseState = 'pending' | 'success' | 'failed'
export type UploadJob = ExamPackageItem & {
  parse_state: UploadParseState
  parse_error?: string
}

export const uploadJobs = shallowRef<UploadJob[]>([])

export function startPackageUpload(request: PackageUploadRequest, onFinished: () => void) {
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
    parse_state: 'pending'
  }
  uploadJobs.value = [job, ...uploadJobs.value]

  // Let Vue render the pending row and close the drawer before hashing, uploading,
  // converting documents, or parsing the package.
  window.setTimeout(() => void processUpload(jobId, request, onFinished), 0)
}

async function processUpload(jobId: string, request: PackageUploadRequest, onFinished: () => void) {
  try {
    const result = await createLocalPackageFromFolder(
      request.subjectId,
      request.examId,
      request.packageName,
      request.files,
      request.folderPaths,
      { blankPaper: request.blankPaper }
    )
    updateJob(jobId, {
      parse_state: 'success',
      local_package_id: result.local_package_id,
      package_id: result.local_package_id ? `local_${result.local_package_id}` : result.package_id,
      student_count: result.students.length,
      extract_path: 'parsed'
    })
    onFinished()
  } catch (error: any) {
    const message = error?.response?.data?.message || error?.message || '试卷包解析失败'
    updateJob(jobId, { parse_state: 'failed', parse_error: message })
  }
}

function updateJob(jobId: string, patch: Partial<UploadJob>) {
  uploadJobs.value = uploadJobs.value.map((job) => job.package_id === jobId ? { ...job, ...patch } : job)
}

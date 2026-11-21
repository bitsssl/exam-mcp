export interface PackageUploadRequest {
  subjectId: string
  examId: string
  packageName: string
  files: File[]
  folderPaths: string[]
  subjectName: string
  subjectNo: string
  examName: string
}

export interface AnswerUploadItem {
  upload_id: number
  package_name: string
  subject_id: number
  subject_no?: string
  subject_name: string
  exam_id: number
  exam_name: string
  status: 'uploaded' | 'parsing' | 'parsed' | 'failed' | string
  parse_error?: string | null
  assignment_status: 'pending' | 'extracting' | 'extracted' | 'failed' | string
  assignment_error?: string | null
  local_package_id?: number | null
  uploaded_at: string
}

export type AnswerUploadDisplayItem = AnswerUploadItem | import('./upload-jobs').UploadJob

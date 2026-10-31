export interface PackageUploadRequest {
  subjectId: string
  examId: string
  packageName: string
  files: File[]
  folderPaths: string[]
  blankPaper?: File
  subjectName: string
  subjectNo: string
  examName: string
}

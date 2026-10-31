import api from './index';
import { apiPrefix } from './index';

export interface SubjectItem {
  subject_id: number;
  subject_no: string;
  subject_name: string;
  creator_id: number;
  created_at: string;
  remark?: string;
}

export interface CreateSubjectPayload {
  subject_no: string;
  subject_name: string;
  created_at: string;
  remark?: string;
}

export type UpdateSubjectPayload = CreateSubjectPayload;

export interface ExamItem {
  id: number;
  subject_id: number;
  subject_no?: string;
  subject_name?: string;
  exam_name: string;
  exam_time?: string;
  answer_key_path?: string;
  blank_paper_path?: string;
  creator_id: number;
}

export interface CreateExamPayload {
  exam_name: string;
  exam_time?: string;
  blank_paper?: File;
  answer_key?: File;
}

export type UpdateExamPayload = CreateExamPayload;

export interface ExamPackageItem {
  package_id: number | string;
  local_package_id?: number;
  isLocal?: boolean;
  student_count?: number;
  exam_id: number;
  package_name: string;
  file_path: string;
  extract_path?: string;
  uploaded_at?: string;
  subject_id?: number;
  subject_no?: string;
  subject_name?: string;
  exam_name?: string;
  parse_state?: 'pending' | 'success' | 'failed';
  parse_error?: string;
}

export interface AnswerSheetItem {
  answer_id: number;
  student_no: string;
  exam_id: number;
  package_id?: number;
  upload_type: string;
  file_path?: string;
  text_content?: string;
  answer_json?: StudentAnswerJson;
  uploaded_at?: string;
}

export interface StudentSubQuestionJson {
  question?: string;
  answer?: string;
  images?: string[];
  answer_files?: Record<string, any> | Array<Record<string, any>>;
  score?: number | string;
  comment?: string;
  [key: string]: any;
}

export interface StudentQuestionJson {
  question?: string;
  answer?: string;
  images?: string[];
  sub_question?: StudentSubQuestionJson[];
  answer_files?: Record<string, any> | Array<Record<string, any>>;
  score?: number | string;
  comment?: string;
  [key: string]: any;
}

export interface StudentAnswerJson {
  id?: string | number;
  studentId?: string | number;
  student_no?: string | number;
  studentNo?: string | number;
  total_score?: number | string;
  result?: StudentQuestionJson[];
  [key: string]: any;
}

export interface GradingPayload {
  subject_id?: string | number;
  exam_id?: string | number;
  local_package_id?: string | number;
  package_fingerprint?: string;
  quick_fingerprint?: string;
  student_no_hash?: string;
  question_no?: string;
  question_label?: string;
  grading_mode?: string;
  is_trial?: boolean;
  service_uuid: string | number;
  student_no: string;
  question_text: string;
  answer_text?: string;
  max_score?: number | string | null;
  // 多服务分工评阅：按评分标准中各部分满分评分，不按题目总满分截断
  multi_service?: boolean;
  standard_id?: number;
  standard_version_no?: number;
  question_version_no?: number;
  template_id?: number;
  template_name?: string;
  standard_label?: string;
  image?: File | Blob;
  image_name?: string;
}

export interface GradingResult {
  status: string;
  student_no: string;
  service_uuid: string | number;
  // 多选 MCP 逐个调用时，前端补充的当前服务名称
  mcp_service_name?: string;
  image_name?: string;
  question_no?: string;
  question_label?: string;
  grading_mode?: string;
  question_text: string;
  answer_text?: string;
  max_score?: number | string | null;
  result: any;
  grading_record?: LocalGradingRecordItem;
  save_error?: string;
}

export interface BatchGradingTarget {
  key: string;
  question_no?: string;
  service_uuid: string | number;
  student_no: string;
  question_label: string;
  question_text: string;
  answer_text?: string;
  max_score?: number | string | null;
  // 多服务分工评阅：按评分标准中各部分满分评分，不按题目总满分截断
  multi_service?: boolean;
  standard_id?: number;
  standard_version_no?: number;
  question_version_no?: number;
  template_id?: number;
  template_name?: string;
  standard_label?: string;
  image?: File | Blob;
  image_name?: string;
  sub_questions?: BatchGradingSubQuestion[];
}

export interface BatchGradingSubQuestion {
  key?: string;
  question_no: string;
  question_label?: string;
  question_text: string;
  answer_text?: string;
  max_score?: number | string | null;
  standard_id?: number;
  standard_version_no?: number;
  question_version_no?: number;
  template_id?: number;
  template_name?: string;
  standard_label?: string;
}

export interface BatchGradingPayload {
  subject_id?: string | number;
  exam_id?: string | number;
  local_package_id?: string | number;
  package_fingerprint?: string;
  quick_fingerprint?: string;
  student_no_hash?: string;
  is_trial?: boolean;
  mode: string;
  targets: BatchGradingTarget[];
}

export interface BatchGradingResult {
  status: string;
  mode: string;
  total: number;
  success_count: number;
  failed_count: number;
  results: Array<GradingResult & {
    key: string;
    question_label: string;
    error?: string;
  }>;
}

export interface AnswerFileItem {
  id: number;
  answer_id: number;
  exam_id: number;
  package_id: number;
  student_no: string;
  file_name: string;
  file_path?: string;
  file_type: string;
  relative_path: string;
  file_size?: number;
  created_at?: string;
}

export interface GradingStandardItem {
  item_id?: number;
  question_no: string;
  question_type: string;
  mcp_service_id: string | number;
  mcp_service_name?: string;
  question_text?: string;
  reference_answer?: string;
  grading_criteria?: string;
  question_version_no?: number;
  source_standard_version_no?: number;
  mcp_params?: Record<string, any>;
  max_score?: number;
  remark?: string;
}

export interface CreateGradingStandardPayload {
  standard_id?: number;
  standard_items: GradingStandardItem[];
  remark?: string;
}

export interface ExamGradingStandard {
  standard_id: number;
  subject_id: number;
  exam_id: number;
  creator_id: number;
  version_no: number;
  standard_items: GradingStandardItem[];
  remark?: string;
  created_at?: string;
  updated_at?: string;
}
export interface GradingTemplateItem {
  question_no: string;
  standard_id: number;
  standard_version_no?: number;
  question_version_no?: number;
  standard_item?: GradingStandardItem;
}

export interface CreateGradingTemplatePayload {
  template_name: string;
  description?: string;
  template_items: Array<{
    question_no: string;
    standard_id: number;
    item_id?: number;
  }>;
}

export interface ExamGradingTemplate {
  template_id: number;
  subject_id: number;
  exam_id: number;
  creator_id: number;
  template_name: string;
  template_items: GradingTemplateItem[];
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExamGradingTask {
  task_id: number;
  subject_id: number;
  subject_no?: string;
  subject_name?: string;
  exam_id: number;
  exam_name?: string;
  local_package_id: number;
  package_name: string;
  student_count: number;
  package_fingerprint?: string;
  standard_id: number;
  template_id: number;
  template_name: string;
  template_items: GradingTemplateItem[];
  created_at?: string;
}

export interface CreateExamGradingTaskPayload {
  subject_id: number | string;
  exam_id: number | string;
  local_package_id: number | string;
  standard_id: number | string;
  template_id: number | string;
}
export interface LocalPackageRegisterPayload {
  package_name: string;
  package_fingerprint: string;
  quick_fingerprint?: string;
  file_fingerprint?: string;
  probe?: boolean;
  folder_name?: string;
  json_file_name?: string;
  json_file_size?: number;
  student_count: number;
  image_count: number;
  word_document_count?: number;
  total_file_size?: number;
  total_image_size?: number;
  total_word_size?: number;
  student_no_hash?: string;
  structure_summary?: Record<string, any>;
  answer_index?: Array<Record<string, any>>;
  file_manifest?: Array<Record<string, any>>;
  parsed_students?: StudentAnswerJson[];
  parsed_image_manifest?: Array<Record<string, any>>;
  reference_answers?: Array<Record<string, any>>;
  blank_paper_json?: Record<string, any>;
  answer_key_json?: Record<string, any>;
  source_token?: string;
}

export interface LocalPackageItem extends LocalPackageRegisterPayload {
  local_package_id: number;
  package_id: string;
  subject_id: number;
  exam_id: number;
  creator_id: number;
  status: string;
  created_at?: string;
  updated_at?: string;
  isLocal: true;
}

export interface ProcessedLocalPackageData {
  source_token: string;
  students: StudentAnswerJson[];
  students_json?: string;
  images?: Array<Record<string, any>>;
  supporting_files?: {
    answer_key_name?: string | null;
    blank_paper_name?: string | null;
  };
  reference_answers?: Array<Record<string, any>>;
  blank_paper_json?: Record<string, any> | null;
  answer_key_json?: Record<string, any> | null;
  answer_key_document?: Record<string, any> | null;
  blank_paper_document?: Record<string, any> | null;
  blank_student_count?: number;
  structure_serialized?: boolean;
  parse_report?: ParseReportSummary;
}

// ===== 解析报告与结构预检（解析通用化 · 前端接入） =====

export interface ParseReportSummary {
  candidateCount: number;
  blankCandidateCount: number;
  questionCount: number;
  structureSource?: string | null;
  matchedLayout?: string | null;
}

export interface ParseReportData {
  schemaVersion?: string;
  summary: ParseReportSummary;
  files: {
    answerKey?: string | null;
    blankPaper?: string | null;
    ignoredAttachmentCount?: number;
    ignoredAttachments?: string[];
  };
  issues: {
    missingMaxScoreQuestions?: string[];
    missingMaxScoreCount?: number;
    misalignedAnswerCount?: number;
    misalignedAnswers?: Array<{ candidateId: string; questionNo: string }>;
    candidatesWithUnassignedFiles?: number;
    emptyFolderCandidateCount?: number;
    emptyFolderCandidates?: string[];
    structureWarnings?: string[];
    recognitionError?: string | null;
  };
}

export interface StructurePreviewResult {
  status: 'success' | 'error';
  error?: string;
  expected?: string;
  tree_preview?: string[];
  manifest?: {
    schemaVersion?: string;
    roleSource?: string;
    files?: {
      answerKey?: string | null;
      blankPaper?: string | null;
      ignored?: string[];
    };
    candidates?: {
      mode?: string;
      root?: string;
      resolved?: Array<{
        candidateId: string;
        answerRoot: string;
        isBlank: boolean;
        answerFiles?: Array<{ relativePath: string; fileName: string }>;
      }>;
    };
  };
  diagnostics?: {
    matchedLayout?: string;
    candidateCount?: number;
    blankCount?: number;
    answerKeyFound?: boolean;
    ignoredCount?: number;
  };
  parse_report?: ParseReportData;
}

export interface LocalGradingRecordPayload {
  student_no: string;
  question_no: string;
  question_label?: string;
  grading_mode?: string;
  template_id?: number;
  template_name?: string;
  standard_label?: string;
  mcp_service_id?: string | number;
  mcp_service_name?: string;
  standard_id?: number;
  standard_version_no?: number;
  question_version_no?: number;
  score?: number | string | null;
  max_score?: number | string | null;
  grading_desc?: string;
  question_text?: string;
  answer_text?: string;
  image_name?: string;
  result?: any;
  is_trial?: boolean;
}

export interface LocalGradingRecordItem extends LocalGradingRecordPayload {
  record_id: number;
  local_package_id: number;
  package_id: string;
  subject_id: number;
  exam_id: number;
  package_fingerprint: string;
  mcp_raw_json?: any;
  graded_at?: string;
  updated_at?: string;
  round_note?: string | null;
  round_starred?: boolean;
  creator_name?: string;
}
export interface CreatePackagePayload {
  package_name: string;
  package_file: File;
  blank_paper?: File;
}

export async function getSubjects(keyword = '') {
  const response = await api.get(`${apiPrefix}/teacher-scoring/subjects`, {
    params: keyword ? { keyword } : {}
  });
  return response.data;
}

export async function getSubject(subjectId: number | string) {
  const response = await api.get(`${apiPrefix}/teacher-scoring/subjects/${subjectId}`);
  return response.data;
}

export async function createSubject(data: CreateSubjectPayload) {
  const response = await api.post(`${apiPrefix}/teacher-scoring/subjects`, data);
  return response.data;
}

export async function updateSubject(subjectId: number | string, data: UpdateSubjectPayload) {
  const response = await api.put(`${apiPrefix}/teacher-scoring/subjects/${subjectId}`, data);
  return response.data;
}

export async function deleteSubject(subjectId: number | string) {
  const response = await api.delete(`${apiPrefix}/teacher-scoring/subjects/${subjectId}`);
  return response.data;
}

export async function getExams(subjectId: number | string, keyword = '') {
  const response = await api.get(`${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams`, {
    params: keyword ? { keyword } : {}
  });
  return response.data;
}

export async function getAllExams(keyword = '') {
  const response = await api.get(`${apiPrefix}/teacher-scoring/exams`, {
    params: keyword ? { keyword } : {}
  });
  return response.data;
}

export async function createExam(subjectId: number | string, data: CreateExamPayload) {
  const formData = new FormData();
  formData.append('exam_name', data.exam_name);
  if (data.exam_time) {
    formData.append('exam_time', data.exam_time);
  }
  if (data.blank_paper) {
    formData.append('blank_paper', data.blank_paper);
  }
  if (data.answer_key) {
    formData.append('answer_key', data.answer_key);
  }

  const response = await api.post(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  );
  return response.data;
}

export async function getExam(subjectId: number | string, examId: number | string) {
  const response = await api.get(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}`
  );
  return response.data;
}

export async function updateExam(
  subjectId: number | string,
  examId: number | string,
  data: UpdateExamPayload
) {
  const formData = new FormData();
  formData.append('exam_name', data.exam_name);
  if (data.exam_time) {
    formData.append('exam_time', data.exam_time);
  }
  if (data.blank_paper) {
    formData.append('blank_paper', data.blank_paper);
  }
  if (data.answer_key) {
    formData.append('answer_key', data.answer_key);
  }

  const response = await api.put(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    }
  );
  return response.data;
}

export async function deleteExam(subjectId: number | string, examId: number | string) {
  const response = await api.delete(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}`
  );
  return response.data;
}

export async function getLatestGradingStandard(
  subjectId: number | string,
  examId: number | string
) {
  const response = await api.get(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/grading-standards`
  );
  return response.data;
}

export async function createGradingStandard(
  subjectId: number | string,
  examId: number | string,
  data: CreateGradingStandardPayload
) {
  const response = await api.post(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/grading-standards`,
    data
  );
  return response.data;
}

export async function updateGradingStandard(
  subjectId: number | string,
  examId: number | string,
  standardId: number | string,
  data: CreateGradingStandardPayload
) {
  const response = await api.put(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/grading-standards/${standardId}`,
    data
  );
  return response.data;
}

export async function getGradingStandardVersions(
  subjectId: number | string,
  examId: number | string
) {
  const response = await api.get(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/grading-standards/versions`
  );
  return response.data;
}

export async function deleteGradingStandard(
  subjectId: number | string,
  examId: number | string,
  standardId: number | string
) {
  const response = await api.delete(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/grading-standards/${standardId}`
  );
  return response.data;
}

export async function getGradingTemplates(
  subjectId: number | string,
  examId: number | string
) {
  const response = await api.get(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/grading-templates`
  );
  return response.data;
}

export async function getGradingTasks() {
  const response = await api.get(`${apiPrefix}/teacher-scoring/grading-tasks`);
  return response.data;
}

export async function createGradingTask(data: CreateExamGradingTaskPayload) {
  const response = await api.post(`${apiPrefix}/teacher-scoring/grading-tasks`, data);
  return response.data;
}

export async function createGradingTemplate(
  subjectId: number | string,
  examId: number | string,
  data: CreateGradingTemplatePayload
) {
  const response = await api.post(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/grading-templates`,
    data
  );
  return response.data;
}

export async function updateGradingTemplate(
  subjectId: number | string,
  examId: number | string,
  templateId: number | string,
  data: CreateGradingTemplatePayload
) {
  const response = await api.put(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/grading-templates/${templateId}`,
    data
  );
  return response.data;
}

export async function deleteGradingTemplate(
  subjectId: number | string,
  examId: number | string,
  templateId: number | string
) {
  const response = await api.delete(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/grading-templates/${templateId}`
  );
  return response.data;
}

export async function copyGradingTemplate(
  subjectId: number | string,
  examId: number | string,
  templateId: number | string,
  data: { target_exam_id: number | string; template_name?: string }
) {
  const response = await api.post(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/grading-templates/${templateId}/copy`,
    data
  );
  return response.data;
}
export async function registerLocalPackage(
  subjectId: number | string,
  examId: number | string,
  data: LocalPackageRegisterPayload
) {
  const response = await api.post(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/local-packages`,
    data,
    {
      // 登记请求携带完整学生 JSON（可达几十 MB），放宽超时避免默认 10 秒中断。
      timeout: 5 * 60 * 1000
    }
  );
  return response.data;
}

export async function processLocalPackageFiles(
  subjectId: number | string,
  examId: number | string,
  packageName: string,
  files: File[],
  folderPaths: string[] = [],
  supporting: { blankPaper?: File; answerKey?: File } = {},
  pathResolver?: (file: File) => string
) {
  const normalizeUploadPath = (value: string) => {
    const normalized = String(value || '').replace(/\\/g, '/');
    const parts = normalized.split('/').filter((part) => part && part !== '.' && part !== '..');
    // File System Access API 的 fullPath 在某些浏览器会带“/”，只保留
    // 相对根目录，避免把绝对路径传给后端安全校验。
    return parts.join('/');
  };
  const normalizedFolderPaths = folderPaths
    .map(normalizeUploadPath)
    .filter(Boolean);
  const formData = new FormData();
  formData.append('package_name', packageName);
  formData.append('folder_paths', JSON.stringify(normalizedFolderPaths));
  formData.append(
    'file_paths',
    JSON.stringify(files.map((file) => (
      normalizeUploadPath(pathResolver?.(file) || (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name)
    )))
  );
  files.forEach((file) => {
    const relativePath = normalizeUploadPath(
      pathResolver?.(file) || (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    );
    formData.append('files', file, relativePath);
  });
  if (supporting.blankPaper) formData.append('blank_paper', supporting.blankPaper);
  if (supporting.answerKey) formData.append('answer_key', supporting.answerKey);

  const response = await api.post(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/local-packages/process`,
    formData,
    {
      // .doc 考生文档需逐个经 Word COM 转换（约 3-4 秒/个），
      // 数百考生的大试卷包转换可达数十分钟，超时设为 1 小时。
      timeout: 60 * 60 * 1000
    }
  );
  return response.data as {
    code: number;
    message: string;
    data: ProcessedLocalPackageData;
  };
}

export async function getLocalPackage(
  subjectId: number | string,
  examId: number | string,
  localPackageId: number | string,
  options: { quiet404?: boolean } = {}
) {
  const response = await api.get(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/local-packages/${localPackageId}`,
    options.quiet404 ? { quiet404: true } as any : undefined
  );
  return response.data;
}

export async function getLocalPackageStructure(
  subjectId: number | string,
  examId: number | string,
  localPackageId: number | string
) {
  const response = await api.get(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/local-packages/${localPackageId}/structure`,
    { timeout: 60000 }
  );
  return response.data as { code: number; message?: string; data: StructurePreviewResult };
}

export async function importLocalPackageReferenceAnswers(
  subjectId: number | string,
  examId: number | string,
  localPackageId: number | string
) {
  const response = await api.post(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/local-packages/${localPackageId}/reference-answers/import`,
    {},
    {
      timeout: 5 * 60 * 1000
    }
  );
  return response.data;
}

export async function deleteLocalPackageHistory(
  subjectId: number | string,
  examId: number | string,
  localPackageId: number | string
) {
  const response = await api.delete(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/local-packages/${localPackageId}`
  );
  return response.data;
}

export async function getLocalGradingRecords(
  subjectId: number | string,
  examId: number | string,
  localPackageId: number | string,
  params: { student_no?: string; question_no?: string } = {}
) {
  const response = await api.get(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/local-packages/${localPackageId}/grading-records`,
    {
      params,
      // 历史评分记录可能包含较大的题干、答案和 MCP 原始结果，
      // 单独放宽读取超时，避免默认 10 秒影响试卷包详情页加载。
      timeout: 30000
    }
  );
  return response.data;
}

export async function updateLocalGradingRound(
  subjectId: number | string,
  examId: number | string,
  localPackageId: number | string,
  data: { record_ids: number[]; note?: string | null; starred?: boolean }
) {
  const response = await api.post(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/local-packages/${localPackageId}/grading-records/round-update`,
    data
  );
  return response.data;
}

export async function deleteLocalGradingRecords(
  subjectId: number | string,
  examId: number | string,
  localPackageId: number | string,
  recordIds: number[]
) {
  const response = await api.post(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/local-packages/${localPackageId}/grading-records/batch-delete`,
    { record_ids: recordIds }
  );
  return response.data;
}

export async function saveLocalGradingRecords(
  subjectId: number | string,
  examId: number | string,
  localPackageId: number | string,
  records: LocalGradingRecordPayload[]
) {
  const response = await api.post(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/local-packages/${localPackageId}/grading-records`,
    { records }
  );
  return response.data;
}
export async function getPackages(
  subjectId: number | string,
  examId: number | string,
  keyword = ''
) {
  const response = await api.get(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/packages`,
    {
      params: keyword ? { keyword } : {}
    }
  );
  return response.data;
}

export async function getAllPackages(params: {
  keyword?: string;
  subject_id?: number;
  exam_id?: number;
} = {}) {
  const response = await api.get(`${apiPrefix}/teacher-scoring/packages`, { params });
  return response.data;
}

export async function createPackage(
  subjectId: number | string,
  examId: number | string,
  data: CreatePackagePayload
) {
  const formData = new FormData();
  formData.append('package_name', data.package_name);
  formData.append('package_file', data.package_file);
  if (data.blank_paper) formData.append('blank_paper', data.blank_paper);

  const response = await api.post(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/packages`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 0
    }
  );
  return response.data;
}

export async function getPackage(
  subjectId: number | string,
  examId: number | string,
  packageId: number | string
) {
  const response = await api.get(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/packages/${packageId}`
  );
  return response.data;
}

export async function deletePackage(
  subjectId: number | string,
  examId: number | string,
  packageId: number | string
) {
  const response = await api.delete(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/packages/${packageId}`
  );
  return response.data;
}

export async function getAnswerSheets(
  subjectId: number | string,
  examId: number | string,
  packageId: number | string
) {
  const response = await api.get(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/packages/${packageId}/answers`
  );
  return response.data;
}

export async function getAnswerFiles(
  subjectId: number | string,
  examId: number | string,
  packageId: number | string,
  answerId: number | string
) {
  const response = await api.get(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/packages/${packageId}/answers/${answerId}/files`
  );
  return response.data;
}

export async function getAnswerImageBlob(
  subjectId: number | string,
  examId: number | string,
  packageId: number | string,
  answerId: number | string,
  fileId: number | string
) {
  const response = await api.get(
    `${apiPrefix}/teacher-scoring/subjects/${subjectId}/exams/${examId}/packages/${packageId}/answers/${answerId}/files/${fileId}`,
    {
      responseType: 'blob'
    }
  );
  return response.data as Blob;
}

export async function gradeWithMcp(data: GradingPayload) {
  const formData = new FormData();
  if (data.subject_id !== undefined) formData.append('subject_id', String(data.subject_id));
  if (data.exam_id !== undefined) formData.append('exam_id', String(data.exam_id));
  if (data.local_package_id !== undefined) formData.append('local_package_id', String(data.local_package_id));
  if (data.package_fingerprint) formData.append('package_fingerprint', data.package_fingerprint);
  if (data.quick_fingerprint) formData.append('quick_fingerprint', data.quick_fingerprint);
  if (data.student_no_hash) formData.append('student_no_hash', data.student_no_hash);
  if (data.question_no) formData.append('question_no', data.question_no);
  if (data.question_label) formData.append('question_label', data.question_label);
  if (data.grading_mode) formData.append('grading_mode', data.grading_mode);
  if (data.is_trial !== undefined) formData.append('is_trial', data.is_trial ? '1' : '0');
  formData.append('service_uuid', String(data.service_uuid));
  formData.append('student_no', data.student_no);
  formData.append('question_text', data.question_text);
  if (data.answer_text) {
    formData.append('answer_text', data.answer_text);
  }
  if (data.max_score !== undefined && data.max_score !== null && data.max_score !== '') {
    formData.append('max_score', String(data.max_score));
  }
  if (data.multi_service) formData.append('multi_service', '1');
  if (data.standard_id !== undefined) formData.append('standard_id', String(data.standard_id));
  if (data.standard_version_no !== undefined) formData.append('standard_version_no', String(data.standard_version_no));
  if (data.question_version_no !== undefined) formData.append('question_version_no', String(data.question_version_no));
  if (data.template_id !== undefined) formData.append('template_id', String(data.template_id));
  if (data.template_name) formData.append('template_name', data.template_name);
  if (data.standard_label) formData.append('standard_label', data.standard_label);
  if (data.image) {
    formData.append('image', data.image, data.image_name || 'answer-image.png');
  }

  const response = await api.post(`${apiPrefix}/teacher-scoring/grade-with-mcp`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    timeout: 0
  });
  return response.data;
}

export async function gradeBatchWithMcp(data: BatchGradingPayload) {
  const formData = new FormData();
  if (data.subject_id !== undefined) formData.append('subject_id', String(data.subject_id));
  if (data.exam_id !== undefined) formData.append('exam_id', String(data.exam_id));
  if (data.local_package_id !== undefined) formData.append('local_package_id', String(data.local_package_id));
  if (data.package_fingerprint) formData.append('package_fingerprint', data.package_fingerprint);
  if (data.quick_fingerprint) formData.append('quick_fingerprint', data.quick_fingerprint);
  if (data.student_no_hash) formData.append('student_no_hash', data.student_no_hash);
  if (data.is_trial !== undefined) formData.append('is_trial', data.is_trial ? '1' : '0');
  formData.append('mode', data.mode);
  const targetMeta = data.targets.map((target, index) => {
    const fileField = `image_${index}`;
    if (target.image) {
      formData.append(fileField, target.image, target.image_name || `answer-image-${index + 1}.png`);
    }
    return {
      key: target.key,
      question_no: target.question_no || '',
      service_uuid: target.service_uuid,
      student_no: target.student_no,
      question_label: target.question_label,
      question_text: target.question_text,
      answer_text: target.answer_text || '',
      max_score: target.max_score,
      multi_service: target.multi_service || false,
      standard_id: target.standard_id,
      standard_version_no: target.standard_version_no,
      question_version_no: target.question_version_no,
      template_id: target.template_id,
      template_name: target.template_name || '',
      standard_label: target.standard_label || '',
      sub_questions: target.sub_questions || [],
      image_field: target.image ? fileField : ''
    };
  });
  formData.append('targets', JSON.stringify(targetMeta));

  const response = await api.post(`${apiPrefix}/teacher-scoring/grade-batch-with-mcp`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    timeout: 0
  });
  return response.data;
}

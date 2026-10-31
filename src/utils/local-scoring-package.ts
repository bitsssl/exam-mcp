import { isProxy, toRaw } from 'vue';
import { useUserStore } from '@/store/modules/user';
import { processLocalPackageFiles, registerLocalPackage } from '@/api/teacher-scoring';
import type { LocalPackageItem, ParseReportSummary, StudentAnswerJson, StudentQuestionJson } from '@/api/teacher-scoring';

export interface LocalImageFile {
  name: string;
  relativePath: string;
  type: string;
  size: number;
  blob: Blob;
  url?: string;
}

export interface LocalWordDocument {
  name: string;
  relativePath: string;
  type: string;
  size: number;
  blob: Blob;
  student_no?: string;
}

export interface LocalSupportingDocument {
  name: string;
  type: string;
  size: number;
  blob: Blob;
}

export interface LocalStudentAnswer {
  answer_id: string;
  student_no: string;
  answer_json: StudentAnswerJson;
  search_text: string;
  total_score: number | string | null;
}

export interface LocalPackageData {
  package_id: string;
  exam_id: string;
  subject_id: string;
  package_name: string;
  folder_name: string;
  json_file_name: string;
  uploaded_at: string;
  students: LocalStudentAnswer[];
  images: LocalImageFile[];
  local_package_id?: number;
  package_fingerprint?: string;
  quick_fingerprint?: string;
  total_file_size?: number;
  total_image_size?: number;
  total_word_size?: number;
  student_no_hash?: string;
  server_package?: LocalPackageItem;
  matched_history?: boolean;
  word_documents?: LocalWordDocument[];
  blank_paper?: LocalSupportingDocument;
  answer_key?: LocalSupportingDocument;
  reference_answers?: Array<Record<string, any>>;
  blank_paper_json?: Record<string, any>;
  answer_key_json?: Record<string, any>;
  /** 解析报告摘要（后端 /process 随包返回，缓存命中的历史包无此数据） */
  parse_report_summary?: ParseReportSummary;
  structure_serialized?: boolean;
}
export interface LocalPackageSummary {
  package_id: string;
  exam_id: string;
  subject_id: string;
  package_name: string;
  folder_name: string;
  json_file_name: string;
  uploaded_at: string;
  student_count: number;
  image_count: number;
  local_package_id?: number;
  package_fingerprint?: string;
  quick_fingerprint?: string;
  student_no_hash?: string;
  total_word_size?: number;
  blank_paper_name?: string;
  answer_key_name?: string;
  isLocal: true;
}
const DB_NAME = 'teacher-scoring-local-packages';
const DB_VERSION = 1;
const STORE_NAME = 'packages';
const IMAGE_SUFFIXES = ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.svg'];
const WORD_SUFFIXES = ['.doc', '.docx'];
const EXCEL_ANSWER_SUFFIXES = ['.xlsx', '.xls'];
const DATABASE_ANSWER_SUFFIXES = ['.mdf', '.ldf', '.bak', '.dmp', '.sql', '.db', '.dump'];
const DATABASE_ANSWER_KEYWORDS = ['BAK', 'BACKUP', 'DATABASE', 'DB', 'SQL', 'MDF', 'LDF'];
const ANSWER_SUPPORTING_KEYWORDS = ['answer', 'reference', 'rubric', '答案', '参考答案', '标准答案', '评分标准'];
const BLANK_SUPPORTING_KEYWORDS = ['blank', 'empty', '空白', '空卷', '空试卷'];
const STUDENT_DOCUMENT_ID_PATTERN = /\d{6,}[A-Za-z]\d+/;
// File System Access API 返回的 File.webkitRelativePath 在部分浏览器中是只读的。
// 用 WeakMap 保存目录选择器生成的相对路径，保证上传时不会丢失学号目录层级。
const fileRelativePaths = new WeakMap<File, string>();
// v6：大题四的【KES Plus】备选组合回同一大题（小题连续编号 4.1-4.9，
// 与评分标准对齐）；多数票结构对齐修复后 2.4/2.5 的 xlsx/备份文件
// 能正确挂载到对应小题。
// 版本号变更会使同内容试卷包的历史解析缓存失效，触发重新解析。
// v11：空白考生生成时保留空白卷骨架的题目参考图片（此前被当作答案图误清空）。
// v13：兼容传统目录上传时补登记 webkitEntries 中的空考生目录，避免历史
// 339 人缓存继续复用，导致应有的 343 人始终少 4 人。
const SCORING_PACKAGE_PARSER_VERSION = '2026-10-kss-image-and-empty-dirs-v13';

const hasRealParsedStudents = (students: any): boolean => (
  Array.isArray(students)
  && students.some((student) => (
    student
    && !student.is_blank
    && Array.isArray(student.result)
    && student.result.length > 0
  ))
);


const toHex = (buffer: ArrayBuffer | Uint8Array) => Array.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer))
  .map((value) => value.toString(16).padStart(2, '0'))
  .join('');

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

const rightRotate = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));

const sha256Fallback = (input: Uint8Array) => {
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;

  const bitLengthHigh = Math.floor(input.length / 0x20000000);
  const bitLengthLow = (input.length << 3) >>> 0;
  const tail = paddedLength - 8;
  padded[tail] = (bitLengthHigh >>> 24) & 0xff;
  padded[tail + 1] = (bitLengthHigh >>> 16) & 0xff;
  padded[tail + 2] = (bitLengthHigh >>> 8) & 0xff;
  padded[tail + 3] = bitLengthHigh & 0xff;
  padded[tail + 4] = (bitLengthLow >>> 24) & 0xff;
  padded[tail + 5] = (bitLengthLow >>> 16) & 0xff;
  padded[tail + 6] = (bitLengthLow >>> 8) & 0xff;
  padded[tail + 7] = bitLengthLow & 0xff;

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const position = offset + index * 4;
      words[index] = (
        (padded[position] << 24) |
        (padded[position + 1] << 16) |
        (padded[position + 2] << 8) |
        padded[position + 3]
      ) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rightRotate(words[index - 15], 7) ^ rightRotate(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rightRotate(words[index - 2], 17) ^ rightRotate(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[index] + words[index]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const output = new Uint8Array(32);
  const view = new DataView(output.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((value, index) => {
    view.setUint32(index * 4, value);
  });
  return toHex(output);
};

const sha256Hex = async (data: Uint8Array | ArrayBuffer) => {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const subtle = globalThis.crypto?.subtle;
  if (subtle?.digest) {
    const digestData = data instanceof ArrayBuffer ? data : new Uint8Array(bytes).buffer;
    return toHex(await subtle.digest('SHA-256', digestData));
  }
  return sha256Fallback(bytes);
};
const sha256Text = async (value: string) => {
  const data = new TextEncoder().encode(value);
  return sha256Hex(data);
};

const stableStringify = (value: any): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const fileHeadHash = async (file: File) => {
  const chunk = file.slice(0, Math.min(file.size, 64 * 1024));
  return sha256Hex(await chunk.arrayBuffer());
};

const getFileStem = (value: string) => {
  const normalized = normalizePath(value);
  const name = normalized.split('/').pop() || normalized;
  return name.replace(/\.[^.]+$/, '');
};

const normalizeStudentToken = (value: string) => {
  return getFileStem(value)
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '')
    .toLowerCase();
};

const isWordDocumentFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  return WORD_SUFFIXES.some((suffix) => lowerName.endsWith(suffix));
};

const isTemporaryWordFile = (file: File) => {
  const fileName = getFilePath(file).split('/').pop() || file.name;
  const lowerName = fileName.toLowerCase();
  return lowerName.startsWith('~$') || lowerName.startsWith('.~lock');
};

const normalizeSupportingFileName = (file: File) => {
  const parts = getFilePath(file).split('/').filter(Boolean);
  return parts.slice(-2).join('/').replace(/\s+/g, '').toLowerCase();
};

const supportingNameMatches = (file: File, keywords: string[]) => (
  keywords.some((keyword) => normalizeSupportingFileName(file).includes(keyword.toLowerCase()))
);

const filePathContainsStudentId = (file: File) => STUDENT_DOCUMENT_ID_PATTERN.test(getFilePath(file));

const isStudentAnswerDocumentFile = (file: File) => {
  if (!isWordDocumentFile(file) || isTemporaryWordFile(file)) return false;
  if (filePathContainsStudentId(file)) return true;
  // 路径中没有考生学号的散文件，才按“答案/空白卷”关键词排除；
  // 考生答题卡普遍命名为 Answer.doc，不能因关键词被误杀。
  return !supportingNameMatches(file, ANSWER_SUPPORTING_KEYWORDS)
    && !supportingNameMatches(file, BLANK_SUPPORTING_KEYWORDS);
};

const isAnswerSupportingFile = (file: File) => (
  isWordDocumentFile(file)
  && !filePathContainsStudentId(file)
  && supportingNameMatches(file, ANSWER_SUPPORTING_KEYWORDS)
);

const isBlankSupportingFile = (file: File) => (
  isWordDocumentFile(file)
  && !filePathContainsStudentId(file)
  && supportingNameMatches(file, BLANK_SUPPORTING_KEYWORDS)
);

const isPackageSupportingFile = (file: File) => (
  isAnswerSupportingFile(file) || isBlankSupportingFile(file)
);

const findMatchedStudentNo = (filePath: string, studentNos: string[]) => {
  const normalizedFile = normalizeStudentToken(filePath);
  if (!normalizedFile) return undefined;
  const orderedStudentNos = [...studentNos].sort(
    (left, right) => normalizeStudentToken(right).length - normalizeStudentToken(left).length
  );

  for (const studentNo of orderedStudentNos) {
    const normalizedStudentNo = normalizeStudentToken(studentNo);
    if (!normalizedStudentNo) continue;
    if (
      normalizedFile === normalizedStudentNo ||
      normalizedFile.includes(normalizedStudentNo) ||
      normalizedStudentNo.includes(normalizedFile)
    ) {
      return studentNo;
    }
  }

  return undefined;
};

const buildFileManifestEntry = async (file: File) => ({
  name: file.name,
  relative_path: getFilePath(file),
  size: file.size,
  type: file.type,
  last_modified: file.lastModified,
  head_hash: await fileHeadHash(file)
});

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'package_id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
};

const runStore = async <T>(
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore) => IDBRequest<T> | void
) => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = runner(store);
    let result: T;

    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error);
    }

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
  });
};

const getFilePath = (file: File) => {
  const mappedPath = fileRelativePaths.get(file);
  if (mappedPath) return mappedPath;
  const webkitPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return webkitPath || file.name;
};

export const getLocalPackageFilePath = (file: File) => getFilePath(file);

export const setLocalPackageFilePath = (file: File, relativePath: string) => {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized) fileRelativePaths.set(file, normalized);
};

const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
const normalizeImagePath = (value: string) => normalizePath(value).replace(/^image\/?media\//, 'media/');

const createEmbeddedImageMarkerRegExp = () => /----\s*([^\r\n]+?\.(?:png|jpg|jpeg|bmp|gif|webp|svg))\s*----/gi;

export const extractEmbeddedImagePaths = (value?: string) => {
  const text = String(value || '');
  return Array.from(text.matchAll(createEmbeddedImageMarkerRegExp()), (match) => match[1].trim())
    .filter(Boolean);
};

export const stripEmbeddedImageMarkers = (value?: string) => {
  return String(value || '').replace(createEmbeddedImageMarkerRegExp(), '').trim();
};

export type EmbeddedImageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; path: string };

export const parseEmbeddedImageContent = (value?: string): EmbeddedImageContentPart[] => {
  const text = String(value || '');
  const parts: EmbeddedImageContentPart[] = [];
  const markerRegExp = createEmbeddedImageMarkerRegExp();
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = markerRegExp.exec(text)) !== null) {
    const leadingText = text.slice(lastIndex, match.index).trim();
    if (leadingText) parts.push({ type: 'text', text: leadingText });
    parts.push({ type: 'image', path: match[1].trim() });
    lastIndex = markerRegExp.lastIndex;
  }

  const trailingText = text.slice(lastIndex).trim();
  if (trailingText) parts.push({ type: 'text', text: trailingText });
  return parts;
};

const isImageFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  return IMAGE_SUFFIXES.some((suffix) => lowerName.endsWith(suffix));
};

const isExcelAnswerFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  return EXCEL_ANSWER_SUFFIXES.some((suffix) => lowerName.endsWith(suffix));
};

const isDatabaseAnswerFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  const upperName = file.name.toUpperCase();
  return DATABASE_ANSWER_SUFFIXES.some((suffix) => lowerName.endsWith(suffix))
    || DATABASE_ANSWER_KEYWORDS.some((keyword) => upperName.includes(keyword));
};

const isStudentAnswerAttachmentFile = (file: File) => (
  !isTemporaryWordFile(file)
  && !isPackageSupportingFile(file)
  && !isImageFile(file)
  && !WORD_SUFFIXES.some((suffix) => file.name.toLowerCase().endsWith(suffix))
  && !file.name.toLowerCase().endsWith('.json')
  && (isExcelAnswerFile(file) || isDatabaseAnswerFile(file))
);

// 考生答案目录下的工程/项目文件（如第四大题低代码工程的 src/views、
// .vue、.npb 工程备份等）。它们不属于 Word/Excel/数据库答案类别，
// 但第四大题评分服务需要遍历考生 KS 目录做项目评分，必须随包上传。
// 跳过 IDE 垃圾目录（Eclipse .metadata、构建输出等）和超长路径（Windows MAX_PATH 限制）。
const PROJECT_FILE_SKIP_DIRS = [
  'node_modules', '.git', 'bin', 'obj', 'packages', '__pycache__',
  '.metadata', '.settings', '.idea', '.vscode', '.gradle', 'target', 'build'
];
// 相对路径长度上限：服务器落盘路径 = 暂存目录(约125字符) + 相对路径，
// 需控制在 Windows MAX_PATH(260) 以内
const PROJECT_FILE_MAX_PATH_LENGTH = 130;
const isStudentProjectFile = (file: File) => {
  if (isTemporaryWordFile(file) || isPackageSupportingFile(file)) return false;
  if (isImageFile(file)) return false;
  if (WORD_SUFFIXES.some((suffix) => file.name.toLowerCase().endsWith(suffix))) return false;
  if (file.name.toLowerCase().endsWith('.json')) return false;
  if (isExcelAnswerFile(file) || isDatabaseAnswerFile(file)) return false;
  if (!filePathContainsStudentId(file)) return false;
  const relativePath = getFilePath(file);
  if (relativePath.length > PROJECT_FILE_MAX_PATH_LENGTH) return false;
  const parts = relativePath.split('/');
  return !parts.some((part) => PROJECT_FILE_SKIP_DIRS.includes(part.toLowerCase()));
};

const collectImageRefsFromValue = (value: any): string[] => {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') {
    const refs = extractEmbeddedImagePaths(value);
    const normalized = value.replace(/\\/g, '/').trim();
    const suffix = `.${normalized.split('?')[0].split('#')[0].split('.').pop() || ''}`.toLowerCase();
    if (IMAGE_SUFFIXES.includes(suffix)) refs.push(normalized);
    return refs;
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectImageRefsFromValue(item));
  }
  if (typeof value === 'object') {
    return Object.values(value).flatMap((item) => collectImageRefsFromValue(item));
  }
  return [];
};

const imageFileMatchesRefs = (file: File, imageRefs: string[]) => {
  if (!imageRefs.length) return false;
  const relativePath = normalizePath(getFilePath(file));
  const fileName = relativePath.split('/').pop() || normalizePath(file.name);
  return imageRefs.some((imageRef) => {
    const normalizedRef = normalizePath(imageRef);
    const refFileName = normalizedRef.split('/').pop();
    return (
      relativePath === normalizedRef ||
      relativePath.endsWith(`/${normalizedRef}`) ||
      normalizedRef.endsWith(`/${relativePath}`) ||
      (!!refFileName && fileName === refFileName)
    );
  });
};

const imageFileBelongsToStudents = (file: File, studentNos: string[]) => {
  // 作答图片文件名（如 PicA.jpg）通常不含学号，需按所在目录段匹配考生
  const dirParts = normalizePath(getFilePath(file)).split('/').slice(0, -1);
  if (dirParts.some((part) => studentNos.includes(part))) return true;
  return Boolean(findMatchedStudentNo(getFilePath(file), studentNos));
};

const isLikelyStudentObject = (value: any) => {
  return value && (value.id || value.studentId || Array.isArray(value.result));
};

const loadJsonObject = (obj: any) => {
  const students: StudentAnswerJson[] = [];
  if (Array.isArray(obj)) {
    obj.forEach((item) => {
      if (isLikelyStudentObject(item)) students.push(item);
    });
  } else if (isLikelyStudentObject(obj)) {
    students.push(obj);
  } else if (obj && typeof obj === 'object') {
    Object.values(obj).forEach((value) => {
      if (isLikelyStudentObject(value)) students.push(value as StudentAnswerJson);
    });
  }
  return students;
};

const getStudentNo = (entry: StudentAnswerJson, index: number) => {
  return String(entry.id || entry.studentId || entry.student_no || entry.studentNo || `record-${index + 1}`);
};

export const getQuestionList = (entry: StudentAnswerJson | null): StudentQuestionJson[] => {
  return entry && Array.isArray(entry.result) ? entry.result : [];
};

export const calculateTotalScore = (entry: StudentAnswerJson | null): number | string | null => {
  if (!entry) return null;
  if (entry.total_score !== undefined && entry.total_score !== null) return entry.total_score;
  const questions = getQuestionList(entry);
  if (!questions.length) return null;
  return questions.reduce((sum, question) => {
    const score = Number(question.score);
    return Number.isFinite(score) ? sum + score : sum;
  }, 0);
};

const readJsonFiles = async (files: File[]) => {
  const jsonFiles = files.filter(
    (file) => file.name.toLowerCase().endsWith('.json') && !isTemporaryWordFile(file)
  );
  for (const file of jsonFiles) {
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      const students = loadJsonObject(obj);
      if (students.length) {
        return { file, students };
      }
    } catch (error) {
      // Try the next JSON file.
    }
  }
  return null;
};

export const createLocalPackageFromFolder = async (
  subjectId: string,
  examId: string,
  packageName: string,
  files: File[],
  folderPaths: string[] = [],
  supportingFiles: {
    blankPaper?: File;
    answerKey?: File;
  } = {}
) => {
  const localParsedJson = await readJsonFiles(files);
  let processedData: Awaited<ReturnType<typeof processLocalPackageFiles>>['data'] | null = null;
  const validFiles = files.filter((file) => !isTemporaryWordFile(file));

  // 文件指纹只依赖原始文件（路径+大小+内容哈希），转换前即可计算；
  // 重复上传同一试卷包时直接复用历史解析结果，跳过 Word 全量重转。
  const computeFileFingerprint = async () => {
    const supportingEntries = await Promise.all(
      [supportingFiles.blankPaper, supportingFiles.answerKey]
        .filter((file): file is File => Boolean(file))
        .map((file) => buildFileManifestEntry(file))
    );
    const manifest = await Promise.all(validFiles.map((file) => buildFileManifestEntry(file)));
    return sha256Text(stableStringify({
      parser_version: SCORING_PACKAGE_PARSER_VERSION,
      folder_paths: folderPaths.map((path) => normalizePath(path)).sort(),
      files: [...manifest, ...supportingEntries]
        .map((file) => ({
          relative_path: normalizePath(file.relative_path),
          size: file.size,
          head_hash: file.head_hash
        })).sort((a, b) => a.relative_path.localeCompare(b.relative_path))
    }));
  };
  const fileFingerprint = await computeFileFingerprint();
  let cachedServerPackage: LocalPackageItem | null = null;
  try {
    const probeResponse = await registerLocalPackage(subjectId, examId, {
      package_name: packageName,
      package_fingerprint: fileFingerprint,
      file_fingerprint: fileFingerprint,
      student_count: 0,
      image_count: 0,
      probe: true
    });
    if (
      (probeResponse.code === 0 || probeResponse.code === 200)
      && probeResponse.data?.matched
      && probeResponse.data?.package?.parsed_students?.length
      // 只复用真正解析出题目的历史包；全空白考生的坏数据缓存不允许可复用，
      // 否则重复上传同一文件夹会永远拿回“考生数量对、题目为空”的结果。
      && hasRealParsedStudents(probeResponse.data.package.parsed_students)
    ) {
      cachedServerPackage = probeResponse.data.package;
    }
  } catch (error) {
    console.warn('探测历史试卷包失败，继续走完整转换流程', error);
  }

  if (cachedServerPackage) {
    // 命中同内容历史试卷包：复用已解析的学生数据和图片清单。
    processedData = {
      source_token: '',
      students: cachedServerPackage.parsed_students as StudentAnswerJson[],
      students_json: '',
      images: cachedServerPackage.parsed_image_manifest || [],
      reference_answers: cachedServerPackage.reference_answers || [],
      answer_key_json: (cachedServerPackage.answer_key_json as Record<string, any>) || null,
      blank_paper_json: (cachedServerPackage.blank_paper_json as Record<string, any>) || null,
      answer_key_document: null,
      blank_paper_document: null
    };
  }

  if (!processedData) {
    // 后端 /process 只负责 Word->JSON 转换和参考答案解析；
    // Excel/数据库答案附件会上传给后端，以便写入学生 JSON 并生成评分服务可访问的文件链接。
    // 考生目录（如 33A/<学号>/KS）下的真实作答图片也必须随 /process 上传：
    // 图片类评分服务（如“图像制作评分服务”）直接扫描服务端目录取图。
    // 此处在解析前从文件夹路径推导考生目录名（布局为 <根目录>/<学号>/...），
    // 用于筛选属于考生的图片，不依赖解析结果。
    const studentDirNames = new Set<string>();
    const collectStudentDirName = (rawPath: string) => {
      const parts = normalizePath(rawPath).split('/').filter(Boolean);
      if (parts.length >= 2) studentDirNames.add(parts[1]);
    };
    folderPaths.forEach(collectStudentDirName);
    files.forEach((file) => collectStudentDirName(getFilePath(file)));
    const studentDirNameList = Array.from(studentDirNames);
    const isStudentAnswerImageFile = (file: File) => {
      if (isTemporaryWordFile(file) || isPackageSupportingFile(file) || !isImageFile(file)) return false;
      // 图片文件名多为 PicA.jpg 之类，不含学号；按所在目录段匹配考生目录
      const dirParts = normalizePath(getFilePath(file)).split('/').slice(0, -1);
      return dirParts.some((part) => studentDirNameList.includes(part));
    };
    const processFileMap = new Map<string, File>();
    files
      .filter((file) => file.name.toLowerCase().endsWith('.zip') || isStudentAnswerDocumentFile(file) || isStudentAnswerAttachmentFile(file) || isStudentProjectFile(file) || isStudentAnswerImageFile(file))
      .forEach((file) => processFileMap.set(getFilePath(file), file));
    if (localParsedJson?.file) processFileMap.set(getFilePath(localParsedJson.file), localParsedJson.file);
    const processFiles = Array.from(processFileMap.values());
    try {
      const response = await processLocalPackageFiles(
        subjectId,
        examId,
        packageName,
        processFiles,
        folderPaths,
        supportingFiles,
        getLocalPackageFilePath
      );
      if (response.code === 0 || response.code === 200) {
        processedData = response.data;
      }
    } catch (error) {
      if (!localParsedJson) {
        throw error;
      }
      console.warn('后端文档转换失败，回退到浏览器已有 JSON 解析', error);
    }
  }

  const parsedStudents = processedData?.students?.length
    ? processedData.students
    : localParsedJson?.students || [];
  if (!parsedStudents.length) {
    throw new Error('所选试卷包中没有找到可解析的学生 Word 或 JSON 数据');
  }

  const uploadedAt = new Date().toISOString();
  const parsedJsonFile = localParsedJson?.file
    || validFiles.find((file) => file.name.toLowerCase().endsWith('.json'));
  const firstPath = getFilePath(validFiles[0] || parsedJsonFile || new File([], packageName));
  const firstFolderPath = folderPaths.find(Boolean) || firstPath;
  const folderName = firstFolderPath.includes('/') ? firstFolderPath.split('/')[0] : packageName;

  const studentNos = parsedStudents.map((entry, index) => getStudentNo(entry, index));
  const students = parsedStudents.map((entry, index) => ({
    answer_id: '',
    student_no: studentNos[index],
    answer_json: entry,
    search_text: JSON.stringify(entry).toLowerCase(),
    total_score: calculateTotalScore(entry)
  }));

  const wordFiles = files.filter(isStudentAnswerDocumentFile);
  const answerAttachmentFiles = files.filter(isStudentAnswerAttachmentFile);
  const projectFiles = files.filter(isStudentProjectFile);
  const parsedImageRefs = collectImageRefsFromValue(parsedStudents);
  const imageFiles = files.filter((file) => {
    if (isTemporaryWordFile(file) || isPackageSupportingFile(file) || !isImageFile(file)) return false;
    if (imageFileMatchesRefs(file, parsedImageRefs)) return true;
    // 考生答案目录（如 C:\KS）下的真实作答图片也必须随包上传：
    // 它们由图片类评分服务（如“图像制作评分服务”）直接扫描目录取图，
    // 不能因为后端解析已产出图片就把这些原始文件丢弃。
    return imageFileBelongsToStudents(file, studentNos);
  });
  const sourceFileMap = new Map<string, File>();
  [...wordFiles, ...answerAttachmentFiles, ...projectFiles, ...imageFiles, ...(parsedJsonFile ? [parsedJsonFile] : [])]
    .forEach((file) => sourceFileMap.set(getFilePath(file), file));
  const sourceFiles = Array.from(sourceFileMap.values());
  const images: LocalImageFile[] = imageFiles.map((file) => ({
    name: file.name,
    relativePath: getFilePath(file),
    type: file.type,
    size: file.size,
    blob: file
  }));
  const wordDocuments: LocalWordDocument[] = wordFiles.map((file) => ({
    name: file.name,
    relativePath: getFilePath(file),
    type: file.type,
    size: file.size,
    blob: file,
    student_no: findMatchedStudentNo(getFilePath(file), studentNos)
  }));
  const blankPaper = supportingFiles.blankPaper
    ? {
      name: supportingFiles.blankPaper.name,
      type: supportingFiles.blankPaper.type,
      size: supportingFiles.blankPaper.size,
      blob: supportingFiles.blankPaper
    }
    : undefined;
  const answerKey = supportingFiles.answerKey
    ? {
      name: supportingFiles.answerKey.name,
      type: supportingFiles.answerKey.type,
      size: supportingFiles.answerKey.size,
      blob: supportingFiles.answerKey
    }
    : undefined;

  const totalFileSize = [
    ...sourceFiles,
    ...(supportingFiles.blankPaper ? [supportingFiles.blankPaper] : []),
    ...(supportingFiles.answerKey ? [supportingFiles.answerKey] : [])
  ].reduce((sum, file) => sum + file.size, 0);
  const totalImageSize = imageFiles.reduce((sum, file) => sum + file.size, 0);
  const totalWordSize = wordFiles.reduce((sum, file) => sum + file.size, 0);
  const answerIndex = students.map((student) => ({
    student_no: student.student_no,
    question_count: getQuestionList(student.answer_json).length,
    total_score: student.total_score
  }));
  const structureSummary = {
    folder_name: folderName,
    json_file_name: parsedJsonFile?.name || processedData?.students_json?.split('/').pop() || '',
    student_count: students.length,
    image_count: imageFiles.length,
    word_document_count: wordFiles.length,
    answer_file_count: answerAttachmentFiles.length,
    blank_paper_name: blankPaper?.name || '',
    answer_key_name: answerKey?.name || '',
    total_file_size: totalFileSize,
    total_image_size: totalImageSize,
    total_word_size: totalWordSize
  };
  const fileManifest = await Promise.all(sourceFiles.map(buildFileManifestEntry));
  const normalizedJson = stableStringify(parsedStudents);
  const studentNoHash = await sha256Text(studentNos.slice().sort().join('|'));
  const quickFingerprint = await sha256Text(stableStringify({
    parser_version: SCORING_PACKAGE_PARSER_VERSION,
    json_file_name: parsedJsonFile?.name || processedData?.students_json?.split('/').pop() || '',
    json_file_size: parsedJsonFile?.size || 0,
    student_count: students.length,
    image_count: Math.max(imageFiles.length, processedData?.images?.length || 0),
    total_image_size: totalImageSize,
    student_no_hash: studentNoHash
  }));
  const packageFingerprint = await sha256Text(stableStringify({
    parser_version: SCORING_PACKAGE_PARSER_VERSION,
    json: normalizedJson,
    files: fileManifest
      .map((file) => ({
      relative_path: normalizePath(file.relative_path),
      size: file.size,
      head_hash: file.head_hash
    })).sort((a, b) => a.relative_path.localeCompare(b.relative_path))
  }));

  const registerResponse = await registerLocalPackage(subjectId, examId, {
    package_name: packageName,
    package_fingerprint: packageFingerprint,
    quick_fingerprint: quickFingerprint,
    file_fingerprint: fileFingerprint,
    folder_name: folderName,
    json_file_name: parsedJsonFile?.name || processedData?.students_json?.split('/').pop() || '',
    json_file_size: parsedJsonFile?.size || 0,
    student_count: students.length,
    image_count: Math.max(imageFiles.length, processedData?.images?.length || 0),
    word_document_count: wordFiles.length,
    total_file_size: totalFileSize,
    total_image_size: totalImageSize,
    total_word_size: totalWordSize,
    student_no_hash: studentNoHash,
    structure_summary: structureSummary,
    answer_index: answerIndex,
    file_manifest: fileManifest,
    parsed_students: processedData?.students,
    parsed_image_manifest: processedData?.images,
    source_token: processedData?.source_token
  });
  const serverPackage = registerResponse.data?.package as LocalPackageItem | undefined;
  const matchedHistory = Boolean(registerResponse.data?.matched);
  const localPackageId = serverPackage?.local_package_id;
  const packageId = serverPackage?.package_id || `local_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const persistedStudents = serverPackage?.parsed_students?.length
    ? serverPackage.parsed_students
    : parsedStudents;

  const localStudents = persistedStudents.map((entry, index) => ({
    answer_id: '',
    student_no: getStudentNo(entry, index),
    answer_json: entry,
    search_text: JSON.stringify(entry).toLowerCase(),
    total_score: calculateTotalScore(entry)
  }));
  localStudents.forEach((student, index) => {
    student.answer_id = `${packageId}_${index}`;
  });
  const persistedImages = (serverPackage?.parsed_image_manifest || []).map((image: any) => ({
    name: image.name || image.relative_path?.split('/').pop() || 'image',
    relativePath: image.relative_path || image.name || '',
    type: image.type || `image/${image.file_type || 'png'}`,
    size: Number(image.file_size || image.size || 0),
    blob: new Blob([], { type: image.type || `image/${image.file_type || 'png'}` }),
    url: image.url
  })) as LocalImageFile[];

  const localPackage: LocalPackageData = {
    package_id: packageId,
    local_package_id: localPackageId,
    subject_id: subjectId,
    exam_id: examId,
    package_name: serverPackage?.package_name || packageName,
    folder_name: folderName,
    json_file_name: parsedJsonFile?.name || processedData?.students_json?.split('/').pop() || '',
    uploaded_at: uploadedAt,
    students: localStudents,
    images: [...images, ...persistedImages],
    word_documents: wordDocuments,
    package_fingerprint: packageFingerprint,
    quick_fingerprint: quickFingerprint,
    total_file_size: totalFileSize,
    total_image_size: totalImageSize,
    total_word_size: totalWordSize,
    student_no_hash: studentNoHash,
    server_package: serverPackage,
    matched_history: matchedHistory,
    blank_paper: blankPaper,
    answer_key: answerKey,
    reference_answers: serverPackage?.reference_answers || [],
    blank_paper_json: serverPackage?.blank_paper_json || undefined,
    answer_key_json: serverPackage?.answer_key_json || undefined,
    parse_report_summary: processedData?.parse_report,
    structure_serialized: processedData?.structure_serialized
  };

  await saveLocalPackage(localPackage);
  return localPackage;
};
const getCanonicalPackageId = (localPackage: Pick<LocalPackageData, 'package_id' | 'local_package_id'>) => {
  if (localPackage.local_package_id !== undefined && localPackage.local_package_id !== null) {
    return `local_${localPackage.local_package_id}`;
  }
  return localPackage.package_id;
};

const getLocalPackageGroupKey = (localPackage: LocalPackageData) => {
  if (localPackage.local_package_id !== undefined && localPackage.local_package_id !== null) {
    return `local:${localPackage.local_package_id}`;
  }
  if (localPackage.package_fingerprint) return `fingerprint:${localPackage.package_fingerprint}`;
  return `package:${localPackage.package_id}`;
};

const isBetterLocalPackage = (next: LocalPackageData, current?: LocalPackageData) => {
  if (!current) return true;
  const nextStudentCount = next.students?.length || 0;
  const currentStudentCount = current.students?.length || 0;
  if (nextStudentCount !== currentStudentCount) return nextStudentCount > currentStudentCount;
  const nextTime = new Date(next.uploaded_at || '').getTime();
  const currentTime = new Date(current.uploaded_at || '').getTime();
  if (Number.isFinite(nextTime) && Number.isFinite(currentTime) && nextTime !== currentTime) return nextTime > currentTime;
  return getCanonicalPackageId(next) === next.package_id;
};

// IndexedDB 无法结构化克隆 Vue 响应式 Proxy，
// 保存前需要深度还原为普通对象（File/Blob 原样保留）。
const toCloneSafe = (value: any): any => {
  if (value === null || typeof value !== 'object') return value;
  if (typeof File !== 'undefined' && value instanceof File) return value;
  if (value instanceof Blob) return value;
  if (Array.isArray(value)) return value.map(toCloneSafe);
  const raw = isProxy(value) ? toRaw(value) : value;
  const result: Record<string, any> = {};
  Object.keys(raw).forEach((key) => {
    result[key] = toCloneSafe((raw as Record<string, any>)[key]);
  });
  return result;
};

export const saveLocalPackage = async (localPackage: LocalPackageData) => {
  const canonicalPackageId = getCanonicalPackageId(localPackage);
  const packageToSave = toCloneSafe({ ...localPackage, package_id: canonicalPackageId });
  await runStore<void>('readwrite', (store) => {
    store.put(packageToSave);
  });
};

export const getLocalPackage = async (packageId: string) => {
  const normalizedId = String(packageId || '').trim();
  if (!normalizedId) return undefined;
  const direct = await runStore<LocalPackageData | undefined>('readonly', (store) => store.get(normalizedId));
  if (direct) return direct;

  const localIdText = normalizedId.startsWith('local_') ? normalizedId.slice('local_'.length) : normalizedId;
  const localPackageId = Number(localIdText);
  if (!Number.isFinite(localPackageId)) return undefined;

  const packages = await runStore<LocalPackageData[]>('readonly', (store) => store.getAll());
  return (packages || [])
    .filter((item) => Number(item.local_package_id) === localPackageId)
    .sort((left, right) => (isBetterLocalPackage(left, right) ? -1 : 1))[0];
};


export const listLocalPackages = async (subjectId: string, examId: string) => {
  const packages = await runStore<LocalPackageData[]>('readonly', (store) => store.getAll());
  const grouped = new Map<string, LocalPackageData>();
  (packages || [])
    .filter((item) => item.subject_id === subjectId && item.exam_id === examId)
    .forEach((item) => {
      const key = getLocalPackageGroupKey(item);
      const current = grouped.get(key);
      if (isBetterLocalPackage(item, current)) grouped.set(key, item);
    });

  return Array.from(grouped.values())
    .sort((left, right) => new Date(right.uploaded_at || '').getTime() - new Date(left.uploaded_at || '').getTime())
    .map<LocalPackageSummary>((item) => ({
      package_id: getCanonicalPackageId(item),
      subject_id: item.subject_id,
      exam_id: item.exam_id,
      package_name: item.package_name,
      folder_name: item.folder_name,
      json_file_name: item.json_file_name,
      uploaded_at: item.uploaded_at,
      student_count: item.students?.length || 0,
      image_count: item.images?.length || 0,
      local_package_id: item.local_package_id,
      package_fingerprint: item.package_fingerprint,
      quick_fingerprint: item.quick_fingerprint,
      student_no_hash: item.student_no_hash,
      total_word_size: item.total_word_size,
      blank_paper_name: item.blank_paper?.name,
      answer_key_name: item.answer_key?.name,
      isLocal: true
    }));
};
export const buildImageResolver = (images: LocalImageFile[]) => {
  const objectUrls: string[] = [];
  const urlMap = new Map<string, string>();

  const addKey = (key: string, url: string) => {
    const normalized = normalizeImagePath(key);
    if (!normalized) return;
    urlMap.set(normalized, url);
    const mediaIndex = normalized.lastIndexOf('/media/');
    if (mediaIndex >= 0) urlMap.set(normalized.slice(mediaIndex + 1), url);
    if (normalized.startsWith('media/')) urlMap.set(normalized.replace(/^media\//, ''), url);
    const pathParts = normalized.split('/');
    for (let index = 0; index < pathParts.length; index += 1) {
      const suffix = pathParts.slice(index).join('/');
      if (suffix) urlMap.set(suffix, url);
    }
    urlMap.set(normalized.split('/').pop() || normalized, url);
  };

  images.forEach((image) => {
    // 后端持久化的图片会带 URL，但 Blob 为空占位。优先使用已拉取的
    // Blob URL，避免 <img> 无法携带请求头导致图片接口被浏览器拦截。
    const hasBlob = Boolean(image.blob && image.blob.size > 0);
    const url = hasBlob || !image.url ? URL.createObjectURL(image.blob) : image.url;
    if (hasBlob || !image.url) objectUrls.push(url);
    addKey(image.relativePath, url);
    addKey(image.name, url);
    const metadata = image as LocalImageFile & { storage_path?: string; path?: string };
    addKey(metadata.storage_path || '', url);
    addKey(metadata.path || '', url);
    if (image.url) {
      try {
        const parsedUrl = new URL(image.url, window.location.origin);
        const storedPath = parsedUrl.searchParams.get('path');
        if (storedPath) addKey(storedPath, url);
      } catch {
        // Ignore malformed optional image links; the manifest paths remain usable.
      }
    }
  });

  const getAccessToken = () => {
    try {
      return useUserStore().accessToken.replace(/^Bearer\s+/i, '');
    } catch {
      return '';
    }
  };

  // <img> 标签无法携带 Authorization 请求头，后端图片接口
  // 通过 access_token 查询参数接收同一 JWT。
  const withAccessToken = (url: string) => {
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) return url;
    if (/^https?:\/\//i.test(url) && !url.startsWith(window.location.origin)) return url;
    const token = getAccessToken();
    if (!token) return url;
    return `${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`;
  };

  return {
    resolve(imagePath?: string) {
      if (!imagePath) return '';
      if (/^https?:\/\//i.test(imagePath) || imagePath.startsWith('/api/')) return withAccessToken(imagePath);
      if (imagePath.startsWith('blob:') || imagePath.startsWith('data:')) return imagePath;
      let decodedPath = imagePath;
      try { decodedPath = decodeURIComponent(imagePath); } catch { /* Keep the original path. */ }
      const normalized = normalizeImagePath(decodedPath);
      const pathParts = normalized.split('/');
      for (let index = 0; index < pathParts.length; index += 1) {
        const url = urlMap.get(pathParts.slice(index).join('/'));
        if (url) return withAccessToken(url);
      }
      return withAccessToken(urlMap.get(normalized.split('/').pop() || normalized) || '');
    },
    revoke() {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    }
  };
};

const getStoredAccessToken = () => {
  try {
    return useUserStore().accessToken.replace(/^Bearer\s+/i, '');
  } catch {
    return '';
  }
};

// 后端持久化的图片只有 url、blob 是空占位；
// 评阅等需要真实文件内容的场景先按 url 拉取（带认证）。
export const ensureImageBlob = async (image?: LocalImageFile): Promise<Blob | undefined> => {
  if (!image) return undefined;
  if (image.blob && image.blob.size > 0) return image.blob;
  if (!image.url) return image.blob;
  const url = image.url.startsWith('blob:') || image.url.startsWith('data:')
    ? image.url
    : `${image.url}${image.url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(getStoredAccessToken())}`;
  try {
    const response = await fetch(url);
    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 0) {
        image.blob = blob;
        return blob;
      }
    }
  } catch (error) {
    console.warn('拉取试卷包图片失败', image.url, error);
  }
  return image.blob;
};

export const findLocalImage = (images: LocalImageFile[], imagePath?: string) => {  if (!imagePath) return undefined;
  const normalized = normalizeImagePath(imagePath);
  const fileName = normalized.split('/').pop();
  return images.find((image) => {
    const relativePath = normalizeImagePath(image.relativePath);
    const imageName = normalizeImagePath(image.name);
    const relativeParts = relativePath.split('/');
    return (
      relativePath === normalized ||
      imageName === normalized ||
      relativePath.endsWith(`/${normalized}`) ||
      normalized.endsWith(`/${relativePath}`) ||
      relativeParts.some((_, index) => relativeParts.slice(index).join('/') === normalized) ||
      (!!fileName && (imageName === fileName || relativePath.endsWith(`/${fileName}`)))
    );
  });
};

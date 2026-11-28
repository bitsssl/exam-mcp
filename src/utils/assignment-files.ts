/**
 * MCP 答案归属结果（candidate assignments）的题目匹配工具。
 *
 * 归属解析返回的题目编码形态多样：Q1.1、1-1、Q2_PR、Q2_DW、Q3_VIDEO、
 * Q4_创意 等。展示每道小题的答案结果文件时按以下顺序匹配（与后端
 * candidate_assignment_context 保持同一套归属规则）：
 * 1. 题号精确匹配（Q1.1 / 1-1 归一后相等）；
 * 2. 题号前缀匹配（归属把同一大题拆成 1.1、1.2 而结构只保留大题号）；
 * 3. 编码后缀关键词按题干路由（Q2_PR 用 PR/Premiere 命中视频小题、
 *    Q2_DW 用 DW/Dreamweaver 命中网页小题）；
 * 4. 同一大题下的归属按顺序映射到对应小题。
 */

export const normalizeAssignmentQuestionCode = (value: any) => String(value || '').trim().toUpperCase().replace(/\s+/g, '');

export const getAssignmentQuestionNo = (value: any) => {
  const normalized = normalizeAssignmentQuestionCode(value)
    .replace(/^Q/, '')
    .replace(/[／\\-]+/g, '.')
    .replace(/[、:：]/g, '.');
  const match = normalized.match(/^(\d+)(?:[._](\d+))?/);
  if (!match) return '';
  return match[2] ? `${Number(match[1])}.${Number(match[2])}` : String(Number(match[1]));
};

const ALIAS_KEYWORDS: Record<string, string[]> = {
  AUDITION: ['audition', '音频', '试听'],
  PR: ['pr', 'premiere', '视频剪辑', '剪辑'],
  DW: ['dw', 'dreamweaver', '网页'],
  VIDEO: ['video', '视频', '影片'],
  ANIMATE: ['animate', '动画'],
  '3DSMAX': ['3dsmax', '3dmax', '3d', '建模'],
  UNITY: ['unity', '游戏']
};

type AssignmentRecord = { assignment_json?: { student?: { questions?: any[] } } } | null | undefined;

/** 按题号+题干把归属结果匹配到试卷结构题目，返回命中的归属题目对象（含 files） */
export const getMatchedAssignmentQuestions = (assignment: AssignmentRecord, questionNo: string, questionText = '') => {
  const student = (assignment as any)?.assignment_json?.student;
  const normalizedQuestionNo = getAssignmentQuestionNo(questionNo);
  const questions = Array.isArray(student?.questions) ? student.questions : [];
  const questionMatches = (item: any) => {
    const code = getAssignmentQuestionNo(item?.questionCode);
    const label = getAssignmentQuestionNo(item?.questionLabel);
    return code === normalizedQuestionNo || label === normalizedQuestionNo;
  };
  let matchedQuestions = questions.filter(questionMatches);

  // 答案抽取结果可能把同一大题拆成 1.1、1.2，而试卷结构只保留大题号；
  // 也可能使用 1-1、Q1.1 等写法。精确匹配失败时按标准化题号前缀补齐，
  // 确保不会因为题号格式不同而误显示“暂无答案结果文件”。
  if (!matchedQuestions.length && normalizedQuestionNo) {
    const prefix = `${normalizedQuestionNo}.`;
    matchedQuestions = questions.filter((item: any) => {
      const code = getAssignmentQuestionNo(item?.questionCode);
      const label = getAssignmentQuestionNo(item?.questionLabel);
      return code.startsWith(prefix) || label.startsWith(prefix);
    });
  }

  // Q2_PR/Q2_DW/Q2_VIDEO 等编码没有数字小题号时，使用题干中的 PR、DW、
  // 视频剪辑等关键词精确选中对应抽取结果，避免把同一大题的文件漏掉或串题。
  const subMatchForAlias = normalizedQuestionNo.match(/^(\d+)\.(\d+)$/);
  const prefixForAlias = normalizedQuestionNo.match(/^(\d+)/)?.[1] || '';
  const subIndexForAlias = subMatchForAlias?.[2] || '';
  const sourceText = String(questionText || '').toLowerCase();
  if (!matchedQuestions.length && prefixForAlias && sourceText) {
    matchedQuestions = questions.filter((item: any) => {
      const rawCode = normalizeAssignmentQuestionCode(item?.questionCode);
      const codePrefix = rawCode.match(/^Q(\d+)(?:[_ .-]|$)/i)?.[1] || '';
      if (codePrefix !== prefixForAlias) return false;
      const compactCode = rawCode.replace(/[^A-Z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
      if (subIndexForAlias && new RegExp(`_${subIndexForAlias}(?:_|$)`).test(compactCode)) return true;
      const suffix = compactCode.split('_', 2)[1]?.toUpperCase() || '';
      return (ALIAS_KEYWORDS[suffix] || []).some((alias) => sourceText.includes(alias.toLowerCase()));
    });
  }

  // MCP 题目编码还可能是 Q2_PR、Q2_DW、Q2_VIDEO 这类“同一大题下的
  // 非数字小题”。标准结构会把它们展示为 2.1、2.2、2.3，此时数字
  // 归一化后都只有大题号 2，需要按抽取结果原有顺序映射到对应小题。
  const subMatch = normalizedQuestionNo.match(/^(\d+)\.(\d+)$/);
  if (!matchedQuestions.length && subMatch) {
    const majorNo = subMatch[1];
    const subNo = Number(subMatch[2]);
    const majorCandidates = questions.filter((item: any) => (
      getAssignmentQuestionNo(item?.questionCode) === majorNo
      || getAssignmentQuestionNo(item?.questionLabel) === majorNo
    ));
    if (majorCandidates.length) {
      const selected = majorCandidates[subNo - 1];
      matchedQuestions = selected ? [selected] : [];
    }
  }

  return matchedQuestions;
};

export const getAssignmentQuestionFiles = (assignment: AssignmentRecord, questionNo: string, questionText = '') => (
  getMatchedAssignmentQuestions(assignment, questionNo, questionText)
    .flatMap((question: any) => (Array.isArray(question?.files) ? question.files : []))
);

export const getAssignmentFileRows = (assignment: AssignmentRecord, questionNo: string, questionText = '') => (
  getAssignmentQuestionFiles(assignment, questionNo, questionText).map((file: any) => ({
    fileName: file.fileName || file.file_name || '答案文件',
    fileType: file.fileType || file.file_type || '-',
    subtype: file.subtype || '-',
    reason: file.reason || file.recognition_reason || '—',
    status: file.status || file.recognition_status || 'OK'
  }))
);

export const getAssignmentFileNames = (assignment: AssignmentRecord, questionNo: string, questionText = ''): string[] => (
  [...new Set(getAssignmentQuestionFiles(assignment, questionNo, questionText)
    .map((file: any) => String(file?.fileName || file?.file_name || file?.name || '').trim())
    .filter(Boolean))] as string[]
)

export interface AssignmentTextRow {
  /** 答案内容说明：抽取字段名（大模型名称/选择原因/合适提示词…）或"作答文本" */
  description: string
  /** 文本内容：字段值 */
  content: string
  /** 文本来源：答卷文档路径 */
  source: string
  /** 来源文件类型：答卷文档扩展名（XLSX/DOCX…） */
  sourceType: string
  /** 状态：与文件表一致（OK=正常 / ABNORMAL=异常）；文本抽取成功均为 OK */
  status: string
}

/**
 * 归属结果里的文本作答内容 → 表格行（每个抽取字段一行）。
 * 没有抽取字段时返回空数组（展示层显示"无"）——答卷文档转换出的
 * 材料/题干文本不是考生答案，不作为兜底内容。
 */
export const getAssignmentTextRows = (assignment: AssignmentRecord): AssignmentTextRow[] => {
  const student = ((assignment as any)?.assignment_json?.student || {}) as any
  const extracted = student.extractedContent || {}
  return getFieldsTextRows(extracted.fields, extracted.sourceFile, extracted.sourceType)
}

/**
 * 按题号取该题自己的抽取内容（questionContents 按题挂靠，含来源文件）。
 * extractedContent 是考生级单套字段：多题科目里只装了一道题的内容，
 * 各题共用会把别的题答案当成自己的（Word 题显示/评阅到 Excel 题答案）。
 * 匹配顺序：题号精确 → 小题回退父大题号（归属按大题挂靠时 1.1 → 1）。
 */
export const getAssignmentQuestionContent = (assignment: AssignmentRecord | null | undefined, questionNo: any) => {
  const student = ((assignment as any)?.assignment_json?.student || {}) as any
  const target = getAssignmentQuestionNo(questionNo)
  if (!target) return null
  const entries = (student.questionContents || []) as any[]
  const exact = entries.find((entry) => getAssignmentQuestionNo(entry?.questionNo) === target)
  if (exact) return exact
  if (target.includes('.')) {
    const major = target.split('.')[0]
    return entries.find((entry) => getAssignmentQuestionNo(entry?.questionNo) === major) || null
  }
  return null
}

/** 指定题号的抽取内容行：只取该题自己的 fields（无则返回空，展示"无"）。 */
export const getAssignmentTextRowsForQuestion = (
  assignment: AssignmentRecord | null | undefined,
  questionNo: any
): AssignmentTextRow[] => {
  const entry = getAssignmentQuestionContent(assignment, questionNo)
  if (!entry) return []
  return getFieldsTextRows(entry.fields || {}, entry.sourceFile, entry.sourceType)
}

/** 指定字段集的抽取内容行（按题展示用：每道题的 fields + 来源文档）。 */
export const getFieldsTextRows = (
  fields: Record<string, any> | null | undefined,
  sourceFile: string = '',
  sourceType: string = ''
): AssignmentTextRow[] => {
  const source = String(sourceFile || '').trim()
  const normalizedType = String(sourceType || '').trim().toUpperCase()
    || (source.includes('.') ? (source.split('.').pop() || '').toUpperCase() : '')
  return orderAssignmentFields(fields).map(({ field, value }) => ({
    description: field,
    content: value,
    source,
    sourceType: normalizedType,
    status: 'OK'
  }))
};

// 抽取字段的展示顺序。assignment_json 是 MySQL 原生 JSON 列，对象键入库
// 时会被按字节重排，抽取端写的字段顺序到读取时已不可靠，展示层统一在此定序。
export const ASSIGNMENT_FIELD_ORDER: string[] = ['大模型名称', '大模型特点', '选择原因', '合适提示词'];

export const orderAssignmentFields = (fields: Record<string, any> | null | undefined): Array<{ field: string; value: string }> => {
  const entries = (fields || {}) as Record<string, any>;
  const ordered: Array<{ field: string; value: string }> = [];
  const push = (field: string) => {
    const value = entries[field];
    if (value !== undefined && value !== null && String(value).trim()) {
      ordered.push({ field, value: String(value) });
    }
  };
  ASSIGNMENT_FIELD_ORDER.forEach(push);
  Object.keys(entries).forEach((field) => {
    if (!ASSIGNMENT_FIELD_ORDER.includes(field)) push(field);
  });
  return ordered;
};

import type { LocalGradingRecordItem } from '@/api/teacher-scoring';
import { calculateTotalScore, getQuestionList, type LocalPackageData, type LocalStudentAnswer } from '@/utils/local-scoring-package';

export type ScoreCompareResultType = 'trial' | 'formal';

export interface TrialAttemptCompareRow {
  key: string;
  attemptNo: number;
  attemptText: string;
  standardVersionText: string;
  scoreValue: number | null;
  scoreText: string;
  manualDiffText: string;
  manualDiffClass: string;
  gradedAt: string;
  comment: string;
}

export interface QuestionCompareRow {
  question_no: string;
  questionText: string;
  record: LocalGradingRecordItem | null;
  attemptCount?: number;
  scoreValue: number | null;
  manualScoreValue: number | null;
  scoreText: string;
  comment: string;
  manualScoreText: string;
  manualDiffText: string;
  manualDiffClass: string;
  trialAttempts?: TrialAttemptCompareRow[];
  standardSpreadText?: string;
  standardSpreadClass?: string;
}

export interface StudentCompareRow {
  student_no: string;
  questionCount: number;
  gradedCount: number;
  completed: boolean;
  statusText: string;
  totalScore: number | string;
  manualTotal: number | string;
  diffText: string;
  questions: QuestionCompareRow[];
}

const numericScore = (value: any) => {
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
};

const gradingRecordKey = (studentNo: string, questionNo: string) => `${studentNo}__${questionNo}`;

const getRecordSortTime = (record: LocalGradingRecordItem) => new Date(record.graded_at || record.updated_at || '').getTime() || 0;

const sortGradingRecords = (records: LocalGradingRecordItem[]) => [...records].sort((a, b) => {
  const timeDiff = getRecordSortTime(a) - getRecordSortTime(b);
  if (timeDiff) return timeDiff;
  return Number(a.record_id || 0) - Number(b.record_id || 0);
});

const parseQuestionNoToIndexes = (questionNo?: string) => {
  const [topicText, subText] = String(questionNo || '').split('.');
  const topicIndex = Number(topicText) - 1;
  const subIndex = subText === undefined ? -1 : Number(subText) - 1;
  if (!Number.isInteger(topicIndex) || topicIndex < 0) return null;
  if (subText !== undefined && (!Number.isInteger(subIndex) || subIndex < 0)) return null;
  return { topicIndex, subIndex };
};

export const getQuestionNode = (student: LocalStudentAnswer, questionNo: string) => {
  const parsed = parseQuestionNoToIndexes(questionNo);
  if (!parsed) return null;
  const topic = getQuestionList(student.answer_json || null)[parsed.topicIndex];
  if (!topic) return null;
  return parsed.subIndex >= 0 ? topic.sub_question?.[parsed.subIndex] || null : topic;
};

export const buildQuestionRows = (localPackage: LocalPackageData | null) => {
  const student = localPackage?.students?.[0];
  const questions = getQuestionList(student?.answer_json || null);
  const rows: Array<{ question_no: string; questionText: string }> = [];
  questions.forEach((topic, topicIndex) => {
    const subQuestions = topic.sub_question || [];
    if (subQuestions.length) {
      subQuestions.forEach((subQuestion, subIndex) => {
        rows.push({
          question_no: `${topicIndex + 1}.${subIndex + 1}`,
          questionText: subQuestion.question || topic.question || ''
        });
      });
      return;
    }
    rows.push({
      question_no: String(topicIndex + 1),
      questionText: topic.question || ''
    });
  });
  return rows;
};

const formatCompareNumber = (value: number | null) => value === null ? '-' : String(Number(value.toFixed(2)));

const formatAbsoluteCompareDiff = (value: number | null) => value === null ? '-' : formatCompareNumber(Math.abs(value));

const getCompareDiffClass = (value: number | null) => {
  if (value === null || value === 0) return 'peer-diff-neutral';
  return 'peer-diff-negative';
};

// 版本号仅在为正整数时有效；null/undefined/0 都视为未记录
const positiveVersionNo = (value: unknown) => {
  const versionNo = Number(value);
  return Number.isFinite(versionNo) && versionNo > 0 ? versionNo : null;
};

export const formatRecordStandardVersionText = (record?: LocalGradingRecordItem | null) => {
  if (!record) return '标准版本 -';
  const standardVersion = positiveVersionNo(record.standard_version_no);
  const questionVersion = positiveVersionNo(record.question_version_no);
  if (standardVersion !== null && questionVersion !== null) return `标准 V${standardVersion} / 本题 V${questionVersion}`;
  if (standardVersion !== null) return `标准 V${standardVersion}`;
  if (questionVersion !== null) return `本题 V${questionVersion}`;
  if (record.standard_id) return `标准 #${record.standard_id}`;
  return '标准版本未记录';
};

const buildTrialAttempts = (records: LocalGradingRecordItem[], manualScoreValue: number | null): TrialAttemptCompareRow[] => records.map((record, index) => {
  const scoreValue = numericScore(record.score);
  const manualDiff = scoreValue !== null && manualScoreValue !== null
    ? Number((scoreValue - manualScoreValue).toFixed(2))
    : null;
  return {
    key: `${record.record_id || 'trial'}-${index}`,
    attemptNo: index + 1,
    attemptText: `第${index + 1}次`,
    standardVersionText: formatRecordStandardVersionText(record),
    scoreValue,
    scoreText: `${record.score ?? '-'}/${record.max_score ?? '-'}`,
    manualDiffText: formatAbsoluteCompareDiff(manualDiff),
    manualDiffClass: getCompareDiffClass(manualDiff),
    gradedAt: record.graded_at || record.updated_at || '-',
    comment: record.grading_desc || '暂无评语'
  };
});

const getTrialAttemptSpreadText = (attempts: TrialAttemptCompareRow[]) => {
  const scores = attempts.map((attempt) => attempt.scoreValue).filter((score): score is number => score !== null);
  if (!scores.length) return '-';
  return formatCompareNumber(Number((Math.max(...scores) - Math.min(...scores)).toFixed(2)));
};

const decorateRows = (rows: StudentCompareRow[]) => rows.map((row) => {
  let maxManualAbsDiff: number | null = null;
  const questions = row.questions.map((question) => {
    const manualDiff = question.scoreValue !== null && question.manualScoreValue !== null
      ? Number((question.scoreValue - question.manualScoreValue).toFixed(2))
      : null;
    if (manualDiff !== null) maxManualAbsDiff = Math.max(maxManualAbsDiff ?? 0, Math.abs(manualDiff));
    return {
      ...question,
      manualScoreText: formatCompareNumber(question.manualScoreValue),
      manualDiffText: formatAbsoluteCompareDiff(manualDiff),
      manualDiffClass: getCompareDiffClass(manualDiff)
    };
  });
  return {
    ...row,
    diffText: formatCompareNumber(maxManualAbsDiff),
    questions
  };
});

const buildQuestionNos = (localPackage: LocalPackageData | null, records: LocalGradingRecordItem[]) => {
  const rows = buildQuestionRows(localPackage);
  const nos = rows.map((row) => row.question_no);
  records.forEach((record) => {
    const questionNo = String(record.question_no || '').trim();
    if (questionNo && !nos.includes(questionNo)) nos.push(questionNo);
  });
  return nos;
};

const buildRecordLookup = (records: LocalGradingRecordItem[], resultType: ScoreCompareResultType) => {
  const groups = new Map<string, LocalGradingRecordItem[]>();
  records
    .filter((record) => Boolean(record.is_trial) === (resultType === 'trial'))
    .forEach((record) => {
      const key = gradingRecordKey(record.student_no, record.question_no);
      const group = groups.get(key) || [];
      group.push(record);
      groups.set(key, group);
    });
  groups.forEach((group, key) => groups.set(key, sortGradingRecords(group)));
  return groups;
};

// 同题多服务评阅合并规则：每个 MCP 服务取最新一条记录，得分按服务求和，
// 与试卷包详情页的 mergeRecordsBySum 口径保持一致。
const mergeRecordsByService = (group: LocalGradingRecordItem[]): LocalGradingRecordItem | null => {
  if (!group.length) return null;
  const byService = new Map<string, LocalGradingRecordItem>();
  group.forEach((record) => {
    const serviceKey = String(record.mcp_service_id ?? record.mcp_service_name ?? '');
    const previous = byService.get(serviceKey);
    if (!previous || getRecordSortTime(record) >= getRecordSortTime(previous)) {
      byService.set(serviceKey, record);
    }
  });
  const latestPerService = [...byService.values()];
  if (latestPerService.length === 1) return latestPerService[0];
  const totalScore = latestPerService.reduce((sum, item) => sum + (numericScore(item.score) || 0), 0);
  const comments = latestPerService
    .map((item) => {
      const label = String(item.mcp_service_name || item.mcp_service_id || 'MCP').trim();
      const comment = String(item.grading_desc || '').trim();
      return comment ? `${label}：${comment}` : '';
    })
    .filter(Boolean)
    .join('\n');
  return {
    ...latestPerService[latestPerService.length - 1],
    score: Number(totalScore.toFixed(2)),
    grading_desc: comments || latestPerService[latestPerService.length - 1].grading_desc
  } as LocalGradingRecordItem;
};

export const buildStudentScoreComparisonRows = (
  localPackage: LocalPackageData | null,
  records: LocalGradingRecordItem[],
  resultType: ScoreCompareResultType,
  selectedStudentNos: string[] = []
): StudentCompareRow[] => {
  const selectedSet = new Set(selectedStudentNos.map((item) => String(item)));
  const students = (localPackage?.students || []).filter((student) => !selectedSet.size || selectedSet.has(student.student_no));
  const questionRows = buildQuestionRows(localPackage);
  const questionTextMap = new Map(questionRows.map((row) => [row.question_no, row.questionText]));
  const questionNos = buildQuestionNos(localPackage, records);
  const recordLookup = buildRecordLookup(records, resultType);

  const rows = students.map((student) => {
    const questions = questionNos.map<QuestionCompareRow>((questionNo) => {
      const group = recordLookup.get(gradingRecordKey(student.student_no, questionNo)) || [];
      const record = mergeRecordsByService(group);
      const scoreValue = numericScore(record?.score);
      const questionNode = getQuestionNode(student, questionNo);
      const manualScoreValue = numericScore(questionNode?.score);
      const trialAttempts = resultType === 'trial' ? buildTrialAttempts(group, manualScoreValue) : undefined;
      const standardSpreadText = trialAttempts ? getTrialAttemptSpreadText(trialAttempts) : undefined;
      return {
        question_no: questionNo,
        questionText: questionTextMap.get(questionNo) || questionNode?.question || record?.question_text || '',
        record,
        attemptCount: resultType === 'trial' ? group.length : undefined,
        scoreValue,
        manualScoreValue,
        scoreText: record ? `${record.score ?? '-'}/${record.max_score ?? '-'}` : '未评',
        comment: record?.grading_desc || '暂无评语',
        manualScoreText: '-',
        manualDiffText: '-',
        manualDiffClass: 'peer-diff-neutral',
        trialAttempts,
        standardSpreadText,
        standardSpreadClass: standardSpreadText === '-' || standardSpreadText === '0' ? 'peer-diff-neutral' : 'peer-diff-negative'
      };
    });
    const gradedQuestions = questions.filter((question) => question.record);
    const totalScore = gradedQuestions.reduce((sum, question) => sum + (question.scoreValue || 0), 0);
    const manualTotal = numericScore(student.total_score ?? calculateTotalScore(student.answer_json));
    const completed = Boolean(questionNos.length) && gradedQuestions.length === questionNos.length;
    return {
      student_no: student.student_no,
      questionCount: questionNos.length,
      gradedCount: gradedQuestions.length,
      completed,
      statusText: completed ? '已完成' : `已评 ${gradedQuestions.length}/${questionNos.length}`,
      totalScore: gradedQuestions.length ? Number(totalScore.toFixed(2)) : '-',
      manualTotal: manualTotal ?? '-',
      diffText: '-',
      questions
    };
  }).filter((student) => student.gradedCount > 0);

  return decorateRows(rows);
};
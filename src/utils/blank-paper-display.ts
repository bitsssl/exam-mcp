/**
 * 将空白试卷结构与考生答卷按题号位置合并，供阅卷页面展示。
 * 空白卷负责题号、题干、子题和参考图片；考生答卷负责答案与附件。
 */
export const buildBlankPaperQuestions = (sourceQuestions: any[] = [], blankPaper?: Record<string, any> | null) => {
  const blankMajors = blankPaper && Array.isArray(blankPaper.大题) ? blankPaper.大题 : [];
  if (!blankMajors.length) return sourceQuestions;

  const getBlankText = (question: any) => {
    return String(question?.题干 || question?.标题 || '').trim();
  };
  const pickQuestionText = (source: any, blank: any, fallback = '') => {
    const sourceText = String(source?.question || '').trim();
    const blankText = getBlankText(blank);
    // 答卷解析通常包含题干中的材料、操作要求和评分相关提示，
    // 空白卷只作为历史数据缺少题干时的兜底。两者都有时保留信息更完整的一份。
    return sourceText.length >= blankText.length ? sourceText : (blankText || sourceText || fallback);
  };

  const getBlankImages = (question: any) => {
    const values = [
      ...(Array.isArray(question?.参考答案图片) ? question.参考答案图片 : []),
      ...(Array.isArray(question?.参考图片) ? question.参考图片 : [])
    ];
    return Array.from(new Set(values
      .map((image) => String(image || '').trim())
      .filter(Boolean)
      .map((image) => /^media\//i.test(image) ? image : `media/blank_paper/${image}`)));
  };

  // 答卷解析出的题干经常把步骤全文（子小题）拼在题干末尾，而空白卷的
  // 子小题会作为 display_steps 单独渲染。这里从题干中截掉已包含的步骤，
  // 保证每道题的步骤只出现一次；同时剥离步骤自带的序号，由渲染层统一编号。
  const normalizeStepText = (step: any) => String(step?.题干 || step?.标题 || '')
    .trim()
    .replace(/^[（(]\s*[0-9一二三四五六七八九十]+\s*[)）][.、．]?\s*/, '')
    .replace(/^[0-9一二三四五六七八九十]+[.、．]\s*/, '')
    .trim();

  const buildDisplaySteps = (blankQuestion: any) => (Array.isArray(blankQuestion?.子小题)
    ? blankQuestion.子小题.map(normalizeStepText).filter(Boolean)
    : []);

  const dedupeQuestionText = (questionText: string, displaySteps: string[]) => {
    if (!displaySteps.length) return questionText;
    for (const step of displaySteps) {
      // 用去掉序号后的步骤正文前缀在题干中定位（编号格式可能不一致）
      const probe = step.slice(0, Math.min(10, step.length));
      if (probe.length < 4) continue;
      const index = questionText.indexOf(probe);
      if (index <= 0) continue;
      // 回退吃掉紧邻其前的步骤序号（如「（1）」）与空白
      const head = questionText.slice(0, index).replace(/[（(]\s*[0-9]*\s*[)）]?[\s.、．]*$/, '');
      return head.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trimEnd();
    }
    return questionText;
  };

  // 大题标题是否只是占位：答卷文档名（无中文，如 WordA/ExcelA）或
  // 大模型兜底解析的通用标题（未分部分）。
  const isTrivialMajorTitle = (title: string) => {
    const text = String(title || '').trim();
    if (!text) return true;
    if (text === '未分部分') return true;
    return !/[\u4e00-\u9fa5]/.test(text);
  };

  const buildQuestionNode = (sourceQuestion: any, blankQuestion: any, fallbackTitle = '') => {
    const displaySteps = buildDisplaySteps(blankQuestion);
    return {
      ...sourceQuestion,
      question: dedupeQuestionText(pickQuestionText(sourceQuestion, blankQuestion, fallbackTitle), displaySteps),
      display_steps: displaySteps,
      images: getBlankImages(blankQuestion),
      answer_images: Array.isArray(sourceQuestion.images) ? sourceQuestion.images : [],
      answer: sourceQuestion.answer || '',
      answer_files: sourceQuestion.answer_files
    };
  };

  return blankMajors.map((major: any, topicIndex: number) => {
    const sourceTopic = sourceQuestions[topicIndex] || {};
    const blankQuestions = Array.isArray(major?.小题) ? major.小题 : [];
    const sourceSubQuestions = Array.isArray(sourceTopic.sub_question) ? sourceTopic.sub_question : [];
    const hasSubQuestions = sourceSubQuestions.length > 0 || blankQuestions.length > 1;
    const majorTitle = String(major?.标题 || major?.题干 || '').trim();

    if (!hasSubQuestions) {
      return buildQuestionNode(sourceTopic, blankQuestions[0] || {}, majorTitle);
    }

    const questionCount = Math.max(blankQuestions.length, sourceSubQuestions.length);
    const subQuestions = Array.from({ length: questionCount }, (_, subIndex) => (
      buildQuestionNode(sourceSubQuestions[subIndex] || {}, blankQuestions[subIndex] || {})
    ));
    const mergedMajorTitle = pickQuestionText(sourceTopic, major, majorTitle);

    return {
      ...sourceTopic,
      // 大题题干取考生原文与空白卷中更长的一份；仅有一道小题的大题
      // （如 11A 整卷一题），若合并后的题干只是答卷文档标题（WordA）
      // 或通用占位（未分部分），改用「第N大题」简短标题——材料与要求
      // 全文留在小题题干里。
      question: questionCount === 1 && isTrivialMajorTitle(mergedMajorTitle)
        ? `第${topicIndex + 1}大题`
        : mergedMajorTitle,
      sub_question: subQuestions
    };
  }).concat(
    // 考生解析结果多出的大题（如标准里加题后、合并卷的 Word/Excel 题）：
    // 空白卷大题按序合并之后，多出的考生题目整题追加，不丢弃。
    sourceQuestions.slice(blankMajors.length).map((sourceTopic: any) => (
      buildQuestionNode(sourceTopic || {}, {})
    ))
  );
};

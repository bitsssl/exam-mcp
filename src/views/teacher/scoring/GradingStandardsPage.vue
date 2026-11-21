<template>
  <div class="grading-setup-page">
    <aside class="question-sidebar">
      <div class="sidebar-header"><h2>试题列表</h2><span>{{ standardItems.length }} 题</span></div>
      <div v-if="selectedPackage" class="sidebar-package">{{ selectedPackage.package_name }}</div>
      <nav class="question-nav" aria-label="试题列表">
        <button v-for="(item, index) in standardItems" :key="item.local_id || item.question_no" class="question-nav-item" :class="{ active: activeIndex === index }" :aria-current="activeIndex === index ? 'page' : undefined" @click="activeIndex = index">
          <span class="nav-question-id">Q{{ item.question_no }}</span><span class="nav-question-name">{{ questionLabel(item) }}</span><span v-if="pointsLabel(item)" class="nav-question-score">{{ pointsLabel(item) }}</span><el-button v-if="!isReadOnly" text circle class="nav-edit-button" @click.stop="openQuestionEdit(index)"><el-icon><Edit /></el-icon></el-button>
        </button>
        <el-empty v-if="!loading && !standardItems.length" description="暂无题目" />
      </nav>
      <div v-if="!isReadOnly" class="sidebar-footer">
        <el-button type="primary" plain class="add-question-button" :icon="Plus" @click="addQuestion">加入题目</el-button>
      </div>
    </aside>

    <main class="editor-main">
      <header class="editor-header">
        <div class="editor-header-title">
          <h1>{{ isReadOnly ? readOnlyTitle : isEditing ? '编辑阅卷标准' : '新建阅卷标准' }}</h1>
        </div>
        <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      </header>
      <div v-loading="loading" class="editor-scroll-area" :class="{ 'is-locked': isEditing && !isCurrentEditable }">
        <el-empty v-if="!loading && !selectedPackage && !standardItems.length" description="当前考试暂无空白试卷，请先在考试管理中上传空白试卷" />
        <template v-else-if="currentItem">
          <section class="question-editor">
            <div class="current-question-heading"><div><span class="question-number">Q{{ currentItem.question_no }}</span><span v-if="pointsLabel(currentItem)" class="question-score">{{ pointsLabel(currentItem) }}</span></div><span class="question-position">{{ activeIndex + 1 }} / {{ standardItems.length }}</span><el-button v-if="isEditing" class="question-edit-icon" size="large" circle type="primary" title="编辑本题" @click="editingIndex = activeIndex"><el-icon><Edit /></el-icon></el-button></div>
            <div class="version-info"><span>本题当前版本 V{{ currentQuestionVersion(currentItem) }}</span></div>
            <section class="prompt-preview"><h2>{{ isReadOnly ? '题干' : '题干（可编辑）' }}</h2><el-input v-model="currentItem.question_text" :disabled="isFieldDisabled" type="textarea" autosize resize="none" placeholder="请检查并修正自动识别的题干" /></section>
            <section class="version-remark-row">
              <label class="version-remark-label"><span class="version-remark-tag">本题备注</span></label>
              <el-input v-model="currentItem.remark" :disabled="isFieldDisabled" class="version-remark-input" placeholder="选填，仅标注本题，例如：放宽工程文件名匹配规则" />
              <span class="version-remark-required">（选填）</span>
            </section>
            <el-form class="standard-form" label-position="top">
              <div class="question-grid">
                <el-form-item label="题型"><el-select v-model="currentItem.question_type" :disabled="isFieldDisabled" class="full-width"><el-option label="简答题" value="short_answer" /><el-option label="图片题" value="image" /><el-option label="操作题" value="operation" /><el-option label="代码题" value="code" /><el-option label="文件题" value="file" /></el-select></el-form-item>
                <el-form-item label="总分（分）"><el-input-number v-model="currentItem.max_score" :disabled="isFieldDisabled" :min="0" :step="1" :precision="2" class="full-width" /></el-form-item>
              </div>
              <el-form-item label="AI 评分服务"><el-select v-model="currentItem.mcp_service_id" :disabled="isFieldDisabled" class="full-width" filterable placeholder="选择评分服务"><el-option v-for="service in services" :key="serviceValue(service)" :label="serviceLabel(service)" :value="serviceValue(service)" /></el-select></el-form-item>
              <el-form-item label="参考答案"><el-input v-model="currentItem.reference_answer" :disabled="isFieldDisabled" type="textarea" resize="vertical" class="answer-input" placeholder="请手动填写本题参考答案" /></el-form-item>
              <el-form-item label="评分标准"><el-input v-model="currentItem.grading_criteria" :disabled="isFieldDisabled" type="textarea" resize="vertical" class="criteria-input" placeholder="请填写各项评分细则、得分点及扣分规则" /></el-form-item>
            </el-form>
            <footer class="editor-actions"><el-button :disabled="activeIndex === 0" @click="activeIndex -= 1">上一题</el-button><div class="editor-actions-right"><template v-if="!isReadOnly"><el-button type="primary" plain :loading="saving" :disabled="activeIndex >= standardItems.length - 1" @click="saveAndNext">保存并下一题</el-button><el-button type="primary" :loading="saving" @click="submit">提交</el-button></template><el-button v-else :disabled="activeIndex >= standardItems.length - 1" @click="activeIndex += 1">下一题</el-button></div></footer>
          </section>
        </template>
      </div>
    </main>
    <el-dialog v-model="questionEditVisible" title="编辑题目导航" width="min(760px, 92vw)" align-center append-to-body destroy-on-close>
      <el-form label-position="top" v-if="questionEditItem">
        <el-form-item label="题号"><el-input v-model="questionEditItem.question_no" /></el-form-item>
        <el-form-item label="题目名称/题干"><el-input v-model="questionEditItem.question_text" type="textarea" autosize resize="none" /></el-form-item>
      </el-form>
      <div class="question-ops">
        <span class="question-ops-label">题目顺序与删除（只调整题目内容，不改动试卷结构）：</span>
        <el-button size="small" :disabled="questionEditIndex <= 0" @click="moveQuestionEdit(-1)">上移</el-button>
        <el-button size="small" :disabled="questionEditIndex >= standardItems.length - 1" @click="moveQuestionEdit(1)">下移</el-button>
        <el-button size="small" type="danger" plain @click="removeQuestionEdit">删除题目</el-button>
      </div>
      <template #footer><el-button @click="questionEditVisible = false">取消</el-button><el-button type="primary" @click="saveQuestionEdit">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, Edit, Plus } from '@element-plus/icons-vue';
import { getExam, getSubject, getLocalPackage, getLatestGradingStandard, getGradingStandardVersions, createGradingStandard, type GradingStandardItem } from '@/api/teacher-scoring';
import { listServices } from '@/api/mcp';
import type { McpServiceInfo } from '@/types/marketplace';

const route = useRoute(); const router = useRouter();
const subjectId = computed(() => String(route.params.subjectId || '')); const examId = computed(() => String(route.params.examId || ''));
const isEditing = computed(() => route.query.mode === 'edit');
const isReadOnly = computed(() => route.query.view === '1');
const loading = ref(false); const saving = ref(false); const selectedPackage = ref<any>(null); const services = ref<McpServiceInfo[]>([]);
const standardItems = ref<any[]>([]);
const viewingVersion = ref<number>();
const readOnlyTitle = computed(() => viewingVersion.value ? `查看阅卷标准（V${viewingVersion.value}）` : '查看阅卷标准');
const activeIndex = ref(0);
const editingIndex = ref<number | null>(isEditing.value ? null : 0);
const isCurrentEditable = computed(() => !isEditing.value || editingIndex.value === activeIndex.value);
const isFieldDisabled = computed(() => isReadOnly.value || (isEditing.value && !isCurrentEditable.value));
const questionEditVisible = ref(false);
const questionEditItem = ref<any | null>(null);
const questionEditIndex = ref(-1);
const currentItem = computed(() => standardItems.value[activeIndex.value]);
const currentQuestionVersion = (item: any) => Number(item?.question_version_no || 1);
const goBack = () => {
  const allowedReturnPaths = new Set(['/grading/trial', '/grading/formal', '/grading-standards']);
  const returnTo = String(route.query.returnTo || '');
  void router.push(allowedReturnPaths.has(returnTo) ? returnTo : '/grading-standards');
};
const readMaxScore = (item: any) => {
  for (const key of ['max_score', 'maxScore', 'full_score', 'fullScore', 'total_possible_score']) {
    const value = Number(item?.[key]);
    if (item?.[key] !== undefined && item?.[key] !== null && item?.[key] !== '' && Number.isFinite(value)) return value;
  }
  return undefined;
};
const extractScoreFromText = (...values: unknown[]) => {
  const texts = values.map((value) => String(value || ''));
  for (const text of texts) {
    const explicit = text.match(/(?:满分\s*[:：]?|共|合计|总计)\s*(\d+(?:\.\d+)?)\s*分/);
    if (explicit) return Number(explicit[1]);
  }
  for (const text of texts) {
    const list = text.match(/分值\s*[:：]?\s*((?:\d+(?:\.\d+)?\s+)*\d+(?:\.\d+)?)/);
    if (list) return list[1].trim().split(/\s+/).reduce((sum, value) => sum + Number(value), 0);
  }
  const points = texts.flatMap((text) => [...text.matchAll(/[（(]\s*(?:占|各|共)?\s*(\d+(?:\.\d+)?)\s*分\s*[）)]/g)]);
  if (points.length) return points.reduce((sum, match) => sum + Number(match[1]), 0);
  return undefined;
};
const getQuestions = (pkg: any) => {
  const blank = pkg?.blank_paper_json;
  if (blank && Array.isArray(blank.大题)) {
    const answerSources = [pkg?.reference_answers, pkg?.answer_key_json?.reference_answers, pkg?.answer_key_json?.answers].filter(Array.isArray).flat();
    const answerByNo = new Map(answerSources.map((answer: any) => [String(answer.question_no || answer.questionNo || ''), answer]));
    const blankRows: any[] = [];
    blank.大题.forEach((major: any, majorIndex: number) => {
      const children = Array.isArray(major?.小题) ? major.小题 : [];
      children.forEach((question: any, questionIndex: number) => {
        const questionNo = children.length > 1 ? `${majorIndex + 1}.${questionIndex + 1}` : String(majorIndex + 1);
        const steps = Array.isArray(question?.子小题) ? question.子小题.map((step: any) => String(step?.题干 || '').trim()).filter(Boolean) : [];
        const questionText = [question?.题干, ...steps].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
        const answerInfo = answerByNo.get(questionNo) as any;
        const score = readMaxScore(answerInfo) ?? extractScoreFromText(answerInfo?.grading_criteria, answerInfo?.reference_answer) ?? 0;
        // _structure_ref 记录本行对应的快照节点（大题[i].小题[j]），保存时用于
        // 把教师修正过的题干同步回快照；回退考生答卷解析生成的行没有节点不打标。
        blankRows.push({ question_no: questionNo, question_text: questionText, question_type: 'short_answer', mcp_service_id: '', reference_answer: '', grading_criteria: '', max_score: score, score, remark: '', index: blankRows.length + 1, _structure_ref: { majorIndex, subIndex: questionIndex } });
      });
    });
    if (blankRows.length) return blankRows;
  }
  const sourceStudents = pkg?.students || (pkg?.parsed_students || []).map((student: any) => ({ answer_json: student }));
  const first = sourceStudents.find((s: any) => !s?.answer_json?.is_blank) || sourceStudents?.[0];
  const result = first?.answer_json?.result || [];
  const answerSources = [pkg?.reference_answers, pkg?.answer_key_json?.reference_answers, pkg?.answer_key_json?.answers]
    .filter(Array.isArray).flat();
  const answerByNo = new Map(answerSources.map((answer: any) => [String(answer.question_no || answer.questionNo || ''), answer]));
  const rows: any[] = [];
  result.forEach((topic: any, ti: number) => {
    const subs = Array.isArray(topic.sub_question) && topic.sub_question.length ? topic.sub_question : [topic];
    subs.forEach((sub: any, si: number) => {
      const questionNo = subs.length > 1 ? `${ti + 1}.${si + 1}` : String(ti + 1);
      const questionText = sub.question || topic.question || '';
      const answerInfo = answerByNo.get(questionNo) as any;
      const score = readMaxScore(answerInfo)
        ?? readMaxScore(sub)
        ?? readMaxScore(topic)
        ?? extractScoreFromText(
          questionText,
          answerInfo?.grading_criteria,
          answerInfo?.reference_answer,
          answerInfo?.评分情况,
          answerInfo?.参考答案,
          sub.grading_criteria,
          sub.reference_answer,
          topic.grading_criteria,
          topic.reference_answer
        )
        ?? 0;
      rows.push({ question_no: questionNo, question_text: questionText, question_type: 'short_answer', mcp_service_id: '', reference_answer: '', grading_criteria: '', max_score: score, score, remark: '', index: rows.length + 1 });
    });
  });
  return rows;
};
const questionLabel = (item: any) => {
  const text = String(item.question_text || '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 36) : '未命名题目';
};
const openQuestionEdit = (index: number) => {
  activeIndex.value = index;
  questionEditIndex.value = index;
  questionEditItem.value = { ...standardItems.value[index] };
  questionEditVisible.value = true;
};
const saveQuestionEdit = () => {
  if (!questionEditItem.value) return;
  // 按 questionEditIndex 定位：上移/下移会把题目挪到新的位置，
  // 不能用打开弹窗时的 activeIndex，否则会把别的题覆盖掉。
  const index = questionEditIndex.value;
  if (index < 0 || index >= standardItems.value.length) {
    questionEditVisible.value = false;
    return;
  }
  const target = standardItems.value[index];
  standardItems.value[index] = { ...target, ...questionEditItem.value };
  questionEditVisible.value = false;
};
// 题目顺序调整/删除：只改动题目内容层（交换相邻题目的内容、移除本题）。
// 快照保留原试卷结构（结构=试卷本身，删除只表示本题不参与评分）；
// 加题与题干修正在提交时由 buildPaperStructureSnapshot 合入快照。
const moveQuestionEdit = (direction: -1 | 1) => {
  const index = questionEditIndex.value;
  const target = index + direction;
  if (index < 0 || target < 0 || target >= standardItems.value.length) return;
  const tmp = standardItems.value[index];
  standardItems.value[index] = standardItems.value[target];
  standardItems.value[target] = tmp;
  questionEditIndex.value = target;
  questionEditItem.value = { ...standardItems.value[target] };
  // 右侧编辑区跟随移动后的题目，避免展示错位
  activeIndex.value = target;
};
const removeQuestionEdit = () => {
  const index = questionEditIndex.value;
  if (index < 0 || index >= standardItems.value.length) return;
  const removedNo = String(standardItems.value[index].question_no || '');
  standardItems.value.splice(index, 1);
  questionEditVisible.value = false;
  if (activeIndex.value >= standardItems.value.length) activeIndex.value = Math.max(0, standardItems.value.length - 1);
  ElMessage.success(`Q${removedNo} 已删除（仅移除本题内容，试卷结构保持不变）`);
};
const pointsLabel = (item: any) => {
  const score = Number(item.max_score ?? item.maxScore ?? item.score ?? 0);
  if (!Number.isFinite(score) || score <= 0) return '';
  return `${score} 分`;
};
const allStandardsComplete = computed(() => {
  if (!standardItems.value.length) return false;
  return !standardItems.value.some((item) =>
    !String(item.reference_answer || '').trim()
    || !String(item.grading_criteria || '').trim()
    || !item.mcp_service_id
    || !(Number(item.max_score) > 0)
  );
});
const serviceValue = (s: any) => s.service_uuid || s.id;
const serviceLabel = (s: any) => s.service_name || s.name || s.module_name || String(serviceValue(s));
// 把已保存的标准题目合入当前编辑器列表：结构内（题号能对上）的按题号
// 合并内容；结构外的题整行补回——旧标准（快照尚不含加题）或题号被改过时，
// 加过的题会因结构快照/空白卷里没有对应框架而消失，这里兜底补回。
const mergeSavedItemsIntoEditor = (savedItems: any[]) => {
  const savedByNo = new Map<string, any>(
    (savedItems || []).map((item: any) => [String(item.question_no || '').trim(), item])
  );
  standardItems.value.forEach((row) => {
    const found = savedByNo.get(String(row.question_no || '').trim());
    if (found) Object.assign(row, found);
  });
  const frameNos = new Set(standardItems.value.map((row) => String(row.question_no || '').trim()));
  (savedItems || []).forEach((item: any) => {
    const no = String(item.question_no || '').trim();
    if (!no || frameNos.has(no)) return;
    standardItems.value.push({
      ...item,
      local_id: String(item.item_id || `${no}-${standardItems.value.length}`)
    });
    frameNos.add(no);
  });
  standardItems.value = standardItems.value.map((item: any, index: number) => ({
    ...item,
    local_id: item.local_id || String(item.item_id || `${item.question_no || 'question'}-${index}`)
  }));
};
// 阅卷标准绑定的试卷结构（新建时从空白卷模板复制，提交时吸收教师加题/改题干）。
// 编辑器的题目列表从这里生成；删除/排序只改题目内容层，加题与题干修正保存时合入。
const boundStructure = ref<any>(null);
// 保存时把编辑器当前的题目集合合入结构快照：
// - 结构内已有节点（_structure_ref 命中）保留子小题/参考图片/分组等原始信息，
//   教师修正过题干时把 小题.题干 同步为编辑器最新文本；
// - 结构外新增的题（“加入题目”）按大题号追加为新的大题节点；
// - 删除/排序只改内容层，快照保留原结构节点（结构 = 试卷本身）。
const buildPaperStructureSnapshot = (base: any, items: any[]) => {
  const majors: any[] = Array.isArray(base?.大题) ? JSON.parse(JSON.stringify(base.大题)) : [];
  items.forEach((item: any) => {
    const ref = item?._structure_ref;
    if (!ref || !majors[ref.majorIndex]) return;
    const children = Array.isArray(majors[ref.majorIndex]?.小题) ? majors[ref.majorIndex].小题 : [];
    const node = children[ref.subIndex];
    if (!node) return;
    const steps = Array.isArray(node?.子小题) ? node.子小题.map((step: any) => String(step?.题干 || '').trim()).filter(Boolean) : [];
    const structureText = [node?.题干, ...steps].map((value) => String(value || '').trim()).filter(Boolean).join('\n');
    if (String(item.question_text || '') !== structureText) node.题干 = String(item.question_text || '');
  });
  // 结构外新增的题：同一大题号的多行合并成一个新大题的多个小题节点；
  // 标题留空，展示层按位置显示“第N大题”，题干由 小题.题干 承载。
  const addedByMajor = new Map<string, any[]>();
  items.forEach((item: any) => {
    if (item?._structure_ref) return;
    const majorNo = String(item?.question_no || '').split('.')[0] || 'added';
    if (!addedByMajor.has(majorNo)) addedByMajor.set(majorNo, []);
    addedByMajor.get(majorNo)!.push(item);
  });
  addedByMajor.forEach((rows) => {
    majors.push({ 标题: '', 小题: rows.map((row) => ({ 题干: String(row.question_text || '') })) });
  });
  if (!majors.length) return null;
  return { 大题: majors };
};
// 加入题目：按现有最大大题号 +1 追加一道新的大题，题干/评分信息由教师填写
const addQuestion = () => {
  const majors = new Set(standardItems.value.map((item) => String(item.question_no || '').split('.')[0]).filter(Boolean));
  let nextMajor = 1;
  while (majors.has(String(nextMajor))) nextMajor += 1;
  standardItems.value.push({
    question_no: String(nextMajor),
    question_text: '',
    question_type: 'short_answer',
    mcp_service_id: '',
    mcp_service_name: '',
    reference_answer: '',
    grading_criteria: '',
    max_score: undefined,
    remark: '',
    local_id: `added-${nextMajor}-${Date.now()}`
  });
  activeIndex.value = standardItems.value.length - 1;
  editingIndex.value = null;
  ElMessage.success(`已加入第${nextMajor}大题，请填写题干、总分、评分服务与评分标准后提交`);
};
const selectPackage = async (item: any) => {
  try {
    const response = await getLocalPackage(subjectId.value, examId.value, item.local_package_id || item.package_id);
    selectedPackage.value = response.data;
    standardItems.value = getQuestions(response.data);
    boundStructure.value = response.data?.blank_paper_json || null;
    activeIndex.value = 0;
    const standardsResponse = await getLatestGradingStandard(subjectId.value, examId.value);
    const selected = standardsResponse.data;
    mergeSavedItemsIntoEditor(selected?.standard_items || []);
  } catch (error: any) {
    const message = String(error.response?.data?.message || '');
    if (error.response?.status === 404 || message.includes('不存在或无权访问')) {
      ElMessage.warning('请先上传试卷包！');
      return;
    }
    ElMessage.error(message || '读取试卷题目失败');
  }
};
const loadExamBlankPaper = async () => {
  const [response, subjectResponse] = await Promise.all([
    getExam(subjectId.value, examId.value),
    getSubject(subjectId.value)
  ]);
  const blankPaper = response?.data?.blank_paper_json;
  if (!blankPaper || !Array.isArray(blankPaper.大题) || !blankPaper.大题.length) {
    ElMessage.warning('当前考试暂无空白试卷，请先在考试管理中上传空白试卷');
    return false;
  }
  selectedPackage.value = {
    package_name: `${subjectResponse?.data?.subject_name || '当前科目'} ${response?.data?.exam_name || '当前考试'}的试题`,
    blank_paper_json: blankPaper,
    reference_answers: [],
    answer_key_json: null,
  };
  boundStructure.value = blankPaper;
  standardItems.value = getQuestions(selectedPackage.value);
  activeIndex.value = 0;
  const standardsResponse = await getLatestGradingStandard(subjectId.value, examId.value);
  const old = standardsResponse.data?.standard_items || [];
  standardItems.value.forEach((row) => {
    const found = old.find((item: any) => String(item.question_no) === String(row.question_no));
    if (found) Object.assign(row, found);
  });
  return true;
};
const persist = async (items: any[], redirect = true, requireComplete = true) => {
  if (isReadOnly.value) return false;
  if (!items.length) { ElMessage.warning('当前没有可配置的题目'); return false; }
  const invalid = requireComplete && items.find((item) => !String(item.reference_answer || '').trim() || !String(item.grading_criteria || '').trim() || !item.mcp_service_id || !(Number(item.max_score) > 0));
  if (invalid) {
    activeIndex.value = standardItems.value.findIndex((item) => item === invalid);
    ElMessage.warning(`请完整填写 Q${invalid.question_no} 的总分、参考答案、评分标准和 AI 评分服务`); return false;
  }
  saving.value = true;
  try {
    const response = await createGradingStandard(subjectId.value, examId.value, {
      // 剔除仅编辑器使用的临时字段（index/结构节点引用），不随标准入库
      standard_items: items.map((item: any) => {
        const row: Record<string, any> = { ...item };
        delete row.index;
        delete row._structure_ref;
        return row;
      }) as GradingStandardItem[],
      // 结构快照：以空白卷为基础，吸收教师加题/改题干后的完整试卷结构，
      // 随标准保存，之后作为上传/抽取/试阅/评阅/结果页的结构来源
      paper_structure_json: buildPaperStructureSnapshot(boundStructure.value, items) || undefined,
      draft: !requireComplete
    });
    if (response.code === 0 || response.code === 200) {
      ElMessage.success('阅卷标准保存成功');
      if (redirect) await router.push({ name: 'GradingStandardsManagement' });
      return true;
    } else ElMessage.error(response.message || '保存失败');
  } catch (error: any) { ElMessage.error(error.response?.data?.message || '保存阅卷标准失败'); return false; } finally { saving.value = false; }
};
const save = async (redirect = true) => persist(standardItems.value, redirect);
const saveAndNext = async () => {
  if (activeIndex.value >= standardItems.value.length - 1) return;
  const currentIndex = activeIndex.value;
  const current = standardItems.value[currentIndex];
  if (!String(current?.reference_answer || '').trim() || !String(current?.grading_criteria || '').trim() || !current?.mcp_service_id || !(Number(current?.max_score) > 0)) {
    ElMessage.warning(`请先完整填写 Q${current?.question_no || ''} 的总分、参考答案、评分标准和 AI 评分服务`);
    return;
  }
  // 这里只保存当前页面草稿，不调用后端版本接口；整体版本和题目版本
  // 只有点击“提交”时才会真正生成。
  editingIndex.value = null;
  activeIndex.value = currentIndex + 1;
  ElMessage.success('本题已保存，已进入下一题；全部题目完成后请点击提交');
};
const submit = async () => save(true);
// 页面按 keepAlive 缓存：再次进入（查看/编辑/切换标准后）路由参数可能已
// 变化，必须按最新参数重新加载，否则会显示上一次访问的缓存内容。
const loadPage = async () => {
  loading.value = true;
  try {
    const serviceResponse = await listServices(undefined, true);
    const data: any = serviceResponse.data;
    services.value = Array.isArray(data) ? data : (data?.items || []);
    if (isReadOnly.value) {
      const response = await getGradingStandardVersions(subjectId.value, examId.value);
      const version = (response?.data || []).find((item: any) => String(item.standard_id) === String(route.query.standardId || ''));
      if (!version) throw new Error('找不到该阅卷任务使用的标准版本');
      viewingVersion.value = Number(version.version_no || 1);
      selectedPackage.value = { package_name: `${route.query.examName || '当前考试'}阅卷标准 V${viewingVersion.value}` };
      standardItems.value = (version.standard_items || []).map((item: any, index: number) => ({
        ...item,
        local_id: String(item.item_id || `${item.question_no || 'question'}-${index}`)
      }));
      activeIndex.value = 0;
    } else if (isEditing.value) {
      editingIndex.value = null;
      // 编辑时以当前科目/考试的已保存标准为唯一数据源，不能再从本地
      // 浏览器缓存中挑选“最新试卷包”，避免串到其他考试的空白卷结构。
      const standardResponse = await getLatestGradingStandard(subjectId.value, examId.value);
      const standardData = standardResponse.data || {};
      const savedItems = standardData.standard_items || [];
      // 阅卷标准绑定了自己的结构快照（创建时从空白卷复制、提交时吸收加题/改题干）：
      // 题目列表从快照生成，不再随考试空白卷变化。没有快照的旧标准
      // 回退到考试空白卷。快照外的存量加题由 mergeSavedItemsIntoEditor 补回。
      const boundSnapshot = standardData.paper_structure_json || null;
      if (boundSnapshot && Array.isArray(boundSnapshot.大题) && boundSnapshot.大题.length) {
        selectedPackage.value = {
          package_name: `${route.query.examName || '当前考试'}的试题`,
          blank_paper_json: boundSnapshot,
          reference_answers: [],
          answer_key_json: null,
        };
        boundStructure.value = boundSnapshot;
        standardItems.value = getQuestions(selectedPackage.value);
        activeIndex.value = 0;
      } else {
        await loadExamBlankPaper();
      }
      mergeSavedItemsIntoEditor(savedItems || []);
      activeIndex.value = 0;
    } else {
      await loadExamBlankPaper();
    }
  } catch {
    ElMessage.error('加载阅卷准备数据失败');
  } finally {
    loading.value = false;
  }
};
let skipNextActivatedLoad = false;
onMounted(() => {
  // 首次进入由 onMounted 加载一次；紧随其后的 onActivated 跳过，避免重复请求
  skipNextActivatedLoad = true;
  void loadPage();
});
onActivated(() => {
  // keepAlive 缓存下再次进入（查看/编辑/切换标准后重新点开）：按最新路由参数重新加载
  if (skipNextActivatedLoad) {
    skipNextActivatedLoad = false;
    return;
  }
  void loadPage();
});
</script>

<style scoped>
.grading-setup-page { display:flex; width:100%; height:100vh; min-height:650px; overflow:hidden; color:#25344a; background:#f6f8fb; font-family:"Source Han Sans SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif; }
.question-sidebar { display:flex; flex:0 0 280px; flex-direction:column; min-height:0; border-right:1px solid #e5eaf1; background:#fff; }
.sidebar-header { display:flex; align-items:center; justify-content:space-between; padding:24px 20px 16px; }
.sidebar-header h2 { margin:0; color:#1c2d46; font-size:18px; font-weight:650; }
.sidebar-header > span { color:#8995a6; font-size:13px; }
.sidebar-package { overflow:hidden; margin:0 16px 12px; padding:10px 12px; border-radius:8px; color:#52647c; background:#f5f7fa; font-size:13px; text-overflow:ellipsis; white-space:nowrap; }
.question-nav { flex:1; overflow:auto; padding:0 10px 20px; }
.question-nav-item { display:grid; width:100%; grid-template-columns:auto minmax(0,1fr) auto auto; align-items:center; gap:8px; min-height:58px; margin:4px 0; padding:10px 10px; border:0; border-radius:8px; color:#5c6b80; background:transparent; text-align:left; cursor:pointer; }
.question-nav-item:hover { background:#f3f7fd; }
.question-nav-item.active { color:#2369c7; background:#eaf3ff; box-shadow:inset 3px 0 #3478d4; }
.nav-question-id { font-size:13px; font-weight:650; white-space:nowrap; }
.nav-question-name { overflow:hidden; font-size:13px; text-overflow:ellipsis; white-space:nowrap; }
.nav-edit-button { color:#3478d4; }
.nav-question-score { color:#8290a3; font-size:12px; white-space:nowrap; }
.editor-main { display:flex; flex:1; min-width:0; flex-direction:column; }
.editor-header { display:flex; align-items:center; justify-content:space-between; gap:20px; min-height:112px; padding:20px 36px; border-bottom:1px solid #e8edf3; background:#fff; }
.editor-header-title { display:flex; align-items:center; gap:12px; }
.editor-header h1 { margin:10px 0 0; color:#1d2e48; font-size:24px; font-weight:650; }
.editor-scroll-area { flex:1; overflow:auto; padding:30px 36px 40px; } .editor-scroll-area.is-locked { background:#eef1f5; } .editor-scroll-area.is-locked .question-editor { filter:grayscale(.2); opacity:.9; } .question-edit-icon { flex:none; margin-left:16px; font-size:20px; }
.question-editor { max-width:1680px; margin:0 auto; padding:28px 32px; border:1px solid #e6ebf2; border-radius:12px; background:#fff; box-shadow:0 3px 14px rgba(30,55,85,.045); }
.current-question-heading { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
.version-info { display:flex; flex-wrap:wrap; gap:8px 16px; margin:-10px 0 22px; color:#728097; font-size:12px; }
.version-info span { padding:4px 9px; border:1px solid #e3e8ef; border-radius:5px; background:#f7f9fc; }
.question-number { color:#286bc4; font-size:20px; font-weight:700; }
.question-score { margin-left:12px; color:#738198; font-size:14px; }
.question-position { color:#8491a3; font-size:13px; }
.prompt-preview { margin-bottom:26px; padding:18px 20px; border:1px solid #e0e6ee; border-radius:9px; background:#f9fafc; }
.prompt-preview h2 { margin:0 0 12px; color:#475a73; font-size:14px; font-weight:650; }
.prompt-content { color:#3b4a60; font-size:14px; line-height:1.8; white-space:pre-wrap; overflow-wrap:anywhere; }
.version-remark-row { position:relative; display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:12px; margin:0 0 22px; padding:14px 18px; border:1px dashed #d4dce7; border-radius:9px; background:#fafbfd; }
.version-remark-label { display:contents; }
.version-remark-tag { display:inline-flex; align-items:center; padding:4px 12px; border-radius:5px; color:#3478d4; background:#eaf3ff; font-size:13px; font-weight:600; white-space:nowrap; }
.version-remark-input :deep(.el-input__wrapper) { min-height:38px; border-radius:7px; box-shadow:0 0 0 1px #d4dce7 inset; }
.version-remark-input :deep(.el-input__wrapper.is-focus) { box-shadow:0 0 0 1px #3478d4 inset; }
.version-remark-required { color:#8b97a8; font-size:12px; white-space:nowrap; }
.question-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
.full-width { width:100%; }
.standard-form :deep(.el-form-item) { margin-bottom:22px; }
.standard-form :deep(.el-form-item__label) { padding-bottom:9px; color:#354861; font-size:14px; font-weight:600; }
.standard-form :deep(.el-input__wrapper), .standard-form :deep(.el-select__wrapper) { min-height:42px; border-radius:8px; }
.standard-form :deep(.el-textarea__inner) { min-height:120px !important; padding:12px 14px; border-radius:8px; font-family:inherit; font-size:14px; line-height:1.7; }
.standard-form .criteria-input :deep(.el-textarea__inner) { min-height:220px !important; }
.editor-actions { display:flex; align-items:center; justify-content:space-between; gap:12px; padding-top:6px; }
.editor-actions-right { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:10px; }
.editor-actions :deep(.el-button) { min-height:40px; border-radius:8px; }
.sidebar-footer { padding:0 10px 16px; }
.add-question-button { width:100%; }
.question-ops { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-top:6px; padding-top:10px; border-top:1px dashed var(--el-border-color-lighter); }
.question-ops-label { color:var(--el-text-color-secondary); font-size:12px; }
@media(max-width:800px) { .grading-setup-page { height:auto; min-height:100vh; flex-direction:column; overflow:visible; }.question-sidebar { flex:auto; min-height:auto; border-right:0; border-bottom:1px solid #e5eaf1; }.question-nav { display:flex; max-height:180px; overflow:auto; }.question-nav-item { flex:0 0 250px; }.editor-header { align-items:flex-start; padding:18px; }.editor-header h1 { font-size:21px; }.editor-scroll-area { overflow:visible; padding:18px 12px; }.question-editor { padding:20px 16px; }.question-grid { grid-template-columns:1fr; gap:0; }.editor-actions { align-items:stretch; flex-direction:column-reverse; }.editor-actions-right { justify-content:space-between; } }
</style>

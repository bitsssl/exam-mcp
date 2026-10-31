<template>
  <div class="grading-setup-page">
    <aside class="question-sidebar">
      <div class="sidebar-header"><h2>试题列表</h2><span>{{ standardItems.length }} 题</span></div>
      <div v-if="selectedPackage" class="sidebar-package">{{ selectedPackage.package_name }}</div>
      <nav class="question-nav" aria-label="试题列表">
        <button v-for="(item, index) in standardItems" :key="item.question_no" class="question-nav-item" :class="{ active: activeIndex === index }" :aria-current="activeIndex === index ? 'page' : undefined" @click="activeIndex = index">
          <span class="nav-question-id">Q{{ item.question_no }}</span><span class="nav-question-name">{{ questionLabel(item) }}</span><span v-if="pointsLabel(item)" class="nav-question-score">{{ pointsLabel(item) }}</span>
        </button>
        <el-empty v-if="!loading && !standardItems.length" description="暂无题目" />
      </nav>
    </aside>

    <main class="editor-main">
      <header class="editor-header">
        <h1>{{ isEditing ? '编辑阅卷标准' : '新建阅卷标准' }}</h1>
      </header>
      <div v-loading="loading" class="editor-scroll-area">
        <el-empty v-if="!loading && !selectedPackage" description="暂无已解析试卷包，请先回到考试详情上传试卷包" />
        <template v-else-if="currentItem">
          <section class="question-editor">
            <div class="current-question-heading"><div><span class="question-number">Q{{ currentItem.question_no }}</span><span v-if="pointsLabel(currentItem)" class="question-score">{{ pointsLabel(currentItem) }}</span></div><span class="question-position">{{ activeIndex + 1 }} / {{ standardItems.length }}</span></div>
            <section class="prompt-preview"><h2>题干预览</h2><div class="prompt-content">{{ currentItem.question_text || '此题暂无题干内容' }}</div></section>
            <section class="version-remark-row">
              <label class="version-remark-label"><span class="version-remark-tag">本题备注</span></label>
              <el-input v-model="currentItem.remark" class="version-remark-input" placeholder="选填，仅标注本题，例如：放宽工程文件名匹配规则" />
              <span class="version-remark-required">（选填）</span>
            </section>
            <el-form class="standard-form" label-position="top">
              <div class="question-grid">
                <el-form-item label="题型"><el-select v-model="currentItem.question_type" class="full-width"><el-option label="简答题" value="short_answer" /><el-option label="图片题" value="image" /><el-option label="操作题" value="operation" /><el-option label="代码题" value="code" /><el-option label="文件题" value="file" /></el-select></el-form-item>
                <el-form-item label="总分（分）"><el-input-number v-model="currentItem.max_score" :min="0" :step="1" :precision="2" class="full-width" /></el-form-item>
              </div>
              <el-form-item label="AI 评分服务"><el-select v-model="currentItem.mcp_service_id" class="full-width" filterable placeholder="选择评分服务"><el-option v-for="service in services" :key="serviceValue(service)" :label="serviceLabel(service)" :value="serviceValue(service)" /></el-select></el-form-item>
              <el-form-item label="参考答案"><el-input v-model="currentItem.reference_answer" type="textarea" resize="vertical" class="answer-input" placeholder="请手动填写本题参考答案" /></el-form-item>
              <el-form-item label="评分标准"><el-input v-model="currentItem.grading_criteria" type="textarea" resize="vertical" class="criteria-input" placeholder="请填写各项评分细则、得分点及扣分规则" /></el-form-item>
            </el-form>
            <footer class="editor-actions"><el-button :disabled="activeIndex === 0" @click="activeIndex -= 1">上一题</el-button><div class="editor-actions-right"><el-button :disabled="activeIndex >= standardItems.length - 1" @click="activeIndex += 1">下一题</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></div></footer>
          </section>
        </template>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getLocalPackage, getLatestGradingStandard, createGradingStandard } from '@/api/teacher-scoring';
import { listServices } from '@/api/mcp';
import type { McpServiceInfo } from '@/types/marketplace';
import { listLocalPackages, type LocalPackageSummary } from '@/utils/local-scoring-package';

const route = useRoute(); const router = useRouter();
const subjectId = computed(() => String(route.params.subjectId || '')); const examId = computed(() => String(route.params.examId || ''));
const isEditing = computed(() => route.query.mode === 'edit');
const loading = ref(false); const saving = ref(false); const packages = ref<LocalPackageSummary[]>([]); const selectedPackage = ref<any>(null); const services = ref<McpServiceInfo[]>([]);
const standardItems = ref<any[]>([]);
const activeIndex = ref(0);
const currentItem = computed(() => standardItems.value[activeIndex.value]);
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
  );
});
const serviceValue = (s: any) => s.service_uuid || s.id;
const serviceLabel = (s: any) => s.service_name || s.name || s.module_name || String(serviceValue(s));
const selectPackage = async (item: LocalPackageSummary) => {
  try {
    const response = await getLocalPackage(subjectId.value, examId.value, item.local_package_id || item.package_id);
    selectedPackage.value = response.data;
    standardItems.value = getQuestions(response.data);
    activeIndex.value = 0;
    const standardsResponse = await getLatestGradingStandard(subjectId.value, examId.value);
    const selected = standardsResponse.data;
    const old = selected?.standard_items || [];
    standardItems.value.forEach((row) => { const found = old.find((x: any) => String(x.question_no) === row.question_no); if (found) Object.assign(row, found); });
  } catch (error: any) {
    const message = String(error.response?.data?.message || '');
    if (error.response?.status === 404 || message.includes('不存在或无权访问')) {
      ElMessage.warning('请先上传试卷包！');
      return;
    }
    ElMessage.error(message || '读取试卷题目失败');
  }
};
const save = async () => {
  if (!standardItems.value.length) return ElMessage.warning('当前没有可配置的题目');
  // 保存提交的是全部题目，必须整体校验，否则未填服务的题会被后端拒绝
  const invalid = standardItems.value.find((item) => !String(item.reference_answer || '').trim() || !String(item.grading_criteria || '').trim() || !item.mcp_service_id);
  if (invalid) {
    activeIndex.value = standardItems.value.findIndex((item) => item === invalid);
    return ElMessage.warning(`请完整填写 Q${invalid.question_no} 的参考答案、评分标准和 AI 评分服务`);
  }
  saving.value = true;
  try {
    const response = await createGradingStandard(subjectId.value, examId.value, {
      standard_items: standardItems.value.map(({ index, ...item }) => item)
    });
    if (response.code === 0 || response.code === 200) {
      ElMessage.success('阅卷标准保存成功');
      await router.push({ name: 'GradingStandardsManagement' });
    } else ElMessage.error(response.message || '保存失败');
  } catch (error: any) { ElMessage.error(error.response?.data?.message || '保存阅卷标准失败'); } finally { saving.value = false; }
};
onMounted(async () => {
  loading.value = true;
  try {
    packages.value = await listLocalPackages(subjectId.value, examId.value);
    const sourcePackage = [...packages.value].sort((left, right) => String(right.uploaded_at || '').localeCompare(String(left.uploaded_at || '')))[0];
    if (!sourcePackage) {
      ElMessage.warning('请先上传试卷包！');
      return;
    }
    const serviceResponse = await listServices(undefined, true);
    const data: any = serviceResponse.data;
    services.value = Array.isArray(data) ? data : (data?.items || []);
    await selectPackage(sourcePackage);
  } catch {
    ElMessage.error('加载阅卷准备数据失败');
  } finally {
    loading.value = false;
  }
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
.question-nav-item { display:grid; width:100%; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:8px; min-height:58px; margin:4px 0; padding:10px 10px; border:0; border-radius:8px; color:#5c6b80; background:transparent; text-align:left; cursor:pointer; }
.question-nav-item:hover { background:#f3f7fd; }
.question-nav-item.active { color:#2369c7; background:#eaf3ff; box-shadow:inset 3px 0 #3478d4; }
.nav-question-id { font-size:13px; font-weight:650; white-space:nowrap; }
.nav-question-name { overflow:hidden; font-size:13px; text-overflow:ellipsis; white-space:nowrap; }
.nav-question-score { color:#8290a3; font-size:12px; white-space:nowrap; }
.editor-main { display:flex; flex:1; min-width:0; flex-direction:column; }
.editor-header { display:flex; align-items:center; justify-content:space-between; gap:20px; min-height:112px; padding:20px 36px; border-bottom:1px solid #e8edf3; background:#fff; }
.editor-header h1 { margin:10px 0 0; color:#1d2e48; font-size:24px; font-weight:650; }
.editor-scroll-area { flex:1; overflow:auto; padding:30px 36px 40px; }
.question-editor { max-width:1680px; margin:0 auto; padding:28px 32px; border:1px solid #e6ebf2; border-radius:12px; background:#fff; box-shadow:0 3px 14px rgba(30,55,85,.045); }
.current-question-heading { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
.question-number { color:#286bc4; font-size:20px; font-weight:700; }
.question-score { margin-left:12px; color:#738198; font-size:14px; }
.question-position { color:#8491a3; font-size:13px; }
.prompt-preview { margin-bottom:26px; padding:18px 20px; border:1px solid #e0e6ee; border-radius:9px; background:#f9fafc; }
.prompt-preview h2 { margin:0 0 12px; color:#475a73; font-size:14px; font-weight:650; }
.prompt-content { max-height:220px; overflow:auto; color:#3b4a60; font-size:14px; line-height:1.8; white-space:pre-wrap; overflow-wrap:anywhere; }
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
@media(max-width:800px) { .grading-setup-page { height:auto; min-height:100vh; flex-direction:column; overflow:visible; }.question-sidebar { flex:auto; min-height:auto; border-right:0; border-bottom:1px solid #e5eaf1; }.question-nav { display:flex; max-height:180px; overflow:auto; }.question-nav-item { flex:0 0 250px; }.editor-header { align-items:flex-start; padding:18px; }.editor-header h1 { font-size:21px; }.editor-scroll-area { overflow:visible; padding:18px 12px; }.question-editor { padding:20px 16px; }.question-grid { grid-template-columns:1fr; gap:0; }.editor-actions { align-items:stretch; flex-direction:column-reverse; }.editor-actions-right { justify-content:space-between; } }
</style>

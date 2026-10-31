<template>
  <div class="template-page">
    <header class="page-header">
      <div>
        <h1>组装阅卷模板</h1>
        <p v-if="!isReadonly" class="page-description">为每道试题绑定阅卷标准版本，模板将作为试阅和正式评阅的统一依据</p>
        <p v-else class="page-description">查看当前模板各题绑定的阅卷标准版本</p>
      </div>
    </header>

    <main class="template-content">
      <section v-if="!isReadonly" class="standard-picker-panel" aria-label="选择阅卷标准">
        <div class="standard-picker-copy">
          <strong>选择阅卷标准</strong>
          <span>先选择一套整体阅卷标准，下面将列出每道题目的所有标准版本。</span>
        </div>
        <el-select v-model="selectedStandardId" filterable class="standard-picker-select" placeholder="请选择阅卷标准" @change="handleStandardChange">
          <el-option v-for="standard in standards" :key="standard.standard_id" :label="standardOptionLabel(standard)" :value="String(standard.standard_id)" />
        </el-select>
      </section>
      <section v-if="!isReadonly" class="template-meta" aria-label="模板信息">
        <el-form label-position="top" class="template-head">
          <div class="head-grid">
            <el-form-item label="模板名称">
              <el-input v-model="templateName" maxlength="100" placeholder="例如：2026 春季考试正式阅卷模板" />
            </el-form-item>
            <el-form-item label="使用说明">
              <el-input v-model="description" maxlength="500" placeholder="填写适用范围或阅卷说明" />
            </el-form-item>
          </div>
        </el-form>
      </section>
      <section v-else-if="templateName || description" class="template-meta template-meta-view">
        <div v-if="templateName" class="template-view-name">{{ templateName }}</div>
        <div v-if="description" class="template-view-desc">{{ description }}</div>
      </section>

      <section class="binding-progress" :class="{ incomplete: !isComplete }" aria-live="polite">
        <div class="progress-copy">
          <strong>{{ isComplete ? '题目绑定进度' : '还有题目未完成绑定' }}</strong>
          <span>{{ isComplete ? '所有试题均已关联阅卷标准，可以保存模板。' : '请为每道试题选择一个阅卷标准版本后再保存。' }}</span>
        </div>
        <div class="progress-meter">
          <span class="progress-count">已完成 {{ selectedCount }}/{{ rows.length }} 题绑定</span>
          <el-progress :percentage="progressPercent" :stroke-width="9" :show-text="false" :color="isComplete ? '#39a879' : '#e7a23b'" />
        </div>
      </section>

      <section class="question-list" aria-label="试题列表">
        <div v-if="!rows.length" class="empty-panel">
          <el-empty description="当前考试还没有可组装的题目，请先完成阅卷标准。" />
        </div>

        <article v-for="row in rows" :key="row.question_no" class="question-card">
          <header class="question-card-header">
            <div class="question-identity">
              <span class="question-number">Q{{ row.question_no }}</span>
              <strong class="question-name">{{ row.question_name || '未命名题目' }}</strong>
              <span class="question-score">{{ Number(row.score || 0) }} 分</span>
            </div>
            <div class="question-header-tools">
              <el-tag v-if="selections[row.question_no]" type="success" effect="light" round>✓ 已绑定</el-tag>
              <el-tag v-else type="warning" effect="light" round>⚠ 待选择</el-tag>
              <el-button text class="collapse-button" :aria-expanded="Boolean(expanded[row.question_no])" @click="toggleQuestion(row.question_no)">
                {{ expanded[row.question_no] ? '收起题干' : '展开题干' }}
                <el-icon><ArrowDown v-if="!expanded[row.question_no]" /><ArrowUp v-else /></el-icon>
              </el-button>
            </div>
          </header>

          <div v-if="expanded[row.question_no]" class="prompt-preview">
            <span class="prompt-label">试题题干</span>
            <p>{{ row.question_text || '此题暂无题干内容' }}</p>
          </div>

          <div class="binding-controls">
            <label :for="`standard-${row.question_no}`">选择阅卷标准版本</label>
            <el-select
              :id="`standard-${row.question_no}`"
              v-model="selections[row.question_no]"
              filterable
              class="standard-select"
              placeholder="请选择此题的标准版本"
              :disabled="!optionsFor(row.question_no).length || isReadonly"
            >
              <el-option
                v-for="option in optionsFor(row.question_no)"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-button v-if="!isReadonly" class="preview-button" :disabled="!selectedOption(row.question_no)" @click="openPreview(row.question_no)">预览</el-button>
          </div>
        </article>
      </section>
    </main>

    <footer v-if="!isReadonly" class="page-actions">
      <el-button @click="goToStandards">编辑阅卷标准</el-button>
      <el-button type="primary" :disabled="!isComplete || saving" :loading="saving" @click="save">保存模板</el-button>
    </footer>

    <el-dialog v-model="previewVisible" title="阅卷标准预览" width="min(720px, 90vw)" append-to-body class="standard-preview-dialog">
      <div v-if="previewItem" class="preview-content">
        <div class="preview-heading"><span>Q{{ previewItem.question_no }}</span><strong>{{ previewItem.question_type || '未设置题型' }}</strong><el-tag effect="plain">{{ previewItem.versionLabel }}</el-tag></div>
        <section class="preview-section"><h3>参考答案</h3><p>{{ previewItem.reference_answer || '暂无参考答案' }}</p></section>
        <section class="preview-section"><h3>评分标准</h3><p>{{ previewItem.grading_criteria || '暂无评分标准' }}</p></section>
      </div>
      <template #footer><el-button type="primary" @click="previewVisible = false">关闭</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue';
import { getLatestGradingStandard, getGradingStandardVersions, getGradingTemplates, createGradingTemplate, updateGradingTemplate, getLocalPackage } from '@/api/teacher-scoring';
import { getExam } from '@/api/teacher-scoring';
import { listLocalPackages } from '@/utils/local-scoring-package';

const route = useRoute();
const router = useRouter();
const subjectId = computed(() => String(route.params.subjectId || ''));
const examId = computed(() => String(route.params.examId || ''));
const isReadonly = computed(() => route.query.readonly === '1');
const isEditingTemplate = computed(() => route.query.edit === '1');
const viewTemplateId = computed(() => String(route.query.templateId || ''));
const rows = ref<any[]>([]);
const packageRows = ref<any[]>([]);
const standards = ref<any[]>([]);
const standardVersions = ref<any[]>([]);
const selectedStandardId = ref('');
const selections = ref<Record<string, string>>({});
const expanded = ref<Record<string, boolean>>({});
const templateName = ref('正式阅卷模板');
const description = ref('');
const saving = ref(false);
const examName = ref('');
const previewVisible = ref(false);
const previewItem = ref<any>(null);

const selectedCount = computed(() => rows.value.filter((row) => Boolean(selections.value[row.question_no])).length);
const isComplete = computed(() => rows.value.length > 0 && selectedCount.value === rows.value.length);
const progressPercent = computed(() => rows.value.length ? Math.round(selectedCount.value / rows.value.length * 100) : 0);

const goToStandards = () => router.push({ name: 'teacher-grading-standards', params: { subjectId: subjectId.value, examId: examId.value } });

const selectedStandard = computed(() => standards.value.find((standard) => String(standard.standard_id) === selectedStandardId.value));
const standardOptionLabel = (standard: any) => {
  const standardName = String(standard.standard_name || standard.name || examName.value || '阅卷标准').trim();
  const questionCount = standard.standard_items?.length || 0;
  const createdAt = standard.created_at ? String(standard.created_at).replace('T', ' ').slice(0, 16) : '暂无时间';
  return `${standardName} · ${questionCount}道题 · ${createdAt}`;
};

const questionRows = (pkg: any) => {
  const sourceStudents = pkg?.students || (pkg?.parsed_students || []).map((student: any) => ({ answer_json: student }));
  const first = sourceStudents?.find((student: any) => !student?.answer_json?.is_blank) || sourceStudents?.[0];
  const result = first?.answer_json?.result || [];
  const output: any[] = [];
  result.forEach((topic: any, topicIndex: number) => {
    const subs = Array.isArray(topic.sub_question) && topic.sub_question.length ? topic.sub_question : [topic];
    subs.forEach((sub: any, subIndex: number) => {
      const text = String(sub.question || topic.question || '');
      output.push({
        question_no: subs.length > 1 ? `${topicIndex + 1}.${subIndex + 1}` : String(topicIndex + 1),
        question_name: sub.name || sub.title || topic.name || topic.title || text.replace(/\s+/g, ' ').trim().slice(0, 36) || '未命名题目',
        question_text: text,
        question_type: 'short_answer',
        score: sub.score ?? sub.points ?? sub.max_score ?? topic.score ?? topic.points ?? topic.max_score ?? 0
      });
    });
  });
  return output;
};

const questionTypeLabel = (type: string) => ({
  short_answer: '简答题', image: '图片题', operation: '操作题', code: '代码题', file: '文件题'
} as Record<string, string>)[String(type || '')] || type || '未设置题型';

const optionsFor = (questionNo: string) => standardVersions.value.flatMap((standard: any) =>
  (standard.standard_items || [])
    .filter((item: any) => String(item.question_no) === questionNo)
    .map((item: any) => {
      const typeLabel = questionTypeLabel(item.question_type);
      const maxScore = item.max_score != null && Number(item.max_score) > 0 ? `（${Number(item.max_score)} 分）` : '';
      // 备注与版本号均为题目级，避免不同题目共用同一句说明
      const remark = String(item.remark || '').trim();
      const questionVersionNo = Number(item.question_version_no || 1);
      const versionTag = `V${questionVersionNo}`;
      const label = [typeLabel, maxScore, remark, versionTag].filter(Boolean).join(' · ');
      return {
        value: `${standard.standard_id}:${item.item_id || item.question_version_no || 1}`,
        label,
        versionLabel: `本题V${questionVersionNo}${remark ? ` · ${remark}` : ''}`,
        question_no: questionNo,
        question_type: item.question_type,
        reference_answer: item.reference_answer,
        grading_criteria: item.grading_criteria,
        standard_id: standard.standard_id,
        item_id: item.item_id,
        question_version_no: questionVersionNo
      };
    })
).reduce((options: any[], option: any) => {
  const existing = options.find((item) => Number(item.question_version_no) === Number(option.question_version_no));
  if (!existing || Number(option.standard_id) > Number(existing.standard_id)) {
    return [...options.filter((item) => Number(item.question_version_no) !== Number(option.question_version_no)), option];
  }
  return options;
}, []).sort((a: any, b: any) => Number(b.question_version_no || 0) - Number(a.question_version_no || 0));

const selectedOption = (questionNo: string) => optionsFor(questionNo).find((option: any) => option.value === selections.value[questionNo]);
const toggleQuestion = (questionNo: string) => { expanded.value[questionNo] = !expanded.value[questionNo]; };
const openPreview = (questionNo: string) => {
  previewItem.value = selectedOption(questionNo);
  previewVisible.value = Boolean(previewItem.value);
};

const rebuildRowsFromStandard = () => {
  const standard = selectedStandard.value;
  if (!standard) {
    rows.value = isReadonly.value ? packageRows.value : [];
    return;
  }
  const packageRowsByNo = new Map(packageRows.value.map((row) => [String(row.question_no), row]));
  rows.value = (standard.standard_items || []).map((item: any) => {
    const packageRow = packageRowsByNo.get(String(item.question_no));
    return {
      ...packageRow,
      question_no: String(item.question_no),
      question_name: packageRow?.question_name || String(item.question_text || '').replace(/\s+/g, ' ').trim().slice(0, 36) || '未命名题目',
      question_text: item.question_text || packageRow?.question_text || '',
      question_type: item.question_type || packageRow?.question_type || 'short_answer',
      score: item.max_score ?? packageRow?.score ?? 0
    };
  });
};

const handleStandardChange = () => {
  selections.value = {};
  expanded.value = {};
  rebuildRowsFromStandard();
  applyDefaultSelections();
};

const applyDefaultSelections = () => {
  rows.value.forEach((row) => {
    if (!selections.value[row.question_no]) {
      const latestOption = optionsFor(row.question_no)[0];
      if (latestOption) selections.value[row.question_no] = latestOption.value;
    }
  });
};

const save = async () => {
  if (!isComplete.value) return ElMessage.warning('请为每道题选择阅卷标准版本');
  const items = rows.value.map((row) => {
    const [standardId, itemId] = String(selections.value[row.question_no] || '').split(':');
    return { question_no: row.question_no, standard_id: Number(standardId) || 0, item_id: Number(itemId) || undefined };
  });
  saving.value = true;
  try {
    const payload = {
      template_name: templateName.value || '正式阅卷模板',
      description: description.value,
      template_items: items
    };
    const response = isEditingTemplate.value && viewTemplateId.value
      ? await updateGradingTemplate(subjectId.value, examId.value, viewTemplateId.value, payload)
      : await createGradingTemplate(subjectId.value, examId.value, payload);
    if (response.code === 0 || response.code === 200) {
      ElMessage.success('阅卷模板已保存');
      await router.push({ name: 'GradingTemplatesManagement' });
    } else {
      ElMessage.error(response.message || '保存阅卷模板失败');
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '保存阅卷模板失败');
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  try {
    const [standardResponse, standardVersionsResponse, packageList, examResponse] = await Promise.all([
      getLatestGradingStandard(subjectId.value, examId.value),
      getGradingStandardVersions(subjectId.value, examId.value),
      listLocalPackages(subjectId.value, examId.value),
      getExam(subjectId.value, examId.value)
    ]);
    const currentStandard = standardResponse.data;
    standardVersions.value = (standardVersionsResponse.data || []).sort((a: any, b: any) => Number(b.version_no || 0) - Number(a.version_no || 0));
    standards.value = currentStandard ? [currentStandard] : (standardVersions.value[0] ? [standardVersions.value[0]] : []);
    packageRows.value = [];
    // 取最新版本标准里的 max_score，覆盖 rows 里试卷包自带的分值
    const latestStandard = standards.value[0];
    const maxScoreByNo = new Map<string, number>();
    if (latestStandard?.standard_items) {
      latestStandard.standard_items.forEach((item: any) => {
        if (item.max_score != null && Number(item.max_score) > 0) maxScoreByNo.set(String(item.question_no), Number(item.max_score));
      });
    }
    if (examResponse.code === 0 || examResponse.code === 200) examName.value = String(examResponse.data?.exam_name || '').trim();
    const packageId = String(route.query.packageId || packageList[0]?.local_package_id || packageList[0]?.package_id || '');
    if (packageId) {
      const response = await getLocalPackage(subjectId.value, examId.value, packageId);
      packageRows.value = questionRows(response.data);
      packageRows.value.forEach((row) => {
        const ms = maxScoreByNo.get(String(row.question_no));
        if (ms != null) row.score = ms;
      });
    }
    selectedStandardId.value = String(standards.value[0]?.standard_id || '');
    rebuildRowsFromStandard();
    const templates = await getGradingTemplates(subjectId.value, examId.value);
    const allTemplates = templates.data || [];
    let latest = allTemplates[0];
    // 指定 templateId 时优先展示该模板（查看和编辑均适用）
    const targetTemplateId = viewTemplateId.value;
    if (targetTemplateId) {
      const matched = allTemplates.find((t: any) => String(t.template_id) === targetTemplateId);
      if (matched) latest = matched;
    }
    if (latest) {
      templateName.value = latest.template_name;
      description.value = latest.description || '';
    }
    // 查看或编辑已有模板时，回灌模板自身绑定的标准版本。
    if ((isReadonly.value || isEditingTemplate.value) && latest) {
      const items = latest.template_items || [];
      const optionKeyIndex = new Map<string, { value: string }>();
      rows.value.forEach((row) => {
        optionsFor(row.question_no).forEach((opt: any) => {
          optionKeyIndex.set(`${row.question_no}|${opt.value.split(':')[0]}`, opt);
        });
      });
      items.forEach((item: any) => {
        const qno = String(item.question_no || '');
        const sid = String(item.standard_id || '');
        const option = optionKeyIndex.get(`${qno}|${sid}`);
        if (option) selections.value[qno] = option.value;
      });
    }
    // 默认每道题选中最新版本（未匹配到模板绑定时）
    applyDefaultSelections();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '加载模板数据失败');
  }
});
</script>

<style scoped>
.template-page { min-height:100vh; padding:28px 36px 32px; color:#26364c; background:#f6f8fb; font-family:"Source Han Sans SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif; }
.page-header { max-width:1680px; margin:0 auto 22px; }
.page-header h1 { margin:11px 0 5px; color:#1d2e48; font-size:27px; font-weight:650; }
.page-description { margin:0; color:#748297; font-size:14px; line-height:1.6; }
.template-content { max-width:1680px; margin:0 auto; }
.standard-picker-panel { display:flex; align-items:center; justify-content:space-between; gap:24px; margin-bottom:16px; padding:18px 24px; border:1px solid #dce8f5; border-radius:12px; background:#f5f9ff; }
.standard-picker-copy { display:flex; flex-direction:column; gap:5px; }
.standard-picker-copy strong { color:#244d78; font-size:15px; }
.standard-picker-copy span { color:#718197; font-size:13px; }
.standard-picker-select { width:min(620px, 52%); }
.standard-picker-select :deep(.el-select__wrapper) { min-height:42px; border-radius:8px; }
.template-meta { margin-bottom:16px; padding:20px 24px 4px; border:1px solid #e8edf3; border-radius:12px; background:#eef1f5; }
.template-meta-view { padding:16px 24px; }
.template-view-name { color:#1d2e48; font-size:18px; font-weight:600; }
.template-view-desc { margin-top:8px; color:#5b6a80; font-size:13px; line-height:1.6; }
.head-grid { display:grid; grid-template-columns:1fr 1.5fr; gap:24px; }
.template-head :deep(.el-form-item) { margin-bottom:16px; }
.template-head :deep(.el-form-item__label) { color:#42546c; font-size:14px; font-weight:600; }
.template-head :deep(.el-input__wrapper) { min-height:42px; border-radius:8px; box-shadow:0 0 0 1px #dce3ec inset; }
.binding-progress { display:flex; align-items:center; justify-content:space-between; gap:30px; margin-bottom:18px; padding:18px 22px; border:1px solid #dcefe6; border-radius:11px; background:#f4fbf7; }
.binding-progress.incomplete { border-color:#f3dfbd; background:#fffaf1; }
.progress-copy { display:flex; flex-direction:column; gap:5px; }
.progress-copy strong { color:#315b49; font-size:15px; }
.progress-copy span { color:#758679; font-size:13px; }
.incomplete .progress-copy strong { color:#9b6a1d; }
.progress-meter { width:min(420px,42%); }
.progress-count { display:block; margin-bottom:8px; color:#64758a; font-size:13px; text-align:right; }
.question-list { display:flex; flex-direction:column; gap:16px; }
.question-card { padding:20px 24px 18px; border:1px solid #e5eaf1; border-radius:12px; background:#fff; box-shadow:0 3px 12px rgba(25,48,78,.045); }
.question-card-header { display:flex; align-items:center; justify-content:space-between; gap:20px; min-height:34px; }
.question-identity { display:flex; min-width:0; align-items:baseline; gap:12px; }
.question-number { flex:none; color:#286bc4; font-size:16px; font-weight:700; }
.question-name { overflow:hidden; color:#2e3f57; font-size:16px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.question-score { flex:none; color:#8290a3; font-size:13px; }
.question-header-tools { display:flex; flex:none; align-items:center; gap:12px; }
.collapse-button { color:#657994; }
.collapse-button :deep(.el-icon) { margin-left:3px; }
.prompt-preview { margin:16px 0 2px; padding:16px 18px; border:1px solid #e4e9ef; border-radius:9px; background:#f7f9fb; }
.prompt-label { color:#60738b; font-size:13px; font-weight:600; }
.prompt-preview p { max-height:220px; overflow:auto; margin:8px 0 0; color:#42536a; font-size:14px; line-height:1.8; white-space:pre-wrap; overflow-wrap:anywhere; }
.binding-controls { display:grid; grid-template-columns:170px minmax(220px,1fr) auto; align-items:center; gap:14px; margin-top:16px; padding-top:16px; border-top:1px solid #f0f2f5; }
.binding-controls > label { color:#53657d; font-size:14px; font-weight:600; }
.standard-select { width:100%; }
.standard-select :deep(.el-select__wrapper) { min-height:42px; border-radius:8px; }
.preview-button { min-width:78px; min-height:40px; border-radius:8px; }
.empty-panel { padding:36px; border:1px solid #e5eaf1; border-radius:12px; background:#fff; }
.page-actions { display:flex; justify-content:flex-end; gap:12px; max-width:1680px; margin:28px auto 0; padding:14px 0 0; border-top:1px solid #e8edf3; }
.page-actions :deep(.el-button) { min-height:42px; padding:0 22px; border-radius:8px; }
.preview-content { display:flex; flex-direction:column; gap:18px; }
.preview-heading { display:flex; align-items:center; gap:12px; padding-bottom:14px; border-bottom:1px solid #e8edf3; color:#286bc4; font-weight:650; }
.preview-heading strong { color:#42556e; font-weight:550; }
.preview-section { padding:16px 18px; border:1px solid #e7ebf1; border-radius:9px; background:#f8fafc; }
.preview-section h3 { margin:0 0 9px; color:#536780; font-size:14px; }
.preview-section p { max-height:260px; overflow:auto; margin:0; color:#35465c; font-size:14px; line-height:1.8; white-space:pre-wrap; overflow-wrap:anywhere; }
@media(max-width:900px) { .template-page { padding:20px 18px 32px; }.head-grid { grid-template-columns:1fr 1fr; gap:14px; }.binding-progress { align-items:stretch; flex-direction:column; gap:15px; }.progress-meter { width:100%; }.progress-count { text-align:left; }.standard-picker-panel { align-items:stretch; flex-direction:column; gap:14px; }.standard-picker-select { width:100%; }.page-actions { padding-right:0; padding-left:0; } }
@media(max-width:640px) { .head-grid { grid-template-columns:1fr; gap:0; }.question-card { padding:16px; }.question-card-header { align-items:flex-start; flex-direction:column; gap:8px; }.question-header-tools { justify-content:space-between; width:100%; }.binding-controls { grid-template-columns:1fr auto; gap:10px; }.binding-controls > label { grid-column:1 / -1; }.standard-select { grid-column:1; }.preview-button { grid-column:2; }.page-actions { justify-content:stretch; }.page-actions :deep(.el-button) { flex:1; padding:0 12px; } }
</style>

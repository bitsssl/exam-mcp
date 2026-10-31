<template>
  <div class="grading-page">
    <div v-if="autoMode && (autoRunning || autoFinished)" class="auto-grading-overlay">
      <div class="auto-grading-card">
        <el-icon v-if="autoRunning" class="is-loading auto-grading-icon"><Loading /></el-icon>
        <el-icon v-else class="auto-grading-icon auto-grading-done"><CircleCheck /></el-icon>
        <div class="auto-grading-title">{{ autoFinished ? '评分完成，正在返回…' : (isTrialMode ? '正在自动执行试阅…' : '正在自动执行评阅…') }}</div>
        <div class="auto-grading-desc">按已保存的阅卷模板与评分标准执行，请稍候，不要关闭页面</div>
      </div>
    </div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ title }}</span>
          <el-button @click="goBack">返回</el-button>
        </div>
      </template>

      <div
        v-loading="loading"
        class="grading-layout"
      >
        <section class="grading-pane source-pane">
          <div class="pane-heading">
            <div class="pane-title">待评阅内容</div>

          </div>
          <div v-if="!isBatchMode" class="trial-workbench" v-loading="standardLoading">
            <div class="trial-workbench-head">
              <div>
                <div class="trial-title">{{ isTrialMode ? '试阅方案' : '评阅基准' }}</div>
                <div class="trial-subtitle">{{ workbenchSubtitle }}</div>
              </div>
              <el-tag :type="isTrialMode ? 'warning' : 'success'" effect="plain">{{ trialModeLabel }}</el-tag>
            </div>
            <el-alert
              v-if="standardLoadError"
              class="trial-alert"
              type="warning"
              :title="standardLoadError"
              show-icon
              :closable="false"
            />
            <div class="trial-grid batch-trial-grid">
              <label class="trial-field">
                <span>{{ isTrialMode ? '试阅考生' : '评阅考生' }}</span>
                <div class="readonly-student-list">
                    <el-tag
                    v-for="studentNo in trialStudentNos"
                    :key="studentNo"
                    effect="plain"
                  >
                    {{ studentNo }}
                  </el-tag>
                  <span v-if="!trialStudentNos.length" class="readonly-empty">暂无已选考生</span>
                </div>
              </label>
            </div>
            <div class="batch-standard-heading">
              <span>{{ isPaperMode ? '阅卷模板' : '评阅标准' }}</span>
              <span class="batch-standard-count">（{{ trialPlanSummaryText }}）</span>
            </div>
            <div class="batch-standard-list">
              <div v-if="!isPaperMode" class="batch-standard-row">
                <div class="batch-standard-main">
                  <div class="batch-standard-title">
                    <span class="question-tag">Q{{ currentQuestionNo }}</span>
                  </div>
                  <div class="batch-standard-meta">
                    <div class="batch-standard-students">
                      <span class="student-label">考号：</span>
                      <el-tag
                        v-for="studentNo in trialStudentNos"
                        :key="studentNo"
                        size="small"
                        effect="plain"
                      >
                        {{ studentNo }}
                      </el-tag>
                    </div>
                    <span>MCP：{{ getEffectiveMcpLabelForQuestion(currentQuestionNo) || '未配置' }}</span>
                  </div>
                </div>
                <el-select
                  v-model="selectedStandardId"
                  class="batch-standard-select"
                  placeholder="选择评阅标准版本"
                  filterable
                >
                  <el-option-group :label="`题号 Q${currentQuestionNo}`">
                    <el-option
                      v-for="option in standardOptions"
                      :key="option.value"
                      :label="getBatchStandardOptionLabel(currentQuestionNo, option)"
                      :value="option.value"
                    />
                  </el-option-group>
                </el-select>
              </div>
              <div v-else class="batch-standard-row">
                <div class="batch-standard-main">
                  <div class="batch-standard-title">
                    <span class="question-tag">整卷</span>
                  </div>
                  <div class="batch-standard-meta">
                    <div class="batch-standard-students">
                      <span class="student-label">考号：</span>
                      <el-tag
                        v-for="studentNo in trialStudentNos"
                        :key="studentNo"
                        size="small"
                        effect="plain"
                      >
                        {{ studentNo }}
                      </el-tag>
                    </div>
                    <span>模板题目：{{ selectedTemplate?.template_items?.length || 0 }} 道题</span>
                    <span>MCP：按模板中每道题标准内 MCP 自动分配</span>
                  </div>
                </div>
                <el-select
                  v-model="selectedTemplateId"
                  class="batch-standard-select"
                  placeholder="选择阅卷模板"
                  filterable
                >
                  <el-option-group label="整卷阅卷模板">
                    <el-option
                      v-for="option in templateOptions"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-option-group>
                </el-select>
              </div>
            </div>
            <div class="trial-standard-preview">
              <div class="preview-title">评分依据预览</div>
              <pre>{{ isPaperMode ? getTemplateCriteriaSummary() || '请选择阅卷模板' : getTrialStandardText(currentQuestionNo) || '请选择本题评阅标准版本' }}</pre>
            </div>
            <div class="trial-action-bar">
              <div>
                <div class="trial-action-title">{{ isTrialMode ? '试阅操作' : '评阅操作' }}</div>
                <div class="trial-action-desc">{{ isTrialMode ? '按当前选择的评阅标准内 MCP 执行试阅，结果会保存到试卷包详情页的试阅结果。' : '按当前选择的评阅标准内 MCP 与评分档位执行正式评阅，结果计入考生正式成绩。' }}</div>
              </div>
              <el-button type="primary" :loading="gradingLoading" @click="saveAndStartGrading">
                {{ isTrialMode ? '保存并试阅' : '保存并评阅' }}
              </el-button>
            </div>
          </div>
          <div v-else class="trial-workbench batch-trial-workbench" v-loading="standardLoading">
            <div class="trial-workbench-head">
              <div>
                <div class="trial-title">{{ isTrialMode ? '试阅方案' : '评阅基准' }}</div>
                <div class="trial-subtitle">{{ isTrialMode ? '批量试阅按题号选择评阅标准版本，同一道题会统一使用该版本内保存的 MCP。' : '批量正式评阅按题号确认评阅标准版本（默认沿用试阅所选版本），同一道题统一使用该版本内保存的 MCP。' }}</div>
              </div>
              <el-tag :type="isTrialMode ? 'warning' : 'success'" effect="plain">{{ isTrialMode ? '批量试阅' : '批量评阅' }}</el-tag>
            </div>
            <el-alert
              v-if="standardLoadError"
              class="trial-alert"
              type="warning"
              :title="standardLoadError"
              show-icon
              :closable="false"
            />
            <div class="trial-grid batch-trial-grid">
              <label class="trial-field">
                <span>{{ isTrialMode ? '试阅考生' : '评阅考生' }}</span>
                <div class="readonly-student-list">
                  <el-tag
                    v-for="studentNo in trialStudentNos"
                    :key="studentNo"
                    effect="plain"
                  >
                    {{ studentNo }}
                  </el-tag>
                  <span v-if="!trialStudentNos.length" class="readonly-empty">暂无已选考生</span>
                </div>
              </label>

            </div>
            <div class="batch-standard-heading">
              <span>评阅标准</span>
              <span class="batch-standard-count">（{{ batchPlanQuestionNos.length }} 道题 / {{ activeBatchTargets.length }} 个{{ isTrialMode ? '试阅目标' : '评阅目标' }}）</span>
            </div>
            <div class="batch-standard-list">
              <div v-for="questionNo in batchPlanQuestionNos" :key="questionNo" class="batch-standard-row">
                <div class="batch-standard-main">
                  <div class="batch-standard-title">
                    <span class="question-tag">Q{{ questionNo }}</span>
                  </div>
                  <div class="batch-standard-meta">
                    <div class="batch-standard-students">
                      <span class="student-label">考号：</span>
                      <el-tag
                        v-for="studentNo in getQuestionTargetStudentNos(questionNo)"
                        :key="studentNo"
                        size="small"
                        effect="plain"
                      >
                        {{ studentNo }}
                      </el-tag>
                    </div>
                    <span>MCP：{{ getEffectiveMcpLabelForQuestion(questionNo) || '未配置' }}</span>
                  </div>
                </div>
                <el-select
                  v-model="selectedBatchStandardIdMap[questionNo]"
                  class="batch-standard-select"
                  placeholder="选择评阅标准版本"
                  filterable
                >
                  <el-option-group :label="`题号 Q${questionNo}`">
                    <el-option
                      v-for="option in getStandardOptionsForQuestion(questionNo)"
                      :key="option.value"
                      :label="getBatchStandardOptionLabel(questionNo, option)"
                      :value="option.value"
                    />
                  </el-option-group>
                </el-select>
              </div>
            </div>
            <div class="trial-standard-preview">
              <div class="preview-title">评分依据预览</div>
              <pre>{{ getBatchCriteriaSummary() || '请选择评阅标准版本' }}</pre>
            </div>
            <div class="trial-action-bar">
              <div>
                <div class="trial-action-title">{{ isTrialMode ? '试阅操作' : '评阅操作' }}</div>
                <div class="trial-action-desc">{{ isTrialMode ? '按当前选择的评阅标准内 MCP 执行试阅，结果会保存到试卷包详情页的试阅结果。' : '按各题确认的评阅标准内 MCP 与评分档位执行批量正式评阅，结果计入考生正式成绩。' }}</div>
              </div>
              <el-button type="primary" :loading="gradingLoading" @click="saveAndStartGrading">
                {{ isTrialMode ? '保存并试阅' : '保存并评阅' }}
              </el-button>
            </div>
          </div>
          <el-empty v-if="!isBatchMode && !currentStudent" description="暂无待评阅内容" />

          <div v-if="isBatchMode" class="source-content batch-source">
            <el-empty v-if="!activeBatchTargets.length" description="暂无批量评阅内容，请返回试卷包详情页选择题目" />
            <details
              v-for="target in activeBatchTargets"
              :key="target.key"
              class="question-block batch-source-item"
              open
            >
              <summary>
                <span class="question-tag">{{ target.label }}</span>
                <strong>{{ target.student.student_no }}</strong>
                {{ getBatchSubQuestion(target)?.question || '未命名题目' }}
              </summary>
              <div class="question-content">
                <ImageList :images="getStandaloneQuestionImages(getBatchSubQuestion(target))" :resolve="resolveImageUrl" @preview="previewImage" />
                <RichImageContent :text="getBatchSubQuestion(target)?.answer" text-class="answer-text" :resolve="resolveImageUrl" @preview="previewImage" />
              </div>
            </details>
          </div>

          <div v-else-if="currentStudent" class="source-content">
            <div class="student-meta">
              <strong>学号：</strong>{{ displayStudent?.student_no }}
              <span v-if="displayTotalScore !== null" class="score-text">
                总分：{{ displayTotalScore }}
              </span>
            </div>
            <div v-if="isPaperMode && paperModeStudents.length > 1" class="paper-student-pager">
              <el-button
                :icon="ArrowLeft"
                circle
                :disabled="paperStudentPage <= 1"
                aria-label="上一位考生"
                @click="goToPreviousPaperStudent"
              />
              <div class="paper-student-pager-main">
                <span>当前预览考生</span>
                <strong>{{ displayStudent?.student_no }}</strong>
                <em>{{ paperStudentPage }} / {{ paperStudentTotalPages }}</em>
              </div>
              <el-button
                :icon="ArrowRight"
                circle
                :disabled="paperStudentPage >= paperStudentTotalPages"
                aria-label="下一位考生"
                @click="goToNextPaperStudent"
              />
            </div>

            <template v-if="isPaperMode">
              <details
                v-for="(topic, topicIndex) in displayQuestions"
                :key="topicIndex"
                class="question-block"
                open
              >
                <summary>
                  <span class="question-tag">大题 {{ topicIndex + 1 }}</span>
                  {{ topic.question || '未命名题目' }}
                </summary>
                <div class="question-content">
                  <RichImageContent :text="topic.answer" text-class="answer-text" :resolve="resolveImageUrl" @preview="previewImage" />
                  <ImageList :images="getStandaloneQuestionImages(topic)" :resolve="resolveImageUrl" @preview="previewImage" />
                  <div
                    v-for="(subQuestion, subIndex) in topic.sub_question || []"
                    :key="subIndex"
                    class="sub-question"
                  >
                    <div class="sub-title">子题 {{ subIndex + 1 }}：{{ getDisplayText(subQuestion.question) }}</div>
                    <ImageList :images="getStandaloneQuestionImages(subQuestion)" :resolve="resolveImageUrl" @preview="previewImage" />
                    <RichImageContent :text="subQuestion.answer" text-class="answer-text" :resolve="resolveImageUrl" @preview="previewImage" />
                  </div>
                </div>
              </details>
            </template>

            <template v-else>
              <div class="question-block single-question">
                <div class="question-tag">大题 {{ topicNumber }} / 子题 {{ subNumber }}</div>
                <div class="sub-title">{{ getDisplayText(targetSubQuestion?.question) || '未命名小题' }}</div>
                <ImageList :images="getStandaloneQuestionImages(targetSubQuestion)" :resolve="resolveImageUrl" @preview="previewImage" />
                <RichImageContent :text="targetSubQuestion?.answer" text-class="answer-text" :resolve="resolveImageUrl" @preview="previewImage" />
              </div>
            </template>
          </div>
        </section>

        <section v-if="gradingResults.length" class="grading-complete-note">
          评分已完成，得分和评语已保存。请返回试卷包详情页查看结果。
        </section>
      </div>
    </el-card>

    <div v-if="previewUrl" class="lightbox" @click="closePreview">
      <button class="lightbox-close" @click.stop="closePreview">关闭</button>
      <img class="lightbox-image" :src="previewUrl" @click.stop />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, ArrowRight, CircleCheck, Loading } from '@element-plus/icons-vue';
import { listServices } from '@/api/mcp';
import type { McpServiceInfo } from '@/types/marketplace';
import { getGradingStandardVersions, getGradingTemplates, getLocalGradingRecords, getLocalPackage as getLocalPackageRegistration, gradeBatchWithMcp, gradeWithMcp, type BatchGradingResult, type BatchGradingTarget, type ExamGradingStandard, type ExamGradingTemplate, type GradingPayload, type GradingResult, type GradingStandardItem, type GradingTemplateItem, type LocalGradingRecordItem, type StudentQuestionJson, type StudentSubQuestionJson } from '@/api/teacher-scoring';
import {
  buildImageResolver,
  calculateTotalScore,
  extractEmbeddedImagePaths,
  ensureImageBlob,
  findLocalImage,
  getLocalPackage,
  getQuestionList,
  parseEmbeddedImageContent,
  saveLocalPackage,
  stripEmbeddedImageMarkers,
  type LocalPackageData,
  type LocalStudentAnswer
} from '@/utils/local-scoring-package';

const ImageList = defineComponent({
  props: {
    images: Array,
    resolve: {
      type: Function,
      required: true
    }
  },
  emits: ['preview'],
  setup(props, { emit }) {
    return () => {
      const images = (props.images || []) as string[];
      if (!images.length) return null;
      return h('div', { class: 'image-list' }, images.map((image) => {
        const url = props.resolve(image);
        if (!url) return h('span', { class: 'image-missing', title: image }, image);
        return h('img', {
          class: 'thumb',
          src: url,
          title: image,
          onClick: () => emit('preview', url)
        });
      }));
    };
  }
});

const RichImageContent = defineComponent({
  props: {
    text: String,
    textClass: {
      type: String,
      default: 'answer-text'
    },
    resolve: {
      type: Function,
      required: true
    }
  },
  emits: ['preview'],
  setup(props, { emit }) {
    return () => {
      const parts = parseEmbeddedImageContent(props.text);
      if (!parts.length) return null;
      return h('div', { class: 'rich-image-content' }, parts.map((part, index) => {
        if (part.type === 'text') {
          return h('div', { key: `text-${index}`, class: props.textClass }, part.text);
        }
        const url = props.resolve(part.path);
        if (!url) {
          return h('span', { key: `image-${index}`, class: 'image-missing', title: part.path }, part.path);
        }
        return h('img', {
          key: `image-${index}`,
          class: 'thumb embedded-thumb',
          src: url,
          title: part.path,
          onClick: () => emit('preview', url)
        });
      }));
    };
  }
});

defineOptions({
  name: 'TeacherGradingPlaceholder'
});

const route = useRoute();
const router = useRouter();
// auto=1 时进入自动执行模式：隐藏配置 UI，按已保存的阅卷模板直接开始评分
const autoMode = computed(() => String(route.query.auto || '') === '1');
const autoRunning = ref(false);
const autoFinished = ref(false);
const loading = ref(false);
const localPackage = ref<LocalPackageData | null>(null);
const previewUrl = ref('');
const imageResolver = ref<ReturnType<typeof buildImageResolver> | null>(null);
const mcpLoading = ref(false);
const mcpLoadError = ref('');
const mcpServices = ref<McpServiceInfo[]>([]);
const gradingLoading = ref(false);
const gradingResult = ref<GradingResult | null>(null);
// 多选 MCP：按服务逐个调用的结果列表
const gradingResults = ref<GradingResult[]>([]);
const batchGradingResult = ref<BatchGradingResult | null>(null);
const gradingStandardVersions = ref<ExamGradingStandard[]>([]);
const gradingTemplates = ref<ExamGradingTemplate[]>([]);
const standardLoading = ref(false);
const standardLoadError = ref('');
const selectedStandardId = ref<string | undefined>();
const selectedTemplateId = ref<number | undefined>();
const selectedTrialStudentNos = ref<string[]>([]);
const selectedBatchStandardIdMap = ref<Record<string, string | undefined>>({});
const selectedTrialRecordIdMap = ref<Record<string, number | undefined>>({});
const paperStudentPage = ref(1);
const trialGradingRecords = ref<LocalGradingRecordItem[]>([]);
// 全部评分记录（含正式评阅 is_trial=false），供正式评阅模式展示分数
const allGradingRecords = ref<LocalGradingRecordItem[]>([]);

const mode = computed(() => String(route.query.mode || ''));
const topicNumber = computed(() => Number(route.query.topic || 1));
const subNumber = computed(() => Number(route.query.sub || 1));
const isBatchMode = computed(() => mode.value === 'batch-trial' || mode.value === 'batch-grade');
const isPaperMode = computed(() => mode.value === 'paper-trial' || mode.value === 'paper-grade');
const isTrialMode = computed(() => mode.value === 'sub-trial' || mode.value === 'paper-trial' || mode.value === 'batch-trial');
// 分数展示用的记录集：正式评阅模式（batch-grade/paper-grade）显示正式记录，
// 试阅模式显示试阅记录；与试卷包详情页的取数口径保持一致，避免总分对不上。
const scoreDisplayRecords = computed<LocalGradingRecordItem[]>(() => (
  (mode.value === 'batch-grade' || mode.value === 'paper-grade' || mode.value === 'sub-grade')
    ? allGradingRecords.value.filter((record) => !record.is_trial)
    : trialGradingRecords.value
));
const titleMap: Record<string, string> = {
  'sub-trial': '小题试阅',
  'sub-grade': '小题评阅',
  'paper-trial': '整卷试阅',
  'paper-grade': '整卷评阅',
  'batch-trial': '批量试阅',
  'batch-grade': '批量评阅'
};
const title = computed(() => titleMap[mode.value] || '评阅页面');
const currentQuestionNo = computed(() => `${topicNumber.value}.${subNumber.value}`);
const packageStudents = computed(() => Array.isArray(localPackage.value?.students) ? localPackage.value.students : []);
const trialModeLabel = computed(() => {
  if (!isTrialMode.value) return '正式评阅';
  return isPaperMode.value ? '整卷试阅' : '单题试阅';
});
// 评阅基准工作台副标题：正式评阅默认沿用试阅阶段手动选择的评阅标准版本/阅卷模板
const workbenchSubtitle = computed(() => {
  if (isTrialMode.value) {
    return isPaperMode.value
      ? '选择阅卷模板和试阅考生，先看效果再进入正式评阅。'
      : '选择评阅标准和试阅考生，先看效果再进入正式评阅。';
  }
  if (isPaperMode.value) {
    return '正式整卷评阅默认沿用试阅所选阅卷模板，按模板中各题标准内保存的 MCP 与评分档位逐题执行。';
  }
  return '正式评阅默认沿用试阅所选评阅标准版本，按标准内保存的 MCP 与评分档位执行。';
});
const currentStudent = computed<LocalStudentAnswer | undefined>(() => {
  const routeStudentNo = String(route.query.studentNo || '').trim();
  const selectedStudentNo = selectedTrialStudentNos.value[0] || '';
  const studentNo = routeStudentNo || selectedStudentNo;
  return packageStudents.value.find((student) => student.student_no === studentNo) || packageStudents.value[0];
});
const questions = computed(() => currentStudent.value ? getQuestionList(currentStudent.value.answer_json || null) : []);
const targetTopic = computed(() => questions.value[topicNumber.value - 1]);
const targetSubQuestion = computed<QuestionScoreSource>(() => {
  const topic = targetTopic.value;
  if (!topic) return null;
  const subQuestions = topic.sub_question || [];
  return subQuestions[subNumber.value - 1] || (!subQuestions.length ? topic : null);
});
interface BatchTargetView {
  key: string;
  student: LocalStudentAnswer;
  topicIndex: number;
  subIndex: number;
  label: string;
}

const parseBatchTargetKey = (key: string) => {
  const parts = key.split('__');
  if (parts.length < 3) return null;
  const subIndex = Number(parts.pop()) - 1;
  const topicIndex = Number(parts.pop()) - 1;
  const studentNo = parts.join('__');
  if (!studentNo || !Number.isInteger(topicIndex) || !Number.isInteger(subIndex)) return null;
  return { studentNo, topicIndex, subIndex };
};

const getQuestionNoFromIndexes = (topicIndex: number, subIndex: number) => (
  subIndex >= 0 ? `${topicIndex + 1}.${subIndex + 1}` : `${topicIndex + 1}`
);

// “背景资料”类小题只是题干材料（如第四大题 4.1），不是作答题目：
// 不生成评阅目标、不参与评分与总分，避免大题总分被错误拆分到题干上
const isBackgroundSubQuestion = (sub?: { question?: unknown; is_background?: unknown } | null) => {
  if (!sub) return false;
  if (sub.is_background) return true;
  const title = String(sub.question || '').trim().split('\n', 1)[0] || '';
  const stripped = title.replace(/^[\d一二三四五六七八九十]+[.、．]\s*/, '');
  return stripped.startsWith('背景资料') || stripped.startsWith('背景材料');
};

const normalizeBatchTargetIndexes = (student: LocalStudentAnswer, topicIndex: number, subIndex: number) => {
  const topic = getQuestionList(student.answer_json || null)[topicIndex];
  if (!topic) return null;
  const subQuestions = topic.sub_question || [];
  if (!subQuestions.length) return { topicIndex, subIndex: -1 };
  if (subIndex >= 0 && subIndex < subQuestions.length) return { topicIndex, subIndex };
  return null;
};

interface BatchQuestionEntry {
  topic: StudentQuestionJson;
  subQuestion: StudentSubQuestionJson | null;
  topicIndex: number;
  subIndex: number;
}

const buildStudentBatchTargets = (student: LocalStudentAnswer) => getQuestionList(student.answer_json || null)
  .flatMap((topic, topicIndex): BatchQuestionEntry[] => {
    const subQuestions = topic.sub_question || [];
    if (subQuestions.length) {
      // 过滤背景资料小题但保留原始下标，保证题号（如 4.2）不变
      return subQuestions
        .map((subQuestion, subIndex) => ({ subQuestion, subIndex }))
        .filter((item) => !isBackgroundSubQuestion(item.subQuestion))
        .map((item) => ({ topic, subQuestion: item.subQuestion, topicIndex, subIndex: item.subIndex }));
    }
    return [{ topic, subQuestion: null, topicIndex, subIndex: -1 }];
  })
  .map((item) => {
    const questionNo = item.subIndex >= 0 ? `${item.topicIndex + 1}.${item.subIndex + 1}` : `${item.topicIndex + 1}`;
    const keySubIndex = item.subIndex >= 0 ? item.subIndex + 1 : 0;
    return {
      key: `${student.student_no}__${item.topicIndex + 1}__${keySubIndex}`,
      student,
      topicIndex: item.topicIndex,
      subIndex: item.subIndex,
      label: `Q${questionNo}`
    };
  });

const allBatchTargetViews = computed<BatchTargetView[]>(() => {
  if (!isBatchMode.value || !localPackage.value) return [];
  return packageStudents.value.flatMap((student) => buildStudentBatchTargets(student));
});

// targets 参数存在但无法定位到任何题目时置位，用于界面提示
const batchTargetsResolveFailed = ref(false);
watch(batchTargetsResolveFailed, (failed) => {
  if (failed) {
    ElMessage.warning('未能定位指定的评阅题目（考生信息可能与当前试卷包不一致），请从试卷包详情页重新进入评阅');
    batchTargetsResolveFailed.value = false;
  }
});

const batchTargetViews = computed<BatchTargetView[]>(() => {
  if (!isBatchMode.value || !localPackage.value) return [];
  const keys = String(route.query.targets || '').split(',').map((item) => item.trim()).filter(Boolean);
  const parsedTargets = keys.flatMap((key) => {
    const parsed = parseBatchTargetKey(key);
    if (!parsed) return [];
    const student = packageStudents.value.find((item) => item.student_no === parsed.studentNo);
    if (!student) return [];
    const normalized = normalizeBatchTargetIndexes(student, parsed.topicIndex, parsed.subIndex);
    if (!normalized) return [];
    return buildStudentBatchTargets(student).filter((target) => target.topicIndex === normalized.topicIndex);
  });
  if (parsedTargets.length) {
    const deduped = new Map<string, BatchTargetView>();
    parsedTargets.forEach((target) => deduped.set(target.key, target));
    return Array.from(deduped.values());
  }
  // targets 定位失败时不再静默回退为整包全部大题：
  // 优先按路由里的大题序号过滤，仍无法定位则提示并显示空列表。
  const topicNo = Number(route.query.topic);
  if (keys.length && Number.isInteger(topicNo) && topicNo >= 1) {
    return allBatchTargetViews.value.filter((target) => target.topicIndex === topicNo - 1);
  }
  if (keys.length) {
    batchTargetsResolveFailed.value = true;
  }
  return [];
});
type QuestionScoreSource = Pick<StudentQuestionJson, 'question' | 'answer' | 'score'> | Pick<StudentSubQuestionJson, 'question' | 'answer' | 'score'> | null | undefined;

const normalizeScoreValue = (score: number) => Number.isInteger(score) ? score : Number(score.toFixed(2));

const parseScoreNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? normalizeScoreValue(value) : null;
  }
  if (typeof value !== 'string') return null;

  const text = value.trim();
  if (!text) return null;

  const directScore = Number(text);
  if (Number.isFinite(directScore) && directScore >= 0) {
    return normalizeScoreValue(directScore);
  }

  // 数字前不能紧邻字母/数字，避免把「MC03分别」中的「03分」误判为满分
  const scoreMatches = Array.from(text.matchAll(/(?<![A-Za-z0-9])(\d+(?:\.\d+)?)\s*分/g));
  if (!scoreMatches.length) return null;

  const score = Number(scoreMatches[scoreMatches.length - 1][1]);
  return Number.isFinite(score) && score >= 0 ? normalizeScoreValue(score) : null;
};

const getQuestionDeclaredScore = (question: QuestionScoreSource) => {
  // score 字段是学生得分占位（默认 0），不能当作满分声明
  return parseScoreNumber(question?.question) ?? (Number(question?.score) > 0 ? parseScoreNumber(question?.score) : null);
};

const getTopicPerSubDeclaredScore = (topic: unknown) => {
  const title = String((topic as { question?: unknown } | null | undefined)?.question || '');
  const match = title.match(/每小题\s*(\d+(?:\.\d+)?)\s*分/);
  if (match) return normalizeScoreValue(Number(match[1]));
  // “二选一”大题（如第二大题视频/网页制作）：小题满分 = 大题满分，
  // 不做均分——评分服务按自己的细则打分可能超过单题满分，需按此满分截断
  if (title.includes('二选一')) {
    const majorScore = parseScoreNumber(title);
    if (majorScore !== null) return normalizeScoreValue(majorScore);
  }
  return null;
};

const getBatchScoreKey = (target: Pick<BatchTargetView, 'topicIndex' | 'subIndex'>) => `${target.topicIndex + 1}__${target.subIndex >= 0 ? target.subIndex + 1 : 0}`;

const standardSubScoreMap = computed(() => {
  const scoreCounts = new Map<string, Map<number, number>>();
  const addScore = (key: string, score: number | null) => {
    if (score === null) return;
    const counts = scoreCounts.get(key) || new Map<number, number>();
    counts.set(score, (counts.get(score) || 0) + 1);
    scoreCounts.set(key, counts);
  };
  (localPackage.value?.students || []).forEach((student) => {
    getQuestionList(student.answer_json || null).forEach((topic, topicIndex) => {
      const subQuestions = topic.sub_question || [];
      if (!subQuestions.length) {
        addScore(`${topicIndex + 1}__0`, getQuestionDeclaredScore(topic));
        return;
      }
      subQuestions.forEach((subQuestion, subIndex) => {
        const perSubScore = getTopicPerSubDeclaredScore(topic);
        addScore(`${topicIndex + 1}__${subIndex + 1}`, getQuestionDeclaredScore(subQuestion) ?? perSubScore);
      });
    });
  });

  const result = new Map<string, number>();
  scoreCounts.forEach((counts, key) => {
    let bestScore: number | null = null;
    let bestCount = 0;
    counts.forEach((count, score) => {
      if (count > bestCount) {
        bestScore = score;
        bestCount = count;
      }
    });
    if (bestScore !== null) result.set(key, bestScore);
  });
  return result;
});

const getBatchQuestionNo = (target: Pick<BatchTargetView, 'topicIndex' | 'subIndex'>) => getQuestionNoFromIndexes(target.topicIndex, target.subIndex);

const getBatchTopic = (target: BatchTargetView) => {
  const questions = getQuestionList(target.student.answer_json || null);
  return questions[target.topicIndex];
};

const getBatchQuestionNode = (target: BatchTargetView) => {
  const topic = getBatchTopic(target);
  return target.subIndex >= 0 ? topic?.sub_question?.[target.subIndex] : topic;
};

const getBatchSubQuestion = getBatchQuestionNode;

const getQuestionVersionNo = (item: GradingStandardItem, fallbackVersion: number) => {
  const rawVersion = Number(item.question_version_no || 0);
  return rawVersion > 0 ? rawVersion : fallbackVersion;
};

const getQuestionStandardVersions = (questionNo: string) => {
  let fallbackVersion = 0;
  const versionMap = new Map<string, { standard: ExamGradingStandard; item: GradingStandardItem; version_no: number }>();
  gradingStandardVersions.value
    .slice()
    .sort((a, b) => Number(a.version_no || 0) - Number(b.version_no || 0) || Number(a.standard_id || 0) - Number(b.standard_id || 0))
    .forEach((standard) => {
      const matchedItems = (standard.standard_items || [])
        .filter((standardItem) => String(standardItem.question_no || '').trim() === questionNo);
      matchedItems.forEach((item) => {
        const versionNo = getQuestionVersionNo(item, fallbackVersion + 1);
        fallbackVersion = Math.max(fallbackVersion, versionNo);
        const versionKey = item.item_id
          ? `item-${item.item_id}`
          : `standard-${standard.standard_id}-question-${questionNo}-v-${versionNo}`;
        if (versionMap.has(versionKey)) return;
        versionMap.set(versionKey, { standard, item, version_no: versionNo });
      });
    });
  return Array.from(versionMap.values()).sort((a, b) => a.version_no - b.version_no
    || Number(a.item.item_id || 0) - Number(b.item.item_id || 0)
    || a.standard.standard_id - b.standard.standard_id);
};

const standardOptions = computed(() => getStandardOptionsForQuestion(currentQuestionNo.value));
type StandardOptionItem = {
  value: string;
  label: string;
  version: { standard: ExamGradingStandard; item: GradingStandardItem; version_no: number };
  criteria: string;
  reference: string;
};

const questionTypeLabelMap: Record<string, string> = {
  short_answer: '简答题',
  image: '图片题',
  operation: '操作题',
  code: '代码题',
  file: '文件题',
  subjective: '主观题',
  calculation: '计算题'
};

const getQuestionTypeLabel = (value?: string) => {
  const key = String(value || '').trim();
  return questionTypeLabelMap[key] || key || '未设置类型';
};

const getStandardOptionsForQuestion = (questionNo: string): StandardOptionItem[] => getQuestionStandardVersions(questionNo).map((version) => ({
  value: `${version.standard.standard_id}:${version.item.item_id || version.version_no}`,
  label: `本题 V${version.version_no} / ${getQuestionTypeLabel(version.item.question_type)}`,
  version,
  criteria: version.item.grading_criteria || '',
  reference: version.item.reference_answer || ''
}));

const getBatchStandardOptionLabel = (questionNo: string, option: StandardOptionItem) => (
  `Q${questionNo} / 本题 V${option.version.version_no} / ${getQuestionTypeLabel(option.version.item.question_type)}`
);

const selectedStandardOption = computed(() => standardOptions.value.find((option) => option.value === selectedStandardId.value));
const selectedStandardItem = computed(() => selectedStandardOption.value?.version.item || null);
const templateOptions = computed(() => gradingTemplates.value.map((template) => ({
  value: template.template_id,
  label: `${template.template_name} / ${template.template_items?.length || 0}题 / ${template.created_at || ''}`,
  template
})));
const selectedTemplate = computed(() => templateOptions.value.find((option) => option.value === selectedTemplateId.value)?.template || null);
const selectedTemplateItemMap = computed(() => {
  const map = new Map<string, GradingTemplateItem>();
  (selectedTemplate.value?.template_items || []).forEach((item) => map.set(item.question_no, item));
  return map;
});

const trialStudentNos = computed(() => {
  const selected = selectedTrialStudentNos.value.length ? selectedTrialStudentNos.value : (currentStudent.value ? [currentStudent.value.student_no] : []);
  return selected.filter((studentNo, index, list) => Boolean(studentNo) && list.indexOf(studentNo) === index);
});

const trialStudents = computed(() => trialStudentNos.value
  .map((studentNo) => packageStudents.value.find((student) => student.student_no === studentNo))
  .filter((student): student is LocalStudentAnswer => Boolean(student)));

const paperModeStudents = computed(() => {
  if (!isPaperMode.value) return [];
  if (trialStudents.value.length) return trialStudents.value;
  return currentStudent.value ? [currentStudent.value] : [];
});
const paperStudentTotalPages = computed(() => Math.max(1, paperModeStudents.value.length));
const displayStudent = computed<LocalStudentAnswer | undefined>(() => {
  if (!isPaperMode.value) return currentStudent.value;
  const pageIndex = Math.min(Math.max(paperStudentPage.value, 1), paperStudentTotalPages.value) - 1;
  return paperModeStudents.value[pageIndex] || currentStudent.value;
});
const displayQuestions = computed(() => getQuestionList(displayStudent.value?.answer_json || null));
const displayTotalScore = computed(() => {
  if (!displayStudent.value) return null;
  return calculateDisplayedTotalScore(displayStudent.value);
});

const goToPreviousPaperStudent = () => {
  paperStudentPage.value = Math.max(1, paperStudentPage.value - 1);
};

const goToNextPaperStudent = () => {
  paperStudentPage.value = Math.min(paperStudentTotalPages.value, paperStudentPage.value + 1);
};

const trialPlanSummaryText = computed(() => {
  const studentCount = trialStudentNos.value.length;
  const targetLabel = isTrialMode.value ? '试阅目标' : '评阅目标';
  if (isPaperMode.value) {
    const questionCount = selectedTemplate.value?.template_items?.length || 0;
    return `${questionCount} 道题 / ${studentCount} 位考生 / ${questionCount * studentCount} 个${targetLabel}`;
  }
  return `1 道题 / ${studentCount} 个${targetLabel}`;
});

const batchPlanQuestionNos = computed(() => {
  const set = new Set<string>();
  batchTargetViews.value.forEach((target) => set.add(getBatchQuestionNo(target)));
  return Array.from(set).sort((a, b) => {
    const left = parseQuestionNoToIndexes(a);
    const right = parseQuestionNoToIndexes(b);
    return (left?.topicIndex ?? 0) - (right?.topicIndex ?? 0) || (left?.subIndex ?? 0) - (right?.subIndex ?? 0);
  });
});

const getMajorQuestionNosForTarget = (target?: Pick<BatchTargetView, 'student' | 'topicIndex'>) => {
  if (!target) return [];
  const topic = getStudentQuestions(target.student)[target.topicIndex];
  const subQuestions = topic?.sub_question || [];
  if (!subQuestions.length) return [getQuestionNoFromIndexes(target.topicIndex, -1)];
  return subQuestions.map((_, subIndex) => getQuestionNoFromIndexes(target.topicIndex, subIndex));
};

const getMajorQuestionNosForQuestionNo = (questionNo?: string) => {
  const parsed = parseQuestionNoToIndexes(questionNo);
  const student = currentStudent.value;
  if (!parsed || !student) return questionNo ? [questionNo] : [];
  return getMajorQuestionNosForTarget({ student, topicIndex: parsed.topicIndex });
};

const getSelectedBatchStandardId = (questionNo: string) => {
  const selected = selectedBatchStandardIdMap.value[questionNo];
  if (selected) return selected;
  return getStandardOptionsForQuestion(questionNo).slice(-1)[0]?.value;
};

const getBatchStandardVersionForQuestion = (questionNo: string) => {
  const selectedId = getSelectedBatchStandardId(questionNo);
  return getQuestionStandardVersions(questionNo).find((version) => `${version.standard.standard_id}:${version.item.item_id || version.version_no}` === selectedId) || getQuestionStandardVersions(questionNo).slice(-1)[0] || null;
};

// 阅卷标准里教师指定的总分优先，缺失时回退题干解析出的分值
const getStandardMaxScore = (questionNo: string): number | null => {
  if (!questionNo) return null;
  const candidates: Array<GradingStandardItem | null | undefined> = [];
  if (isPaperMode.value && selectedTemplate.value) {
    candidates.push(selectedTemplateItemMap.value.get(questionNo)?.standard_item);
  }
  if (isBatchMode.value) {
    candidates.push(getBatchStandardVersionForQuestion(questionNo)?.item);
  }
  candidates.push(getQuestionStandardVersions(questionNo).slice(-1)[0]?.item);
  if (questionNo === currentQuestionNo.value) candidates.push(selectedStandardItem.value);
  for (const item of candidates) {
    const raw = item?.max_score;
    const score = Number(raw);
    if (raw !== undefined && raw !== null && Number.isFinite(score) && score > 0) return score;
  }
  return null;
};

const getQuestionTargets = (questionNo: string) => batchTargetViews.value.filter((target) => getBatchQuestionNo(target) === questionNo);

const getQuestionTargetStudentNos = (questionNo: string) => getQuestionTargets(questionNo)
  .map((target) => target.student.student_no)
  .filter((studentNo, index, list) => Boolean(studentNo) && list.indexOf(studentNo) === index);

const canUseTrialWorkbench = computed(() => isTrialMode.value && !isBatchMode.value);

const parseQuestionNoToIndexes = (questionNo?: string) => {
  const [topicText, subText] = String(questionNo || '').split('.');
  const topicIndex = Number(topicText) - 1;
  const subIndex = subText === undefined ? -1 : Number(subText) - 1;
  if (!Number.isInteger(topicIndex) || !Number.isInteger(subIndex) || topicIndex < 0 || subIndex < -1) return null;
  return { topicIndex, subIndex, questionNo: getQuestionNoFromIndexes(topicIndex, subIndex) };
};

// 整卷模板题目解析：背景资料小题（如 4.1）不生成评阅目标
const resolvePaperTemplateTarget = (student: LocalStudentAnswer, questionNo: string) => {
  const parsed = parseQuestionNoToIndexes(questionNo);
  if (!parsed) return null;
  if (parsed.subIndex >= 0) {
    const topic = getQuestionList(student.answer_json || null)[parsed.topicIndex];
    const sub = topic?.sub_question?.[parsed.subIndex];
    if (isBackgroundSubQuestion(sub)) return null;
  }
  return parsed;
};

const getPaperTrialTargets = computed<BatchTargetView[]>(() => {
  if (!isTrialMode.value || !isPaperMode.value || !selectedTemplate.value) return [];
  return paperModeStudents.value.flatMap((student) => (selectedTemplate.value?.template_items || []).flatMap((item) => {
    const parsed = resolvePaperTemplateTarget(student, item.question_no);
    if (!parsed) return [];
    return [{
      key: `${student.student_no}__${parsed.topicIndex + 1}__${parsed.subIndex + 1}`,
      student,
      topicIndex: parsed.topicIndex,
      subIndex: parsed.subIndex,
      label: `Q${parsed.questionNo}`
    }];
  }));
});
const getFormalPaperTargets = computed<BatchTargetView[]>(() => {
  if (isTrialMode.value || !isPaperMode.value || !selectedTemplate.value) return [];
  return paperModeStudents.value.flatMap((student) => (selectedTemplate.value?.template_items || []).flatMap((item) => {
    const parsed = resolvePaperTemplateTarget(student, item.question_no);
    if (!parsed) return [];
    return [{
      key: `${student.student_no}__${parsed.topicIndex + 1}__${parsed.subIndex + 1}`,
      student,
      topicIndex: parsed.topicIndex,
      subIndex: parsed.subIndex,
      label: `Q${parsed.questionNo}`
    }];
  }));
});

const getStandardVersionForQuestion = (questionNo?: string) => {
  const normalizedQuestionNo = questionNo || currentQuestionNo.value;
  if (isBatchMode.value) {
    const batchVersion = getBatchStandardVersionForQuestion(normalizedQuestionNo);
    if (batchVersion) return batchVersion;
  }
  if (isPaperMode.value && selectedTemplate.value) {
    const templateItem = selectedTemplateItemMap.value.get(normalizedQuestionNo);
    if (templateItem?.standard_item) {
      return {
        standard: {
          standard_id: templateItem.standard_id,
          version_no: templateItem.standard_version_no || 0
        } as ExamGradingStandard,
        item: templateItem.standard_item,
        version_no: templateItem.question_version_no || templateItem.standard_item.question_version_no || templateItem.standard_version_no || 0,
        templateItem
      };
    }
  }
  if (normalizedQuestionNo === currentQuestionNo.value && selectedStandardOption.value) {
    return selectedStandardOption.value.version;
  }
  return getQuestionStandardVersions(normalizedQuestionNo).slice(-1)[0] || null;
};

const getMcpServiceValue = (service: McpServiceInfo) => service.service_uuid || service.id;

const getMcpServiceLabel = (service: McpServiceInfo) => {
  return service.service_name || service.name || service.module_name || service.service_uuid || String(service.id);
};
const getMcpServiceLabelByValue = (value?: string | number, fallbackName = '') => {
  if (value === undefined || value === null || value === '') return '';
  const service = mcpServices.value.find((item) => String(getMcpServiceValue(item)) === String(value));
  return service ? getMcpServiceLabel(service) : (fallbackName || String(value));
};

const getStandardMcpInfoForQuestion = (questionNo?: string) => {
  const version = getStandardVersionForQuestion(questionNo);
  const value = version?.item?.mcp_service_id;
  return {
    value,
    label: getMcpServiceLabelByValue(value, version?.item?.mcp_service_name || '')
  };
};
const getEffectiveMcpLabelForQuestion = (questionNo: string) => {
  const value = getEffectiveMcpForTarget(undefined, questionNo);
  const standardLabel = getStandardMcpInfoForQuestion(questionNo).label;
  return getMcpServiceLabelByValue(value, standardLabel);
};

// 试阅与正式评阅统一使用当前评阅标准版本内保存的 MCP；
// 正式评阅的标准版本默认沿用试阅阶段的手动选择（见 applyFormalBenchmarkDefaults）。
const getEffectiveMcpForTarget = (target?: Pick<BatchTargetView, 'key' | 'topicIndex' | 'subIndex'>, questionNo?: string) => {
  const normalizedQuestionNo = questionNo || (target ? getBatchQuestionNo(target) : undefined);
  return getStandardMcpInfoForQuestion(normalizedQuestionNo).value;
};

const getMajorEffectiveMcpValue = (target?: BatchTargetView, questionNo?: string) => {
  if (!target && !questionNo) return getEffectiveMcpForTarget(target, questionNo);
  const questionNos = target ? getMajorQuestionNosForTarget(target) : getMajorQuestionNosForQuestionNo(questionNo);
  const values = questionNos
    .map((item) => getEffectiveMcpForTarget(target, item))
    .filter((value) => value !== undefined && value !== null && value !== '');
  return values[0] ?? getEffectiveMcpForTarget(target, questionNo);
};

// 服务路由特征词：从服务名中提取专业方向关键词，用于把多选服务按小题题干路由到对应服务。
// 长词（>=3字）优先于短词，避免「二维动画/三维动画」被泛词「动画」混匹配。
const SERVICE_ROUTE_FEATURE_WORDS = [
  '音频制作', '图像制作', '二维动画', '三维动画', '视频制作', '网页制作',
  'Unity', 'Premiere', 'Dreamweaver', 'Animate', '3ds',
  '创意', '海报', '音频', '图像', '动画', 'SQL'
];

const stripServiceNameSuffix = (label: string) =>
  String(label || '').replace(/(AI)?(自动)?(评分|阅卷|批改|判分)?服务$/, '').trim();

const resolveServiceRouteKeywords = (label: string): string[] => {
  const base = stripServiceNameSuffix(label);
  if (!base) return [];
  const hits = SERVICE_ROUTE_FEATURE_WORDS.filter((word) => base.includes(word));
  const longHits = hits.filter((word) => word.length >= 3);
  return longHits.length ? longHits : hits;
};

// 路由文本拆分：小题题干首行 与 大题题干（小题只取首行，避免正文里的工具名/素材名误匹配，
// 如 1.2 正文提到"海报"、4.2 正文提到"图像制作"；大题题干可能列举三选一的全部工具名，
// 如"Animate、3ds Max、Unity3D 三选一"，只能作为小题无法判断时的兜底）
const getQuestionRouteParts = (target?: BatchTargetView, questionNo?: string): { majorText: string; subText: string } => {
  let topic: unknown;
  let subQuestion: unknown;
  if (target) {
    topic = getBatchTopic(target);
    subQuestion = getBatchSubQuestion(target);
  } else if (questionNo) {
    const [topicPart, subPart] = String(questionNo).split('.');
    const topicIndex = Number(topicPart) - 1;
    const subIndex = subPart !== undefined ? Number(subPart) - 1 : -1;
    const student = localPackage.value?.students?.[0];
    const topics = getQuestionList(student?.answer_json || null);
    topic = topics[topicIndex];
    subQuestion = subIndex >= 0 ? (topic as { sub_question?: unknown[] } | undefined)?.sub_question?.[subIndex] : undefined;
  }
  const majorText = getDisplayText((topic as { question?: string } | null | undefined)?.question);
  const subText = getDisplayText((subQuestion as { question?: string } | null | undefined)?.question).split('\n')[0];
  return { majorText, subText };
};

const matchServicesByText = (serviceUuids: string[], text: string): string[] => {
  if (!text.trim()) return [];
  return serviceUuids.filter((uuid) => {
    const keywords = resolveServiceRouteKeywords(getMcpServiceNameByUuid(uuid));
    if (!keywords.length) return false;
    return keywords.some((keyword) => text.includes(keyword));
  });
};

// 多选服务路由：一道题绑定多个服务时，按服务名关键词与题干匹配，只保留本题对应的服务
// （命中哪个评哪个，不是全部跑一遍求和）。匹配优先级：小题题干首行 > 大题题干 > 保持原列表兜底。
const routeServicesForQuestion = (serviceUuids: string[], routeParts: { majorText: string; subText: string }): string[] => {
  if (serviceUuids.length <= 1) return serviceUuids;
  const subMatched = matchServicesByText(serviceUuids, routeParts.subText);
  if (subMatched.length) return subMatched;
  const majorMatched = matchServicesByText(serviceUuids, routeParts.majorText);
  if (majorMatched.length) return majorMatched;
  return serviceUuids;
};

// 多选 MCP：标准里以逗号分隔存储，评阅时按服务逐个调用；
// 一道小题绑定多个服务时按题干路由到对应服务（命中哪个评哪个，不是全部跑一遍求和）
const getEffectiveMcpListForTarget = (target?: BatchTargetView, questionNo?: string): string[] => {
  // 优先使用当前小题自己绑定的服务；只有该小题未绑定服务时，才回落到大题级服务。
  // 若直接取大题第一个小题的服务，会让 1.2 误用 1.1 的服务、3.2/3.3 误用 3.1 的服务，
  // 出现同一大题所有小题分数和评语完全相同的串题问题。
  const normalizedQuestionNo = questionNo || (target ? getBatchQuestionNo(target) : undefined);
  const ownValue = getEffectiveMcpForTarget(target, normalizedQuestionNo);
  const value = ownValue !== undefined && ownValue !== null && String(ownValue).trim()
    ? ownValue
    : getMajorEffectiveMcpValue(target, normalizedQuestionNo);
  const list = String(value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return routeServicesForQuestion(list, getQuestionRouteParts(target, normalizedQuestionNo));
};

const getMcpServiceNameByUuid = (uuid: string) => {
  const service = mcpServices.value.find((item) => String(getMcpServiceValue(item)) === String(uuid));
  return service ? getMcpServiceLabel(service) : uuid;
};

onMounted(async () => {
  await Promise.allSettled([loadData(), loadMcpServices(), loadTrialStandards()]);
  await loadTrialGradingRecords();
  applyFormalBenchmarkDefaults();
  window.addEventListener('keydown', handleKeydown);
  if (autoMode.value) {
    // 自动执行模式：直接按已保存的阅卷模板/标准开始评分，完成后自动返回试卷包详情页
    autoRunning.value = true;
    const ok = await saveAndStartGrading();
    autoRunning.value = false;
    // 内嵌在试卷包详情页中运行时，用消息通知父页面刷新结果，不做整页跳转
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'teacher-grading-auto-done', ok }, window.location.origin);
      return;
    }
    if (ok) {
      autoFinished.value = true;
      setTimeout(() => goBack(), 800);
    }
  }
});

onBeforeUnmount(() => {
  imageResolver.value?.revoke();
  window.removeEventListener('keydown', handleKeydown);
});

const loadData = async () => {
  loading.value = true;
  try {
    const packageId = String(route.params.packageId || '');
    let found = await getLocalPackage(packageId);
    if (packageId && (!found?.local_package_id || packageId.startsWith('local_'))) {
      try {
        const remoteLocalPackageId = found?.local_package_id || found?.server_package?.local_package_id || packageId;
        const response = await getLocalPackageRegistration(
          String(route.params.subjectId),
          String(route.params.examId),
          remoteLocalPackageId
        );
        const remote = response.data;
        const remoteStudents = Array.isArray(remote?.parsed_students) ? remote.parsed_students : [];
        const remoteImages = Array.isArray(remote?.parsed_image_manifest)
          ? remote.parsed_image_manifest.map((image: any) => {
            const relativePath = image.relative_path || image.name || '';
            const cachedImage = found
              ? findLocalImage(found.images || [], relativePath)
              : undefined;
            return {
              name: image.name || relativePath.split('/').pop() || 'image',
              relativePath,
              type: image.type || `image/${image.file_type || 'png'}`,
              size: Number(image.file_size || image.size || cachedImage?.size || 0),
              blob: cachedImage?.blob || new Blob([], { type: image.type || `image/${image.file_type || 'png'}` }),
              url: image.url || cachedImage?.url
            };
          })
          : [];
        if (remote && (remoteStudents.length || found || remote.student_count === 0)) {
          const currentStudents = found?.students || [];
          const students = remoteStudents.length
            ? remoteStudents.map((entry: any, index: number) => {
              const studentNo = String(
                entry.id
                || entry.studentId
                || entry.student_no
                || entry.studentNo
                || `record-${index + 1}`
              );
              const cachedStudent = currentStudents.find((student) => student.student_no === studentNo);
              return {
                answer_id: cachedStudent?.answer_id || `${remote.package_id || packageId}_${index}`,
                student_no: studentNo,
                answer_json: entry,
                search_text: JSON.stringify(entry).toLowerCase(),
                total_score: calculateTotalScore(entry)
              };
            })
            : currentStudents;
          const cachedImages = found?.images || [];
          const mergedImages = remoteImages.length
            ? [
              ...remoteImages,
              ...cachedImages.filter((image) => !findLocalImage(remoteImages, image.relativePath || image.name))
            ]
            : cachedImages;
          found = {
            ...(found || {
              package_id: remote.package_id || `local_${remote.local_package_id}`,
              local_package_id: remote.local_package_id,
              subject_id: String(remote.subject_id || route.params.subjectId),
              exam_id: String(remote.exam_id || route.params.examId),
              package_name: remote.package_name || '试卷包',
              folder_name: remote.folder_name || '',
              json_file_name: remote.json_file_name || '',
              uploaded_at: remote.updated_at || remote.created_at || new Date().toISOString(),
              students: [],
              images: []
            }),
            package_id: remote.package_id || found?.package_id || `local_${remote.local_package_id}`,
            local_package_id: remote.local_package_id || found?.local_package_id,
            subject_id: String(remote.subject_id || found?.subject_id || route.params.subjectId),
            exam_id: String(remote.exam_id || found?.exam_id || route.params.examId),
            package_name: remote.package_name || found?.package_name || '试卷包',
            folder_name: remote.folder_name || found?.folder_name || '',
            json_file_name: remote.json_file_name || found?.json_file_name || '',
            uploaded_at: remote.updated_at || remote.created_at || found?.uploaded_at || new Date().toISOString(),
            students,
            images: mergedImages,
            package_fingerprint: remote.package_fingerprint || found?.package_fingerprint,
            quick_fingerprint: remote.quick_fingerprint || found?.quick_fingerprint,
            total_file_size: remote.total_file_size ?? found?.total_file_size,
            total_image_size: remote.total_image_size ?? found?.total_image_size,
            total_word_size: remote.total_word_size ?? found?.total_word_size,
            student_no_hash: remote.student_no_hash || found?.student_no_hash,
            reference_answers: remote.reference_answers || found?.reference_answers || [],
            answer_key_json: remote.answer_key_json || found?.answer_key_json,
            blank_paper_json: remote.blank_paper_json || found?.blank_paper_json,
            server_package: remote,
            matched_history: true
          };
          await saveLocalPackage(found);
        }
      } catch (remoteError) {
        console.error('从后端恢复本地试卷包失败', remoteError);
      }
    }
    localPackage.value = found || null;
    imageResolver.value?.revoke();
    imageResolver.value = found ? buildImageResolver(Array.isArray(found.images) ? found.images : []) : null;
    const parseStudentNos = (value: unknown) => String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter((studentNo, index, list) => Boolean(studentNo) && list.indexOf(studentNo) === index);
    if (isBatchMode.value) {
      const studentNos = String(route.query.targets || '').split(',').map((item) => parseBatchTargetKey(item.trim())?.studentNo).filter((studentNo): studentNo is string => Boolean(studentNo));
      const uniqueStudentNos = studentNos.filter((studentNo, index, list) => list.indexOf(studentNo) === index);
      selectedTrialStudentNos.value = uniqueStudentNos.length ? uniqueStudentNos : (Array.isArray(found?.students) ? found.students : []).map((student) => student.student_no);
    } else if (isPaperMode.value) {
      const routeStudentNos = parseStudentNos(route.query.studentNos);
      const initialStudentNo = String(route.query.studentNo || (Array.isArray(found?.students) ? found.students[0]?.student_no : '') || '');
      selectedTrialStudentNos.value = routeStudentNos.length ? routeStudentNos : (initialStudentNo ? [initialStudentNo] : []);
    } else {
      const initialStudentNo = String(route.query.studentNo || (Array.isArray(found?.students) ? found.students[0]?.student_no : '') || '');
      selectedTrialStudentNos.value = initialStudentNo ? [initialStudentNo] : [];
    }
  } finally {
    loading.value = false;
  }
};

const STANDARD_LOAD_TIMEOUT_MS = 12000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const loadTrialStandards = async () => {
  standardLoading.value = true;
  standardLoadError.value = '';
  try {
    const [standardsResponse, templatesResponse] = await withTimeout(Promise.all([
      getGradingStandardVersions(String(route.params.subjectId), String(route.params.examId)),
      getGradingTemplates(String(route.params.subjectId), String(route.params.examId))
    ]), STANDARD_LOAD_TIMEOUT_MS, '评阅标准加载超时，请稍后刷新重试');
    gradingStandardVersions.value = standardsResponse.data || [];
    gradingTemplates.value = templatesResponse.data || [];
    if (!selectedStandardId.value && standardOptions.value.length) {
      selectedStandardId.value = standardOptions.value[standardOptions.value.length - 1].value;
    }
    // 整卷正式评阅同样默认选中最新阅卷模板，随后由 applyFormalBenchmarkDefaults
    // 按试阅阶段手动选择的模板进行覆盖
    if (!selectedTemplateId.value && templateOptions.value.length) {
      selectedTemplateId.value = templateOptions.value[0].value;
    }
  } catch (error: any) {
    console.error('获取试阅标准失败', error);
    standardLoadError.value = error?.response?.data?.message || error?.message || '获取试阅标准失败';
    ElMessage.warning(standardLoadError.value);
  } finally {
    standardLoading.value = false;
  }
};
const loadTrialGradingRecords = async () => {
  const localPackageId = localPackage.value?.local_package_id || String(route.params.packageId || '');
  if (!localPackageId) return;
  try {
    const response = await getLocalGradingRecords(
      String(route.params.subjectId),
      String(route.params.examId),
      localPackageId
    );
    const records = (response.data || []) as LocalGradingRecordItem[];
    allGradingRecords.value = records;
    trialGradingRecords.value = records.filter((record) => Boolean(record.is_trial));
  } catch (error) {
    console.error('获取试阅记录失败', error);
  }
};

const trialRecordKey = (studentNo: string, questionNo: string) => `${studentNo}__${questionNo}`;

const getRecordSortTime = (record: LocalGradingRecordItem) => {
  const timeValue = record.graded_at || record.updated_at || '';
  const time = timeValue ? new Date(timeValue).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
};

const sortTrialRecords = (records: LocalGradingRecordItem[]) => [...records].sort((a, b) => {
  const timeDiff = getRecordSortTime(a) - getRecordSortTime(b);
  if (timeDiff) return timeDiff;
  return Number(a.record_id || 0) - Number(b.record_id || 0);
});

const trialRecordGroupMap = computed(() => {
  const map = new Map<string, LocalGradingRecordItem[]>();
  trialGradingRecords.value.forEach((record) => {
    const key = trialRecordKey(record.student_no, record.question_no);
    const records = map.get(key) || [];
    records.push(record);
    map.set(key, records);
  });
  map.forEach((records, key) => map.set(key, sortTrialRecords(records)));
  return map;
});

const getTrialRecords = (studentNo?: string, questionNo?: string) => {
  if (!studentNo || !questionNo) return [];
  return trialRecordGroupMap.value.get(trialRecordKey(studentNo, questionNo)) || [];
};

const setSelectedTrialRecordId = (key: string, recordId?: number) => {
  selectedTrialRecordIdMap.value = { ...selectedTrialRecordIdMap.value, [key]: recordId };
};

const mergeTrialGradingRecord = (record?: LocalGradingRecordItem) => {
  if (!record || !record.is_trial || !record.student_no || !record.question_no) return;
  const existingIndex = trialGradingRecords.value.findIndex((item) => (
    Number(item.record_id) > 0
    && Number(record.record_id) > 0
    && Number(item.record_id) === Number(record.record_id)
  ));
  if (existingIndex >= 0) {
    const nextRecords = [...trialGradingRecords.value];
    nextRecords[existingIndex] = record;
    trialGradingRecords.value = nextRecords;
  } else {
    trialGradingRecords.value = [...trialGradingRecords.value, record];
  }
  const questionNo = String(record.question_no).trim();
  const selectedKey = trialRecordKey(record.student_no, questionNo);
  setSelectedTrialRecordId(selectedKey, record.record_id);
};

const getQuestionNoAliases = (questionNo?: string) => {
  const normalized = String(questionNo || '').trim();
  if (!normalized) return [];
  const aliases = [normalized];
  if (normalized.includes('.')) {
    const [topicNo, subNo] = normalized.split('.', 2);
    if (subNo === '1') aliases.push(topicNo);
  } else {
    aliases.push(`${normalized}.1`);
  }
  return Array.from(new Set(aliases));
};

const parseRecordResult = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text) return value;
  try {
    return JSON.parse(text);
  } catch {
    const fencedJson = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim();
    if (fencedJson) {
      try {
        return JSON.parse(fencedJson);
      } catch {
        // MCP 有时会把 JSON 包在 Markdown 代码块里，解析失败时继续按原文本处理。
      }
    }
    return value;
  }
};

const getResultCandidates = (value: unknown, seen = new Set<unknown>()): Record<string, unknown>[] => {
  const parsed = parseRecordResult(value);
  if (!parsed || typeof parsed !== 'object' || seen.has(parsed)) return [];
  seen.add(parsed);

  if (Array.isArray(parsed)) {
    return parsed.flatMap((item) => getResultCandidates(item, seen));
  }

  const candidate = parsed as Record<string, unknown>;
  const nestedKeys = ['score_data', 'result', 'data', 'output', 'evaluation', 'response', 'content'];
  return [
    candidate,
    ...nestedKeys.flatMap((key) => getResultCandidates(candidate[key], seen))
  ];
};

const unwrapGradingApiData = <T,>(response: any): T | undefined => {
  const body = response?.data;
  if (
    body
    && typeof body === 'object'
    && !Array.isArray(body)
    && ('code' in body || 'message' in body)
    && Object.prototype.hasOwnProperty.call(body, 'data')
  ) {
    return body.data as T | undefined;
  }
  return body as T | undefined;
};

const getTrialRecordScore = (record?: LocalGradingRecordItem | null): number | null => {
  if (!record) return null;
  const directScore = parseScoreNumber(record.score);
  if (directScore !== null) return directScore;
  const candidates = getResultCandidates(record.result ?? record.mcp_raw_json);
  for (const candidate of candidates) {
    for (const key of ['score', 'earned_score', 'obtained_score', 'points', 'total_score', '得分', '总分']) {
      const score = parseScoreNumber(candidate[key]);
      if (score !== null) return score;
    }
  }
  return null;
};

const calculateDisplayedTotalScore = (student?: LocalStudentAnswer | null): number | string | null => {
  if (!student) return null;
  const questions = getQuestionList(student.answer_json || null);
  if (!questions.length) return student.total_score ?? calculateTotalScore(student.answer_json || null);

  let total = 0;
  let hasQuestionScore = false;
  questions.forEach((topic, topicIndex) => {
    const subQuestions = topic.sub_question || [];
    if (subQuestions.length) {
      let subTotal = 0;
      let hasSubScore = false;
      subQuestions.forEach((subQuestion, subIndex) => {
        if (isBackgroundSubQuestion(subQuestion)) return; // 背景资料小题不计分
        const questionNo = `${topicIndex + 1}.${subIndex + 1}`;
        const recordScore = getMergedTrialScoreForQuestion(student.student_no, questionNo);
        const score = recordScore ?? parseScoreNumber(subQuestion.score);
        if (score !== null) {
          subTotal += score;
          hasSubScore = true;
        }
      });
      if (!hasSubScore) {
        const topicRecordScore = getMergedTrialScoreForQuestion(student.student_no, `${topicIndex + 1}`);
        const topicScore = topicRecordScore ?? parseScoreNumber(topic.score);
        if (topicScore !== null) {
          subTotal = topicScore;
          hasSubScore = true;
        }
      }
      if (hasSubScore) {
        total += subTotal;
        hasQuestionScore = true;
      }
      return;
    }

    const questionNo = `${topicIndex + 1}`;
    const recordScore = getMergedTrialScoreForQuestion(student.student_no, questionNo);
    const score = recordScore ?? parseScoreNumber(topic.score);
    if (score !== null) {
      total += score;
      hasQuestionScore = true;
    }
  });

  if (hasQuestionScore) return normalizeScoreValue(total);
  return student.total_score ?? calculateTotalScore(student.answer_json || null);
};

// 多服务评阅合并规则：同一题的多个 MCP 记录，每服务取最新后求和
const getAllTrialRecordsForQuestion = (studentNo?: string, questionNo?: string): LocalGradingRecordItem[] => {
  if (!studentNo) return [];
  const aliases = getQuestionNoAliases(questionNo);
  if (!aliases.length) return [];
  return scoreDisplayRecords.value.filter((record) => (
    String(record.student_no || '') === String(studentNo)
    && aliases.includes(String(record.question_no || '').trim())
  ));
};

const getMergedTrialScoreForQuestion = (studentNo?: string, questionNo?: string): number | null => {
  const records = getAllTrialRecordsForQuestion(studentNo, questionNo);
  if (!records.length) return null;
  const byService = new Map<string, LocalGradingRecordItem>();
  records.forEach((record) => {
    const serviceKey = String(record.mcp_service_id ?? record.mcp_service_name ?? '');
    const previous = byService.get(serviceKey);
    const recordTime = new Date(record.graded_at || record.updated_at || '').getTime() || 0;
    const previousTime = previous ? (new Date(previous.graded_at || previous.updated_at || '').getTime() || 0) : -1;
    if (!previous || recordTime >= previousTime) byService.set(serviceKey, record);
  });
  let hasScore = false;
  let total = 0;
  byService.forEach((record) => {
    const score = getTrialRecordScore(record);
    if (score !== null) {
      total += score;
      hasScore = true;
    }
  });
  return hasScore ? normalizeScoreValue(total) : null;
};

const getRecordTemplateId = (record: LocalGradingRecordItem) => {
  const id = Number(record.template_id || 0);
  return Number.isFinite(id) && id > 0 ? id : undefined;
};

const findStandardOptionFromTrialRecord = (record: LocalGradingRecordItem, questionNo: string) => getStandardOptionsForQuestion(questionNo).find((option) => (
  Number(option.version.standard.standard_id || 0) === Number(record.standard_id || 0)
  && Number(option.version.standard.version_no || 0) === Number(record.standard_version_no || 0)
  && (!record.question_version_no || Number(option.version.version_no || 0) === Number(record.question_version_no || 0))
)) || getStandardOptionsForQuestion(questionNo).find((option) => (
  Number(option.version.standard.standard_id || 0) === Number(record.standard_id || 0)
  && Number(option.version.standard.version_no || 0) === Number(record.standard_version_no || 0)
));

// 正式评阅默认基准：静默沿用试阅阶段教师手动选择的评阅标准版本/阅卷模板。
// 仅在页面初始化、试阅记录加载完成后执行一次；教师仍可在评阅基准工作台手动调整。
// 若该试卷从未试阅，则保持加载时的默认（最新评阅标准版本 / 最新阅卷模板）。
const applyFormalBenchmarkDefaults = () => {
  if (isTrialMode.value) return;
  if (!trialGradingRecords.value.length) return;
  if (!isPaperMode.value && !isBatchMode.value) {
    // 小题正式评阅：沿用本题最近一次试阅使用的评阅标准版本
    const records = getTrialRecords(currentStudent.value?.student_no, currentQuestionNo.value);
    const record = records[records.length - 1];
    if (record) {
      const matched = findStandardOptionFromTrialRecord(record, currentQuestionNo.value);
      if (matched) selectedStandardId.value = matched.value;
    }
    return;
  }
  if (isPaperMode.value) {
    // 整卷正式评阅：沿用最近一次整卷试阅使用的阅卷模板
    const latestTemplateRecord = [...trialGradingRecords.value]
      .filter((record) => Boolean(getRecordTemplateId(record)))
      .sort((a, b) => getRecordSortTime(b) - getRecordSortTime(a))[0];
    const templateId = latestTemplateRecord ? getRecordTemplateId(latestTemplateRecord) : undefined;
    if (templateId && templateOptions.value.some((option) => Number(option.value) === Number(templateId))) {
      selectedTemplateId.value = templateId;
    }
    return;
  }
  // 批量正式评阅：逐题沿用最近一次试阅使用的评阅标准版本
  batchTargetViews.value.forEach((target) => {
    const questionNo = getBatchQuestionNo(target);
    if (selectedBatchStandardIdMap.value[questionNo]) return;
    const records = getTrialRecords(target.student.student_no, questionNo);
    const record = records[records.length - 1];
    if (!record) return;
    const matched = findStandardOptionFromTrialRecord(record, questionNo);
    if (matched) selectedBatchStandardIdMap.value[questionNo] = matched.value;
  });
};
const loadMcpServices = async () => {
  mcpLoading.value = true;
  mcpLoadError.value = '';
  try {
    const response = await listServices(undefined, true);
    const responseData = response.data as McpServiceInfo[] | { items?: McpServiceInfo[] } | undefined;
    if (Array.isArray(responseData)) {
      mcpServices.value = responseData;
    } else if (Array.isArray(responseData?.items)) {
      mcpServices.value = responseData.items;
    } else {
      mcpServices.value = [];
    }
    if (!mcpServices.value.length) {
      mcpLoadError.value = '暂未获取到MCP服务，请确认管理员端已创建MCP服务';
    }
  } catch (error) {
    console.error('获取MCP服务失败', error);
    mcpLoadError.value = '获取MCP服务失败，请确认当前账号有权限访问服务列表';
  } finally {
    mcpLoading.value = false;
  }
};

const resolveImageUrl = (imagePath?: string) => imageResolver.value?.resolve(imagePath) || '';

const getDisplayText = (value?: string) => stripEmbeddedImageMarkers(value);

const collectAnswerFileItems = (value: any): any[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectAnswerFileItems(item));
  if (typeof value !== 'object') return [];
  const directFile = value.file_name || value.fileName || value.url || value.storage_path || value.relative_path;
  if (directFile) return [value];
  return Object.values(value).flatMap((item) => collectAnswerFileItems(item));
};

const getQuestionAnswerFileText = (question: any) => {
  const files = collectAnswerFileItems(question?.answer_files);
  if (!files.length) return '';
  const seen = new Set<string>();
  const lines = files.flatMap((file) => {
    const name = file.file_name || file.name || '答案文件';
    const type = file.file_type || file.type || '附件';
    const link = file.url || file.storage_path || file.relative_path || file.path || '';
    const key = `${name}|${link}`;
    if (!link || seen.has(key)) return [];
    seen.add(key);
    return [`${type}：${name}，地址：${link}`];
  });
  return lines.length ? `【附件答案】\n${lines.join('\n')}` : '';
};

const getQuestionAnswerText = (question: any) => [
  getDisplayText(question?.answer),
  getQuestionAnswerFileText(question)
].filter(Boolean).join('\n\n');

const uniqueStrings = (items: string[]) => Array.from(new Set(items.filter(Boolean)));

const getQuestionDisplayImages = (question: any) => uniqueStrings([
  ...(question?.images || []),
  ...extractEmbeddedImagePaths(question?.question),
  ...extractEmbeddedImagePaths(question?.answer)
]);

// media/blank_paper/ 下的图是空白卷自带的题干参考图，不是考生作答：
// 不得作为作答图传给评分服务，否则空卷考生会被按参考图打出满分
const isBlankPaperReferenceImage = (path: string) => String(path).toLowerCase().includes('media/blank_paper/');
const getGradingAnswerImages = (question: any) => getQuestionDisplayImages(question).filter((image) => !isBlankPaperReferenceImage(image));

const getStandaloneQuestionImages = (question: any) => {
  const embedded = new Set([
    ...extractEmbeddedImagePaths(question?.question),
    ...extractEmbeddedImagePaths(question?.answer)
  ].map((item) => item.toLowerCase()));
  return uniqueStrings(question?.images || []).filter((image) => !embedded.has(String(image).toLowerCase()));
};

const previewImage = (url: string) => {
  previewUrl.value = url;
};

const closePreview = () => {
  previewUrl.value = '';
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closePreview();
};

const goBack = () => {
  router.back();
};

const getStudentQuestions = (student: LocalStudentAnswer) => getQuestionList(student.answer_json || null);

const getTemplateCriteriaSummaryForTemplate = (template: ExamGradingTemplate) => (template.template_items || []).map((item) => {
  const standard = item.standard_item;
  const version = item.question_version_no || standard?.question_version_no || '-';
  return `题号 ${item.question_no} / 本题V${version}
参考答案：${standard?.reference_answer || '暂无'}
评分标准：${standard?.grading_criteria || '暂无'}`;
}).join('\n\n');

const getTemplateCriteriaSummary = () => selectedTemplate.value ? getTemplateCriteriaSummaryForTemplate(selectedTemplate.value) : '';

const getTrialStandardText = (questionNo?: string) => {
  if (isPaperMode.value) {
    if (!questionNo) return getTemplateCriteriaSummary();
    const standard = selectedTemplateItemMap.value.get(questionNo)?.standard_item;
    if (!standard) return '';
    return `参考答案：${standard.reference_answer || '暂无'}\n评分标准：${standard.grading_criteria || '暂无'}`;
  }
  if (isBatchMode.value) {
    const standard = getBatchStandardVersionForQuestion(questionNo || currentQuestionNo.value)?.item;
    if (!standard) return '';
    return `参考答案：${standard.reference_answer || '暂无'}\n评分标准：${standard.grading_criteria || '暂无'}`;
  }
  const standard = questionNo && questionNo !== currentQuestionNo.value
    ? getQuestionStandardVersions(questionNo).slice(-1)[0]?.item
    : selectedStandardItem.value;
  if (!standard) return '';
  return `参考答案：${standard.reference_answer || '暂无'}\n评分标准：${standard.grading_criteria || '暂无'}`;
};

const getBatchCriteriaSummary = () => batchPlanQuestionNos.value.map((questionNo) => {
  const version = getBatchStandardVersionForQuestion(questionNo);
  const standard = version?.item;
  if (!standard) return `题号 ${questionNo}\n暂无评阅标准`;
  return `题号 ${questionNo} / 本题V${version?.version_no || standard.question_version_no || '-'}\n参考答案：${standard.reference_answer || '暂无'}\n评分标准：${standard.grading_criteria || '暂无'}`;
}).join('\n\n');
const getSelectedStandardMeta = (questionNo?: string) => {
  const normalizedQuestionNo = questionNo || currentQuestionNo.value;
  if (isBatchMode.value) {
    const batchVersion = getBatchStandardVersionForQuestion(normalizedQuestionNo);
    if (batchVersion) {
      return {
        standard_id: batchVersion.standard.standard_id,
        standard_version_no: batchVersion.standard.version_no,
        question_version_no: batchVersion.version_no,
        standard_label: `题号 ${normalizedQuestionNo} / 本题 V${batchVersion.version_no}`
      };
    }
  }
  if (isPaperMode.value && selectedTemplate.value) {
    const templateItem = selectedTemplateItemMap.value.get(normalizedQuestionNo);
    const standard = templateItem?.standard_item;
    return {
      template_id: selectedTemplate.value.template_id,
      template_name: selectedTemplate.value.template_name,
      standard_id: templateItem?.standard_id,
      standard_version_no: templateItem?.standard_version_no,
      question_version_no: templateItem?.question_version_no || standard?.question_version_no,
      standard_label: `阅卷模板：${selectedTemplate.value.template_name} / 题号 ${normalizedQuestionNo} / 本题 V${templateItem?.question_version_no || standard?.question_version_no || '-'}`
    };
  }
  const version = getStandardVersionForQuestion(normalizedQuestionNo);
  if (!version) return {};
  return {
    standard_id: version.standard.standard_id,
    standard_version_no: version.standard.version_no,
    question_version_no: version.version_no,
    standard_label: `题号 ${normalizedQuestionNo} / 本题 V${version.version_no}`
  };
};
const buildQuestionTextWithStandard = (baseText: string, questionNo?: string) => {
  const standardText = getTrialStandardText(questionNo);
  return standardText ? `${baseText}\n\n【试阅采用的评阅标准】\n${standardText}` : baseText;
};
const collectTargetImages = () => {
  if (isPaperMode.value) {
    const imagePaths: string[] = [];
    questions.value.forEach((topic) => {
      imagePaths.push(...getGradingAnswerImages(topic));
      (topic.sub_question || []).forEach((subQuestion) => {
        imagePaths.push(...getGradingAnswerImages(subQuestion));
      });
    });
    return imagePaths;
  }
  return getGradingAnswerImages(targetSubQuestion.value);
};

const getTargetQuestionText = () => {
  if (isPaperMode.value) {
    const baseText = questions.value.map((topic, topicIndex) => {
      const subText = (topic.sub_question || []).map((subQuestion, subIndex) => (
        `子题 ${subIndex + 1}：${getDisplayText(subQuestion.question)}\n作答：${getQuestionAnswerText(subQuestion)}`
      )).join('\n');
      return `大题 ${topicIndex + 1}：${getDisplayText(topic.question)}\n作答：${getQuestionAnswerText(topic)}\n${subText}`;
    }).join('\n\n');
    return buildQuestionTextWithStandard(baseText);
  }
  const baseText = `大题 ${topicNumber.value} / 子题 ${subNumber.value}\n题目：${getDisplayText(targetSubQuestion.value?.question)}\n作答：${getQuestionAnswerText(targetSubQuestion.value)}`;
  return buildQuestionTextWithStandard(baseText, currentQuestionNo.value);
};
const getTargetAnswerText = () => {
  if (isPaperMode.value) {
    return questions.value.map((topic) => {
      const answers = [getQuestionAnswerText(topic)];
      (topic.sub_question || []).forEach((subQuestion) => answers.push(getQuestionAnswerText(subQuestion)));
      return answers.filter(Boolean).join('\n');
    }).filter(Boolean).join('\n\n');
  }
  return getQuestionAnswerText(targetSubQuestion.value);
};

const toScoreNumber = (value: unknown) => parseScoreNumber(value) ?? 0;

const getTargetMaxScore = () => {
  if (isPaperMode.value) {
    return questions.value.reduce((total, topic, topicIndex) => {
      const topicScore = getStandardMaxScore(getQuestionNoFromIndexes(topicIndex, -1))
        ?? getQuestionDeclaredScore(topic)
        ?? 0;
      const subScore = (topic.sub_question || []).reduce((sum, subQuestion, subIndex) => (
        sum + (getStandardMaxScore(getQuestionNoFromIndexes(topicIndex, subIndex))
          ?? getQuestionDeclaredScore(subQuestion)
          ?? 0)
      ), 0);
      return total + topicScore + subScore;
    }, 0);
  }
  return getStandardMaxScore(currentQuestionNo.value) ?? getQuestionDeclaredScore(targetSubQuestion.value);
};

const findTargetImageFile = () => {
  const imagePaths = collectTargetImages();
  for (const imagePath of imagePaths) {
    const found = findLocalImage(localPackage.value?.images || [], imagePath);
    if (found) return found;
  }
  return undefined;
};

const getBatchQuestionText = (target: BatchTargetView) => {
  const subQuestion = getBatchSubQuestion(target);
  const maxScore = getBatchMaxScore(target);
  const maxScoreText = maxScore !== null ? `本题满分：${maxScore}分
` : '';
  return `${target.label}
${maxScoreText}题目：${getDisplayText(subQuestion?.question)}
作答：${getQuestionAnswerText(subQuestion)}`;
};

const getBatchAnswerText = (target: BatchTargetView) => getQuestionAnswerText(getBatchSubQuestion(target));

const getBatchMaxScore = (target: BatchTargetView) => getStandardMaxScore(getBatchQuestionNo(target))
  ?? standardSubScoreMap.value.get(getBatchScoreKey(target))
  ?? getQuestionDeclaredScore(getBatchSubQuestion(target))
  ?? (target.subIndex >= 0 ? getTopicPerSubDeclaredScore(getBatchTopic(target)) : null);

const getTrialBatchTargets = computed<BatchTargetView[]>(() => {
  if (!canUseTrialWorkbench.value) return batchTargetViews.value;
  if (isPaperMode.value) return getPaperTrialTargets.value;
  if (trialStudents.value.length <= 1) return batchTargetViews.value;
  return trialStudents.value.map((student) => ({
    key: `${student.student_no}__${topicNumber.value}__${subNumber.value}`,
    student,
    topicIndex: topicNumber.value - 1,
    subIndex: subNumber.value - 1,
    label: `Q${topicNumber.value}.${subNumber.value}`
  }));
});

const activeBatchTargets = computed(() => {
  if (isTrialMode.value && isPaperMode.value) return getPaperTrialTargets.value;
  if (!isTrialMode.value && isPaperMode.value) return getFormalPaperTargets.value;
  if (isBatchMode.value) {
    if (!isTrialMode.value) return batchTargetViews.value;
    const selected = new Set(trialStudentNos.value);
    if (!selected.size) return batchTargetViews.value;
    return batchTargetViews.value.filter((target) => selected.has(target.student.student_no));
  }
  if (canUseTrialWorkbench.value && trialStudents.value.length > 1) return getTrialBatchTargets.value;
  return batchTargetViews.value;
});

watch(paperModeStudents, (students) => {
  if (paperStudentPage.value > students.length) {
    paperStudentPage.value = Math.max(1, students.length);
  }
}, { flush: 'post' });

type MajorBatchGroup = {
  key: string;
  student: LocalStudentAnswer;
  topicIndex: number;
  serviceUuid: string;
  targets: BatchTargetView[];
  serviceCount: number;
};

const buildMajorBatchGroups = (sourceTargets: BatchTargetView[]): MajorBatchGroup[] => {
  const groupMap = new Map<string, MajorBatchGroup>();
  sourceTargets.forEach((target) => {
    const questionNo = getBatchQuestionNo(target);
    const serviceUuids = getEffectiveMcpListForTarget(target, questionNo);
    serviceUuids.forEach((serviceUuid) => {
      // module: 前缀的裸模块（如 SQL 单题评分器）一次只能评一道题，
      // 不能按大题合并调用，需按小题独立分组
      const isSingleQuestionService = String(serviceUuid).startsWith('module:');
      const groupKey = `${target.student.student_no}__topic${target.topicIndex + 1}__svc${serviceUuid}`
        + (isSingleQuestionService ? `__sub${target.subIndex}` : '');
      const group = groupMap.get(groupKey) || {
        key: groupKey,
        student: target.student,
        topicIndex: target.topicIndex,
        serviceUuid,
        targets: [],
        serviceCount: serviceUuids.length
      };
      group.targets.push(target);
      group.serviceCount = Math.max(group.serviceCount, serviceUuids.length);
      groupMap.set(groupKey, group);
    });
  });
  return Array.from(groupMap.values()).map((group) => ({
    ...group,
    targets: [...group.targets].sort((left, right) => left.subIndex - right.subIndex)
  }));
};

const getMajorGroupQuestionNo = (group: MajorBatchGroup) => `${group.topicIndex + 1}`;

const getMajorGroupLabel = (group: MajorBatchGroup) => {
  const serviceSuffix = group.serviceCount > 1 ? `（${getMcpServiceNameByUuid(group.serviceUuid)}）` : '';
  return `Q${getMajorGroupQuestionNo(group)}${serviceSuffix}`;
};

const buildMajorSubQuestionText = (target: BatchTargetView) => {
  const questionNo = getBatchQuestionNo(target);
  const maxScore = getBatchMaxScore(target);
  const maxScoreText = maxScore !== null ? `本题满分：${maxScore}分\n` : '';
  const standardText = getTrialStandardText(questionNo);
  return [
    `小题 Q${questionNo}`,
    `${maxScoreText}题目：${getDisplayText(getBatchSubQuestion(target)?.question)}`,
    `作答：${getQuestionAnswerText(getBatchSubQuestion(target))}`,
    standardText ? `【本题评阅标准】\n${standardText}` : ''
  ].filter(Boolean).join('\n');
};

const buildMajorQuestionText = (group: MajorBatchGroup) => {
  const topic = getBatchTopic(group.targets[0]);
  const subText = group.targets.map((target) => buildMajorSubQuestionText(target)).join('\n\n');
  return [
    `大题 Q${getMajorGroupQuestionNo(group)}`,
    `大题题干：${getDisplayText(topic?.question) || '未命名题目'}`,
    getQuestionAnswerText(topic) ? `大题作答：${getQuestionAnswerText(topic)}` : '',
    subText,
    '请按照每道小题各自的参考答案、评分标准和满分独立评分，并按小题题号返回每道题的分数和评语。'
  ].filter(Boolean).join('\n\n');
};

const buildMajorAnswerText = (group: MajorBatchGroup) => group.targets
  .map((target) => `Q${getBatchQuestionNo(target)}：${getBatchAnswerText(target)}`)
  .filter(Boolean)
  .join('\n\n');

const getMajorMaxScore = (group: MajorBatchGroup) => {
  const total = group.targets.reduce((sum, target) => sum + toScoreNumber(getBatchMaxScore(target)), 0);
  return total || null;
};

const findMajorImageFile = (group: MajorBatchGroup) => {
  const topic = getBatchTopic(group.targets[0]);
  const imagePaths = [
    ...getGradingAnswerImages(topic),
    ...group.targets.flatMap((target) => getGradingAnswerImages(getBatchSubQuestion(target)))
  ];
  for (const imagePath of uniqueStrings(imagePaths)) {
    const found = findLocalImage(localPackage.value?.images || [], imagePath);
    if (found) return found;
  }
  return undefined;
};

const buildBatchPayloadTargets = async () => {
  const sourceTargets = activeBatchTargets.value;
  const groups = buildMajorBatchGroups(sourceTargets);
  const nested = await Promise.all(groups.map(async (group) => {
    // 单小题分组（如单题评分模块）直接按小题平铺调用，
    // 不包 sub_questions，后端按小题直接保存模块返回的分数
    if (group.targets.length === 1) {
      const target = group.targets[0];
      const questionNo = getBatchQuestionNo(target);
      const subNode = getBatchSubQuestion(target);
      const imagePaths = [
        ...getGradingAnswerImages(getBatchTopic(target)),
        ...getGradingAnswerImages(subNode)
      ];
      let imageBlob: Blob | undefined;
      let imageFile: ReturnType<typeof findLocalImage> | undefined;
      for (const imagePath of uniqueStrings(imagePaths)) {
        imageFile = findLocalImage(localPackage.value?.images || [], imagePath);
        if (imageFile) break;
      }
      if (imageFile) {
        imageBlob = (await ensureImageBlob(imageFile)) || imageFile.blob;
      }
      return [{
        key: target.key,
        question_no: questionNo,
        service_uuid: group.serviceUuid,
        student_no: group.student.student_no,
        question_label: target.label,
        question_text: buildQuestionTextWithStandard(getBatchQuestionText(target), questionNo),
        answer_text: getBatchAnswerText(target),
        max_score: getBatchMaxScore(target),
        multi_service: group.serviceCount > 1,
        ...getSelectedStandardMeta(questionNo),
        ...(imageBlob && imageFile ? { image: imageBlob, image_name: imageFile.name } : {})
      } as BatchGradingTarget];
    }
    const imageFile = findMajorImageFile(group);
    let imageBlob: Blob | undefined;
    if (imageFile) {
      // 后端持久化图片的 blob 是空占位，需要先按 url 拉取真实内容
      imageBlob = (await ensureImageBlob(imageFile)) || imageFile.blob;
    }
    const subQuestions = group.targets.map((target) => {
      const questionNo = getBatchQuestionNo(target);
      return {
        key: target.key,
        question_no: questionNo,
        question_label: target.label,
        question_text: buildQuestionTextWithStandard(getBatchQuestionText(target), questionNo),
        answer_text: getBatchAnswerText(target),
        max_score: getBatchMaxScore(target),
        ...getSelectedStandardMeta(questionNo)
      };
    });
    return [{
      key: group.key,
      question_no: getMajorGroupQuestionNo(group),
      service_uuid: group.serviceUuid,
      student_no: group.student.student_no,
      question_label: getMajorGroupLabel(group),
      question_text: buildMajorQuestionText(group),
      answer_text: buildMajorAnswerText(group),
      max_score: getMajorMaxScore(group),
      // 多服务分工评阅：各服务按评分标准中自己部分的满分评分
      multi_service: group.serviceCount > 1,
      sub_questions: subQuestions,
      ...(imageBlob && imageFile ? { image: imageBlob, image_name: imageFile.name } : {})
    } as BatchGradingTarget];
  }));
  return nested.flat().filter((item): item is BatchGradingTarget => Boolean(item));
};
const saveAndStartBatchGrading = async (): Promise<boolean> => {
  if (!isTrialMode.value && isPaperMode.value && !selectedTemplateId.value) {
    ElMessage.warning('请先选择整卷阅卷模板');
    return false;
  }
  if (!activeBatchTargets.value.length) {
    ElMessage.warning(isPaperMode.value ? '暂无整卷评阅内容，请先选择阅卷模板' : '暂无批量评阅内容，请先选择题目');
    return false;
  }
  const payloadTargets = await buildBatchPayloadTargets();
  const batchTargets = activeBatchTargets.value;
  const missingMcp = batchTargets.filter((target) => !getMajorEffectiveMcpValue(target, getBatchQuestionNo(target)));
  if (missingMcp.length) {
    ElMessage.warning('部分题目没有可用 MCP，请在评阅标准中补充 MCP');
    return false;
  }
  gradingLoading.value = true;
  gradingResult.value = null;
  batchGradingResult.value = null;
  try {
    const response = await gradeBatchWithMcp({
      subject_id: String(route.params.subjectId),
      exam_id: String(route.params.examId),
      local_package_id: localPackage.value?.local_package_id || String(route.params.packageId),
      package_fingerprint: localPackage.value?.package_fingerprint,
      quick_fingerprint: localPackage.value?.quick_fingerprint,
      student_no_hash: localPackage.value?.student_no_hash,
      is_trial: isTrialMode.value,
      mode: mode.value,
      targets: payloadTargets.filter(Boolean) as BatchGradingTarget[]
    });
    const batchResult = unwrapGradingApiData<BatchGradingResult>(response);
    batchGradingResult.value = batchResult || null;
    if (isTrialMode.value) {
      batchResult?.results?.forEach((item) => mergeTrialGradingRecord(item.grading_record));
      await loadTrialGradingRecords();
      const savedCount = batchResult?.results?.filter((item) => item.grading_record).length || 0;
      if (!savedCount) {
        const saveError = batchResult?.results?.find((item) => item.save_error)?.save_error;
        // 评分服务本身失败（如评分标准引用的 MCP 实例已删除）时，
        // 优先展示具体失败原因，而不是笼统的“未收到试阅记录”
        const gradeError = batchResult?.results?.find((item) => item.error)?.error;
        const failedLabel = batchResult?.results?.find((item) => item.error)?.question_label;
        ElMessage.warning(
          saveError ? `评分完成，但未保存试阅记录：${saveError}`
            : gradeError ? `评分失败${failedLabel ? `（${failedLabel}）` : ''}：${gradeError}`
              : '评分完成，但未收到后端保存的试阅记录，请检查试卷包ID或后端保存日志'
        );
      }
    } else {
      // 正式评阅完成后刷新记录，保证页面上各题分数与总分立即按正式记录展示
      await loadTrialGradingRecords();
    }
    ElMessage.success('批量评分完成');
    return true;
  } catch (error: any) {
    console.error('批量MCP评分失败', error);
    ElMessage.error(error?.response?.data?.message || error?.message || '批量MCP评分失败');
    return false;
  } finally {
    gradingLoading.value = false;
  }
};

const saveAndStartGrading = async (): Promise<boolean> => {
  if (isBatchMode.value || (!isTrialMode.value && isPaperMode.value)) {
    return await saveAndStartBatchGrading();
  }
  if (!currentStudent.value) {
    ElMessage.warning('暂无待评阅内容');
    return false;
  }
  if (!isPaperMode.value && isBackgroundSubQuestion(targetSubQuestion.value)) {
    ElMessage.warning('该小题为题干背景资料，不是作答题目，无需评分');
    return false;
  }
  if (isTrialMode.value && !isPaperMode.value && !selectedStandardId.value) {
    ElMessage.warning('请先选择本题评阅标准版本');
    return false;
  }
  if (isTrialMode.value && isPaperMode.value && !selectedTemplateId.value) {
    ElMessage.warning('请先选择整卷阅卷模板');
    return false;
  }
  if (isTrialMode.value && isPaperMode.value) {
    return await saveAndStartBatchGrading();
  }
  if (canUseTrialWorkbench.value && !isPaperMode.value && trialStudents.value.length > 1) {
    return await saveAndStartBatchGrading();
  }
  const serviceUuids = getEffectiveMcpListForTarget(undefined, isPaperMode.value ? undefined : currentQuestionNo.value);
  if (!serviceUuids.length) {
    ElMessage.warning('当前题目没有可用 MCP，请在评阅标准中补充 MCP');
    return false;
  }

  const imageFile = findTargetImageFile();
  gradingLoading.value = true;
  gradingResult.value = null;
  gradingResults.value = [];
  batchGradingResult.value = null;
  try {
    // 多选 MCP 时按服务逐个调用：每轮携带完整的题目上下文参数，
    // 只有 service_uuid 不同；图片对所有服务全量传递，
    // 由各 MCP 模块的 evaluate 函数签名决定是否消费图片。
    let imageBlob: Blob | undefined;
    if (imageFile) {
      // 后端持久化图片的 blob 是空占位，需要先按 url 拉取真实内容
      imageBlob = (await ensureImageBlob(imageFile)) || imageFile.blob;
    }
    for (const serviceUuid of serviceUuids) {
      const gradingPayload: GradingPayload = {
        subject_id: String(route.params.subjectId),
        exam_id: String(route.params.examId),
        local_package_id: localPackage.value?.local_package_id || String(route.params.packageId),
        package_fingerprint: localPackage.value?.package_fingerprint,
        quick_fingerprint: localPackage.value?.quick_fingerprint,
        student_no_hash: localPackage.value?.student_no_hash,
        question_no: isPaperMode.value ? 'paper' : `${topicNumber.value}.${subNumber.value}`,
        question_label: isPaperMode.value ? '整卷' : `Q${topicNumber.value}.${subNumber.value}`,
        grading_mode: mode.value,
        is_trial: isTrialMode.value,
        service_uuid: serviceUuid,
        // 多服务分工评阅：各服务按评分标准中自己部分的满分评分
        multi_service: serviceUuids.length > 1,
        student_no: currentStudent.value.student_no,
        question_text: getTargetQuestionText(),
        answer_text: getTargetAnswerText(),
        max_score: getTargetMaxScore(),
        ...getSelectedStandardMeta(isPaperMode.value ? undefined : currentQuestionNo.value)
      };
      if (imageBlob && imageFile) {
        gradingPayload.image = imageBlob;
        gradingPayload.image_name = imageFile.name;
      }
      const response = await gradeWithMcp(gradingPayload);
      const gradingResponse = unwrapGradingApiData<GradingResult>(response);
      const resultWithService = {
        ...(gradingResponse || {}),
        service_uuid: serviceUuid,
        mcp_service_name: getMcpServiceNameByUuid(serviceUuid)
      } as GradingResult;
      gradingResults.value.push(resultWithService);
      gradingResult.value = resultWithService;
      if (isTrialMode.value) {
        mergeTrialGradingRecord(gradingResponse?.grading_record);
      }
    }
    ElMessage.success(serviceUuids.length > 1 ? `已按 ${serviceUuids.length} 个 MCP 服务逐个评分完成` : '评分完成');
    return true;
  } catch (error: any) {
    console.error('MCP评分失败', error);
    ElMessage.error(error?.response?.data?.message || error?.message || 'MCP评分失败');
    if (gradingResults.value.length) {
      ElMessage.warning('部分 MCP 服务评分失败，已保留成功结果');
    }
    return false;
  } finally {
    gradingLoading.value = false;
  }
};

</script>

<style scoped>
.grading-page {
  padding: 20px;
}

.auto-grading-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
}

.auto-grading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 56px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.auto-grading-icon {
  font-size: 42px;
  color: #409eff;
}

.auto-grading-done {
  color: #67c23a;
}

.auto-grading-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.auto-grading-desc {
  font-size: 13px;
  color: #909399;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.grading-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  min-height: 560px;
}

.grading-complete-note {
  margin-top: 16px;
  padding: 14px 16px;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  background: #eff6ff;
  color: #1d4ed8;
}

.grading-layout.has-single-result {
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.9fr);
  align-items: start;
}

.grading-pane {
  min-height: 560px;
  padding: 14px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #ffffff;
  overflow: auto;
}

.source-pane {
  width: 100%;
}

.result-pane {
  position: sticky;
  top: 16px;
}

.result-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-bottom: 10px;
  color: #64748b;
  font-size: 13px;
}

/* 多选 MCP：每个服务的评阅结果独立成块 */
.result-block {
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.merged-total {
  padding: 10px 12px;
  margin-bottom: 12px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  color: #1d4ed8;
}

.result-block .result-json {
  min-height: 200px;
}

.result-json {
  min-height: 420px;
  max-height: 68vh;
  margin: 0;
  padding: 12px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.question-grading-result {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid #c6e2ff;
  border-radius: 8px;
  background: #f4f9ff;
}

.question-grading-result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #1f2937;
  font-size: 14px;
}

.question-grading-result-head span {
  color: #2563eb;
  font-weight: 600;
}

.question-grading-result-comment {
  margin-top: 8px;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.pane-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.pane-title {
  color: #111827;
  font-size: 16px;
  font-weight: 600;
}

.trial-workbench {
  margin-bottom: 14px;
  padding: 12px;
  border: 1px solid #f3d19e;
  border-radius: 8px;
  background: #fffaf0;
}

.trial-workbench-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.trial-title {
  color: #111827;
  font-size: 15px;
  font-weight: 700;
}

.trial-subtitle {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}

.trial-alert {
  margin-bottom: 12px;
}

.trial-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.trial-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #374151;
  font-size: 13px;
  font-weight: 600;
}

.full-width {
  width: 100%;
}

.readonly-student-list {
  min-height: 32px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  background: #f8fafc;
}

.readonly-empty {
  color: #94a3b8;
  font-size: 13px;
}

.batch-trial-workbench {
  margin-bottom: 14px;
}

.batch-trial-grid {
  grid-template-columns: minmax(0, 1fr);
}

.batch-standard-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
  margin-top: 14px;
  color: #111827;
  font-size: 13px;
  font-weight: 700;
}

.batch-standard-count {
  color: #64748b;
  font-weight: 600;
}

.batch-standard-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.batch-standard-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
  gap: 12px;
  align-items: center;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.batch-standard-main {
  min-width: 0;
}

.batch-standard-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: #111827;
  font-size: 13px;
}

.batch-standard-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.batch-standard-students {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  color: #374151;
}

.student-label {
  flex: 0 0 auto;
  color: #64748b;
}

.batch-standard-select {
  width: 100%;
}

.trial-standard-preview {
  margin-top: 12px;
}

.preview-title,
.evidence-title {
  margin-bottom: 6px;
  color: #374151;
  font-size: 13px;
  font-weight: 700;
}

.trial-standard-preview pre,
.evidence-panel pre {
  max-height: 180px;
  margin: 0;
  padding: 10px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #ffffff;
  white-space: pre-wrap;
  word-break: break-word;
}

.trial-action-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f3d19e;
}

.trial-action-bar > div {
  display: none;
}
.student-meta {
  margin-bottom: 12px;
  color: #111827;
}

.paper-student-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
  color: #475569;
  font-size: 13px;
}

.paper-student-pager-main {
  display: grid;
  grid-template-columns: auto auto auto;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

.paper-student-pager-main strong {
  color: #111827;
  font-size: 15px;
}

.paper-student-pager-main em {
  color: #64748b;
  font-style: normal;
  font-weight: 600;
}

.score-text {
  margin-left: 8px;
  color: #dc2626;
}

.question-block {
  padding: 10px 0;
  border-top: 1px dashed #e6eef8;
}

.single-question {
  border-top: none;
}

.question-block summary {
  cursor: pointer;
  outline: none;
}

.question-tag {
  display: inline-block;
  margin-right: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 12px;
}

.question-content {
  padding-top: 8px;
}

.sub-title {
  font-weight: 600;
}

.answer-text {
  margin-top: 6px;
  white-space: pre-wrap;
}

.rich-image-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.rich-image-content .answer-text,
.rich-image-content .question-title {
  width: 100%;
}

.embedded-thumb {
  display: block;
  margin-top: 4px;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.thumb {
  width: 180px;
  height: 120px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  object-fit: cover;
  cursor: pointer;
}

.image-missing {
  color: #909399;
  font-size: 12px;
}

.sub-question {
  padding: 10px 0;
}

.mcp-config-drawer {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 2200;
  width: 360px;
  height: 100vh;
  background: #ffffff;
  border-left: 1px solid #e4e7ed;
  box-shadow: -4px 0 16px rgba(15, 23, 42, 0.12);
  transform: translateX(100%);
  transition: transform 0.2s ease;
}

.mcp-config-drawer.open {
  transform: translateX(0);
}


.lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
}

.lightbox-image {
  max-width: 92vw;
  max-height: 92vh;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

.lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: #ef4444;
  color: #ffffff;
  cursor: pointer;
}

@media (max-width: 900px) {
  .grading-layout,
  .grading-layout.has-single-result {
    grid-template-columns: 1fr;
  }

  .result-pane {
    position: static;
  }

  .paper-student-pager-main {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: 2px;
  }
}
</style>

<template>
  <div class="exam-detail-page">
    <header class="page-header">
      <div class="page-heading">
        <div class="breadcrumb"><span>评分工作台</span><span class="breadcrumb-separator">&gt;</span><span>{{ examTitle }}</span></div>
        <h1>评分工作台</h1>
      </div>
      <div class="header-actions">
        <el-button class="back-button" @click="goBack">返回</el-button>
        <el-input
          v-model="searchKeyword"
          class="exam-search"
          clearable
          placeholder="搜索试卷包"
          :prefix-icon="Search"
          @clear="fetchPackages"
          @keyup.enter="fetchPackages"
        />
      </div>
    </header>

    <section class="workflow-panel" aria-label="阅卷流程">
      <div class="workflow-steps">
        <div class="workflow-step is-available" @click="goToStandards()">
          <span class="step-number">1</span>
          <span class="step-label">新建阅卷标准：设置各题评分细则</span>
        </div>
        <span class="step-connector" :class="{ 'is-active': hasGradingStandard }"></span>
        <div class="workflow-step" :class="hasGradingStandard ? 'is-available' : 'is-pending'" @click="hasGradingStandard && goToTemplates()">
          <span class="step-number">2</span>
          <span class="step-label">组装阅卷模板：生成整卷阅卷方案</span>
        </div>
        <span class="step-connector" :class="{ 'is-active': hasGradingTemplate }"></span>
        <div class="workflow-step" :class="hasGradingTemplate ? 'is-available' : 'is-pending'" @click="hasGradingTemplate && openScoringEntry()">
          <span class="step-number">3</span>
          <span class="step-label">试阅 / 正式评阅：开始试阅与阅卷</span>
        </div>
      </div>
      <div class="workflow-footer">
        <template v-if="!hasGradingStandard">
          <p>先逐题设置评分标准，组装生成整卷阅卷模板后，再发起试阅与正式评阅</p>
          <el-button type="primary" class="primary-action" @click="goToStandards">进入新建阅卷标准</el-button>
        </template>
        <template v-else-if="!hasGradingTemplate">
          <p>阅卷标准已设置，继续组装生成整卷阅卷模板</p>
          <el-button type="primary" class="primary-action" @click="goToTemplates">进入组装阅卷模板</el-button>
        </template>
        <template v-else>
          <p>阅卷模板已就绪，选择试卷包开始试阅与正式评阅</p>
          <div class="footer-actions">
            <el-button class="footer-secondary" :disabled="packages.length === 0" @click="openScoringEntry('trial')">进入试阅</el-button>
            <el-button type="primary" class="primary-action" :disabled="packages.length === 0" @click="openScoringEntry('formal')">进入正式评阅</el-button>
          </div>
        </template>
      </div>
    </section>

    <section class="packages-section">
      <div class="section-heading">
        <div>
          <h2>试卷包</h2>
          <p>管理本场考试的试卷包，进入试卷包查看考生答卷与评分结果。</p>
        </div>
        <el-button type="primary" class="add-package-btn" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          新增试卷包
        </el-button>
      </div>

      <div v-loading="loading" class="package-grid">
        <div
          v-for="item in packages"
          :key="item.package_id"
          class="package-card"
          @click="goToPackageDetail(item)"
        >
          <div class="package-card-header">
            <span class="package-no">试卷包</span>
          </div>
          <div class="package-name">{{ item.package_name }}</div>
          <div class="package-meta">上传时间：{{ formatDateTime(item.uploaded_at) }}</div>
          <div class="package-file">解析状态：{{ 'extract_path' in item && item.extract_path ? '已解压' : '已上传' }}</div>
          <div class="package-actions">
            <el-button size="small" @click.stop="goToPackageResults(item, 'trial')">
              试阅结果
            </el-button>
            <el-button size="small" @click.stop="goToPackageResults(item, 'formal')">
              正式结果
            </el-button>
            <el-button size="small" type="danger" @click.stop="confirmDeletePackage(item)">
              删除
            </el-button>
          </div>
        </div>

        <el-empty
          v-if="!loading && packages.length === 0"
          class="empty-state"
          description="暂无试卷包"
        />
      </div>

      <el-dialog
        v-model="dialogVisible"
        title="新增试卷包"
        width="580px"
        append-to-body
        class="package-dialog"
        destroy-on-close
      >
        <el-form
          ref="packageFormRef"
          :model="packageForm"
          :rules="packageRules"
          label-width="150px"
        >
          <el-form-item label="试卷包名" prop="package_name">
            <el-input v-model="packageForm.package_name" placeholder="请输入试卷包名" />
          </el-form-item>
          <el-form-item label="试卷包文件" prop="package_file">
            <div class="folder-picker">
              <el-button @click="openFolderPicker">选择文件夹</el-button>
              <span class="folder-name">{{ selectedFolderLabel }}</span>
              <input
                ref="folderInputRef"
                class="folder-input"
                type="file"
                webkitdirectory
                directory
                multiple
                @change="handleFolderChange"
              />
              <div class="upload-tip">
                请选择包含学生 Word 文档、JSON 或 media 图片的文件夹；系统会批量转换学生试卷并保存解析结果。
              </div>
            </div>
          </el-form-item>
          <el-form-item label="空白试卷" prop="blank_paper">
            <div class="blank-paper-picker">
              <el-upload
                :auto-upload="false"
                :limit="1"
                :file-list="blankPaperFiles"
                :on-change="handleBlankPaperChange"
                :on-remove="handleBlankPaperRemove"
              >
                <el-button>选择文件</el-button>
              </el-upload>
              <span class="blank-paper-tip">若试卷包中没有作答试卷文件，请在此上传空试卷模板文件</span>
            </div>
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="submitting" @click="submitPackage">
              提交
            </el-button>
          </div>
        </template>
      </el-dialog>

      <ParseReportDialog
        v-model="reportDialogVisible"
        title="试卷包解析报告"
        :loading="reportDialogLoading"
        :report="reportDialogData"
        :structure="reportStructureData"
      />

      <el-dialog
        v-model="scoringDialogVisible"
        :title="scoringDialogMode === 'trial' ? '选择试卷包进入试阅' : '选择试卷包进入正式评阅'"
        width="620px"
        append-to-body
        class="scoring-entry-dialog"
      >
        <div v-if="!packages.length" class="scoring-entry-empty">
          <el-empty description="当前考试下暂无试卷包，请先新增试卷包" />
        </div>
        <div v-else class="scoring-entry-list">
          <div
            v-for="pkg in packages"
            :key="pkg.package_id"
            class="scoring-entry-item"
            @click="selectScoringPackage(pkg)"
          >
            <div class="scoring-entry-main">
              <strong class="scoring-entry-name">{{ pkg.package_name }}</strong>
              <span class="scoring-entry-meta">上传时间：{{ formatDateTime(pkg.uploaded_at) }}</span>
            </div>
            <el-button type="primary" size="small">
              {{ scoringDialogMode === 'trial' ? '进入试阅' : '进入正式评阅' }}
            </el-button>
          </div>
        </div>
      </el-dialog>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, FormInstance, FormRules, UploadFile, UploadUserFile } from 'element-plus';
import { Plus, Search } from '@element-plus/icons-vue';
import {
  deleteLocalPackageHistory,
  deletePackage,
  getExam,
  getGradingTemplates,
  getLatestGradingStandard,
  getLocalPackage as getLocalPackageRegistration,
  getLocalPackageStructure,
  getPackages,
  type ExamItem,
  type ExamPackageItem,
  type ParseReportData,
  type StructurePreviewResult
} from '@/api/teacher-scoring';
import ParseReportDialog from '@/components/ParseReportDialog.vue';
import {
  createLocalPackageFromFolder,
  listLocalPackages,
  setLocalPackageFilePath,
  type LocalPackageSummary
} from '@/utils/local-scoring-package';

defineOptions({
  name: 'TeacherExamDetail'
});

const route = useRoute();
const router = useRouter();
const subjectId = computed(() => String(route.params.subjectId || ''));
const examId = computed(() => String(route.params.examId || ''));
const loading = ref(false);
const submitting = ref(false);
const dialogVisible = ref(false);
const searchKeyword = ref('');
const exam = ref<ExamItem | null>(null);
const packages = ref<Array<ExamPackageItem | LocalPackageSummary>>([]);
const packageFormRef = ref<FormInstance>();
const folderInputRef = ref<HTMLInputElement>();
const selectedFolderFiles = ref<File[]>([]);
const selectedFolderPaths = ref<string[]>([]);
const blankPaperFiles = ref<UploadUserFile[]>([]);
const blankPaperFile = ref<File>();
const reportDialogVisible = ref(false);
const reportDialogLoading = ref(false);
const reportDialogData = ref<ParseReportData | null>(null);
const reportStructureData = ref<StructurePreviewResult | null>(null);
const hasGradingStandard = ref(false);
const hasGradingTemplate = ref(false);
const gradingTemplates = ref<any[]>([]);
const scoringDialogVisible = ref(false);
const scoringDialogMode = ref<'trial' | 'formal'>('trial');
const selectedFolderLabel = computed(() => {
  if (!selectedFolderFiles.value.length && !selectedFolderPaths.value.length) return '未选择文件夹';
  const firstFile = selectedFolderFiles.value[0] as File & { webkitRelativePath?: string };
  const rootName = firstFile?.webkitRelativePath?.split('/')?.[0] || selectedFolderPaths.value[0]?.split('/')?.[0];
  return `${rootName || '已选择文件夹'}（${selectedFolderFiles.value.length} 个文件，${selectedFolderPaths.value.length} 个目录）`;
});
const examTitle = computed(() => exam.value ? `${exam.value.exam_name} - 考试详情` : '考试详情');

const packageForm = reactive({
  package_name: '',
  package_file: '',
  blank_paper: ''
});

const packageRules: FormRules = {
  package_name: [
    { required: true, message: '请输入试卷包名', trigger: 'blur' }
  ],
  package_file: [
    { required: true, message: '请选择试卷包文件', trigger: 'change' }
  ]
};

let searchTimer: number | undefined;

watch(searchKeyword, () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    fetchPackages();
  }, 300);
});

onMounted(async () => {
  await fetchExam();
  await fetchPackages();
  if (!packages.value.length) {
    // 没有任何试卷包时流程无意义，回到初始状态（仅第 1 步可进入）
    hasGradingStandard.value = false;
    hasGradingTemplate.value = false;
    gradingTemplates.value = [];
    return;
  }
  try {
    const res = await getLatestGradingStandard(subjectId.value, examId.value);
    hasGradingStandard.value = Boolean(res.data?.standard_items?.length);
  } catch {
    hasGradingStandard.value = false;
  }
  try {
    const tplRes = await getGradingTemplates(subjectId.value, examId.value);
    gradingTemplates.value = (tplRes.data || []).sort((a: any, b: any) => Number(b.version_no || 0) - Number(a.version_no || 0));
    hasGradingTemplate.value = gradingTemplates.value.length > 0;
  } catch {
    hasGradingTemplate.value = false;
  }
});

const resetForm = () => {
  packageForm.package_name = '';
  packageForm.package_file = '';
  packageForm.blank_paper = '';
  selectedFolderFiles.value = [];
  selectedFolderPaths.value = [];
  blankPaperFiles.value = [];
  blankPaperFile.value = undefined;
  if (folderInputRef.value) {
    folderInputRef.value.value = '';
  }
  packageFormRef.value?.clearValidate();
};

const handleBlankPaperChange = (file: UploadFile) => {
  blankPaperFiles.value = file ? [file] : [];
  blankPaperFile.value = file.raw;
  packageForm.blank_paper = file.raw ? 'selected' : '';
  packageFormRef.value?.validateField('blank_paper');
};

const handleBlankPaperRemove = () => {
  blankPaperFiles.value = [];
  blankPaperFile.value = undefined;
  packageForm.blank_paper = '';
  packageFormRef.value?.validateField('blank_paper');
};

const openCreateDialog = () => {
  resetForm();
  dialogVisible.value = true;
};

const goBack = () => {
  router.push({ path: '/teacher/exams', query: { subjectId: subjectId.value } });
};

const goToPackageDetail = (item: ExamPackageItem | LocalPackageSummary) => {
  router.push(`/teacher/scoring/subjects/${subjectId.value}/exams/${examId.value}/packages/${item.package_id}`);
};

// 试卷包卡片上的结果入口：跳到对应试卷包的试阅/正式结果页
const goToPackageResults = (item: ExamPackageItem | LocalPackageSummary, kind: 'trial' | 'formal') => {
  router.push(`/teacher/scoring/subjects/${subjectId.value}/exams/${examId.value}/packages/${item.package_id}/results/${kind}`);
};

const goToFirstPackage = () => {
  const item = packages.value[0];
  if (item) goToPackageDetail(item);
};

const goToStandards = () => {
  router.push({ name: 'teacher-grading-standards', params: { subjectId: subjectId.value, examId: examId.value } });
};

const goToTemplates = () => {
  router.push({ name: 'teacher-grading-templates', params: { subjectId: subjectId.value, examId: examId.value } });
};

const openScoringEntry = (mode?: 'trial' | 'formal') => {
  scoringDialogMode.value = mode || 'trial';
  scoringDialogVisible.value = true;
};

const selectScoringPackage = (pkg: ExamPackageItem | LocalPackageSummary) => {
  // 试阅/评阅统一进入试卷包详情页（展示每个考生作答的页面），在页面内执行试阅/评阅
  router.push({
    name: 'teacher-package-detail',
    params: { subjectId: subjectId.value, examId: examId.value, packageId: String(pkg.package_id) },
    query: { mode: scoringDialogMode.value }
  });
  scoringDialogVisible.value = false;
};

const fetchExam = async () => {
  try {
    const response = await getExam(subjectId.value, examId.value);
    if (response.code === 0 || response.code === 200) {
      exam.value = response.data;
    } else {
      ElMessage.error(response.message || '获取考试失败');
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '获取考试失败');
  }
};

const filterActiveLocalPackages = async (items: LocalPackageSummary[]) => {
  const checked = await Promise.all(items.map(async (item) => {
    const localPackageId = item.local_package_id || item.package_id;
    if (!localPackageId) return null;
    try {
      // 存在性探测：404 属预期（包已删），静默处理由 catch 过滤
      const response = await getLocalPackageRegistration(subjectId.value, examId.value, localPackageId, { quiet404: true });
      return response.code === 0 || response.code === 200 ? item : null;
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('校验本地试卷包登记失败', error);
      }
      return null;
    }
  }));
  return checked.filter((item): item is LocalPackageSummary => Boolean(item));
};

const fetchPackages = async () => {
  loading.value = true;
  try {
    const response = await getPackages(subjectId.value, examId.value, searchKeyword.value.trim());
    if (response.code === 0 || response.code === 200) {
      const remotePackages = response.data || [];
      let localPackages: LocalPackageSummary[] = [];
      try {
        localPackages = await filterActiveLocalPackages(
          await listLocalPackages(subjectId.value, examId.value)
        );
      } catch (localError) {
        console.error('读取本机试卷包失败', localError);
        ElMessage.warning('后端试卷包已加载，本机试卷包读取失败，请刷新页面后重试');
      }
      const merged = new Map<string, ExamPackageItem | LocalPackageSummary>();
      remotePackages.forEach((item: ExamPackageItem) => merged.set(String(item.package_id), item));
      localPackages.forEach((item) => merged.set(String(item.package_id), item));
      packages.value = Array.from(merged.values());
    } else {
      ElMessage.error(response.message || '获取试卷包失败');
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '获取试卷包失败');
  } finally {
    loading.value = false;
  }
};

// webkitdirectory 文件选择器不会把“完全空”的考生文件夹报告给 input.files：
// 空目录考生（KS 下一个文件都没有）会因此丢失、考生数对不上。
// 优先使用 File System Access API 的 showDirectoryPicker，它能遍历出
// 包括空目录在内的完整目录树；不支持的浏览器回退到传统上传控件。
type DirectoryHandleLike = {
  kind: 'file' | 'directory';
  name: string;
  getFile?: () => Promise<File>;
  values?: () => AsyncIterableIterator<DirectoryHandleLike>;
};

type WebkitFileSystemEntry = {
  name: string;
  fullPath: string;
  isDirectory: boolean;
  isFile: boolean;
};

type WebkitFileSystemDirectoryEntry = WebkitFileSystemEntry & {
  createReader: () => {
    readEntries: (
      successCallback: (entries: WebkitFileSystemEntry[]) => void,
      errorCallback?: (error: DOMException) => void
    ) => void;
  };
};

const supportsDirectoryPicker = typeof (window as any).showDirectoryPicker === 'function';

const collectHandleEntries = async (
  handle: DirectoryHandleLike,
  prefix: string,
  files: File[],
  folderPaths: string[]
) => {
  const currentPath = prefix ? `${prefix}/${handle.name}` : handle.name;
  folderPaths.push(currentPath);
  for await (const child of handle.values?.() || []) {
    if (child.kind === 'file' && child.getFile) {
      const file = await child.getFile();
      setLocalPackageFilePath(file, `${currentPath}/${child.name}`);
      // processLocalPackageFiles 还会读取原生 webkitRelativePath，实例级定义兼容
      // 该调用方；WeakMap 同时覆盖不允许定义此属性的浏览器。
      try {
        Object.defineProperty(file, 'webkitRelativePath', {
          value: `${currentPath}/${child.name}`,
          configurable: true
        });
      } catch {
        // 路径已保存在 WeakMap 中，继续上传。
      }
      files.push(file);
    } else if (child.kind === 'directory') {
      await collectHandleEntries(child, currentPath, files, folderPaths);
    }
  }
};

const applySelectedFolder = (files: File[], folderPaths: string[]) => {
  selectedFolderFiles.value = files;
  selectedFolderPaths.value = folderPaths;
  packageForm.package_file = files.length || folderPaths.length ? 'folder-selected' : '';
  packageFormRef.value?.validateField('package_file');
};

const readDirectoryEntries = (entry: WebkitFileSystemDirectoryEntry) => new Promise<WebkitFileSystemEntry[]>((resolve, reject) => {
  const reader = entry.createReader();
  const entries: WebkitFileSystemEntry[] = [];
  const readBatch = () => {
    reader.readEntries((batch) => {
      if (!batch.length) {
        resolve(entries);
        return;
      }
      entries.push(...batch);
      readBatch();
    }, reject);
  };
  readBatch();
});

// 传统 webkitdirectory 上传默认只提供文件，部分 Chromium 版本仍会通过
// webkitEntries 暴露完整目录树。优先合并这棵树，才能登记没有任何文件的考生目录。
const collectDirectoryPathsFromEntry = async (
  entry: WebkitFileSystemEntry,
  folderPathSet: Set<string>,
  depth = 0
) => {
  if (!entry.isDirectory) return;
  const relativePath = String(entry.fullPath || entry.name).replace(/^\/+/, '').replace(/\\/g, '/');
  if (relativePath) folderPathSet.add(relativePath);
  // 只遍历到“根/学号/KS”，避免枚举考生工程目录中的海量文件夹。
  if (depth >= 2) return;
  try {
    const children = await readDirectoryEntries(entry as WebkitFileSystemDirectoryEntry);
    await Promise.all(children.filter((child) => child.isDirectory).map((child) => (
      collectDirectoryPathsFromEntry(child, folderPathSet, depth + 1)
    )));
  } catch (error) {
    console.warn('读取上传目录结构失败', error);
  }
};

const openFolderPicker = async () => {
  if (!supportsDirectoryPicker) {
    // showDirectoryPicker 仅在 Chrome/Edge + localhost/HTTPS 下可用；
    // 其余情况回退到传统上传控件，但纯空考生文件夹无法被感知
    ElMessage.warning('当前访问方式无法识别空文件夹（需用 Chrome/Edge 并通过 localhost 或 HTTPS 访问本页面），无任何文件的纯空考生文件夹将不会被解析');
    folderInputRef.value?.click();
    return;
  }
  try {
    const rootHandle = await (window as any).showDirectoryPicker() as DirectoryHandleLike;
    const files: File[] = [];
    const folderPaths: string[] = [];
    await collectHandleEntries(rootHandle, '', files, folderPaths);
    if (!files.length && !folderPaths.length) return;
    applySelectedFolder(files, folderPaths);
  } catch (error: any) {
    if (error?.name === 'AbortError') return; // 用户取消选择
    console.warn('文件夹选择器不可用，回退到传统上传控件', error);
    folderInputRef.value?.click();
  }
};

// 兼容模式先从文件相对路径登记目录，再尝试读取 webkitEntries 中的空目录。
const collectSelectedFolderPaths = async (input: HTMLInputElement) => {
  const items = Array.from(input.files || []) as Array<File & { webkitRelativePath?: string }>;
  const folderPathSet = new Set<string>();
  items.forEach((file) => {
    const parts = String(file.webkitRelativePath || '').split('/').filter(Boolean);
    for (let index = 1; index < parts.length; index += 1) {
      folderPathSet.add(parts.slice(0, index).join('/'));
    }
  });
  try {
    const entries = Array.from((input as any).webkitEntries || []) as WebkitFileSystemEntry[];
    await Promise.all(entries.map((entry) => collectDirectoryPathsFromEntry(entry, folderPathSet)));
  } catch (error) {
    console.warn('枚举上传目录结构失败，空文件夹考生可能无法登记', error);
  }
  return Array.from(folderPathSet).sort((left, right) => left.localeCompare(right));
};

const handleFolderChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  selectedFolderFiles.value = Array.from(input.files || []);
  selectedFolderPaths.value = await collectSelectedFolderPaths(input);
  packageForm.package_file = selectedFolderFiles.value.length || selectedFolderPaths.value.length ? 'folder-selected' : '';
  packageFormRef.value?.validateField('package_file');
};

// 上传成功后自动打开解析报告：空文件夹考生学号在报告里列出，供人工复核
const openReportDialog = async (localPackageId?: number) => {
  if (!localPackageId) return;
  reportDialogVisible.value = true;
  reportDialogLoading.value = true;
  reportDialogData.value = null;
  reportStructureData.value = null;
  try {
    const response = await getLocalPackageStructure(subjectId.value, examId.value, localPackageId);
    if (response.code === 0 || response.code === 200) {
      reportStructureData.value = response.data;
      reportDialogData.value = response.data?.parse_report || null;
    } else {
      ElMessage.error(response.message || '获取解析报告失败');
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || '获取解析报告失败');
  } finally {
    reportDialogLoading.value = false;
  }
};

const submitPackage = async () => {
  if (!packageFormRef.value) return;

  try {
    await packageFormRef.value.validate();
    if (!selectedFolderFiles.value.length && !selectedFolderPaths.value.length) {
      ElMessage.error('请选择试卷包文件夹');
      return;
    }

    submitting.value = true;
    const localPackage = await createLocalPackageFromFolder(
      subjectId.value,
      examId.value,
      packageForm.package_name,
      selectedFolderFiles.value,
      selectedFolderPaths.value,
      {
        blankPaper: blankPaperFile.value
      }
    );
    if (localPackage.matched_history) {
      ElMessage.success('已匹配历史试卷包，历史评分结果可恢复');
    } else {
      ElMessage.success('本地试卷包创建成功');
    }
    dialogVisible.value = false;
    resetForm();
    await fetchPackages();
    await openReportDialog(localPackage.local_package_id);
  } catch (error: any) {
    if (error.response) {
      ElMessage.error(error.response.data.message || `试卷包创建失败（HTTP ${error.response.status}）`);
    } else {
      ElMessage.error(error.message || '试卷包创建失败');
    }
  } finally {
    submitting.value = false;
  }
};

const confirmDeletePackage = async (item: ExamPackageItem | LocalPackageSummary) => {
  try {
    const isLocalPackage = 'isLocal' in item && item.isLocal;
    await ElMessageBox.confirm(
      isLocalPackage
        ? `确定删除试卷包“${item.package_name}”吗？后端登记和历史评分结果会一起删除。`
        : `确定要删除试卷包“${item.package_name}”吗？删除后其考生答卷记录也会被删除。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const response = isLocalPackage
      ? await deleteLocalPackageHistory(subjectId.value, examId.value, item.local_package_id || item.package_id)
      : await deletePackage(subjectId.value, examId.value, item.package_id);
    if (response.code === 0 || response.code === 200) {
      ElMessage.success('试卷包删除成功');
    } else {
      ElMessage.error(response.message || '试卷包删除失败');
    }
    await fetchPackages();
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error.response?.data?.message || error.message || '试卷包删除失败');
  }
};
const formatDateTime = (value?: string) => {
  if (!value) return '-';
  return value.slice(0, 16);
};
</script>

<style scoped>
.exam-detail-page {
  min-height: 100%;
  padding: 28px 32px 40px;
  color: #1f2937;
  font-family: "Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif;
  background: #f7f9fc;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.breadcrumb {
  display: flex;
  gap: 10px;
  align-items: center;
  color: #7b8798;
  font-size: 13px;
}

.breadcrumb-separator { color: #b6c0cf; }
.page-heading h1 { margin: 8px 0 0; color: #172b4d; font-size: 26px; font-weight: 650; }

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.add-package-btn {
  height: 40px;
  border-radius: 9px;
  font-weight: 500;
}

.exam-search {
  width: 260px;
}

.exam-search :deep(.el-input__wrapper) {
  min-height: 40px;
  border-radius: 9px;
  box-shadow: 0 0 0 1px #dce3ed inset;
}

.back-button { height: 40px; border-radius: 9px; }

.workflow-panel,
.packages-section {
  border: 1px solid #e7ecf3;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 4px 16px rgba(31, 54, 88, .045);
}

.workflow-panel { padding: 26px 32px 22px; margin-bottom: 24px; }
.workflow-steps { display:flex; align-items:center; max-width: 920px; margin: 0 auto; }
.workflow-step { display:flex; align-items:center; gap:12px; white-space:nowrap; }
.step-number { display:flex; width:34px; height:34px; align-items:center; justify-content:center; border-radius:50%; border:1px solid #d7dee8; color:#8b97a8; background:#f7f8fa; font-size:15px; font-weight:650; }
.step-label { color:#8792a2; font-size:15px; font-weight:550; }
/* 状态流仅灰/蓝两色：未达到=灰（is-pending），处于或已完成=蓝（is-available），三个步骤均可点击回退 */
.workflow-step.is-available { cursor:pointer; transition:transform .15s ease; }
.workflow-step.is-available:hover { transform:translateY(-2px); }
.workflow-step.is-available .step-number { border-color:#3478e5; color:#fff; background:#3478e5; box-shadow:0 3px 8px rgba(52,120,229,.2); }
.workflow-step.is-available .step-label { color:#2366cb; }
.workflow-step.is-pending { cursor:not-allowed; }
.workflow-step.is-locked .step-number { border-color:#edf0f4; color:#b7c0cc; background:#f5f6f8; }
.workflow-step.is-locked .step-label { color:#b0b8c4; }
.step-connector { flex:1; height:2px; min-width:48px; margin:0 18px; background:#e8ecf2; }
.step-connector.is-active { background:#9fc2f5; }
.workflow-footer { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-top:22px; padding-top:18px; border-top:1px solid #f0f2f5; }
.workflow-footer p { margin:0; color:#748197; font-size:14px; }
.footer-actions { display:flex; gap:10px; }
.footer-secondary { min-height:42px; padding:0 22px; border-radius:9px; font-weight:550; border-color:#94a3b8; color:#475569; }
.primary-action { min-height:42px; padding:0 22px; border-radius:9px; font-weight:550; }

.scoring-entry-dialog :deep(.el-dialog__body) { padding: 12px 20px 20px; }
.scoring-entry-empty { padding: 20px 0; }
.scoring-entry-list { display: flex; flex-direction: column; gap: 10px; max-height: 460px; overflow-y: auto; padding-right: 4px; }
.scoring-entry-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  border: 1px solid #e5eaf1;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.scoring-entry-item:hover { border-color: #8bb6f1; box-shadow: 0 4px 12px rgba(48,104,180,0.08); }
.scoring-entry-main { display: flex; flex-direction: column; gap: 4px; }
.scoring-entry-name { color: #111827; font-size: 15px; font-weight: 600; }
.scoring-entry-meta { color: #94a3b8; font-size: 12px; }

.packages-section { min-height: 420px; padding: 26px 28px 30px; }
.section-heading { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-bottom:24px; }
.section-heading h2 { margin:0 0 6px; color:#1b2b45; font-size:20px; font-weight:650; }
.section-heading p { margin:0; color:#7c8798; font-size:14px; }

.package-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  min-height: 320px;
}

.package-card {
  position: relative;
  min-height: 190px;
  padding: 24px 24px 66px;
  border: 1px solid #e5eaf1;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 3px 12px rgba(15, 35, 65, 0.04);
  cursor: pointer;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.package-card:hover {
  border-color: #8bb6f1;
  box-shadow: 0 8px 22px rgba(48, 104, 180, 0.1);
}

.package-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.package-no {
  display: inline-flex;
  max-width: 100%;
  padding: 6px 12px;
  border-radius: 7px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 14px;
  font-weight: 600;
}

.package-name {
  margin-bottom: 16px;
  color: #111827;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.package-meta,
.package-file {
  margin-bottom: 10px;
  color: #64748b;
  font-size: 14px;
}

.package-actions {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  /* 操作按钮常驻显示，不再依赖悬浮 */
  opacity: 1;
  visibility: visible;
}

.empty-state {
  grid-column: 1 / -1;
  align-self: center;
}

.folder-picker {
  width: 100%;
}

.folder-input {
  display: none;
}

.folder-name {
  margin-left: 10px;
  color: #606266;
  font-size: 13px;
}

.upload-tip {
  color: #909399;
  font-size: 12px;
  line-height: 1.6;
}

.blank-paper-picker {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.blank-paper-tip {
  color: #909399;
  font-size: 12px;
  line-height: 1.6;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

:deep(.package-dialog) {
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  margin-top: 7vh;
}

:deep(.package-dialog .el-dialog__body) {
  overflow-y: auto;
  padding-bottom: 8px;
}

@media (max-width: 1100px) {
  .package-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 760px) {
  .exam-detail-page { padding: 20px 14px 28px; }
  .page-header, .workflow-footer, .section-heading {
    flex-direction: column;
    align-items: stretch;
  }
  .header-actions { width:100%; }
  .exam-search { width:100%; }
  .workflow-panel { padding:20px 16px; }
  .workflow-steps { align-items:flex-start; flex-direction:column; gap:12px; }
  .step-connector { width:2px; height:18px; min-width:0; margin:0 16px; }
  .package-grid { grid-template-columns: 1fr; }
  .package-actions { opacity:1; visibility:visible; }
}
</style>

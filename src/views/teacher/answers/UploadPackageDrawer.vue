<template>
  <el-dialog v-model="visible" title="上传新试卷包" width="min(820px, calc(100vw - 32px))" align-center class="upload-package-dialog" destroy-on-close :close-on-click-modal="false" @closed="reset">
    <el-steps :active="activeStep" simple finish-status="success" class="upload-steps">
      <el-step title="选择科目" />
      <el-step title="选择考试" />
      <el-step title="上传答卷" />
    </el-steps>

    <el-form label-position="top" class="upload-form">
      <el-form-item label="科目" required>
        <el-select v-model="subjectId" filterable placeholder="请选择科目" :loading="subjectsLoading" @change="onSubjectChange">
          <el-option v-for="item in subjects" :key="item.subject_id" :label="`${item.subject_no} · ${item.subject_name}`" :value="item.subject_id" />
        </el-select>
      </el-form-item>
      <el-form-item label="考试" required>
        <el-select v-model="examId" filterable placeholder="请选择考试" :disabled="!subjectId" :loading="examsLoading">
          <el-option v-for="item in exams" :key="item.id" :label="item.exam_name" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="试卷包名称" required>
        <el-input v-model="packageName" maxlength="120" show-word-limit placeholder="请输入试卷包名称" />
      </el-form-item>
      <el-form-item label="试卷包内容" required>
        <el-radio-group v-model="uploadMode" class="upload-mode">
          <el-radio-button value="archive">压缩包</el-radio-button>
          <el-radio-button value="folder">文件夹</el-radio-button>
        </el-radio-group>
        <el-upload
          v-if="uploadMode === 'archive'"
          drag
          :auto-upload="false"
          :limit="1"
          accept=".zip"
          :on-change="onArchiveChange"
          :on-remove="onArchiveRemove"
          :file-list="archiveFileList"
        >
          <el-icon class="upload-icon"><UploadFilled /></el-icon>
          <div class="el-upload__text">拖拽答卷压缩包到此处，或 <em>点击选择文件</em></div>
          <template #tip><div class="el-upload__tip">支持 ZIP 格式；系统会使用原有规则解析压缩包内容。</div></template>
        </el-upload>
        <div v-else class="folder-picker">
          <el-button @click="chooseFolder">选择文件夹</el-button>
          <span class="folder-name">{{ folderLabel }}</span>
          <input
            ref="folderInputRef"
            class="folder-input"
            type="file"
            webkitdirectory
            directory
            multiple
            @change="onFolderChange"
          />
          <div class="el-upload__tip">选择包含考生答卷、JSON、图片等文件的文件夹，系统按原有规则解析。</div>
        </div>
      </el-form-item>
      <el-form-item label="空白试卷（可选）">
        <el-upload
          :auto-upload="false"
          :limit="1"
          :on-change="onBlankPaperChange"
          :on-remove="onBlankPaperRemove"
          :file-list="blankPaperFileList"
        >
          <el-button>选择空白试卷</el-button>
          <template #tip>
            <div class="el-upload__tip">考试中未存在的试卷文件时，可单独上传空白试卷模板。</div>
          </template>
        </el-upload>
      </el-form-item>
      <el-alert type="info" :closable="false" show-icon title="此处上传考生试卷包及可选的空白试卷模板。评分标准与阅卷模板请在对应的阅卷管理菜单维护。" />
    </el-form>
    <template #footer>
      <div class="drawer-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :disabled="!canSubmit" @click="submit">提交上传</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, type UploadFile, type UploadUserFile } from 'element-plus'
import { getExams, getSubjects, type ExamItem, type SubjectItem } from '@/api/teacher-scoring'
import { setLocalPackageFilePath } from '@/utils/local-scoring-package'
import type { PackageUploadRequest } from './upload-types'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'submitted', request: PackageUploadRequest): void
}>()
const visible = computed({ get: () => props.modelValue, set: (value) => emit('update:modelValue', value) })
const subjects = ref<SubjectItem[]>([])
const exams = ref<ExamItem[]>([])
const subjectsLoading = ref(false)
const examsLoading = ref(false)
const uploadMode = ref<'archive' | 'folder'>('archive')
const subjectId = ref<number>()
const examId = ref<number>()
const packageName = ref('')
const archiveFile = ref<File>()
const archiveFileList = ref<UploadUserFile[]>([])
const folderInputRef = ref<HTMLInputElement>()
const folderFiles = ref<File[]>([])
const folderPaths = ref<string[]>([])
const folderLabel = ref('未选择文件夹')
const blankPaperFile = ref<File>()
const blankPaperFileList = ref<UploadUserFile[]>([])
const hasPackageContent = computed(() => uploadMode.value === 'archive' ? Boolean(archiveFile.value) : folderFiles.value.length > 0)
const activeStep = computed(() => hasPackageContent.value ? 2 : examId.value ? 2 : subjectId.value ? 1 : 0)
const canSubmit = computed(() => Boolean(subjectId.value && examId.value && packageName.value.trim() && hasPackageContent.value))

watch(() => props.modelValue, (open) => { if (open) void loadSubjects() })

async function loadSubjects() {
  subjectsLoading.value = true
  try {
    const response = await getSubjects()
    if (response?.code !== 0 && response?.code !== 200) throw new Error(response?.message || '获取科目失败')
    subjects.value = response.data || []
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '获取科目失败')
  } finally { subjectsLoading.value = false }
}

async function onSubjectChange(value: number) {
  examId.value = undefined
  exams.value = []
  examsLoading.value = true
  try {
    const response = await getExams(value)
    if (response?.code !== 0 && response?.code !== 200) throw new Error(response?.message || '获取考试失败')
    exams.value = response.data || []
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '获取考试失败')
  } finally { examsLoading.value = false }
}

function onArchiveChange(uploadFile: UploadFile) {
  const raw = uploadFile.raw
  if (!raw) return
  if (!raw.name.toLowerCase().endsWith('.zip')) {
    ElMessage.error('请上传 ZIP 格式的答卷压缩包')
    archiveFileList.value = []
    archiveFile.value = undefined
    return
  }
  archiveFile.value = raw
  archiveFileList.value = [uploadFile]
  if (!packageName.value) packageName.value = raw.name.replace(/\.zip$/i, '')
}

function onArchiveRemove() { archiveFile.value = undefined; archiveFileList.value = [] }

function onFolderChange(event: Event) {
  const input = event.target as HTMLInputElement
  folderFiles.value = Array.from(input.files || [])
  const paths = new Set<string>()
  folderFiles.value.forEach((file) => {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    const parts = relativePath.split('/').filter(Boolean)
    for (let index = 1; index < parts.length; index += 1) paths.add(parts.slice(0, index).join('/'))
  })
  folderPaths.value = Array.from(paths)
  const rootName = (folderFiles.value[0] as (File & { webkitRelativePath?: string }) | undefined)?.webkitRelativePath?.split('/')[0]
  folderLabel.value = rootName ? `${rootName}（${folderFiles.value.length} 个文件）` : '未选择文件夹'
  if (!packageName.value && rootName) packageName.value = rootName
}

type DirectoryPickerHandle = {
  kind: 'file' | 'directory'
  name: string
  getFile?: () => Promise<File>
  values?: () => AsyncIterableIterator<DirectoryPickerHandle>
}

async function collectDirectory(handle: DirectoryPickerHandle, prefix: string, files: File[], paths: string[]) {
  const currentPath = prefix ? `${prefix}/${handle.name}` : handle.name
  paths.push(currentPath)
  for await (const child of handle.values?.() || []) {
    if (child.kind === 'directory') {
      await collectDirectory(child, currentPath, files, paths)
    } else if (child.getFile) {
      const file = await child.getFile()
      const path = `${currentPath}/${child.name}`
      setLocalPackageFilePath(file, path)
      try {
        Object.defineProperty(file, 'webkitRelativePath', { value: path, configurable: true })
      } catch {
        // 路径已保存在解析器映射中。
      }
      files.push(file)
    }
  }
}

async function chooseFolder() {
  const picker = (window as Window & { showDirectoryPicker?: () => Promise<DirectoryPickerHandle> }).showDirectoryPicker
  if (!picker) {
    folderInputRef.value?.click()
    return
  }
  try {
    const root = await picker()
    const files: File[] = []
    const paths: string[] = []
    await collectDirectory(root, '', files, paths)
    folderFiles.value = files
    folderPaths.value = paths
    folderLabel.value = `${root.name}（${files.length} 个文件，${paths.length} 个目录）`
    if (!packageName.value) packageName.value = root.name
  } catch (error: any) {
    if (error?.name !== 'AbortError') folderInputRef.value?.click()
  }
}

function onBlankPaperChange(uploadFile: UploadFile) {
  if (!uploadFile.raw) return
  blankPaperFile.value = uploadFile.raw
  blankPaperFileList.value = [uploadFile]
}

function onBlankPaperRemove() {
  blankPaperFile.value = undefined
  blankPaperFileList.value = []
}

function reset() {
  subjectId.value = undefined; examId.value = undefined; packageName.value = ''; archiveFile.value = undefined
  uploadMode.value = 'archive'; archiveFileList.value = []; folderFiles.value = []; folderPaths.value = []; folderLabel.value = '未选择文件夹'
  if (folderInputRef.value) folderInputRef.value.value = ''
  blankPaperFile.value = undefined; blankPaperFileList.value = []; exams.value = []
}

async function submit() {
  if (!canSubmit.value || !subjectId.value || !examId.value) return
  const subject = subjects.value.find((item) => item.subject_id === subjectId.value)
  const exam = exams.value.find((item) => item.id === examId.value)
  const files = uploadMode.value === 'archive' && archiveFile.value ? [archiveFile.value] : [...folderFiles.value]
  const paths = uploadMode.value === 'archive' && archiveFile.value ? [archiveFile.value.name] : [...folderPaths.value]
  const request: PackageUploadRequest = {
    subjectId: String(subjectId.value),
    examId: String(examId.value),
    packageName: packageName.value.trim(),
    files,
    folderPaths: paths,
    blankPaper: blankPaperFile.value,
    subjectName: subject?.subject_name || '',
    subjectNo: subject?.subject_no || '',
    examName: exam?.exam_name || ''
  }
  visible.value = false
  emit('submitted', request)
}
</script>

<style scoped>
.upload-package-dialog :deep(.el-dialog__body) { max-height: 78vh; overflow-y: auto; padding: 10px 28px 4px; }
.upload-steps { margin: 0 0 28px; }
.upload-form .el-select { width: 100%; }
.upload-mode { margin-bottom: 12px; }
.folder-picker { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; width: 100%; }
.folder-name { color: var(--el-text-color-secondary); }
.folder-input { display: none; }
.upload-icon { font-size: 30px; color: var(--el-color-primary); }
.drawer-footer { display: flex; justify-content: flex-end; gap: 10px; }
@media (max-width: 600px) { .upload-package-dialog :deep(.el-dialog__body) { padding: 8px 16px 2px; } }
</style>

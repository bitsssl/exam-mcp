<template>
  <main class="grading-results-page">
    <el-card shadow="never" class="results-card">
      <template #header>
        <div class="page-header">
          <div>
            <h2>{{ title }}</h2>
            <p>选择阅卷任务，查看汇总结果、考生结果和异常试卷。</p>
          </div>
          <el-tag effect="plain" :type="isTrial ? 'warning' : 'success'">{{
            isTrial ? '试阅' : '正式评阅'
          }}</el-tag>
        </div>
      </template>

      <div class="results-workspace">
        <div class="filters">
          <el-input
            v-model="keyword"
            clearable
            :prefix-icon="Search"
            :placeholder="`搜索${isTrial ? '试阅' : '评阅'}任务、考试或科目`"
          />
          <el-button text :icon="Refresh" :loading="loading" @click="loadTasks">刷新</el-button>
        </div>

        <el-table v-loading="loading" :data="filteredTasks" row-key="task_id">
          <el-table-column label="任务名称" min-width="210">
            <template #default="{ row }">
              <div class="primary-cell">{{ row.package_name || row.exam_name || '阅卷任务' }}</div>
              <div class="muted-cell">{{ row.template_name || '未关联模板' }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="exam_name" label="关联考试" min-width="170">
            <template #default="{ row }">{{ row.exam_name || '—' }}</template>
          </el-table-column>
          <el-table-column label="科目" min-width="160">
            <template #default="{ row }">{{ subjectName(row) }}</template>
          </el-table-column>
          <el-table-column label="考生数量" width="110">
            <template #default="{ row }">{{ row.student_count || 0 }} 份</template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="160">
            <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openResult(row)">查看结果</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty :description="loading ? '正在加载' : '暂无阅卷任务'" />
          </template>
        </el-table>

        <div class="table-footer">共 {{ filteredTasks.length }} 项阅卷任务</div>
      </div>
    </el-card>
  </main>
</template>

<script setup lang="ts">
  import { computed, onActivated, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { Refresh, Search } from '@element-plus/icons-vue'
  import { getGradingTasks, type ExamGradingTask } from '@/api/teacher-scoring'

  const props = defineProps<{
    initialDrawer: 'trial' | 'formal'
  }>()

  const router = useRouter()
  const isTrial = computed(() => props.initialDrawer === 'trial')
  const title = computed(() => (isTrial.value ? '查看试阅结果' : '查看正式评阅结果'))
  const loading = ref(false)
  const keyword = ref('')
  const tasks = ref<ExamGradingTask[]>([])
  let activatedBefore = false

  const filteredTasks = computed(() => {
    const query = keyword.value.trim().toLocaleLowerCase()
    if (!query) return tasks.value
    return tasks.value.filter((task) =>
      [task.package_name, task.exam_name, task.subject_no, task.subject_name, task.template_name]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query)
    )
  })

  onMounted(() => void loadTasks())
  onActivated(() => {
    if (activatedBefore) void loadTasks()
    activatedBefore = true
  })

  async function loadTasks() {
    loading.value = true
    try {
      const response = await getGradingTasks()
      if (![0, 200].includes(response?.code))
        throw new Error(response?.message || '读取阅卷任务失败')
      tasks.value = [...(response.data || [])].sort((left, right) =>
        String(right.created_at || '').localeCompare(String(left.created_at || ''))
      )
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '读取阅卷任务失败')
    } finally {
      loading.value = false
    }
  }

  function openResult(task: ExamGradingTask) {
    router.push({
      name: isTrial.value ? 'teacher-package-trial-results' : 'teacher-package-formal-results',
      params: {
        subjectId: String(task.subject_id),
        examId: String(task.exam_id),
        packageId: String(task.local_package_id)
      }
    })
  }

  function subjectName(task: ExamGradingTask) {
    return [task.subject_no, task.subject_name].filter(Boolean).join(' · ') || '—'
  }

  function formatDate(value?: string) {
    return value ? String(value).replace('T', ' ').slice(0, 16) : '—'
  }
</script>

<style scoped>
  .grading-results-page {
    padding: 24px;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .page-header h2 {
    margin: 0;
    color: var(--el-text-color-primary);
    font-size: 20px;
  }

  .page-header p {
    margin: 8px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 14px;
  }

  .results-workspace {
    padding: 20px 24px 16px;
  }

  .filters {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .filters .el-input {
    width: min(380px, 100%);
  }

  .primary-cell {
    color: var(--el-text-color-primary);
    font-weight: 600;
  }

  .muted-cell {
    margin-top: 4px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .table-footer {
    padding-top: 16px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  @media (max-width: 768px) {
    .grading-results-page {
      padding: 12px;
    }

    .results-workspace {
      padding: 16px 12px 12px;
    }

    .filters {
      align-items: stretch;
    }

    .filters .el-input {
      width: auto;
      flex: 1;
    }
  }
</style>

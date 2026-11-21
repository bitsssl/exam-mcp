<template>
  <main class="grading-results-page">
    <el-card shadow="never">
      <div v-loading="loading" class="results-empty-state">
        <el-empty :description="loading ? '正在打开评阅结果' : '暂无评阅结果'" />
      </div>
    </el-card>
  </main>
</template>

<script setup lang="ts">
  import { onActivated, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { getGradingTasks, type ExamGradingTask } from '@/api/teacher-scoring'

  const router = useRouter()
  const loading = ref(false)
  let activatedBefore = false

  onMounted(() => void openLatestResult())
  onActivated(() => {
    if (activatedBefore) void openLatestResult()
    activatedBefore = true
  })

  async function openLatestResult() {
    loading.value = true
    try {
      const response = await getGradingTasks()
      if (![0, 200].includes(response?.code))
        throw new Error(response?.message || '读取阅卷任务失败')
      const tasks: ExamGradingTask[] = response.data || []
      const latestTask = [...tasks].sort((left, right) =>
        String(right.created_at || '').localeCompare(String(left.created_at || ''))
      )[0]
      if (latestTask) {
        await router.replace({
          name: 'teacher-package-formal-results',
          params: {
            subjectId: String(latestTask.subject_id),
            examId: String(latestTask.exam_id),
            packageId: String(latestTask.local_package_id)
          },
          query: { standardId: latestTask.standard_id ? String(latestTask.standard_id) : undefined }
        })
      }
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '读取评阅结果失败')
    } finally {
      loading.value = false
    }
  }
</script>

<style scoped>
  .grading-results-page { min-height: 100%; padding: 24px; }
  .results-empty-state { display: grid; min-height: 360px; place-items: center; }
  @media (max-width: 768px) { .grading-results-page { padding: 12px; } }
</style>

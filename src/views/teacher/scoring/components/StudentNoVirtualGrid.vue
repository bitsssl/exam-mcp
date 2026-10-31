<template>
  <div ref="containerRef" class="student-grid-container">
    <RecycleScroller
      class="student-virtual-scroller"
      :items="gridRows"
      :item-size="44"
      key-field="key"
      :buffer="180"
      item-tag="div"
    >
      <template #default="{ item }">
        <div class="student-grid-row" :style="{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }">
          <div v-for="studentNo in item.students" :key="studentNo" class="student-no-card">
            <span class="student-no-text" :title="studentNo">{{ studentNo }}</span>
            <el-tag
              size="small"
              :type="completedStudentNos.has(studentNo) ? 'success' : 'warning'"
              effect="light"
            >{{ completedStudentNos.has(studentNo) ? '已完成' : '未完成' }}</el-tag>
          </div>
        </div>
      </template>
    </RecycleScroller>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/index.css'

interface StudentGridRow {
  key: string
  students: string[]
}

const props = withDefaults(defineProps<{
  studentNos: string[]
  completedStudentNos?: string[]
}>(), {
  completedStudentNos: () => []
})

const containerRef = ref<HTMLElement>()
const containerWidth = ref(0)
let resizeObserver: ResizeObserver | undefined

const columnCount = computed(() => Math.max(1, Math.floor((containerWidth.value + 12) / 220)))
const completedStudentNos = computed(() => new Set(props.completedStudentNos))
const gridRows = computed<StudentGridRow[]>(() => {
  const rows: StudentGridRow[] = []
  for (let index = 0; index < props.studentNos.length; index += columnCount.value) {
    rows.push({
      key: `student-grid-row-${index}`,
      students: props.studentNos.slice(index, index + columnCount.value)
    })
  }
  return rows
})

function updateContainerWidth() {
  containerWidth.value = containerRef.value?.clientWidth || 0
}

onMounted(() => {
  updateContainerWidth()
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(updateContainerWidth)
    resizeObserver.observe(containerRef.value)
  }
})

onBeforeUnmount(() => resizeObserver?.disconnect())
watch(() => props.studentNos.length, updateContainerWidth)
</script>

<style scoped>
.student-grid-container { width: 100%; min-width: 0; }
.student-virtual-scroller { width: 100%; height: 300px; overflow-y: auto; }
.student-grid-row { display: grid; gap: 8px 12px; min-height: 44px; padding: 3px 4px; box-sizing: border-box; }
.student-no-card { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; height: 36px; padding: 0 10px 0 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; background: #fff; box-sizing: border-box; }
.student-no-text { overflow: hidden; color: var(--el-text-color-primary); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.student-no-card :deep(.el-tag--warning) { --el-tag-bg-color: #fff7e6; --el-tag-border-color: #f5d89a; --el-tag-text-color: #b7791f; flex: none; }
</style>

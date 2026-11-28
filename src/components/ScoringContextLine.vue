<template>
  <p v-if="segments.length" class="scoring-context-line">
    <span v-if="prefix" class="context-prefix">{{ prefix }}（</span>
    <template v-for="(segment, index) in segments" :key="`${index}-${segment}`">
      <span class="context-segment">{{ segment }}</span>
      <span v-if="index < segments.length - 1" class="context-arrow">·</span>
    </template>
    <span v-if="prefix" class="context-prefix">）</span>
    <span v-if="extra" class="context-extra">{{ extra }}</span>
  </p>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { fetchScoringContextNames, stripParseTimestampSuffix } from '@/utils/scoring-context'

const props = defineProps<{
  subjectId?: number | string
  examId?: number | string
  packageId?: number | string
  /** 调用方已加载到的试卷包名（避免组件重复请求） */
  packageName?: string
  /** 追加说明（如：标准版本 / 考生号 / 评阅批次） */
  extra?: string
  /** 前缀（如：试阅 / 评阅）：传入后上下文用（）包裹显示在其后面 */
  prefix?: string
}>()

const packageName = ref('')

// 标题只保留试卷包名：评阅/试阅都围绕某个试卷包执行，同一考试下可能有
// 多个试卷包，包名比考试名更能标识当前评阅范围。
const segments = computed(() => (packageName.value ? [packageName.value] : []))

watch(
  () => [props.subjectId, props.examId, props.packageId, props.packageName],
  async () => {
    // 调用方已传入包名时直接用（去掉“（解析于 …）”时间戳后缀），避免重复请求
    const propPackageName = stripParseTimestampSuffix(props.packageName)
    if (propPackageName) {
      packageName.value = propPackageName
      return
    }
    const names = await fetchScoringContextNames(props.subjectId, props.examId, props.packageId)
    packageName.value = names.packageName
  },
  { immediate: true }
)
</script>

<style scoped>
.scoring-context-line {
  margin: 6px 0 0;
  color: #1f2937;
  font-size: 20px;
  font-weight: 600;
}

.context-arrow {
  margin: 0 6px;
  color: #1f2937;
}

.context-extra {
  margin-left: 12px;
}
</style>

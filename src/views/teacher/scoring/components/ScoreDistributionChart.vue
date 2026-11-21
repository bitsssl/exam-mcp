<template>
  <section class="score-distribution" aria-label="成绩分布">
    <div class="chart-head">
      <h3>成绩分布</h3>
      <div class="chart-summary">
        <span>整卷满分</span><strong>{{ maxScore }}</strong><i />
        <span>已完成</span><strong>{{ completedCount }}</strong><span>份</span>
      </div>
    </div>
    <div class="distribution-chart">
      <div class="grid-lines" aria-hidden="true"><span v-for="tick in axisTicks" :key="tick" :style="{ left: `${tick}%` }" /></div>
      <div class="distribution-rows">
        <div v-for="bin in bins" :key="bin.label" class="distribution-row">
          <span class="range-label">{{ bin.label }}</span>
          <div class="track">
            <div class="bar" :class="bin.colorClass" :style="{ width: `${bin.percent}%` }" :title="`${bin.label}：${bin.count} 人，占 ${formatPercent(bin.percent)}`" />
            <span v-if="bin.count > 0" class="bar-result">{{ formatPercent(bin.percent) }}（{{ bin.count }}人）</span>
          </div>
        </div>
      </div>
      <div class="axis-labels" aria-hidden="true"><span v-for="tick in axisTicks" :key="tick">{{ tick }} %</span></div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type ScoreRow = { totalScore: number | null; maxTotal: number; gradedCount: number; questionCount: number }
const props = defineProps<{ rows: ScoreRow[]; maxScore?: number }>()
const axisTicks = [0, 20, 40, 60, 80, 100]
const binColors = ['bar-blue', 'bar-coral', 'bar-yellow', 'bar-green', 'bar-purple'] as const
const TARGET_BIN_COUNT = 5
const completed = computed(() => props.rows.filter((row) => row.totalScore !== null && row.questionCount > 0 && row.gradedCount >= row.questionCount))
const completedCount = computed(() => completed.value.length)
// 整卷满分按试卷包真实总分显示（不同考试总分不同，如 11A-word 5 分、
// 11A-excel 3 分）。兜底顺序：父页面传入满分 → 各行满分 → 考生实际
// 总分最大值 → 100 分制。避免标准满分缺失/为 0 时分档步长变成 0。
const maxScore = computed(() => {
  const configuredScore = Number(props.maxScore || 0)
  if (Number.isFinite(configuredScore) && configuredScore > 0) return configuredScore
  const fromRows = Math.max(0, ...props.rows.map((row) => Number(row.maxTotal || 0)))
  if (fromRows > 0) return fromRows
  const fromScores = Math.max(0, ...props.rows.map((row) => Number(row.totalScore || 0)))
  return fromScores > 0 ? fromScores : 100
})
// 分档：满分较小的整数卷（≤20 分）按整数步长分档（如 8 分 → 4 档、
// 5 分 → 5 档），其余按 5 等分；分档标签直接使用真实分数区间。
const binSpec = computed(() => {
  const total = maxScore.value
  if (Number.isInteger(total) && total > 0 && total <= 20) {
    const step = Math.max(1, Math.ceil(total / TARGET_BIN_COUNT))
    return { total, step, count: Math.ceil(total / step) }
  }
  return { total, step: total / TARGET_BIN_COUNT, count: TARGET_BIN_COUNT }
})
const formatScore = (value: number) => `${Number(value.toFixed(2))}`
const bins = computed(() => {
  const { total, step, count } = binSpec.value
  // 满分为 0/步长无效时退化为单一分档，避免除零导致全部考生挤进一个"0~0分"档
  if (!(step > 0) || count < 1) {
    return [{
      label: `${formatScore(total)}分`,
      colorClass: binColors[0],
      count: completedCount.value,
      percent: 100
    }]
  }
  const counts = new Array(count).fill(0)
  completed.value.forEach((row) => {
    const score = Math.min(total, Math.max(0, Number(row.totalScore || 0)))
    // 计数分档序号（0 = 最低档）与展示行序（index 0 = 最高档"4~5分"）相反，
    // 必须换算对位，否则每个分数都会落进低一档的行里。
    const bandIndex = Math.min(count - 1, Math.floor(score / step))
    counts[count - 1 - bandIndex] += 1
  })
  return binColors
    .map((colorClass, index) => {
      if (index >= count) return null
      const high = formatScore(total - index * step)
      const low = formatScore(Math.max(0, total - (index + 1) * step))
      return {
        label: `${low}~${high}分`,
        colorClass,
        count: counts[index],
        percent: completedCount.value ? counts[index] / completedCount.value * 100 : 0
      }
    })
    .filter(Boolean) as Array<{ label: string; colorClass: string; count: number; percent: number }>
})
function formatPercent(value: number) { return `${value.toFixed(2).replace(/\.00$/, '')}%` }
</script>

<style scoped>
.score-distribution{padding:28px 34px 24px;border:1px solid #edf1f7;border-radius:14px;background:#fff;box-shadow:0 8px 26px rgba(35,61,102,.04)}
.chart-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.chart-head h3{margin:0;color:#1d2737;font-size:21px;font-weight:700}.chart-summary{display:flex;align-items:baseline;gap:6px;color:#8b95a7;font-size:12px;white-space:nowrap}.chart-summary strong{color:#3d6fc4;font-size:17px;font-weight:700}.chart-summary i{width:1px;height:16px;margin:0 7px;background:#e5eaf2}
.distribution-chart{position:relative;margin-top:34px;padding-left:88px}.grid-lines{position:absolute;top:0;right:0;bottom:28px;left:88px;pointer-events:none}.grid-lines span{position:absolute;top:0;bottom:0;width:1px;background:#e8eef8}.distribution-rows{position:relative;display:flex;flex-direction:column;gap:22px}.distribution-row{display:flex;align-items:center;min-height:34px}.range-label{position:absolute;left:-80px;width:72px;color:#7f899a;font-size:14px;text-align:right;white-space:nowrap}.track{position:relative;display:flex;align-items:center;width:100%;height:20px}.bar{position:relative;z-index:1;min-width:0;height:20px;border-radius:999px;transition:width .3s ease}.bar-blue{background:#3b82f6}.bar-coral{background:#ff9d7d}.bar-yellow{background:#ffd65a}.bar-green{background:#91dfad}.bar-purple{background:#bba4ef}.bar-result{position:relative;z-index:2;margin-left:7px;color:#347ff1;font-size:16px;white-space:nowrap}.axis-labels{display:flex;justify-content:space-between;margin-top:16px;color:#8993a4;font-size:13px}
@media (max-width:760px){.score-distribution{padding:22px 16px 20px}.chart-head{align-items:flex-start;flex-direction:column}.chart-summary{align-self:flex-end}.distribution-chart{padding-left:74px}.grid-lines{left:74px}.range-label{left:-68px;width:62px;font-size:12px}.bar-result{font-size:12px}}
</style>

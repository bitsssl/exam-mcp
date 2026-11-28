<template>
  <article class="metric-stat-card" :class="[`metric-stat-card--${tone}`, { 'metric-stat-card--stacked': stacked }]">
    <div v-if="!stacked" class="metric-stat-icon"><el-icon><component :is="icon" /></el-icon></div>
    <div class="metric-stat-content">
      <span>{{ label }}</span>
      <strong>{{ value }}</strong>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(defineProps<{
  label: string
  value: string | number
  icon?: Component
  tone?: 'primary' | 'warning' | 'success' | 'info'
  /** 上下排布变体：不显示图标，标签在上、数值在下 */
  stacked?: boolean
}>(), {
  tone: 'primary',
  stacked: false
})
</script>

<style scoped>
.metric-stat-card { display: flex; align-items: center; gap: 12px; min-height: 76px; padding: 12px 18px; border: 1px solid var(--el-border-color-lighter); border-left: 4px solid var(--el-color-primary); border-radius: 8px; background: var(--el-fill-color-blank); }
.metric-stat-card--warning { border-left-color: var(--el-color-warning); }
.metric-stat-card--success { border-left-color: var(--el-color-success); }
.metric-stat-card--info { border-left-color: var(--el-color-info); }
.metric-stat-icon { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 38px; width: 38px; height: 38px; border-radius: 50%; color: var(--el-color-primary); background: var(--el-color-primary-light-9); font-size: 20px; }
.metric-stat-card--warning .metric-stat-icon { color: var(--el-color-warning); background: var(--el-color-warning-light-9); }
.metric-stat-card--success .metric-stat-icon { color: var(--el-color-success); background: var(--el-color-success-light-9); }
.metric-stat-card--info .metric-stat-icon { color: var(--el-color-info); background: var(--el-color-info-light-9); }
.metric-stat-content { display: flex; align-items: baseline; justify-content: space-between; flex: 1; gap: 12px; min-width: 0; }
.metric-stat-content span { color: var(--el-text-color-secondary); font-size: 13px; white-space: nowrap; }
.metric-stat-content strong { overflow: hidden; color: var(--el-text-color-primary); font-size: 26px; line-height: 1; text-overflow: ellipsis; white-space: nowrap; }
.metric-stat-card--stacked { min-height: 0; }
.metric-stat-card--stacked .metric-stat-content { flex-direction: column; align-items: flex-start; gap: 6px; }
</style>

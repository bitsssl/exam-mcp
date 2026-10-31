<template>
  <div class="exam-home-page">
    <el-card shadow="never" class="welcome-card">
      <div class="welcome-mark"><el-icon><Reading /></el-icon></div>
      <div>
        <h1>智能阅卷工作台</h1>
        <p>请从左侧菜单进入相应模块。科目、考试、答卷、阅卷标准、阅卷模板和阅卷流程各自独立，模块间会保留关联跳转。</p>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { Reading } from '@element-plus/icons-vue'
</script>

<style scoped>
.exam-home-page { display: grid; gap: 20px; padding: 24px; }
.welcome-card :deep(.el-card__body) { display: flex; align-items: center; gap: 18px; padding: 28px; }
.welcome-mark { display: grid; width: 58px; height: 58px; flex: 0 0 auto; place-items: center; border-radius: 16px; background: #eef4ff; color: #356ee6; font-size: 30px; }
.welcome-card h1 { margin: 0; color: var(--el-text-color-primary); font-size: 24px; }
.welcome-card p, .module-card p { margin: 8px 0 0; color: var(--el-text-color-secondary); line-height: 1.6; }
</style>

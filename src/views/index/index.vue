<!-- 布局容器 -->
<template>
  <div class="app-layout">
    <aside id="app-sidebar">
      <ArtSidebarMenu />
    </aside>

    <main id="app-main">
      <div id="app-header">
        <ArtHeaderBar />
      </div>
      <div id="app-content">
        <ArtPageContent />
      </div>
    </main>

    <div id="app-global">
      <ArtGlobalComponent />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { MenuTypeEnum } from '@/enums/appEnum'
  import { useSettingStore } from '@/store/modules/setting'

  defineOptions({ name: 'AppLayout' })

  // 阅卷工作台以左侧菜单作为主要模块导航，兼容迁移前保存的其他菜单布局偏好。
  useSettingStore().switchMenuLayouts(MenuTypeEnum.LEFT)
</script>

<style lang="scss" scoped>
  @use './style';
</style>

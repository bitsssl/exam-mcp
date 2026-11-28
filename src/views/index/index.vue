<!-- 布局容器 -->
<template>
  <div class="app-layout">
    <aside id="app-sidebar" :style="sidebarOverrideStyle">
      <ArtSidebarMenu />
      <!-- 侧边栏右缘拖拽手柄：按住左右拖动调整宽度，双击恢复默认 -->
      <div
        v-if="resizeEnabled"
        class="sidebar-resize-handle"
        :class="{ 'is-dragging': isResizingSidebar }"
        title="拖动调整侧边栏宽度，双击恢复默认"
        @mousedown.prevent="startSidebarResize"
        @dblclick="resetSidebarWidth"
      />
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
  import { computed, onMounted, ref, onUnmounted } from 'vue'
  import { MenuTypeEnum } from '@/enums/appEnum'
  import { SETTING_DEFAULT_CONFIG } from '@/config/setting'
  import { useSettingStore } from '@/store/modules/setting'

  defineOptions({ name: 'AppLayout' })

  const settingStore = useSettingStore()

  // 阅卷工作台以左侧菜单作为主要模块导航，兼容迁移前保存的其他菜单布局偏好。
  settingStore.switchMenuLayouts(MenuTypeEnum.LEFT)

  // ===== 侧边栏拖拽调宽：拖动右缘手柄调整宽度（200~420px），设置随 store 自动持久化 =====
  const SIDEBAR_WIDTH_MIN = 200
  const SIDEBAR_WIDTH_MAX = 420
  const isResizingSidebar = ref(false)
  const sidebarWidthOverride = ref<number | null>(null)
  const resizeEnabled = ref(true)

  const sidebarOverrideStyle = computed(() =>
    sidebarWidthOverride.value ? { width: `${sidebarWidthOverride.value}px` } : undefined
  )

  const startSidebarResize = (event: MouseEvent) => {
    const sidebar = document.querySelector('#app-sidebar') as HTMLElement | null
    const startWidth = sidebar?.offsetWidth || SETTING_DEFAULT_CONFIG.menuOpenWidth
    const startX = event.clientX
    isResizingSidebar.value = true
    document.body.classList.add('sidebar-resizing')

    const onMouseMove = (moveEvent: MouseEvent) => {
      const next = Math.min(
        SIDEBAR_WIDTH_MAX,
        Math.max(SIDEBAR_WIDTH_MIN, startWidth + (moveEvent.clientX - startX))
      )
      sidebarWidthOverride.value = next
      settingStore.setMenuOpenWidth(next)
    }
    const onMouseUp = () => {
      isResizingSidebar.value = false
      document.body.classList.remove('sidebar-resizing')
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const resetSidebarWidth = () => {
    sidebarWidthOverride.value = null
    settingStore.setMenuOpenWidth(SETTING_DEFAULT_CONFIG.menuOpenWidth)
  }

  const syncResizeEnabled = () => {
    // 窄屏（≤800px）下侧边栏变为抽屉式固定定位，不支持拖拽调宽
    resizeEnabled.value = window.innerWidth > 800
  }

  onMounted(() => {
    syncResizeEnabled()
    window.addEventListener('resize', syncResizeEnabled)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', syncResizeEnabled)
    document.body.classList.remove('sidebar-resizing')
  })
</script>

<style lang="scss" scoped>
  @use './style';
</style>

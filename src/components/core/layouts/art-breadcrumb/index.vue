<!-- 面包屑导航 -->
<template>
  <nav class="ml-2.5 max-lg:!hidden" aria-label="breadcrumb">
    <ul class="flex-c h-full">
      <li
        v-for="(item, index) in breadcrumbItems"
        :key="item.path"
        class="box-border flex-c h-7 text-sm leading-7"
      >
        <div
          :class="
            isClickable(item, index)
              ? 'c-p py-1 rounded tad-200 hover:bg-active-color hover:[&_span]:text-g-600'
              : ''
          "
          @click="handleBreadcrumbClick(item, index)"
        >
          <span
            class="block max-w-46 overflow-hidden text-ellipsis whitespace-nowrap px-1.5 text-sm text-g-600 dark:text-g-800"
            >{{ formatMenuTitle(item.meta?.title as string) }}</span
          >
        </div>
        <div
          v-if="!isLastItem(index) && item.meta?.title"
          class="mx-1 text-sm not-italic text-g-500"
          aria-hidden="true"
        >
          /
        </div>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import type { RouteLocationMatched, RouteRecordRaw } from 'vue-router'
  import { formatMenuTitle } from '@/utils/router'

  defineOptions({ name: 'ArtBreadcrumb' })

  export interface BreadcrumbItem {
    path: string
    meta: RouteRecordRaw['meta']
  }

  const route = useRoute()
  const router = useRouter()

  // 使用computed替代watch，提高性能
  const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
    const { matched } = route
    const matchedLength = matched.length

    // 处理首页情况
    if (!matchedLength || isHomeRoute(matched[0])) {
      return []
    }

    // 处理一级菜单和普通路由
    const firstRoute = matched[0]
    const isFirstLevel = firstRoute.meta?.isFirstLevel
    const lastIndex = matchedLength - 1
    const currentRoute = matched[lastIndex]
    const currentRouteMeta = currentRoute.meta

    let items = isFirstLevel
      ? [createBreadcrumbItem(currentRoute)]
      : matched.map(createBreadcrumbItem)

    // 试卷详情从“答卷管理”进入；详情路由沿用了阅卷模块的 URL，
    // 因此在面包屑中将其归到答卷菜单，避免显示成“科目与考试”。
    const answerRoutes = new Set([
      'teacher-package-detail',
      'teacher-student-score-compare',
      'teacher-answer-detail'
    ])
    if (answerRoutes.has(String(currentRoute.name || ''))) {
      items = [
        { path: '/answers', meta: { title: '答卷管理' } },
        { path: currentRoute.path, meta: { ...currentRoute.meta, title: currentRoute.name === 'teacher-package-detail' ? '试卷详情' : currentRoute.meta.title } }
      ]
    }

    const resultRouteNames: Record<string, { path: string; title: string }> = {
      'teacher-package-trial-results': {
        path: '/grading/trial-results',
        title: '查看试阅结果'
      },
      'teacher-package-formal-results': {
        path: '/grading/formal-results',
        title: '查看正式评阅结果'
      }
    }
    const resultRoute = resultRouteNames[String(currentRoute.name || '')]
    if (resultRoute) {
      items = [
        { path: '/grading', meta: { title: '阅卷管理' } },
        { path: resultRoute.path, meta: { title: resultRoute.title } },
        { path: currentRoute.path, meta: { ...currentRoute.meta, title: '结果详情' } }
      ]
    }

    // 组装模板页从考试详情进入，但业务上属于独立的“阅卷模板管理”模块。
    // 将隐藏详情页归到对应一级菜单，避免显示成“科目与考试 / 阅卷模板”。
    if (String(currentRoute.name || '') === 'teacher-grading-templates') {
      items = [
        { path: '/grading-templates', meta: { title: '阅卷模板管理' } },
        { path: currentRoute.path, meta: { ...currentRoute.meta, title: '组装阅卷模板' } }
      ]
    }

    // 过滤包裹容器：如果有多个项目且第一个是容器路由（如 /outside），则移除它
    if (items.length > 1 && isWrapperContainer(items[0])) {
      items = items.slice(1)
    }

    // IFrame 页面特殊处理：如果过滤后只剩一个 iframe 页面，或者所有项都是包裹容器，则仅展示当前页
    if (currentRouteMeta?.isIframe && (items.length === 1 || items.every(isWrapperContainer))) {
      return [createBreadcrumbItem(currentRoute)]
    }

    return items
  })

  // 辅助函数：判断是否为包裹容器路由
  const isWrapperContainer = (item: BreadcrumbItem): boolean =>
    item.path === '/outside' && !!item.meta?.isIframe

  // 辅助函数：创建面包屑项目
  const createBreadcrumbItem = (route: RouteLocationMatched): BreadcrumbItem => ({
    path: route.path,
    meta: route.meta
  })

  // 辅助函数：判断是否为首页
  const isHomeRoute = (route: RouteLocationMatched): boolean => route.name === '/'

  // 辅助函数：判断是否为最后一项
  const isLastItem = (index: number): boolean => {
    const itemsLength = breadcrumbItems.value.length
    return index === itemsLength - 1
  }

  // 辅助函数：判断是否可点击
  const isClickable = (item: BreadcrumbItem, index: number): boolean =>
    item.path !== '/outside' && !isLastItem(index)

  // 辅助函数：查找路由的第一个有效子路由
  const findFirstValidChild = (route: RouteRecordRaw) =>
    route.children?.find((child) => !child.redirect && !child.meta?.isHide)

  // 辅助函数：构建完整路径
  const buildFullPath = (childPath: string): string => `/${childPath}`.replace('//', '/')

  // 处理面包屑点击事件
  async function handleBreadcrumbClick(item: BreadcrumbItem, index: number): Promise<void> {
    // 如果是最后一项或外部链接，不处理
    if (isLastItem(index) || item.path === '/outside') {
      return
    }

    try {
      // 缓存路由表查找结果
      const routes = router.getRoutes()
      const targetRoute = routes.find((route) => route.path === item.path)

      if (!targetRoute?.children?.length) {
        await router.push(item.path)
        return
      }

      const firstValidChild = findFirstValidChild(targetRoute)
      if (firstValidChild) {
        await router.push(buildFullPath(firstValidChild.path))
      } else {
        await router.push(item.path)
      }
    } catch (error) {
      console.error('导航失败:', error)
    }
  }
</script>

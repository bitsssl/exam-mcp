import type { AppRouteRecord } from '@/types/router'

const teachersAndAdmins = ['R_USER', 'R_SUPER', 'R_ADMIN']
const administrators = ['R_SUPER', 'R_ADMIN']

/** 业务菜单保持在壳子的一级导航中；详情路由隐藏在菜单下供业务跳转使用。*/
export const platformRoutes: AppRouteRecord[] = [
  {
    path: '/user-management',
    name: 'PlatformUsers',
    component: '/auth/Users',
    meta: { title: '用户管理', icon: 'ri:group-line', roles: administrators, keepAlive: true }
  },
  {
    path: '/teacher',
    name: 'SubjectAndExamManagement',
    component: '/index/index',
    meta: { title: '科目与考试', icon: 'ri:file-list-3-line', roles: teachersAndAdmins },
    children: [
      {
        path: 'scoring',
        name: 'TeacherScoring',
        component: '/teacher/scoring/index',
        meta: { title: '科目管理', icon: 'ri:book-2-line', roles: teachersAndAdmins, keepAlive: true }
      },
      {
        path: 'exams',
        name: 'TeacherExamManagement',
        component: '/teacher/scoring/ExamManagement',
        meta: { title: '考试管理', icon: 'ri:calendar-event-line', roles: teachersAndAdmins, keepAlive: true }
      },
      {
        path: 'scoring/subjects/:subjectId/exams/:examId',
        name: 'teacher-exam-detail',
        component: '/teacher/scoring/ExamDetail',
        meta: { title: '考试详情', isHide: true, roles: teachersAndAdmins, keepAlive: true }
      },
      {
        path: 'scoring/subjects/:subjectId/exams/:examId/grading-standards',
        name: 'teacher-grading-standards',
        component: '/teacher/scoring/GradingStandardsPage',
        meta: { title: '阅卷标准', isHide: true, isFirstLevel: true, roles: teachersAndAdmins, keepAlive: true }
      },
      {
        path: 'scoring/subjects/:subjectId/exams/:examId/grading-templates',
        name: 'teacher-grading-templates',
        component: '/teacher/scoring/GradingTemplatesPage',
        meta: { title: '阅卷模板', isHide: true, roles: teachersAndAdmins, keepAlive: true }
      },
      {
        path: 'scoring/subjects/:subjectId/exams/:examId/packages/:packageId',
        name: 'teacher-package-detail',
        component: '/teacher/scoring/PackageDetail',
        meta: { title: '试卷详情', isHide: true, roles: teachersAndAdmins, keepAlive: true }
      },
      {
        path: 'scoring/subjects/:subjectId/exams/:examId/packages/:packageId/results/trial',
        name: 'teacher-package-trial-results',
        component: '/teacher/scoring/PackageDetail',
        props: { initialDrawer: 'trial' },
        meta: { title: '试阅结果', isHide: true, roles: teachersAndAdmins, keepAlive: true }
      },
      {
        path: 'scoring/subjects/:subjectId/exams/:examId/packages/:packageId/results/formal',
        name: 'teacher-package-formal-results',
        component: '/teacher/scoring/FormalGradingResultsPage',
        meta: { title: '正式阅卷结果', isHide: true, roles: teachersAndAdmins, keepAlive: true }
      },
      {
        path: 'scoring/subjects/:subjectId/exams/:examId/packages/:packageId/results/formal/completion',
        name: 'teacher-package-formal-completion',
        component: '/teacher/scoring/FormalGradingCompletionPage',
        meta: { title: '评阅完成报告', isHide: true, roles: teachersAndAdmins, keepAlive: false }
      },
      {
        path: 'scoring/subjects/:subjectId/exams/:examId/packages/:packageId/results/formal/students/:studentNo',
        name: 'teacher-package-formal-student-detail',
        component: '/teacher/scoring/FormalStudentDetailPage',
        meta: { title: '考生评阅详情', isHide: true, roles: teachersAndAdmins, keepAlive: false }
      },
      {
        path: 'scoring/subjects/:subjectId/exams/:examId/packages/:packageId/student-compare',
        name: 'teacher-student-score-compare',
        component: '/teacher/scoring/StudentScoreCompare',
        meta: { title: '考生评分对比', isHide: true, roles: teachersAndAdmins, keepAlive: true }
      },
      {
        path: 'scoring/subjects/:subjectId/exams/:examId/packages/:packageId/answers/:answerId',
        name: 'teacher-answer-detail',
        component: '/teacher/scoring/AnswerDetail',
        meta: { title: '答卷详情', isHide: true, roles: teachersAndAdmins, keepAlive: true }
      },
      {
        path: 'scoring/subjects/:subjectId/exams/:examId/packages/:packageId/grading-placeholder',
        name: 'teacher-grading-placeholder',
        component: '/teacher/scoring/GradingPlaceholder',
        meta: { title: '评分复核', isHide: true, roles: teachersAndAdmins, keepAlive: true }
      }
    ]
  },
  {
    path: '/grading-standards',
    name: 'GradingStandardsManagement',
    component: '/teacher/scoring/WorkflowManagementPage',
    meta: { title: '阅卷标准管理', icon: 'ri:article-line', isFirstLevel: true, roles: teachersAndAdmins, workflowModule: 'standards', keepAlive: true }
  },
  {
    path: '/answers',
    name: 'AnswerManagement',
    component: '/index/index',
    meta: { title: '答卷管理', icon: 'ri:folder-upload-line', roles: teachersAndAdmins },
    children: [
      {
        path: 'upload',
        name: 'AnswerUpload',
        component: '/teacher/answers/index',
        meta: { title: '答卷上传', icon: 'ri:upload-cloud-2-line', roles: teachersAndAdmins, keepAlive: true }
      },
      {
        path: 'parse',
        name: 'AnswerParse',
        component: '/teacher/answers/AnswerParsePage',
        meta: { title: '答案抽取', icon: 'ri:file-search-line', roles: teachersAndAdmins, keepAlive: true }
      },
      {
        path: 'parse/:subjectId/:examId/:packageId/candidate-assignment-report',
        name: 'answer-candidate-assignment-report',
        component: '/teacher/answers/CandidateAssignmentReport',
        meta: { title: '答案抽取报告', isHide: true, roles: teachersAndAdmins }
      },
      {
        path: 'parse/:subjectId/:examId/:packageId/report',
        name: 'answer-parse-report',
        component: '/teacher/answers/ParseReportPage',
        meta: { title: '答卷解析报告', isHide: true, roles: teachersAndAdmins }
      },
      {
        path: 'upload/:subjectId/:examId/structure',
        name: 'answer-upload-structure',
        component: '/teacher/answers/BlankPaperStructurePage',
        meta: { title: '试卷结构', isHide: true, roles: teachersAndAdmins }
      }
    ]
  },
  {
    path: '/grading-templates',
    name: 'GradingTemplatesManagement',
    component: '/teacher/scoring/WorkflowManagementPage',
    meta: { title: '阅卷模板管理', icon: 'ri:layout-grid-line', isHide: true, workflowModule: 'templates', roles: teachersAndAdmins, keepAlive: true }
  },
  {
    path: '/grading',
    name: 'GradingManagement',
    component: '/index/index',
    redirect: '/grading/trial',
    meta: { title: '阅卷管理', icon: 'ri:edit-box-line', roles: teachersAndAdmins },
    children: [
      {
        path: 'trial',
        name: 'GradingTrial',
        component: '/teacher/scoring/WorkflowManagementPage',
        meta: {
          title: '试阅',
          icon: 'ri:task-line',
          roles: teachersAndAdmins,
          workflowModule: 'grading-trial',
          keepAlive: true
        }
      },
      {
        path: 'formal',
        name: 'GradingFormal',
        component: '/teacher/scoring/WorkflowManagementPage',
        meta: {
          title: '评阅',
          icon: 'ri:edit-2-line',
          roles: teachersAndAdmins,
          workflowModule: 'grading-formal',
          keepAlive: true
        }
      },
      {
        path: 'results',
        name: 'GradingResults',
        // 查看评阅结果 = 按阅卷任务展开的分组菜单：子菜单由 MenuProcessor
        // 在会话初始化时按阅卷任务清单动态注入（一个任务一个子菜单），
        // 点击子菜单进入该任务的正式评阅结果页。
        meta: {
          title: '查看评阅结果',
          icon: 'ri:bar-chart-box-line',
          roles: teachersAndAdmins,
          keepAlive: true
        },
        children: []
      },
      {
        // 保留旧地址供历史书签和已有跳转使用，但不再作为菜单显示。
        path: 'tasks',
        name: 'GradingTasks',
        component: '/teacher/scoring/WorkflowManagementPage',
        meta: { title: '阅卷任务', isHide: true, roles: teachersAndAdmins, workflowModule: 'grading', keepAlive: true }
      },
      {
        // 试阅结果不再提供汇总页，旧地址统一回到正式评阅结果列表。
        path: 'trial-results',
        name: 'GradingTrialResults',
        redirect: '/grading/results',
        meta: { title: '查看试阅结果', isHide: true, roles: teachersAndAdmins, keepAlive: true }
      },
      {
        path: 'formal-results',
        name: 'GradingFormalResults',
        component: '/teacher/scoring/GradingResultsPage',
        props: { initialDrawer: 'formal' },
        meta: { title: '查看正式评阅结果', isHide: true, roles: teachersAndAdmins, keepAlive: true }
      },
    ]
  },
  {
    path: '/mcp-services',
    name: 'McpServiceManagement',
    component: '/index/index',
    redirect: '/mcp-services/square',
    meta: { title: 'MCP服务管理', icon: 'ri:server-line', roles: administrators },
    children: [
      { path: 'square', name: 'McpServiceSquare', component: '/marketplace/index', meta: { title: 'MCP广场', icon: 'ri:grid-line', roles: administrators, keepAlive: true } },
      { path: 'publish', name: 'McpServicePublish', component: '/mcp/index', meta: { title: 'MCP发布服务', icon: 'ri:upload-cloud-line', roles: administrators, keepAlive: true } }
    ]
  },
  {
    path: '/server',
    name: 'McpServerLegacyRedirect',
    redirect: '/mcp-services/publish',
    meta: { title: 'MCP 服务', isHide: true, roles: administrators }
  },
  // 暂不展示其他平台配置入口，保留既有 URL，避免影响管理员已有操作。
  {
    path: '/marketplace',
    name: 'McpMarketplace',
    component: '/index/index',
    redirect: '/marketplace/index',
    meta: { title: 'MCP 服务发布', isHide: true, roles: administrators },
    children: [
      {
        path: 'index',
        name: 'marketplace',
        component: '/marketplace/index',
        meta: { title: '服务发布', isHide: true, roles: administrators }
      },
      {
        path: ':id',
        name: 'module-detail',
        component: '/marketplace/McpTemplateDetail',
        meta: { title: '服务详情', isHide: true, roles: administrators }
      }
    ]
  },
  {
    path: '/statistics',
    name: 'PlatformStatistics',
    component: '/index/index',
    redirect: '/statistics/overview',
    meta: { title: 'MCP 统计', isHide: true, roles: administrators },
    children: [
      {
        path: 'overview',
        name: 'Statistics',
        component: '/statictics/index',
        meta: { title: '使用统计', isHide: true, roles: administrators }
      }
    ]
  },
  {
    path: '/platform-settings',
    name: 'PlatformSettings',
    component: '/index/index',
    redirect: '/platform-settings/overview',
    meta: { title: '系统设置', isHide: true, roles: administrators },
    children: [
      { path: 'overview', name: 'system-management', component: '/system/index', meta: { title: '服务状态', isHide: true, roles: administrators } },
      { path: 'python-packages', name: 'python-packages', component: '/system/PythonPackages', meta: { title: 'Python 环境', isHide: true, roles: administrators } },
      { path: 'scheduled-tasks', name: 'scheduled-tasks', component: '/system/ScheduledTasks', meta: { title: '定时任务', isHide: true, roles: administrators } },
      { path: 'mcp-secrets', name: 'mcp-auth-secret-management', component: '/mcp-auth/SecretManagement', meta: { title: 'MCP 密钥', isHide: true, roles: administrators } },
      { path: 'mcp-access-logs', name: 'mcp-auth-access-logs', component: '/mcp-auth/AccessLogs', meta: { title: 'MCP 访问日志', isHide: true, roles: administrators } }
    ]
  },
  {
    path: '/profile',
    name: 'Profile',
    component: '/index/index',
    meta: { title: '个人帐户', roles: teachersAndAdmins, isHide: true },
    children: [
      {
        path: 'center',
        name: 'ProfileCenter',
        component: '/system/user-center',
        meta: { title: '个人资料', isHide: true, isHideTab: true }
      }
    ]
  }
]

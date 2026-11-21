/**
 * 答卷上传与答案抽取共用的数据变更通知。
 *
 * 两个页面使用 keep-alive 时不会因为路由切换重新请求列表，删除或上传
 * 成功后通过浏览器事件通知另一页重新读取服务端数据，避免依赖手动刷新。
 */
export const ANSWER_UPLOADS_CHANGED_EVENT = 'teacher-answer-uploads-changed'

export function notifyAnswerUploadsChanged() {
  window.dispatchEvent(new CustomEvent(ANSWER_UPLOADS_CHANGED_EVENT))
}

export function subscribeAnswerUploadsChanged(handler: () => void) {
  const listener = () => handler()
  window.addEventListener(ANSWER_UPLOADS_CHANGED_EVENT, listener)
  return () => window.removeEventListener(ANSWER_UPLOADS_CHANGED_EVENT, listener)
}

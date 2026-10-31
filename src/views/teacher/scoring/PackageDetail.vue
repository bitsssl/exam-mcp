<template>
  <div class="package-detail-page">
    <el-card v-if="!resultsView">
      <template #header>
        <div class="card-header">
          <span>{{ packageTitle }}</span>
        </div>
      </template>

      <div class="viewer-toolbar">
        <div class="pagination-actions" v-if="pagedStudents.length > 1">
          <el-button :disabled="currentPage <= 1" @click="currentPage -= 1">上一份</el-button>
          <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
          <el-button :disabled="currentPage >= totalPages" @click="currentPage += 1">下一份</el-button>
        </div>

        <!-- 批量试阅/评阅入口暂时隐藏，后续有需要再启用 -->
        <div v-if="false" class="batch-toolbar">
          <el-button
            :disabled="!selectedQuestionKeys.length"
            @click="goToBatchGrading('batch-trial')"
          >
            批量试阅
          </el-button>
          <el-button
            type="primary"
            :disabled="!selectedQuestionKeys.length"
            @click="goToBatchGrading('batch-grade')"
          >
            批量评阅
          </el-button>
          <span class="selected-count">
            已选 {{ selectedQuestionKeys.length }} 道
          </span>
        </div>

        <div v-if="scoringMode" class="paper-toolbar">
          <el-select
            v-model="selectedPaperStudentNos"
            class="paper-student-select"
            multiple
            collapse-tags
            collapse-tags-tooltip
            filterable
            clearable
            placeholder="选择整卷考生"
          >
            <el-option
              v-for="student in studentCompareOptions"
              :key="student.value"
              :label="student.label"
              :value="student.value"
            />
          </el-select>
          <el-button :disabled="!filteredStudents.length" @click="selectFilteredStudentsForPaper">
            全选当前筛选
          </el-button>
          <el-select
            v-model="paperRangeStartNo"
            class="paper-range-select"
            filterable
            clearable
            placeholder="起始考生"
          >
            <el-option
              v-for="student in studentCompareOptions"
              :key="student.value"
              :label="student.label"
              :value="student.value"
            />
          </el-select>
          <span class="paper-range-sep">至</span>
          <el-select
            v-model="paperRangeEndNo"
            class="paper-range-select"
            filterable
            clearable
            placeholder="结束考生"
          >
            <el-option
              v-for="student in studentCompareOptions"
              :key="student.value"
              :label="student.label"
              :value="student.value"
            />
          </el-select>
          <el-button
            :disabled="!paperRangeStartNo || !paperRangeEndNo"
            @click="selectPaperStudentRange"
          >
            区间选择
          </el-button>
          <span class="paper-selected-count">
            {{ paperActionStudentCountText }}
          </span>
        </div>

        <el-input
          v-model="searchKeyword"
          class="answer-search"
          clearable
          placeholder="按学号、问题或关键字搜索..."
          :prefix-icon="Search"
        />
      </div>

      <div v-loading="loading" class="answer-viewer">
        <el-empty
          v-if="!loading && filteredStudents.length === 0"
          description="暂无考生答卷"
        />

        <div v-else-if="currentStudent" class="student-card">
          <div class="student-header">
            <div>
              <div class="student-title">
                <strong>学号：</strong>{{ currentStudent.student_no }}
                <span v-if="scoringMode && currentTotalScore !== null" class="score-text">
                  总分：{{ currentTotalScore }}
                </span>
                <!-- 查看模式：试阅总分与评阅总分分别展示 -->
                <template v-else-if="!scoringMode">
                  <span v-if="hasStudentRecordForMode(currentStudent, 'trial')" class="score-text">
                    试阅总分：{{ getStudentTotalScoreText(currentStudent, 'trial') }}
                  </span>
                  <span v-if="hasStudentRecordForMode(currentStudent, 'formal')" class="score-text">
                    评阅总分：{{ getStudentTotalScoreText(currentStudent, 'formal') }}
                  </span>
                  <span v-if="!hasStudentRecordForMode(currentStudent, 'trial') && !hasStudentRecordForMode(currentStudent, 'formal')" class="score-text">
                    总分：暂无
                  </span>
                </template>
              </div>
              <div class="meta-text">包含 {{ currentQuestions.length }} 道大题</div>
            </div>
            <!-- 批量试阅/评阅入口已隐藏，整卷批量勾选框不再展示（保留代码便于恢复） -->
            <el-checkbox
              v-if="currentStudent && false"
              :model-value="isPaperStudentSelected(currentStudent?.student_no || '')"
              @change="togglePaperStudentSelection(currentStudent?.student_no || '', Boolean($event))"
            >
              整卷批量
            </el-checkbox>
          </div>

          <details
            v-for="(topic, topicIndex) in currentQuestions"
            :key="topicIndex"
            class="question-block"
          >
            <summary>
              <span class="question-tag">大题 {{ topicIndex + 1 }}</span>
              <span>{{ getDisplayText(topic.question) || '未命名题目' }}</span>
              <!-- 查看模式（无 mode）同时展示试阅与评阅标记；试阅/评阅页面只展示对应标记 -->
              <template v-if="currentStudent && !scoringMode">
                <el-tag
                  v-if="hasTopicRecordForMode(currentStudent.student_no, topicIndex, topic, 'trial')"
                  class="review-status-tag"
                  size="small"
                  type="warning"
                  effect="light"
                >已试阅</el-tag>
                <el-tag
                  v-if="hasTopicRecordForMode(currentStudent.student_no, topicIndex, topic, 'formal')"
                  class="review-status-tag"
                  size="small"
                  type="success"
                  effect="light"
                >已评阅</el-tag>
              </template>
              <el-tag
                v-else-if="currentStudent && getTopicReviewStatus(currentStudent.student_no, topicIndex, topic)"
                class="review-status-tag"
                size="small"
                :type="getTopicReviewStatus(currentStudent.student_no, topicIndex, topic)?.type"
                effect="light"
              >{{ getTopicReviewStatus(currentStudent.student_no, topicIndex, topic)?.label }}</el-tag>
            </summary>

            <div class="question-content">
              <RichImageContent :text="topic.question" text-class="question-title" :resolve="resolveImageUrl" @preview="previewImage" />
              <ImageList :images="getStandaloneQuestionImages(topic)" :resolve="resolveImageUrl" @preview="previewImage" />
              <RichImageContent :text="topic.answer" text-class="answer-text" :resolve="resolveImageUrl" @preview="previewImage" />

              <div
                v-for="(subQuestion, subIndex) in topic.sub_question || []"
                :key="subIndex"
                class="sub-question"
              >
                <div class="sub-title-row">
                  <div class="sub-title">子题 {{ subIndex + 1 }}：{{ getDisplayText(subQuestion.question) }}</div>
                  <template v-if="!scoringMode">
                    <el-tag
                      v-if="hasQuestionRecordForMode(currentStudent.student_no, topicIndex, subIndex, 'trial')"
                      class="review-status-tag"
                      size="small"
                      type="warning"
                      effect="light"
                    >已试阅</el-tag>
                    <el-tag
                      v-if="hasQuestionRecordForMode(currentStudent.student_no, topicIndex, subIndex, 'formal')"
                      class="review-status-tag"
                      size="small"
                      type="success"
                      effect="light"
                    >已评阅</el-tag>
                  </template>
                  <el-tag
                    v-else-if="getQuestionReviewStatus(currentStudent.student_no, topicIndex, subIndex)"
                    class="review-status-tag"
                    size="small"
                    :type="getQuestionReviewStatus(currentStudent.student_no, topicIndex, subIndex)?.type"
                    effect="light"
                  >{{ getQuestionReviewStatus(currentStudent.student_no, topicIndex, subIndex)?.label }}</el-tag>
                </div>
                <ImageList :images="getStandaloneQuestionImages(subQuestion)" :resolve="resolveImageUrl" @preview="previewImage" />
                <RichImageContent :text="subQuestion.answer" text-class="answer-text" :resolve="resolveImageUrl" @preview="previewImage" />
                <div v-if="scoringMode" class="sub-score-summary">
                  <span>得分：{{ getDisplayedQuestionScore(currentStudent.student_no, topicIndex, subIndex) }}</span>
                  <span>评语：{{ getDisplayedQuestionComment(currentStudent.student_no, topicIndex, subIndex) }}</span>
                </div>
                <!-- 查看模式：试阅与评阅结果分别成行展示，互不覆盖 -->
                <template v-else>
                  <div v-if="hasQuestionRecordForMode(currentStudent.student_no, topicIndex, subIndex, 'trial')" class="sub-score-summary">
                    <span>试阅：{{ getModeQuestionScoreText(currentStudent.student_no, topicIndex, subIndex, 'trial') }}</span>
                    <span>评语：{{ getModeQuestionCommentText(currentStudent.student_no, topicIndex, subIndex, 'trial') }}</span>
                  </div>
                  <div v-if="hasQuestionRecordForMode(currentStudent.student_no, topicIndex, subIndex, 'formal')" class="sub-score-summary">
                    <span>评阅：{{ getModeQuestionScoreText(currentStudent.student_no, topicIndex, subIndex, 'formal') }}</span>
                    <span>评语：{{ getModeQuestionCommentText(currentStudent.student_no, topicIndex, subIndex, 'formal') }}</span>
                  </div>
                  <div
                    v-if="!hasQuestionRecordForMode(currentStudent.student_no, topicIndex, subIndex, 'trial') && !hasQuestionRecordForMode(currentStudent.student_no, topicIndex, subIndex, 'formal')"
                    class="sub-score-summary"
                  >
                    <span>得分：暂无</span>
                  </div>
                </template>
                <!-- 本题评阅标准按钮按需求隐藏，保留代码后续可恢复
                <div class="sub-question-actions">
                  <el-button
                    v-if="getQuestionStandard(topicIndex, subIndex)"
                    size="small"
                    @click="openQuestionStandardDialog(topicIndex, subIndex)"
                  >
                    本题评阅标准
                  </el-button>
                </div>
                -->
              </div>
              <div class="topic-score-summary">
                <!-- 批量试阅/评阅入口已隐藏，大题勾选框不再展示（保留代码便于恢复） -->
                <el-checkbox
                  v-if="currentStudent && false"
                  class="batch-check topic-select-check"
                  :model-value="isTopicSelected(currentStudent?.student_no || '', topicIndex, topic)"
                  @change="toggleTopicSelection(currentStudent?.student_no || '', topicIndex, topic, Boolean($event))"
                >
                  选择
                </el-checkbox>
                <strong v-if="scoringMode">大题得分：{{ getDisplayedTopicScore(currentStudent.student_no, topicIndex, topic) }}</strong>
                <!-- 查看模式：大题的试阅与评阅得分分别展示 -->
                <template v-else>
                  <strong v-if="hasTopicRecordForMode(currentStudent.student_no, topicIndex, topic, 'trial')">试阅：{{ getTopicScoreValueForMode(currentStudent.student_no, topicIndex, topic, 'trial') }}</strong>
                  <strong v-if="hasTopicRecordForMode(currentStudent.student_no, topicIndex, topic, 'formal')">评阅：{{ getTopicScoreValueForMode(currentStudent.student_no, topicIndex, topic, 'formal') }}</strong>
                  <strong
                    v-if="!hasTopicRecordForMode(currentStudent.student_no, topicIndex, topic, 'trial') && !hasTopicRecordForMode(currentStudent.student_no, topicIndex, topic, 'formal')"
                  >大题得分：暂无</strong>
                </template>
                <div v-if="scoringMode" class="topic-review-actions">
                  <el-button
                    v-if="scoringMode === 'trial'"
                    size="small"
                    @click="goToTopicGrading('batch-trial', topicIndex, topic)"
                  >
                    试阅
                  </el-button>
                  <el-button
                    v-else
                    size="small"
                    type="primary"
                    @click="goToTopicGrading('batch-grade', topicIndex, topic)"
                  >
                    评阅
                  </el-button>
                </div>
              </div>
            </div>
          </details>

          <div v-if="scoringMode" class="paper-actions">
            <el-button v-if="scoringMode === 'trial'" @click="goToGradingPlaceholder('paper-trial')">
              整卷试阅（{{ paperActionStudentCount }} 人）
            </el-button>
            <el-button v-else type="primary" @click="goToGradingPlaceholder('paper-grade')">
              整卷评阅（{{ paperActionStudentCount }} 人）
            </el-button>
          </div>
        </div>
      </div>


      <section v-if="scoringMode" class="formal-overview">
        <div class="formal-actions">
          <el-button @click="loadGradingRecords">刷新结果</el-button>
        </div>
      </section>


    </el-card>



    <el-dialog
      v-model="formalDialogVisible"
      title="正式评阅设置"
      width="720px"
      class="formal-dialog"
      append-to-body
    >
      <el-alert
        type="warning"
        show-icon
        :closable="false"
        title="正式评阅会写入正式评分记录。默认跳过已评题目，避免覆盖人工复核后的结果。"
      />
      <el-form label-width="96px" class="formal-form">
        <el-form-item label="阅卷模板">
          <el-select v-model="formalForm.template_id" class="full-width" placeholder="请选择阅卷模板" filterable>
            <el-option
              v-for="template in gradingTemplates"
              :key="template.template_id"
              :label="`${template.template_name} / ${template.template_items?.length || 0}题`"
              :value="template.template_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="评阅范围">
          <el-radio-group v-model="formalForm.scope">
            <el-radio-button label="ungraded">未评题目</el-radio-button>
            <el-radio-button label="all">全部题目</el-radio-button>
            <el-radio-button label="current">当前考生</el-radio-button>
            <el-radio-button label="selected">已选题目</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="覆盖策略">
          <el-radio-group v-model="formalForm.overwrite">
            <el-radio label="skip">跳过已有正式结果</el-radio>
            <el-radio label="overwrite">重新评阅并覆盖</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="每批数量">
          <el-input-number v-model="formalForm.batch_size" :min="1" :max="10" />
        </el-form-item>
      </el-form>
      <div class="formal-preview">
        <div>预计评阅：<strong>{{ formalPreview.total }}</strong> 个评阅任务</div>
        <div>已跳过：<strong>{{ formalPreview.skipped }}</strong> 个已有正式结果</div>
        <div>缺少标准/MCP：<strong>{{ formalPreview.invalid }}</strong> 个</div>
      </div>
      <template #footer>
        <el-button @click="formalDialogVisible = false">取消</el-button>
        <el-button type="warning" :loading="formalGradingRunning" @click="startFormalGrading">开始正式评阅</el-button>
      </template>
    </el-dialog>
    <!-- 试阅结果独立页面（results/trial 路由进入） -->
    <div v-if="resultsView === 'trial'" class="result-page-panel">
      <div class="result-page-header">
        <span class="result-page-title">试阅结果</span>
      </div>
      <div class="trial-results-panel">
        <div class="trial-section-head">
          <div>
            <div class="trial-section-title">试阅结果</div>
            <div class="trial-section-desc">查看整批试阅汇总，以及每位考生的各题得分。</div>
          </div>
        </div>
        <div class="result-tabs trial-result-tabs">
          <el-radio-group v-model="trialResultTab" size="small">
            <el-radio-button label="summary">汇总结果</el-radio-button>
            <el-radio-button label="students">考生结果</el-radio-button>
            <!-- 考生对比标签当前不再使用，先隐藏；如需恢复展示，取消下方注释即可
            <el-radio-button label="studentCompare">考生对比</el-radio-button>
            -->
            <!-- 统计与差异标签按需求隐藏，保留代码后续可恢复
            <el-radio-button label="analysis">统计与差异</el-radio-button>
            -->
            <el-radio-button label="exceptions">异常试卷</el-radio-button>
          </el-radio-group>
          <div class="result-tab-content">
            <section v-if="trialResultPaneLoaded.summary" v-show="trialResultTab === 'summary'" class="result-tab-pane">
            <!-- 试阅版本栏按需求隐藏，保留代码便于恢复 -->
            <div v-if="false" class="trial-attempt-bar">
              <span class="trial-attempt-label">试阅版本：</span>
              <el-select
                v-if="trialGradingRounds.length > 1"
                v-model="trialSummaryAttempt"
                size="small"
                class="trial-attempt-select"
              >
                <el-option
                  v-for="option in trialAttemptOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <span v-else class="trial-attempt-static">第1轮｜{{ trialGradingRounds[0].timeText }}</span>
              <el-button
                size="small"
                text
                class="trial-round-star-btn"
                :class="{ 'is-starred': currentTrialRound?.round.starred }"
                :disabled="!currentTrialRound"
                @click="toggleRoundStar('trial')"
              >
                {{ currentTrialRound?.round.starred ? '★ 已星标' : '☆ 星标' }}
              </el-button>
              <el-button size="small" text class="trial-round-note-btn" :disabled="!currentTrialRound" @click="openRoundNoteDialog('trial')">
                编辑备注
              </el-button>
              <el-button size="small" text class="trial-round-clean-btn" @click="openRoundManageDialog('trial')">
                清理轮次
              </el-button>
              <span class="trial-attempt-hint">切换后按所选轮次展示：该轮重新试阅的题目显示新分数，未重试阅的题目沿用最近一次的分数。</span>
            </div>
            <!-- 当前查看栏按需求隐藏，保留代码便于恢复 -->
            <div v-if="currentTrialRound && false" class="trial-snapshot-bar">
              <strong>当前查看：第{{ currentTrialRound?.roundIndex }}轮试阅</strong>
              <span>时间：{{ currentTrialRound?.round.timeText || '-' }}</span>
              <span>操作人：{{ currentTrialRound?.round.creatorName }}</span>
              <span v-if="currentTrialRound?.round.note">备注：{{ currentTrialRound?.round.note }}</span>
              <el-tag v-if="currentTrialRound?.round.starred" size="small" type="warning" effect="plain">星标</el-tag>
            </div>
            <div class="summary-panel">
              <div class="summary-overview-grid">
                <article class="summary-stat-card">
                  <span class="summary-stat-label">试卷份数</span>
                  <strong class="summary-stat-value">{{ trialSummaryStats.paperCount }}</strong>
                </article>
                <article class="summary-stat-card">
                  <span class="summary-stat-label">最高分</span>
                  <strong class="summary-stat-value">{{ trialSummaryStats.maxScore }}</strong>
                </article>
                <article class="summary-stat-card">
                  <span class="summary-stat-label">最低分</span>
                  <strong class="summary-stat-value">{{ trialSummaryStats.minScore }}</strong>
                </article>
                <article class="summary-stat-card">
                  <span class="summary-stat-label">平均分</span>
                  <strong class="summary-stat-value">{{ trialSummaryStats.avgScore }}</strong>
                </article>
                <article class="summary-stat-card">
                  <span class="summary-stat-label">异常试卷</span>
                  <strong class="summary-stat-value">{{ trialSummaryStats.abnormalCount }}</strong>
                </article>
              </div>
              <section class="summary-section">
                <div class="summary-section-head">
                  <div>
                    <div class="summary-section-title">试卷明细</div>
                    <div class="summary-section-desc">点击考号可查看该份试卷的详细评分结果。</div>
                  </div>
                  <div class="summary-section-actions">
                    <el-button size="small" :icon="Download" @click="exportSummaryExcel('trial')">导出Excel</el-button>
                  </div>
                </div>
                <div class="summary-paper-list">
                  <button
                    v-for="paper in trialSummaryRows"
                    :key="paper.student_no"
                    class="summary-paper-row"
                    type="button"
                    @click="openPaperSummaryDetail('trial', paper)"
                  >
                    <span class="summary-paper-id">{{ paper.student_no }}</span>
                    <div class="summary-paper-inline-meta">
                      <strong>总分 {{ paper.totalScoreText }}</strong>
                      <span>已评 {{ paper.gradedCount }}/{{ paper.questionCount }} 题</span>
                    </div>
                    <div class="summary-paper-badges">
                      <el-tag size="small" :type="paper.abnormal ? 'danger' : 'success'" effect="light">
                        {{ paper.abnormal ? '异常' : '正常' }}
                      </el-tag>
                      <el-icon class="summary-paper-arrow">
                        <ArrowRight />
                      </el-icon>
                    </div>
                  </button>
                </div>
              </section>
            </div>
            </section>
            <section v-if="trialResultPaneLoaded.students" v-show="trialResultTab === 'students'" class="result-tab-pane">
            <el-table :data="pagedTrialStudentResults" class="trial-table" stripe>
              <el-table-column prop="student_no" label="考号" min-width="150" fixed />
              <el-table-column prop="totalScore" label="试阅总分" width="130" />
              <el-table-column
                v-for="questionNo in formalQuestionNos"
                :key="`trial-question-${questionNo}`"
                :label="`Q${questionNo}`"
                min-width="112"
              >
                <template #default="{ row }">
                  <div class="score-matrix-cell">
                    <strong>{{ getSummaryQuestion(row, questionNo)?.scoreText || '未评' }}</strong>
                    <span>{{ getSummaryQuestion(row, questionNo)?.versionText || '版本 -' }}</span>
                  </div>
                </template>
              </el-table-column>
            </el-table>
            <div class="student-result-pagination">
              <el-pagination
                v-model:current-page="trialStudentResultPage"
                :page-size="studentResultPageSize"
                :total="trialStudentResults.length"
                layout="total, prev, pager, next"
                background
              />
            </div>
            </section>
            <section v-if="trialResultPaneLoaded.studentCompare" v-show="trialResultTab === 'studentCompare'" class="result-tab-pane">
            <div class="student-compare-toolbar">
              <el-select
                v-model="trialStudentCompareStudent"
                class="student-compare-search"
                filterable
                clearable
                placeholder="请选择要查看标准对比的考号"
              >
                <el-option
                  v-for="student in studentCompareOptions"
                  :key="student.value"
                  :label="student.label"
                  :value="student.value"
                />
              </el-select>
              <el-button
                type="primary"
                :disabled="!trialStudentCompareStudent"
                @click="openStudentComparePage('trial')"
              >对比</el-button>
              <div class="student-compare-pager">
                <span>匹配 {{ filteredTrialStudentComparisonRows.length }} 位考生 / {{ trialStudentComparePageHint }}</span>
                <el-button size="small" :disabled="trialStudentComparePage <= 1" @click="trialStudentComparePage -= 1">上一页</el-button>
                <span class="student-compare-page">{{ trialStudentComparePage }} / {{ trialStudentCompareTotalPages }}</span>
                <el-button size="small" :disabled="trialStudentComparePage >= trialStudentCompareTotalPages" @click="trialStudentComparePage += 1">下一页</el-button>
              </div>
            </div>
            <el-empty v-if="!filteredTrialStudentComparisonRows.length" description="暂无可对比的考生结果" :image-size="64" />
            <div v-else class="student-compare-list">
              <article v-for="student in pagedTrialStudentComparisonRows" :key="student.student_no" class="student-compare-card">
                <div class="student-compare-head">
                  <div>
                    <div class="student-compare-title">{{ student.student_no }}</div>
                    <div class="student-compare-meta">已评 {{ student.gradedCount }}/{{ student.questionCount }} 题 / 总分 {{ student.totalScore }}</div>
                  </div>
                  <div class="student-compare-badges">
                    <el-tag size="small" :type="student.completed ? 'success' : 'warning'" effect="light">{{ student.statusText }}</el-tag>
                  </div>
                </div>
                <div class="student-question-grid">
                  <div
                    v-for="question in student.questions"
                    :key="question.question_no"
                    class="student-question-card"
                    :class="{ 'is-empty': !question.record }"
                  >
                    <div class="student-question-top">
                      <span class="question-tag">Q{{ question.question_no }}</span>
                    </div>
                    <div class="student-question-name" :title="question.questionText">{{ question.questionText || '未命名题目' }}</div>
                    <div class="student-question-metrics">
                      <span><small>人工评分</small><b>{{ question.manualScoreText }}</b></span>
                      <span><small>系统评分</small><b>{{ question.scoreText }}</b></span>
                      <span><small>评分差</small><b :class="question.manualDiffClass">{{ question.manualDiffText }}</b></span>
                    </div>
                    <div v-if="question.attemptCount !== undefined" class="student-question-meta">试阅 {{ question.attemptCount }} 次</div>
                    <div class="student-question-actions">
                      <el-button
                        class="student-comment-button"
                        size="small"
                        type="primary"
                        text
                        @click="openQuestionComment(student.student_no, question.question_no, question.comment)"
                      >评语</el-button>
                    </div>
                  </div>
                </div>
              </article>
            </div>
            </section>
            <section v-if="trialResultPaneLoaded.analysis" v-show="trialResultTab === 'analysis'" class="result-tab-pane">
            <div class="analysis-grid">
              <article v-for="item in trialQuestionStats" :key="item.question_no" class="analysis-card">
                <div class="analysis-card-head">
                  <div class="analysis-card-title">
                    <span class="question-tag">Q{{ item.question_no }}</span>
                    <strong>{{ item.questionText || '未命名题目' }}</strong>
                  </div>
                  <span class="analysis-average">均分 {{ item.avgScore }}</span>
                </div>
                <div class="analysis-metrics">
                  <div class="analysis-metric"><span>试卷份数</span><b>{{ item.paperCount }}</b></div>
                  <div class="analysis-metric"><span>已评份数</span><b>{{ item.count }}</b></div>
                  <div class="analysis-metric"><span>最高分</span><b>{{ item.maxScore }}</b></div>
                  <div class="analysis-metric"><span>最低分</span><b>{{ item.minScore }}</b></div>
                  <div class="analysis-metric"><span>平均分</span><b>{{ item.avgScore }}</b></div>
                  <div class="analysis-metric"><span>差异值</span><b>{{ item.spread }}</b></div>
                </div>
                <div class="analysis-footnote">试阅次数：{{ item.attemptCount }}</div>
              </article>
            </div>
            </section>
            <section v-if="trialResultPaneLoaded.exceptions" v-show="trialResultTab === 'exceptions'" class="result-tab-pane">
            <section class="exception-panel exception-panel-standalone">
              <div class="exception-head">
                <div>
                  <div class="exception-title">异常试卷</div>
                  <div class="exception-desc">整张试卷完成评阅后，总分为 0 或低于阈值的试卷会列入异常清单。</div>
                </div>
              </div>
              <el-empty v-if="!trialAbnormalPapers.length" description="暂无异常试卷" :image-size="56" />
              <div v-else class="exception-list">
                <article v-for="item in trialAbnormalPapers" :key="item.key" class="exception-item">
                  <div class="exception-item-main">
                    <strong>{{ item.student_no }}</strong>
                    <span>得分 {{ item.scoreText }} / 阈值 {{ item.thresholdText }}</span>
                  </div>
                  <div class="exception-item-meta">
                    <span>已评题数：{{ item.questionCount }}</span>
                  </div>
                </article>
              </div>
            </section>
            </section>
          </div>
        </div>
      </div>
    </div>

    <!-- 正式评阅结果独立页面（results/formal 路由进入） -->
    <div v-if="resultsView === 'formal'" class="result-page-panel">
      <div class="result-page-header">
        <span class="result-page-title">正式评阅结果</span>
      </div>
      <div class="formal-results-panel">
        <div class="formal-section-head">
          <div>
            <div class="formal-section-title">正式评阅结果</div>
            <div class="formal-section-desc">查看整批正式评阅汇总，以及每位考生的各题得分。</div>
          </div>
        </div>
        <div class="result-tabs formal-result-tabs">
          <el-radio-group v-model="formalResultTab" size="small">
            <el-radio-button label="summary">汇总结果</el-radio-button>
            <el-radio-button label="students">考生结果</el-radio-button>
            <!-- 统计与差异标签按需求隐藏，保留代码后续可恢复
            <el-radio-button label="analysis">统计与差异</el-radio-button>
            -->
            <el-radio-button label="exceptions">异常试卷</el-radio-button>
          </el-radio-group>
          <div class="result-tab-content">
            <section v-if="formalResultPaneLoaded.summary" v-show="formalResultTab === 'summary'" class="result-tab-pane">
            <!-- 评阅版本栏按需求隐藏，保留代码便于恢复 -->
            <div v-if="false" class="trial-attempt-bar">
              <span class="trial-attempt-label">评阅版本：</span>
              <el-select
                v-if="formalGradingRounds.length > 1"
                v-model="formalSummaryAttempt"
                size="small"
                class="trial-attempt-select"
              >
                <el-option
                  v-for="option in formalAttemptOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
              <span v-else class="trial-attempt-static">第1轮｜{{ formalGradingRounds[0].timeText }}</span>
              <el-button
                size="small"
                text
                class="trial-round-star-btn"
                :class="{ 'is-starred': currentFormalRound?.round.starred }"
                :disabled="!currentFormalRound"
                @click="toggleRoundStar('formal')"
              >
                {{ currentFormalRound?.round.starred ? '★ 已星标' : '☆ 星标' }}
              </el-button>
              <el-button size="small" text class="trial-round-note-btn" :disabled="!currentFormalRound" @click="openRoundNoteDialog('formal')">
                编辑备注
              </el-button>
              <span class="trial-attempt-hint">切换后按所选轮次展示：该轮重新评阅的题目显示新分数，未重评阅的题目沿用最近一次的分数。</span>
            </div>
            <!-- 当前查看栏按需求隐藏，保留代码便于恢复 -->
            <div v-if="currentFormalRound && false" class="trial-snapshot-bar">
              <strong>当前查看：第{{ currentFormalRound?.roundIndex }}轮评阅</strong>
              <span>时间：{{ currentFormalRound?.round.timeText || '-' }}</span>
              <span>操作人：{{ currentFormalRound?.round.creatorName }}</span>
              <span v-if="currentFormalRound?.round.note">备注：{{ currentFormalRound?.round.note }}</span>
              <el-tag v-if="currentFormalRound?.round.starred" size="small" type="warning" effect="plain">星标</el-tag>
            </div>
            <div class="summary-panel">
              <div class="summary-overview-grid">
                <article class="summary-stat-card">
                  <span class="summary-stat-label">试卷份数</span>
                  <strong class="summary-stat-value">{{ formalSummaryStats.paperCount }}</strong>
                </article>
                <article class="summary-stat-card">
                  <span class="summary-stat-label">最高分</span>
                  <strong class="summary-stat-value">{{ formalSummaryStats.maxScore }}</strong>
                </article>
                <article class="summary-stat-card">
                  <span class="summary-stat-label">最低分</span>
                  <strong class="summary-stat-value">{{ formalSummaryStats.minScore }}</strong>
                </article>
                <article class="summary-stat-card">
                  <span class="summary-stat-label">平均分</span>
                  <strong class="summary-stat-value">{{ formalSummaryStats.avgScore }}</strong>
                </article>
                <article class="summary-stat-card">
                  <span class="summary-stat-label">异常试卷</span>
                  <strong class="summary-stat-value">{{ formalSummaryStats.abnormalCount }}</strong>
                </article>
              </div>
              <section class="summary-section">
                <div class="summary-section-head">
                  <div>
                    <div class="summary-section-title">试卷明细</div>
                    <div class="summary-section-desc">点击考号可查看该份试卷的详细评分结果。</div>
                  </div>
                  <div class="summary-section-actions">
                    <el-button size="small" :icon="Download" @click="exportSummaryExcel('formal')">导出Excel</el-button>
                  </div>
                </div>
                <div class="summary-paper-list">
                  <button
                    v-for="paper in formalSummaryRows"
                    :key="paper.student_no"
                    class="summary-paper-row"
                    type="button"
                    @click="openPaperSummaryDetail('formal', paper)"
                  >
                    <span class="summary-paper-id">{{ paper.student_no }}</span>
                    <div class="summary-paper-inline-meta">
                      <strong>总分 {{ paper.totalScoreText }}</strong>
                      <span>已评 {{ paper.gradedCount }}/{{ paper.questionCount }} 题</span>
                    </div>
                    <div class="summary-paper-badges">
                      <el-tag size="small" :type="paper.abnormal ? 'danger' : 'success'" effect="light">
                        {{ paper.abnormal ? '异常' : '正常' }}
                      </el-tag>
                      <el-icon class="summary-paper-arrow">
                        <ArrowRight />
                      </el-icon>
                    </div>
                  </button>
                </div>
              </section>
            </div>
            </section>
            <section v-if="formalResultPaneLoaded.students" v-show="formalResultTab === 'students'" class="result-tab-pane">
            <el-table :data="pagedFormalStudentResults" class="formal-table" stripe>
              <el-table-column prop="student_no" label="考号" min-width="150" fixed />
              <el-table-column prop="totalScore" label="系统总分" width="110" />
              <el-table-column
                v-for="questionNo in formalQuestionNos"
                :key="`formal-question-${questionNo}`"
                :label="`Q${questionNo}`"
                min-width="112"
              >
                <template #default="{ row }">
                  <div class="score-matrix-cell">
                    <strong>{{ getSummaryQuestion(row, questionNo)?.scoreText || '未评' }}</strong>
                    <span>{{ getSummaryQuestion(row, questionNo)?.versionText || '版本 -' }}</span>
                  </div>
                </template>
              </el-table-column>
            </el-table>
            <div class="student-result-pagination">
              <el-pagination
                v-model:current-page="formalStudentResultPage"
                :page-size="studentResultPageSize"
                :total="formalStudentResults.length"
                layout="total, prev, pager, next"
                background
              />
            </div>
            </section>
            <section v-if="formalResultPaneLoaded.analysis" v-show="formalResultTab === 'analysis'" class="result-tab-pane">
            <div class="analysis-grid">
              <article v-for="item in formalQuestionStats" :key="item.question_no" class="analysis-card">
                <div class="analysis-card-head">
                  <div class="analysis-card-title">
                    <span class="question-tag">Q{{ item.question_no }}</span>
                    <strong>{{ item.questionText || '未命名题目' }}</strong>
                  </div>
                  <span class="analysis-average">均分 {{ item.avgScore }}</span>
                </div>
                <div class="analysis-metrics">
                  <div class="analysis-metric"><span>试卷份数</span><b>{{ item.paperCount }}</b></div>
                  <div class="analysis-metric"><span>已评份数</span><b>{{ item.count }}</b></div>
                  <div class="analysis-metric"><span>最高分</span><b>{{ item.maxScore }}</b></div>
                  <div class="analysis-metric"><span>最低分</span><b>{{ item.minScore }}</b></div>
                  <div class="analysis-metric"><span>平均分</span><b>{{ item.avgScore }}</b></div>
                  <div class="analysis-metric"><span>差异值</span><b>{{ item.spread }}</b></div>
                </div>
              </article>
            </div>
            </section>
            <section v-if="formalResultPaneLoaded.exceptions" v-show="formalResultTab === 'exceptions'" class="result-tab-pane">
            <section class="exception-panel exception-panel-standalone">
              <div class="exception-head">
                <div>
                  <div class="exception-title">异常试卷</div>
                  <div class="exception-desc">整张试卷完成评阅后，总分为 0 或低于阈值的试卷会列入异常清单。</div>
                </div>
              </div>
              <el-empty v-if="!formalAbnormalPapers.length" description="暂无异常试卷" :image-size="56" />
              <div v-else class="exception-list">
                <article v-for="item in formalAbnormalPapers" :key="item.key" class="exception-item">
                  <div class="exception-item-main">
                    <strong>{{ item.student_no }}</strong>
                    <span>得分 {{ item.scoreText }} / 阈值 {{ item.thresholdText }}</span>
                  </div>
                  <div class="exception-item-meta">
                    <span>已评题数：{{ item.questionCount }}</span>
                  </div>
                </article>
              </div>
            </section>
            </section>
          </div>
        </div>
      </div>
    </div>

    <el-drawer
      v-model="paperSummaryDetailVisible"
      :title="paperSummaryDetailTitle"
      direction="rtl"
      size="72%"
      class="paper-summary-detail-drawer"
      append-to-body
      @close="closePaperSummaryDetail"
    >
      <el-empty v-if="!paperSummaryDetailRow" description="暂无试卷明细" />
      <div v-else class="paper-summary-detail-panel">
        <div class="paper-summary-detail-head">
          <div>
            <div class="paper-summary-detail-title">{{ paperSummaryDetailRow.student_no }}</div>
            <div class="paper-summary-detail-meta">
              <span>总分 {{ paperSummaryDetailRow.totalScoreText }}</span>
              <span>已评 {{ paperSummaryDetailRow.gradedCount }}/{{ paperSummaryDetailRow.questionCount }} 题</span>
              <el-tag size="small" :type="paperSummaryDetailRow.abnormal ? 'danger' : 'success'" effect="light">
                {{ paperSummaryDetailRow.abnormal ? '异常' : '正常' }}
              </el-tag>
            </div>
          </div>
        </div>

        <div class="paper-summary-detail-list">
          <article v-for="item in paperSummaryDetailQuestions" :key="item.question_no" class="paper-summary-detail-item">
            <div class="paper-summary-detail-item-head">
              <div class="paper-summary-detail-question">
                <span class="question-tag">Q{{ item.question_no }}</span>
                <strong>{{ item.questionText || '未命名题目' }}</strong>
              </div>
              <span class="standard-version-tag">{{ item.versionText }}</span>
            </div>
            <div class="paper-summary-detail-grid">
              <div class="paper-summary-detail-block">
                <span>答题结果</span>
                <p>{{ item.answerText || '暂无' }}</p>
              </div>
              <div class="paper-summary-detail-block">
                <span>评分</span>
                <p>{{ item.scoreText }}</p>
              </div>
              <div class="paper-summary-detail-block">
                <span>评分说明</span>
                <p>{{ item.commentText }}</p>
              </div>
            </div>
            <div v-if="paperSummaryDetailMode === 'formal'" class="paper-summary-review-action">
              <el-button size="small" type="primary" plain @click="openManualReview(item)">人工复核</el-button>
            </div>
          </article>
        </div>
      </div>
    </el-drawer>
    <el-dialog v-model="manualReviewVisible" title="正式评分人工复核" width="520px" append-to-body>
      <el-alert
        type="warning"
        show-icon
        :closable="false"
        title="保存后会新增正式评分记录，并更新答卷中的该题成绩。"
      />
      <el-form label-width="90px" class="manual-review-form">
        <el-form-item label="考生 / 题目">
          <span>{{ manualReviewTarget?.student_no }} / {{ manualReviewTarget?.question_no }}</span>
        </el-form-item>
        <el-form-item label="当前得分">
          <span>{{ manualReviewTarget?.scoreText || '未评' }}</span>
        </el-form-item>
        <el-form-item label="复核得分" required>
          <el-input-number
            v-model="manualReviewForm.score"
            :min="0"
            :max="manualReviewTarget?.maxScore || 0"
            :precision="2"
            :step="0.5"
            :disabled="!manualReviewTarget || manualReviewTarget.maxScore <= 0"
          />
          <span class="manual-review-max">/ {{ manualReviewTarget?.maxScore || 0 }}</span>
        </el-form-item>
        <el-form-item label="复核说明" required>
          <el-input v-model="manualReviewForm.comment" type="textarea" :rows="4" maxlength="2000" show-word-limit placeholder="说明本次人工复核依据" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="manualReviewVisible = false">取消</el-button>
        <el-button type="primary" :loading="manualReviewSaving" @click="saveManualReview">保存复核结果</el-button>
      </template>
    </el-dialog>
    <el-dialog
      v-model="commentDialogVisible"
      :title="commentDialogTitle"
      width="640px"
      class="student-comment-dialog"
      append-to-body
    >
      <div class="student-comment-dialog-body">{{ commentDialogText || '暂无评语' }}</div>
      <template #footer>
        <el-button type="primary" @click="commentDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
    <el-dialog
      v-model="roundNoteDialogVisible"
      :title="roundEditMode === 'trial' ? '编辑试阅轮次备注' : '编辑评阅轮次备注'"
      width="480px"
      append-to-body
    >
      <el-input
        v-model="roundNoteDraft"
        type="textarea"
        :rows="3"
        maxlength="255"
        show-word-limit
        placeholder="给这一轮写点备注，例如：换用V2标准后的评阅"
      />
      <template #footer>
        <el-button @click="roundNoteDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="roundActionLoading" @click="saveRoundNote">保存</el-button>
      </template>
    </el-dialog>
    <el-dialog
      v-model="roundManageVisible"
      :title="roundEditMode === 'trial' ? '清理试阅轮次' : '清理评阅轮次'"
      width="760px"
      append-to-body
    >
      <el-alert
        type="warning"
        show-icon
        :closable="false"
        title="删除轮次会同时删除该轮的评分记录，删除后不可恢复，请谨慎操作。"
      />
      <el-table
        :data="roundManageRows"
        size="small"
        max-height="380"
        style="margin-top: 12px"
        @selection-change="(rows: any[]) => roundManageSelection = rows.map((row) => row.roundIndex)"
      >
        <el-table-column type="selection" width="42" />
        <el-table-column label="轮次" width="110">
          <template #default="{ row }">
            第{{ row.roundIndex }}轮{{ row.round.starred ? ' ★' : '' }}
          </template>
        </el-table-column>
        <el-table-column label="时间" width="140">
          <template #default="{ row }">{{ row.round.timeText || '-' }}</template>
        </el-table-column>
        <el-table-column label="记录数" width="70">
          <template #default="{ row }">{{ row.round.records.length }}</template>
        </el-table-column>
        <el-table-column label="备注" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.round.note || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="70">
          <template #default="{ row }">
            <el-button size="small" text type="danger" @click="deleteRounds([row.roundIndex])">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="roundManageVisible = false">关闭</el-button>
        <el-button
          type="danger"
          :loading="roundActionLoading"
          @click="deleteRounds(roundManageSelection)"
        >
          批量删除
        </el-button>
      </template>
    </el-dialog>
    <div v-if="previewUrl" class="lightbox" @click="closePreview">
      <button class="lightbox-close" @click.stop="closePreview">关闭</button>
      <img class="lightbox-image" :src="previewUrl" @click.stop />
    </div>

    <!-- 试阅/评阅在本页内执行：隐藏的运行页完成后自动刷新结果，不跳转配置页 -->
    <iframe
      v-if="gradingEmbedUrl"
      :src="gradingEmbedUrl"
      class="grading-embed-frame"
      title="teacher-grading-runner"
    />
    <div v-if="gradingEmbedLoading" class="grading-embed-overlay">
      <div class="grading-embed-card">
        <span class="grading-embed-spinner" />
        <div class="grading-embed-text">正在评分，请稍候…</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
// 模块级缓存：前往评阅详情页前保存的搜索定位上下文；评分返回时组件会重新挂载，靠它恢复定位状态
interface PackagePageContextCache {
  packageId: string;
  searchKeyword: string;
  currentPage: number;
}
let cachedPackagePageContext: PackagePageContextCache | null = null;
</script>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onActivated, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/store/modules/user';
import { ElMessage, ElMessageBox } from 'element-plus';
import * as XLSX from 'xlsx';
import { listServices } from '@/api/mcp';
import { apiPrefix } from '@/api/index';
import type { McpServiceInfo } from '@/types/marketplace';
import { createGradingStandard, createGradingTemplate, deleteLocalGradingRecords, getGradingStandardVersions, getGradingTemplates, getLatestGradingStandard, getLocalGradingRecords, getLocalPackage as getLocalPackageRegistration, gradeBatchWithMcp, saveLocalGradingRecords, updateLocalGradingRound, type BatchGradingResult, type BatchGradingTarget, type ExamGradingStandard, type ExamGradingTemplate, type GradingStandardItem, type LocalGradingRecordItem } from '@/api/teacher-scoring';
import { ArrowLeft, ArrowRight, Download, Search } from '@element-plus/icons-vue';
import {
  buildImageResolver,
  calculateTotalScore,
  ensureImageBlob,
  extractEmbeddedImagePaths,
  findLocalImage,
  getLocalPackage,
  getQuestionList,
  parseEmbeddedImageContent,
  saveLocalPackage,
  stripEmbeddedImageMarkers,
  type LocalPackageData,
  type LocalStudentAnswer
} from '@/utils/local-scoring-package';

const ImageList = defineComponent({
  props: {
    images: Array,
    resolve: {
      type: Function,
      required: true
    }
  },
  emits: ['preview'],
  setup(props, { emit }) {
    return () => {
      const images = (props.images || []) as string[];
      if (!images.length) return null;
      return h('div', { class: 'image-list' }, images.map((image) => {
        const url = props.resolve(image);
        if (!url) {
          return h('span', { class: 'image-missing', title: image }, image);
        }
        return h('img', {
          class: 'thumb',
          src: url,
          title: image,
          onClick: () => emit('preview', url)
        });
      }));
    };
  }
});

const RichImageContent = defineComponent({
  props: {
    text: String,
    textClass: {
      type: String,
      default: 'answer-text'
    },
    resolve: {
      type: Function,
      required: true
    }
  },
  emits: ['preview'],
  setup(props, { emit }) {
    return () => {
      const parts = parseEmbeddedImageContent(props.text);
      if (!parts.length) return null;
      return h('div', { class: 'rich-image-content' }, parts.map((part, index) => {
        if (part.type === 'text') {
          return h('div', { key: `text-${index}`, class: props.textClass }, part.text);
        }
        const url = props.resolve(part.path);
        if (!url) {
          return h('span', { key: `image-${index}`, class: 'image-missing', title: part.path }, part.path);
        }
        return h('img', {
          key: `image-${index}`,
          class: 'thumb embedded-thumb',
          src: url,
          title: part.path,
          onClick: () => emit('preview', url)
        });
      }));
    };
  }
});

defineOptions({
  name: 'TeacherPackageDetail'
});

// 结果页路由复用本组件时，通过该 prop 切换为结果页模式（trial=试阅结果 / formal=正式结果）
const props = defineProps<{
  initialDrawer?: 'trial' | 'formal';
}>();

// 结果页模式：trial/formal 时页面主体替换为对应结果内容；空值为试卷包详情模式
const resultsView = computed(() => (props.initialDrawer === 'trial' || props.initialDrawer === 'formal' ? props.initialDrawer : ''));

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

// 试卷包详情页模式：trial=只显示试阅入口 / formal=只显示评阅入口 / 空=纯查看（不显示任何执行入口）
const scoringMode = computed<'trial' | 'formal' | ''>(() => {
  const mode = String(route.query.mode || '');
  return mode === 'trial' || mode === 'formal' ? mode : '';
});
const packageId = computed(() => String(route.params.packageId || ''));
const loading = ref(false);
const localPackage = ref<LocalPackageData | null>(null);
const searchKeyword = ref('');
const currentPage = ref(1);
const previewUrl = ref('');
const imageResolver = ref<ReturnType<typeof buildImageResolver> | null>(null);
const selectedQuestionKeys = ref<string[]>([]);
const selectedPaperStudentNos = ref<string[]>([]);
const standardDialogVisible = ref(false);
const standardSaving = ref(false);
const latestStandardVersion = ref(0);
const standardItems = ref<StandardFormItem[]>([]);
const mcpLoading = ref(false);
const mcpServices = ref<McpServiceInfo[]>([]);
const latestStandard = ref<ExamGradingStandard | null>(null);
const standardDialogMode = ref<'create' | 'view'>('create');
const editingQuestionNo = ref('');
const standardMajorMcpSelections = ref<Record<string, Array<string | number>>>({});
const gradingRecords = ref<LocalGradingRecordItem[]>([]);
const gradingStandardVersions = ref<ExamGradingStandard[]>([]);
const originalStandardItemMap = ref<Record<string, GradingStandardItem | undefined>>({});
const questionStandardVersions = ref<QuestionStandardVersion[]>([]);
const currentQuestionVersionIndex = ref(0);
const gradingTemplates = ref<ExamGradingTemplate[]>([]);
const templateDialogVisible = ref(false);
const templateSaving = ref(false);
const templateSelections = ref<Record<string, string | undefined>>({});
const templateForm = ref({
  template_name: '科目考试阅卷模板',
  description: ''
});

const formalDialogVisible = ref(false);
const formalResultDrawerVisible = ref(false);
const trialResultDrawerVisible = ref(false);
const paperSummaryDetailVisible = ref(false);
const paperSummaryDetailMode = ref<'trial' | 'formal'>('trial');
const paperSummaryDetailRow = ref<PaperSummaryRow | null>(null);
const manualReviewVisible = ref(false);
const manualReviewSaving = ref(false);
const manualReviewTarget = ref<(PaperSummaryQuestion & { student_no: string }) | null>(null);
const manualReviewForm = reactive({ score: 0, comment: '' });
const formalGradingRunning = ref(false);
const formalResultTab = ref('summary');
const trialResultTab = ref('summary');
type ResultTabKey = 'summary' | 'students' | 'studentCompare' | 'analysis' | 'exceptions';
const trialResultPaneLoaded = reactive<Record<ResultTabKey, boolean>>({
  summary: true,
  students: false,
  studentCompare: false,
  analysis: false,
  exceptions: false
});
const formalResultPaneLoaded = reactive<Record<ResultTabKey, boolean>>({
  summary: true,
  students: false,
  studentCompare: false,
  analysis: false,
  exceptions: false
});
const studentCompareDefaultPageSize = 1;
const trialStudentCompareStudent = ref('');
const formalStudentCompareStudents = ref<string[]>([]);
const studentResultPageSize = 20;
const trialStudentResultPage = ref(1);
const formalStudentResultPage = ref(1);
const commentDialogVisible = ref(false);
const commentDialogTitle = ref('评语');
const commentDialogText = ref('');
const trialStudentComparePage = ref(1);
const formalStudentComparePage = ref(1);
const formalBatchResult = ref<BatchGradingResult | null>(null);
const formalProgress = ref({ completed: 0, total: 0, failed: 0 });
const formalForm = ref({
  template_id: undefined as number | undefined,
  scope: 'ungraded',
  overwrite: 'skip',
  batch_size: 4
});

const packageTitle = computed(() => localPackage.value ? `${localPackage.value.package_name} - 试卷包详情` : '试卷包详情');

interface StandardFormItem extends Omit<GradingStandardItem, 'mcp_service_id'> {
  local_id: string;
  // 多选 MCP：表单用数组编辑，提交时合并为逗号分隔的 mcp_service_id
  mcp_service_id: string | number | '';
  mcp_service_ids: Array<string | number>;
}

interface QuestionStandardVersion {
  standard_id: number;
  source_standard_version_no: number;
  version_no: number;
  standard: ExamGradingStandard;
  item: GradingStandardItem;
}

const nextStandardVersion = computed(() => latestStandardVersion.value + 1);
const currentQuestionStandardVersion = computed(() => questionStandardVersions.value[currentQuestionVersionIndex.value] || null);
const currentQuestionDisplayVersion = computed(() => currentQuestionStandardVersion.value?.version_no || 0);
const canViewPreviousQuestionStandard = computed(() => (
  standardDialogMode.value === 'view' && currentQuestionVersionIndex.value > 0
));
const canViewNextQuestionStandard = computed(() => (
  standardDialogMode.value === 'view'
  && currentQuestionVersionIndex.value < questionStandardVersions.value.length - 1
));
const standardDialogTitle = computed(() => standardDialogMode.value === 'view' ? '本题评阅标准' : '新增阅卷标准');
const paperSummaryDetailTitle = computed(() => {
  if (!paperSummaryDetailRow.value) {
    return paperSummaryDetailMode.value === 'trial' ? '试阅结果详情' : '正式结果详情';
  }
  const modeLabel = paperSummaryDetailMode.value === 'trial' ? '试阅' : '正式';
  return `${modeLabel}结果详情 - ${paperSummaryDetailRow.value.student_no}`;
});
const paperSummaryDetailQuestions = computed(() => paperSummaryDetailRow.value?.questions || []);
interface TemplateQuestionRow {
  question_no: string;
  question_text: string;
}

// “背景资料”类小题只是题干材料（如第四大题 4.1），不参与评分，
// 不得进入题号清单，否则试卷永远“未完成”、汇总统计为空
const isBackgroundSubQuestion = (sub?: { question?: unknown; is_background?: unknown } | null) => {
  if (!sub) return false;
  if (sub.is_background) return true;
  const title = String(sub.question || '').trim().split('\n', 1)[0] || '';
  const stripped = title.replace(/^[\d一二三四五六七八九十]+[.、．]\s*/, '');
  return stripped.startsWith('背景资料') || stripped.startsWith('背景材料');
};

const templateQuestionRows = computed<TemplateQuestionRow[]>(() => {
  const student = localPackage.value?.students?.[0];
  const questions = getQuestionList(student?.answer_json || null);
  const rows: TemplateQuestionRow[] = [];
  questions.forEach((topic, topicIndex) => {
    const subQuestions = topic.sub_question || [];
    if (subQuestions.length) {
      subQuestions.forEach((subQuestion, subIndex) => {
        if (isBackgroundSubQuestion(subQuestion)) return;
        rows.push({
          question_no: getQuestionNo(topicIndex, subIndex),
          question_text: subQuestion.question || topic.question || ''
        });
      });
      return;
    }
    rows.push({
      question_no: String(topicIndex + 1),
      question_text: topic.question || ''
    });
  });
  return rows;
});

const selectedTemplateCount = computed(() => (
  templateQuestionRows.value.filter((row) => Boolean(templateSelections.value[row.question_no])).length
));

const getMcpServiceValue = (service: McpServiceInfo) => service.service_uuid || service.id;

const supportedQuestionTypeValues = ['short_answer', 'image', 'operation', 'code', 'file'];

const getMcpServiceLabel = (service: McpServiceInfo) => {
  const name = service.service_name || service.name || service.module_name || service.service_uuid || String(service.id);
  const status = service.status ? ` / ${service.status}` : '';
  return `${name}${status}`;
};
const filteredStudents = computed(() => {
  const students = localPackage.value?.students || [];
  const keyword = searchKeyword.value.trim().toLowerCase();
  if (!keyword) return students;
  return students.filter((student) => student.search_text.includes(keyword));
});
const packageStudentNos = computed(() => (localPackage.value?.students || []).map((student) => student.student_no));
const validSelectedPaperStudentNos = computed(() => {
  const available = new Set(packageStudentNos.value);
  return selectedPaperStudentNos.value.filter((studentNo, index, list) => (
    available.has(studentNo) && list.indexOf(studentNo) === index
  ));
});

const makeQuestionKey = (studentNo: string, topicIndex: number, subIndex: number) => `${studentNo}__${topicIndex + 1}__${subIndex + 1}`;

const getQuestionNo = (topicIndex: number, subIndex: number) => `${topicIndex + 1}.${subIndex + 1}`;


const normalizeQuestionNo = (questionNo: string) => String(questionNo || '').trim().replace(/^q/i, '');

const gradingRecordKey = (studentNo: string, questionNo: string) => `${studentNo}__${normalizeQuestionNo(questionNo)}`;

const questionNoMatches = (left: string, right: string) => {
  const normalizedLeft = normalizeQuestionNo(left);
  const normalizedRight = normalizeQuestionNo(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  return normalizedLeft.includes('.')
    ? normalizedLeft.endsWith('.1') && normalizedLeft.slice(0, -2) === normalizedRight
    : normalizedRight.endsWith('.1') && normalizedRight.slice(0, -2) === normalizedLeft;
};

const recordMatchesQuestionSet = (record: LocalGradingRecordItem, questionNos: Set<string>) => (
  Array.from(questionNos).some((questionNo) => questionNoMatches(record.question_no, questionNo))
);

const setRecordWithQuestionAliases = (
  map: Map<string, LocalGradingRecordItem>,
  record: LocalGradingRecordItem
) => {
  const exactKey = gradingRecordKey(record.student_no, record.question_no);
  // 接口按最新评分时间倒序返回；已有记录时保留第一条，避免旧试阅结果覆盖新结果。
  if (!map.has(exactKey)) map.set(exactKey, record);

  const normalized = normalizeQuestionNo(record.question_no);
  if (!normalized.includes('.')) {
    const childKey = gradingRecordKey(record.student_no, `${normalized}.1`);
    if (!map.has(childKey)) map.set(childKey, record);
  } else if (normalized.endsWith('.1')) {
    const parentKey = gradingRecordKey(record.student_no, normalized.slice(0, -2));
    if (!map.has(parentKey)) map.set(parentKey, record);
  }
};

const gradingRecordMap = computed(() => {
  const map = new Map<string, LocalGradingRecordItem>();
  gradingRecords.value.forEach((record) => {
    if (record.is_trial) return;
    setRecordWithQuestionAliases(map, record);
  });
  return map;
});

const trialGradingRecordMap = computed(() => {
  const map = new Map<string, LocalGradingRecordItem>();
  gradingRecords.value.forEach((record) => {
    if (!record.is_trial) return;
    setRecordWithQuestionAliases(map, record);
  });
  return map;
});

const getSavedRecord = (studentNo: string, topicIndex: number, subIndex: number) => {
  return gradingRecordMap.value.get(gradingRecordKey(studentNo, getQuestionNo(topicIndex, subIndex)));
};

const getSavedTrialRecord = (studentNo: string, topicIndex: number, subIndex: number) => {
  return trialGradingRecordMap.value.get(gradingRecordKey(studentNo, getQuestionNo(topicIndex, subIndex)));
};

// 按页面模式取记录：试阅页面只取试阅记录、正式评阅页面只取正式记录，互不影响；
// 从试卷包卡片直接查看（无 mode）时两者都可用，由模板分别展示试阅与评阅。
const getRecordForMode = (studentNo: string, questionNo: string, mode: 'trial' | 'formal' | '') => {
  const formal = gradingRecordMap.value.get(gradingRecordKey(studentNo, questionNo)) || null;
  const trial = trialGradingRecordMap.value.get(gradingRecordKey(studentNo, questionNo)) || null;
  if (mode === 'trial') return trial;
  if (mode === 'formal') return formal;
  return formal || trial;
};

const getDisplayRecord = (studentNo: string, questionNo: string) => getRecordForMode(studentNo, questionNo, scoringMode.value);

const getTopicDisplayRecord = (studentNo: string, topicIndex: number) => {
  const topicNo = String(topicIndex + 1);
  return getDisplayRecord(studentNo, topicNo)
    || getDisplayRecord(studentNo, `${topicNo}.1`);
};

// 指定模式的单题得分：只取该模式的评分记录，没有记录即为暂无（不回退题目 JSON 里的历史分数）
const getQuestionScoreValueForMode = (studentNo: string, topicIndex: number, subIndex: number, mode: 'trial' | 'formal') =>
  numericScore(getRecordForMode(studentNo, getQuestionNo(topicIndex, subIndex), mode)?.score);

const getDisplayedQuestionScoreValue = (studentNo: string, topicIndex: number, subIndex: number) => {
  const mode = scoringMode.value === 'trial' ? 'trial' : 'formal';
  return getQuestionScoreValueForMode(studentNo, topicIndex, subIndex, mode);
};

const getDisplayedQuestionScore = (studentNo: string, topicIndex: number, subIndex: number) => {
  const score = getDisplayedQuestionScoreValue(studentNo, topicIndex, subIndex);
  return score === null ? '暂无' : formatScoreValue(score);
};

const getQuestionCommentForMode = (studentNo: string, topicIndex: number, subIndex: number, mode: 'trial' | 'formal') => {
  const record = getRecordForMode(studentNo, getQuestionNo(topicIndex, subIndex), mode);
  return record?.grading_desc || '暂无评语';
};

const getDisplayedQuestionComment = (studentNo: string, topicIndex: number, subIndex: number) => {
  const mode = scoringMode.value === 'trial' ? 'trial' : 'formal';
  return getQuestionCommentForMode(studentNo, topicIndex, subIndex, mode);
};

const hasQuestionRecordForMode = (studentNo: string, topicIndex: number, subIndex: number, mode: 'trial' | 'formal') =>
  Boolean(getRecordForMode(studentNo, getQuestionNo(topicIndex, subIndex), mode));

const getModeQuestionScoreText = (studentNo: string, topicIndex: number, subIndex: number, mode: 'trial' | 'formal') => {
  const score = getQuestionScoreValueForMode(studentNo, topicIndex, subIndex, mode);
  return score === null ? '暂无' : formatScoreValue(score);
};

const getModeQuestionCommentText = (studentNo: string, topicIndex: number, subIndex: number, mode: 'trial' | 'formal') =>
  getQuestionCommentForMode(studentNo, topicIndex, subIndex, mode);

// 指定模式的大题得分：按该大题下各小题求和，仅取该模式下的记录
const getTopicScoreValueForMode = (studentNo: string, topicIndex: number, topic: any, mode: 'trial' | 'formal') => {
  const subQuestions = topic?.sub_question || [];
  const scores = subQuestions.length
    ? subQuestions.map((_: any, subIndex: number) => getQuestionScoreValueForMode(studentNo, topicIndex, subIndex, mode))
    : [numericScore(getRecordForMode(studentNo, String(topicIndex + 1), mode)?.score)];
  const validScores = scores.filter((score: number | null): score is number => score !== null);
  return validScores.length ? formatScoreValue(validScores.reduce((sum: number, score: number) => sum + score, 0)) : '暂无';
};

const hasTopicRecordForMode = (studentNo: string, topicIndex: number, topic: any, mode: 'trial' | 'formal') => {
  const subQuestions = topic?.sub_question || [];
  if (!subQuestions.length) return Boolean(getRecordForMode(studentNo, String(topicIndex + 1), mode));
  return subQuestions.some((_: any, subIndex: number) => Boolean(getRecordForMode(studentNo, getQuestionNo(topicIndex, subIndex), mode)));
};

const getDisplayedTopicScore = (studentNo: string, topicIndex: number, topic: any) => {
  const subQuestions = topic?.sub_question || [];
  const scores = subQuestions.length
    ? subQuestions
      .map((_: any, subIndex: number) => getDisplayedQuestionScoreValue(studentNo, topicIndex, subIndex))
      .filter((score: number | null): score is number => score !== null)
    : [
      numericScore(getTopicDisplayRecord(studentNo, topicIndex)?.score)
        ?? numericScore(topic?.score)
    ].filter((score): score is number => score !== null);
  return scores.length ? formatScoreValue(scores.reduce((sum: number, score: number) => sum + score, 0)) : '暂无';
};

const hasSavedRecord = (studentNo: string, topicIndex: number, subIndex: number) => {
  return Boolean(getSavedRecord(studentNo, topicIndex, subIndex));
};

const hasTrialRecord = (studentNo: string, topicIndex: number, subIndex: number) => {
  return Boolean(getSavedTrialRecord(studentNo, topicIndex, subIndex));
};

type ReviewStatus = {
  label: string;
  type: 'success' | 'warning';
};

const getQuestionReviewStatus = (studentNo: string, topicIndex: number, subIndex: number): ReviewStatus | null => {
  const mode = scoringMode.value;
  const hasFormal = hasSavedRecord(studentNo, topicIndex, subIndex);
  const hasTrial = hasTrialRecord(studentNo, topicIndex, subIndex);
  // 试阅页面不显示评阅标记、正式评阅页面不显示试阅标记
  if (mode === 'trial') return hasTrial ? { label: '已试阅', type: 'warning' } : null;
  if (mode === 'formal') return hasFormal ? { label: '已评阅', type: 'success' } : null;
  if (hasFormal) return { label: '已评阅', type: 'success' };
  if (hasTrial) return { label: '已试阅', type: 'warning' };
  return null;
};

const getTopicReviewStatus = (studentNo: string, topicIndex: number, topic: any): ReviewStatus | null => {
  const mode = scoringMode.value;
  const subQuestions = topic?.sub_question || [];
  if (mode === 'trial') {
    return hasTopicRecordForMode(studentNo, topicIndex, topic, 'trial') ? { label: '已试阅', type: 'warning' } : null;
  }
  if (mode === 'formal') {
    return hasTopicRecordForMode(studentNo, topicIndex, topic, 'formal') ? { label: '已评阅', type: 'success' } : null;
  }
  if (!subQuestions.length) {
    const questionNo = String(topicIndex + 1);
    if (getDisplayRecord(studentNo, questionNo)?.is_trial === false || getDisplayRecord(studentNo, `${questionNo}.1`)?.is_trial === false) {
      return { label: '已评阅', type: 'success' };
    }
    if (getDisplayRecord(studentNo, questionNo)?.is_trial || getDisplayRecord(studentNo, `${questionNo}.1`)?.is_trial) {
      return { label: '已试阅', type: 'warning' };
    }
    return null;
  }
  if (subQuestions.every((_: any, subIndex: number) => hasSavedRecord(studentNo, topicIndex, subIndex))) {
    return { label: '已评阅', type: 'success' };
  }
  if (subQuestions.every((_: any, subIndex: number) => hasSavedRecord(studentNo, topicIndex, subIndex) || hasTrialRecord(studentNo, topicIndex, subIndex))) {
    return { label: '已试阅', type: 'warning' };
  }
  return null;
};
const getQuestionSourceStandardVersionNo = (item: GradingStandardItem, fallbackVersion: number) => {
  const rawVersion = Number(item.source_standard_version_no || 0);
  return rawVersion > 0 ? rawVersion : fallbackVersion;
};

const getQuestionStandardVersions = (questionNo: string): QuestionStandardVersion[] => {
  let fallbackVersion = 0;
  let fallbackSourceVersion = 0;
  const versionMap = new Map<string, QuestionStandardVersion>();
  gradingStandardVersions.value
    .slice()
    .sort((a, b) => Number(a.version_no || 0) - Number(b.version_no || 0) || Number(a.standard_id || 0) - Number(b.standard_id || 0))
    .forEach((standard) => {
      const matchedItems = (standard.standard_items || [])
        .filter((standardItem) => String(standardItem.question_no || '').trim() === questionNo);
      matchedItems.forEach((item) => {
        if (!fallbackSourceVersion) {
          fallbackSourceVersion = Number(standard.version_no || 0) || 1;
        }
        const versionNo = Number(item.question_version_no || 0) > 0
          ? Number(item.question_version_no)
          : fallbackVersion + 1;
        if (!item.question_version_no) {
          fallbackVersion = versionNo;
        }
        const sourceStandardVersionNo = getQuestionSourceStandardVersionNo(item, fallbackSourceVersion);
        const versionKey = item.item_id
          ? `item-${item.item_id}`
          : `standard-${standard.standard_id}-question-${questionNo}-v-${versionNo}`;
        if (versionMap.has(versionKey)) return;
        versionMap.set(versionKey, {
          standard_id: standard.standard_id,
          source_standard_version_no: sourceStandardVersionNo,
          version_no: versionNo,
          standard,
          item
        });
      });
    });
  return Array.from(versionMap.values())
    .sort((a, b) => a.version_no - b.version_no
      || a.source_standard_version_no - b.source_standard_version_no
      || Number(a.item.item_id || 0) - Number(b.item.item_id || 0)
      || a.standard_id - b.standard_id);
};

const getQuestionStandard = (topicIndex: number, subIndex: number) => {
  const questionNo = getQuestionNo(topicIndex, subIndex);
  const versions = getQuestionStandardVersions(questionNo);
  return versions[versions.length - 1]?.item || null;
};

// 版本号仅在为正整数时有效；null/undefined/0 都视为未记录
const positiveVersionNo = (value: unknown) => {
  const versionNo = Number(value);
  return Number.isFinite(versionNo) && versionNo > 0 ? versionNo : null;
};

const getResolvedRecordQuestionVersionNo = (record?: LocalGradingRecordItem | null) => {
  if (!record) return null;
  const questionNo = String(record.question_no || '').trim();
  if (!questionNo) return positiveVersionNo(record.question_version_no);
  const versions = getQuestionStandardVersions(questionNo);
  if (!versions.length) return positiveVersionNo(record.question_version_no);
  const standardId = Number(record.standard_id || 0);
  const standardVersionNo = Number(record.standard_version_no || 0);
  const matched = versions.find((version) => (
    (standardId > 0 && version.standard_id === standardId)
    || (standardVersionNo > 0 && Number(version.standard.version_no || 0) === standardVersionNo)
  ));
  return matched?.version_no ?? positiveVersionNo(record.question_version_no);
};

const applyCurrentQuestionStandardVersion = () => {
  const current = currentQuestionStandardVersion.value;
  if (!current) return;
  standardItems.value = [cloneStandardItem(current.item)];
};

const viewPreviousQuestionStandard = () => {
  if (!canViewPreviousQuestionStandard.value) return;
  currentQuestionVersionIndex.value -= 1;
  applyCurrentQuestionStandardVersion();
};

const viewNextQuestionStandard = () => {
  if (!canViewNextQuestionStandard.value) return;
  currentQuestionVersionIndex.value += 1;
  applyCurrentQuestionStandardVersion();
};

// 多选 MCP：mcp_service_id 以逗号分隔存储，表单内用数组编辑
const splitMcpServiceIds = (value?: string | number | null): Array<string | number> => {
  const text = String(value ?? '').trim();
  if (!text) return [];
  return text.split(',').map((part) => part.trim()).filter(Boolean);
};

const joinMcpServiceIds = (ids: Array<string | number>): string => ids.map((id) => String(id).trim()).filter(Boolean).join(',');

const getTopicNoFromQuestionNo = (questionNo?: string) => {
  const normalized = normalizeQuestionNo(String(questionNo || '').trim());
  return normalized.split('.', 1)[0] || normalized;
};

const cloneStandardItem = (item: GradingStandardItem): StandardFormItem => ({
  local_id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
  item_id: item.item_id,
  question_no: item.question_no || '',
  question_type: item.question_type || 'short_answer',
  mcp_service_id: item.mcp_service_id || '',
  mcp_service_ids: splitMcpServiceIds(item.mcp_service_id),
  mcp_service_name: item.mcp_service_name || '',
  reference_answer: item.reference_answer || '',
  grading_criteria: item.grading_criteria || '',
  question_version_no: item.question_version_no,
  source_standard_version_no: item.source_standard_version_no,
  mcp_params: item.mcp_params || {}
});

const standardMajorGroups = computed(() => {
  const groups = new Map<string, { topicNo: string; questionCount: number }>();
  standardItems.value.forEach((item) => {
    const topicNo = getTopicNoFromQuestionNo(item.question_no);
    if (!topicNo) return;
    const group = groups.get(topicNo) || { topicNo, questionCount: 0 };
    group.questionCount += 1;
    groups.set(topicNo, group);
  });
  return Array.from(groups.values()).sort((left, right) => Number(left.topicNo) - Number(right.topicNo));
});

const getMcpServiceNamesByIds = (ids: Array<string | number>) => ids
  .map((id) => {
    const service = mcpServices.value.find((serviceItem) => String(getMcpServiceValue(serviceItem)) === String(id));
    return service ? getMcpServiceLabel(service) : '';
  })
  .filter(Boolean)
  .join('、');

const applyMajorMcpToItem = (item: StandardFormItem) => {
  const topicNo = getTopicNoFromQuestionNo(item.question_no);
  const ids = standardMajorMcpSelections.value[topicNo] || [];
  item.mcp_service_ids = [...ids];
  item.mcp_service_id = joinMcpServiceIds(ids);
  item.mcp_service_name = getMcpServiceNamesByIds(ids);
};

const syncStandardMajorMcpSelection = (topicNo: string) => {
  standardItems.value
    .filter((item) => getTopicNoFromQuestionNo(item.question_no) === topicNo)
    .forEach((item) => applyMajorMcpToItem(item));
};

const syncAllStandardMajorMcpSelections = () => {
  standardItems.value.forEach((item) => applyMajorMcpToItem(item));
};

const initializeStandardMajorMcpSelections = () => {
  const nextSelections: Record<string, Array<string | number>> = {};
  standardItems.value.forEach((item) => {
    const topicNo = getTopicNoFromQuestionNo(item.question_no);
    if (!topicNo || nextSelections[topicNo]?.length) return;
    nextSelections[topicNo] = splitMcpServiceIds(item.mcp_service_id);
  });
  standardMajorMcpSelections.value = nextSelections;
  syncAllStandardMajorMcpSelections();
};


// 搜索唯一命中考生时视为“定位”：翻页基于完整考生序列，便于前后连续切换；
// 多个命中时保持原逻辑，在筛选结果内翻页
const pagedStudents = computed(() => {
  if (searchKeyword.value.trim() && filteredStudents.value.length >= 2) return filteredStudents.value;
  return localPackage.value?.students || [];
});
const totalPages = computed(() => Math.max(1, pagedStudents.value.length));
const currentStudent = computed<LocalStudentAnswer | undefined>(() => pagedStudents.value[currentPage.value - 1]);
const currentQuestions = computed(() => getQuestionList(currentStudent.value?.answer_json || null));
const currentTotalScore = computed(() => {
  if (!currentStudent.value) return null;
  return getDisplayedStudentTotalScore(currentStudent.value);
});
const paperActionStudentNos = computed(() => {
  if (validSelectedPaperStudentNos.value.length) return validSelectedPaperStudentNos.value;
  return currentStudent.value ? [currentStudent.value.student_no] : [];
});
const paperActionStudentCount = computed(() => paperActionStudentNos.value.length);
const paperActionStudentCountText = computed(() => (
  validSelectedPaperStudentNos.value.length
    ? `整卷已选 ${validSelectedPaperStudentNos.value.length} 人`
    : '未多选时默认当前考生'
));

const studentCompareOptions = computed(() => (localPackage.value?.students || []).map((student) => ({
  label: student.student_no,
  value: student.student_no
})));

const locatedStudentNo = ref('');
let restoringPageContext = false;

watch(searchKeyword, () => {
  if (restoringPageContext) return;
  // 定位到唯一命中考生时，跳转至该考生在完整考生序列中的页码，恢复上一页/下一页连续翻页
  if (searchKeyword.value.trim() && filteredStudents.value.length === 1) {
    const index = pagedStudents.value.findIndex((student) => student.student_no === filteredStudents.value[0].student_no);
    currentPage.value = index >= 0 ? index + 1 : 1;
    locatedStudentNo.value = filteredStudents.value[0].student_no;
    return;
  }
  // 清空搜索时若已通过搜索定位考生，保留在当前考生页，不跳回第一条
  if (!searchKeyword.value.trim() && locatedStudentNo.value) {
    locatedStudentNo.value = '';
    return;
  }
  currentPage.value = 1;
});

// 前往评阅详情页前保存当前搜索定位上下文
const rememberPageContext = () => {
  cachedPackagePageContext = {
    packageId: packageId.value,
    searchKeyword: searchKeyword.value,
    currentPage: currentPage.value
  };
};

// 从评阅详情页返回（组件重新挂载）后，恢复离开前的搜索定位上下文
const restorePageContext = () => {
  const cached = cachedPackagePageContext;
  cachedPackagePageContext = null;
  if (!cached || cached.packageId !== packageId.value) return;
  if (!cached.searchKeyword && cached.currentPage <= 1) return;
  restoringPageContext = true;
  searchKeyword.value = cached.searchKeyword;
  currentPage.value = cached.currentPage;
  if (cached.searchKeyword && filteredStudents.value.length === 1) {
    locatedStudentNo.value = filteredStudents.value[0].student_no;
  }
  nextTick(() => { restoringPageContext = false; });
};






watch(filteredStudents, () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value;
});

watch(packageStudentNos, () => {
  selectedPaperStudentNos.value = validSelectedPaperStudentNos.value;
});

watch(trialResultTab, (tab) => {
  trialResultPaneLoaded[tab as ResultTabKey] = true;
}, { immediate: true });

watch(formalResultTab, (tab) => {
  formalResultPaneLoaded[tab as ResultTabKey] = true;
}, { immediate: true });

onMounted(async () => {
  await Promise.all([loadLocalPackage({ refreshRemote: true }), loadLatestStandard(), loadGradingStandardVersions(), loadGradingTemplates()]);
  await loadGradingRecords();
  restorePageContext();
  window.addEventListener('keydown', handleKeydown);
});

onActivated(async () => {
  await loadLocalPackage({ refreshRemote: true });
  await loadGradingRecords();
});

onBeforeUnmount(() => {
  imageResolver.value?.revoke();
  window.removeEventListener('keydown', handleKeydown);
  closeGradingInline();
});

const loadLocalPackage = async (options: { refreshRemote?: boolean } = {}) => {
  loading.value = true;
  try {
    let found = await getLocalPackage(packageId.value);
    if (packageId.value && (options.refreshRemote || !found)) {
      try {
        const response = await getLocalPackageRegistration(
          String(route.params.subjectId),
          String(route.params.examId),
          packageId.value
        );
        const remote = response.data;
        const remoteStudents = Array.isArray(remote?.parsed_students) ? remote.parsed_students : [];
        const remoteImages = Array.isArray(remote?.parsed_image_manifest)
          ? remote.parsed_image_manifest.map((image: any) => {
            const relativePath = String(image.relative_path || image.name || '')
              .replace(/^image\/?media\//i, 'media/');
            const cachedImage = found
              ? findLocalImage(found.images || [], relativePath)
              : undefined;
            const packageLocalId = remote.local_package_id || found?.local_package_id;
            const storagePath = image.storage_path || image.path || (
              /^media\//i.test(String(relativePath)) ? `parsed/${relativePath}` : relativePath
            );
            const fallbackUrl = packageLocalId && storagePath
              ? `${apiPrefix}/teacher-scoring/subjects/${route.params.subjectId}/exams/${route.params.examId}/local-packages/${packageLocalId}/files?path=${encodeURIComponent(String(storagePath).replace(/\\/g, '/'))}`
              : '';
            return {
              name: image.name || relativePath.split('/').pop() || 'image',
              relativePath,
              type: image.type || `image/${image.file_type || 'png'}`,
              size: Number(image.file_size || image.size || cachedImage?.size || 0),
              blob: cachedImage?.blob || new Blob([], { type: image.type || `image/${image.file_type || 'png'}` }),
              url: image.url || cachedImage?.url || fallbackUrl
            };
          })
          : [];

        if (remote && (remoteStudents.length || found || remote.student_count === 0)) {
          const currentStudents = found?.students || [];
          const students = remoteStudents.length
            ? remoteStudents.map((entry: any, index: number) => {
              const studentNo = String(
                entry.id
                || entry.studentId
                || entry.student_no
                || entry.studentNo
                || `record-${index + 1}`
              );
              const cachedStudent = currentStudents.find((student) => student.student_no === studentNo);
              return {
                answer_id: cachedStudent?.answer_id || `${remote.package_id || packageId.value}_${index}`,
                student_no: studentNo,
                answer_json: entry,
                search_text: JSON.stringify(entry).toLowerCase(),
                total_score: calculateTotalScore(entry)
              };
            })
            : currentStudents;
          const cachedImages = found?.images || [];
          const mergedImages = remoteImages.length
            ? [
              ...remoteImages,
              ...cachedImages.filter((image) => !findLocalImage(remoteImages, image.relativePath || image.name))
            ]
            : cachedImages;

          found = {
            ...(found || {
              package_id: remote.package_id || `local_${remote.local_package_id}`,
              local_package_id: remote.local_package_id,
              subject_id: String(remote.subject_id || route.params.subjectId),
              exam_id: String(remote.exam_id || route.params.examId),
              package_name: remote.package_name || '试卷包',
              folder_name: remote.folder_name || '',
              json_file_name: remote.json_file_name || '',
              uploaded_at: remote.updated_at || remote.created_at || new Date().toISOString(),
              students: [],
              images: []
            }),
            package_id: remote.package_id || found?.package_id || `local_${remote.local_package_id}`,
            local_package_id: remote.local_package_id || found?.local_package_id,
            subject_id: String(remote.subject_id || found?.subject_id || route.params.subjectId),
            exam_id: String(remote.exam_id || found?.exam_id || route.params.examId),
            package_name: remote.package_name || found?.package_name || '试卷包',
            folder_name: remote.folder_name || found?.folder_name || '',
            json_file_name: remote.json_file_name || found?.json_file_name || '',
            uploaded_at: remote.updated_at || remote.created_at || found?.uploaded_at || new Date().toISOString(),
            students,
            images: mergedImages,
            package_fingerprint: remote.package_fingerprint || found?.package_fingerprint,
            quick_fingerprint: remote.quick_fingerprint || found?.quick_fingerprint,
            total_file_size: remote.total_file_size ?? found?.total_file_size,
            total_image_size: remote.total_image_size ?? found?.total_image_size,
            total_word_size: remote.total_word_size ?? found?.total_word_size,
            student_no_hash: remote.student_no_hash || found?.student_no_hash,
            reference_answers: remote.reference_answers || found?.reference_answers || [],
            answer_key_json: remote.answer_key_json || found?.answer_key_json,
            blank_paper_json: remote.blank_paper_json || found?.blank_paper_json,
            server_package: remote,
            matched_history: true
          };
          await saveLocalPackage(found);
        }
      } catch (remoteError) {
        console.error('从后端恢复本地试卷包失败', remoteError);
      }
    }
    if (!found) {
      ElMessage.error('未找到本地试卷包，请重新选择文件夹创建');
      return;
    }
    // 详情页可能读取到后端持久化的图片清单，此时 IndexedDB 中只有空 Blob
    // 占位。先按带鉴权的图片 URL 拉取真实内容，再交给解析器生成 Blob URL。
    // 这样浏览器不需要直接携带 Authorization 请求头加载图片。
    const remoteImageRequests = found.images
      .filter((image) => Boolean(image.url) && (!image.blob || image.blob.size === 0))
      .map((image) => ensureImageBlob(image));
    if (remoteImageRequests.length) {
      await Promise.allSettled(remoteImageRequests);
      await saveLocalPackage(found).catch((error) => {
        console.warn('缓存试卷包图片失败，将继续使用当前页面图片', error);
      });
    }
    localPackage.value = found;
    imageResolver.value?.revoke();
    imageResolver.value = buildImageResolver(found.images);
  } finally {
    loading.value = false;
  }
};


const loadGradingRecords = async () => {
  const localPackageId = localPackage.value?.local_package_id || packageId.value;
  if (!localPackageId) return;
  try {
    const response = await getLocalGradingRecords(
      String(route.params.subjectId),
      String(route.params.examId),
      localPackageId
    );
    if (response.code === 0 || response.code === 200) {
      gradingRecords.value = response.data || [];
    }
  } catch (error) {
    console.error('获取历史评分结果失败', error);
  }
};
const resolveImageUrl = (imagePath?: string) => {
  const resolved = imageResolver.value?.resolve(imagePath);
  if (resolved) return resolved;
  const normalized = imageReference(imagePath);
  const localId = localPackage.value?.local_package_id;
  if (!normalized || !localId) return '';
  const filePath = /^media\//i.test(normalized) ? `parsed/${normalized}` : normalized;
  const url = `${apiPrefix}/teacher-scoring/subjects/${route.params.subjectId}/exams/${route.params.examId}/local-packages/${localId}/files?path=${encodeURIComponent(filePath)}`;
  const token = userStore.accessToken.replace(/^Bearer\s+/i, '');
  return token ? `${url}&access_token=${encodeURIComponent(token)}` : url;
};

const getDisplayText = (value?: string) => stripEmbeddedImageMarkers(value);

const imageReference = (value: any) => {
  if (typeof value === 'string') return value.trim().replace(/^image\/?media\//i, 'media/');
  if (!value || typeof value !== 'object') return '';
  return String(value.url || value.path || value.storage_path || value.relative_path || value.file_name || value.name || '')
    .trim()
    .replace(/^image\/?media\//i, 'media/');
};

const uniqueStrings = (items: any[]) => Array.from(new Set(items.map(imageReference).filter(Boolean)));

const getQuestionDisplayImages = (question: any) => uniqueStrings([
  ...(question?.images || []),
  ...extractEmbeddedImagePaths(question?.question),
  ...extractEmbeddedImagePaths(question?.answer)
]);

const getStandaloneQuestionImages = (question: any) => {
  const embedded = new Set([
    ...extractEmbeddedImagePaths(question?.question),
    ...extractEmbeddedImagePaths(question?.answer)
  ].map((item) => item.toLowerCase()));
  return uniqueStrings(question?.images || []).filter((image) => !embedded.has(String(image).toLowerCase()));
};

const previewImage = (url: string) => {
  previewUrl.value = url;
};

const closePreview = () => {
  previewUrl.value = '';
};

const openQuestionComment = (studentNo: string, questionNo: string, comment?: string, context?: string) => {
  commentDialogTitle.value = `评语 - ${studentNo} / Q${questionNo}${context ? ` / ${context}` : ''}`;
  commentDialogText.value = comment || '暂无评语';
  commentDialogVisible.value = true;
};



const openStudentComparePage = (resultType: 'trial' | 'formal') => {
  const students = resultType === 'trial'
    ? (trialStudentCompareStudent.value ? [trialStudentCompareStudent.value] : [])
    : formalStudentCompareStudents.value;
  if (resultType === 'trial' && !students.length) {
    ElMessage.warning('请选择 1 位考生查看评分标准对比');
    return;
  }
  if (resultType === 'formal' && students.length < 2) {
    ElMessage.warning('请至少选择 2 位考生进行对比');
    return;
  }
  router.push({
    name: 'teacher-student-score-compare',
    params: {
      subjectId: route.params.subjectId,
      examId: route.params.examId,
      packageId: packageId.value
    },
    query: {
      type: resultType,
      students: students.join(',')
    }
  });
};



const isTopicSelected = (studentNo: string, topicIndex: number, topic: any) => {
  const keys = getTopicQuestionKeys(studentNo, topicIndex, topic);
  return keys.length > 0 && keys.every((key) => selectedQuestionKeys.value.includes(key));
};

const toggleTopicSelection = (
  studentNo: string,
  topicIndex: number,
  topic: any,
  checked: boolean
) => {
  const keys = getTopicQuestionKeys(studentNo, topicIndex, topic);
  if (checked) {
    const existing = new Set(selectedQuestionKeys.value);
    const additions = keys.filter((key) => !existing.has(key));
    if (additions.length) selectedQuestionKeys.value = [...selectedQuestionKeys.value, ...additions];
    return;
  }
  const removals = new Set(keys);
  selectedQuestionKeys.value = selectedQuestionKeys.value.filter((item) => !removals.has(item));
};

const isPaperStudentSelected = (studentNo: string) => selectedPaperStudentNos.value.includes(studentNo);

const togglePaperStudentSelection = (studentNo: string, checked: boolean) => {
  if (checked) {
    if (!selectedPaperStudentNos.value.includes(studentNo)) {
      selectedPaperStudentNos.value = [...selectedPaperStudentNos.value, studentNo];
    }
    return;
  }
  selectedPaperStudentNos.value = selectedPaperStudentNos.value.filter((item) => item !== studentNo);
};

const selectFilteredStudentsForPaper = () => {
  selectedPaperStudentNos.value = filteredStudents.value
    .map((student) => student.student_no)
    .filter((studentNo, index, list) => Boolean(studentNo) && list.indexOf(studentNo) === index);
};

const paperRangeStartNo = ref('');
const paperRangeEndNo = ref('');

// 区间一键选择：按试卷包考生序列选中起始、结束考生之间的全部考生（含两端），与已勾选结果合并
const selectPaperStudentRange = () => {
  if (!paperRangeStartNo.value || !paperRangeEndNo.value) {
    ElMessage.warning('请先选择起始考生和结束考生');
    return;
  }
  const students = localPackage.value?.students || [];
  const startIndex = students.findIndex((student) => student.student_no === paperRangeStartNo.value);
  const endIndex = students.findIndex((student) => student.student_no === paperRangeEndNo.value);
  if (startIndex < 0 || endIndex < 0) {
    ElMessage.warning('所选考生不在当前试卷包内，请重新选择');
    return;
  }
  const [fromIndex, toIndex] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
  const rangeNos = students.slice(fromIndex, toIndex + 1).map((student) => student.student_no);
  const merged = new Set(selectedPaperStudentNos.value);
  rangeNos.forEach((studentNo) => merged.add(studentNo));
  selectedPaperStudentNos.value = Array.from(merged);
  ElMessage.success(`已选中区间内 ${rangeNos.length} 位考生`);
};

const getSummaryQuestion = (
  row: { paperRow?: PaperSummaryRow | null },
  questionNo: string
) => row.paperRow?.questions.find((question) => questionNoMatches(question.question_no, questionNo)) || null;

const openPaperSummaryDetail = (mode: 'trial' | 'formal', row?: PaperSummaryRow | null) => {
  if (!row) return;
  paperSummaryDetailMode.value = mode;
  paperSummaryDetailRow.value = row;
  paperSummaryDetailVisible.value = true;
};

const closePaperSummaryDetail = () => {
  paperSummaryDetailVisible.value = false;
  paperSummaryDetailRow.value = null;
};

const openManualReview = (question: PaperSummaryQuestion) => {
  if (!paperSummaryDetailRow.value) return;
  manualReviewTarget.value = { ...question, student_no: paperSummaryDetailRow.value.student_no };
  manualReviewForm.score = question.record ? (numericScore(question.record.score) ?? 0) : 0;
  manualReviewForm.comment = '';
  manualReviewVisible.value = true;
};

const saveManualReview = async () => {
  const target = manualReviewTarget.value;
  const pkg = localPackage.value;
  const subjectId = String(route.params.subjectId || '');
  const examId = String(route.params.examId || '');
  if (!target || !pkg || !subjectId || !examId) return;
  if (!Number.isFinite(manualReviewForm.score) || manualReviewForm.score < 0 || manualReviewForm.score > target.maxScore) {
    ElMessage.warning(`复核得分需在 0 到 ${target.maxScore} 之间`);
    return;
  }
  const comment = manualReviewForm.comment.trim();
  if (!comment) {
    ElMessage.warning('请填写复核说明');
    return;
  }
  manualReviewSaving.value = true;
  try {
    const record = target.record;
    await saveLocalGradingRecords(subjectId, examId, pkg.local_package_id || packageId.value, [{
      student_no: target.student_no,
      question_no: target.question_no,
      question_label: target.question_no,
      grading_mode: 'manual_review',
      score: manualReviewForm.score,
      max_score: target.maxScore,
      grading_desc: `人工复核：${comment}`,
      question_text: target.questionText,
      answer_text: target.answerText,
      standard_id: record?.standard_id,
      standard_version_no: record?.standard_version_no,
      question_version_no: record?.question_version_no,
      template_id: record?.template_id,
      template_name: record?.template_name,
      standard_label: record?.standard_label,
      mcp_service_name: '人工复核',
      result: { source: 'manual_review', previous_score: record?.score ?? null, review_note: comment },
      is_trial: false
    }]);
    ElMessage.success('人工复核结果已保存');
    manualReviewVisible.value = false;
    await loadGradingRecords();
    formalSummaryAttempt.value = formalGradingRounds.value.length;
    if (paperSummaryDetailRow.value) {
      const refreshed = formalSummaryRows.value.find((row) => row.student_no === paperSummaryDetailRow.value?.student_no);
      paperSummaryDetailRow.value = refreshed || null;
    }
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '保存复核结果失败');
  } finally {
    manualReviewSaving.value = false;
  }
};

type ExportQuestionGroup = {
  topicNo: string;
  label: string;
  questions: Array<{
    questionNo: string;
    label: string;
  }>;
};

const formatExportScore = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '-';
  return String(Number(value.toFixed(2)));
};

const sanitizeFileName = (value: string) => String(value || '')
  .replace(/[\\/:*?"<>|]+/g, '_')
  .replace(/\s+/g, ' ')
  .trim() || '试卷包';

const buildExportQuestionGroups = () => {
  const groups: ExportQuestionGroup[] = [];
  const map = new Map<string, ExportQuestionGroup>();
  formalQuestionNos.value.forEach((questionNo) => {
    const [topicNoRaw] = String(questionNo || '').split('.');
    const topicNo = topicNoRaw || String(questionNo || '');
    let group = map.get(topicNo);
    if (!group) {
      group = {
        topicNo,
        label: `大题 ${topicNo}`,
        questions: []
      };
      map.set(topicNo, group);
      groups.push(group);
    }
    group.questions.push({
      questionNo,
      label: `Q${questionNo}`
    });
  });
  return groups;
};

const REVIEW_MANUAL_KEYWORDS: string[] = ['转人工', '待复核', '请人工'];
const REVIEW_MISSING_KEYWORDS: string[] = ['未找到', '未提交', '缺失', '不存在'];

const isManualReviewDesc = (desc?: string | null): boolean => {
  if (!desc) return false;
  return [...REVIEW_MANUAL_KEYWORDS, ...REVIEW_MISSING_KEYWORDS].some((kw) => desc.includes(kw));
};

const exportSummaryExcel = (mode: 'trial' | 'formal') => {
  const students = localPackage.value?.students || [];
  if (!students.length || !formalQuestionNos.value.length) {
    ElMessage.warning('暂无可导出的试卷明细');
    return;
  }

  const groups = buildExportQuestionGroups();
  const headersTop = ['考生号'];
  const headersBottom = [''];
  const merges: XLSX.Range[] = [{ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }];
  let columnIndex = 1;

  groups.forEach((group) => {
    headersTop.push(group.label);
    for (let index = 1; index < group.questions.length; index += 1) {
      headersTop.push('');
    }
    group.questions.forEach((question) => {
      headersBottom.push(question.label);
    });
    merges.push({ s: { r: 0, c: columnIndex }, e: { r: 0, c: columnIndex + group.questions.length - 1 } });
    columnIndex += group.questions.length;
  });

  // 末尾新增两列：总分、需人工审核
  const totalScoreCol = columnIndex;
  const reviewCol = columnIndex + 1;
  headersTop.push('总分', '需人工审核');
  headersBottom.push('', '');
  merges.push({ s: { r: 0, c: totalScoreCol }, e: { r: 1, c: totalScoreCol } });
  merges.push({ s: { r: 0, c: reviewCol }, e: { r: 1, c: reviewCol } });

  // 构造每位考生的逐题数据（分数 + grading_desc 用于转人工判定）
  const buildQuestionData = (studentNo: string, questionNo: string) => {
    if (mode === 'trial') {
      const record = getLatestTrialRecord(studentNo, questionNo);
      return {
        score: numericScore(record?.score),
        grading_desc: record?.grading_desc ?? null
      };
    }
    const record = formalScopedRecordMap.value.get(gradingRecordKey(studentNo, questionNo));
    return {
      score: numericScore(record?.score),
      grading_desc: record?.grading_desc ?? null
    };
  };

  const dataRows: Array<Array<string | number>> = [];
  const reviewRowIndexes: number[] = [];

  students.forEach((student) => {
    const row: Array<string | number> = [student.student_no];
    let totalScore = 0;
    const manualReviewNos: string[] = [];

    formalQuestionNos.value.forEach((questionNo) => {
      const qd = buildQuestionData(student.student_no, questionNo);
      const score = qd.score;
      if (score !== null) totalScore += score;
      row.push(formatExportScore(score));

      if (isManualReviewDesc(qd.grading_desc)) manualReviewNos.push(questionNo);
    });

    totalScore = Number(totalScore.toFixed(2));
    row.push(totalScore);

    // 拼接需人工审核说明
    const abnormal = totalScore === 0 || totalScore < REVIEW_EXCEPTION_THRESHOLD_SCORE;
    const reviewSegments: string[] = [];
    if (abnormal) reviewSegments.push(`异常试卷（总分 ${totalScore}）`);
    if (manualReviewNos.length) reviewSegments.push(`转人工题：${manualReviewNos.join('、')}`);
    const reviewText = reviewSegments.join('；');
    row.push(reviewText);

    if (reviewText) reviewRowIndexes.push(dataRows.length + 2); // +2 = 跳过表头两行
    dataRows.push(row);
  });

  const worksheet = XLSX.utils.aoa_to_sheet([
    headersTop,
    headersBottom,
    ...dataRows
  ]);
  worksheet['!merges'] = merges;
  worksheet['!cols'] = [
    { wch: 18 },
    ...formalQuestionNos.value.map(() => ({ wch: 18 })),
    { wch: 10 },
    { wch: 50 }
  ];

  // 需人工审核行标黄
  const YELLOW_FILL = { patternType: 'solid', fgColor: { rgb: 'FFFFFF00' } };
  reviewRowIndexes.forEach((rowIdx) => {
    const rowCells = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
    if (!rowCells) return;
    for (let c = rowCells.s.c; c <= rowCells.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
      const cell = worksheet[addr];
      if (cell) {
        cell.s = cell.s ? { ...cell.s, fill: YELLOW_FILL } : { fill: YELLOW_FILL };
      }
    }
    // 行高增加一点，标黄更醒目
    worksheet['!rows'] = worksheet['!rows'] || [];
    worksheet['!rows'][rowIdx] = { hpt: 22 };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, mode === 'trial' ? '试阅结果' : '正式结果');
  const fileName = `${sanitizeFileName(localPackage.value?.package_name || packageTitle.value)}_${mode === 'trial' ? '试阅' : '正式'}结果汇总.xlsx`;
  XLSX.writeFile(workbook, fileName, { cellStyles: true });
};

const goToBatchGrading = (mode: string) => {
  if (!selectedQuestionKeys.value.length) {
    ElMessage.warning('请先选择需要批量评阅的题目');
    return;
  }
  rememberPageContext();
  const routePackageId = localPackage.value?.local_package_id
    ? `local_${localPackage.value.local_package_id}`
    : packageId.value;
  router.push({
    name: 'teacher-grading-placeholder',
    params: {
      subjectId: route.params.subjectId,
      examId: route.params.examId,
      packageId: routePackageId
    },
    query: {
      mode,
      targets: selectedQuestionKeys.value.join(',')
    }
  });
};

const getTopicQuestionKeys = (studentNo: string, topicIndex: number, topic: any): string[] => {
  const subQuestions = topic?.sub_question || [];
  if (!subQuestions.length) return [makeQuestionKey(studentNo, topicIndex, -1)];
  return subQuestions.map((_: any, subIndex: number) => makeQuestionKey(studentNo, topicIndex, subIndex));
};

const goToTopicGrading = (mode: string, topicIndex: number, topic: any) => {
  if (!currentStudent.value) return;
  const targets = getTopicQuestionKeys(currentStudent.value.student_no, topicIndex, topic);
  if (!targets.length) {
    ElMessage.warning('当前大题没有可评阅的小题');
    return;
  }
  rememberPageContext();
  const routePackageId = localPackage.value?.local_package_id
    ? `local_${localPackage.value.local_package_id}`
    : packageId.value;
  // 大题试阅/评阅同样在本页内执行，不跳转配置页
  runGradingInline({
    name: 'teacher-grading-placeholder',
    params: {
      subjectId: route.params.subjectId,
      examId: route.params.examId,
      packageId: routePackageId
    },
    query: {
      mode,
      studentNo: currentStudent.value.student_no,
      topic: String(topicIndex + 1),
      targets: targets.join(','),
      auto: '1'
    }
  });
};

const gradingEmbedUrl = ref('');
const gradingEmbedLoading = ref(false);
let gradingEmbedHandler: ((event: MessageEvent) => void) | null = null;

const goToGradingPlaceholder = (mode: string, topicIndex?: number, subIndex?: number) => {
  if (!currentStudent.value) return;
  const isPaperMode = mode === 'paper-trial' || mode === 'paper-grade';
  const targetStudentNos = isPaperMode ? paperActionStudentNos.value : [currentStudent.value.student_no];
  if (!targetStudentNos.length) {
    ElMessage.warning('请先选择需要整卷评阅的考生');
    return;
  }
  rememberPageContext();
  const routePackageId = localPackage.value?.local_package_id
    ? `local_${localPackage.value.local_package_id}`
    : packageId.value;
  const targetRoute = {
    name: 'teacher-grading-placeholder',
    params: {
      subjectId: route.params.subjectId,
      examId: route.params.examId,
      packageId: routePackageId
    },
    query: {
      mode,
      studentNo: targetStudentNos[0],
      studentNos: isPaperMode ? targetStudentNos.join(',') : undefined,
      topic: topicIndex !== undefined ? String(topicIndex + 1) : undefined,
      sub: subIndex !== undefined ? String(subIndex + 1) : undefined,
      auto: '1'
    }
  };
  // 直接在本页执行评分，不跳转配置页；校验失败时才退回配置页供人工处理
  runGradingInline(targetRoute);
};

const closeGradingInline = () => {
  gradingEmbedLoading.value = false;
  gradingEmbedUrl.value = '';
  if (gradingEmbedHandler) {
    window.removeEventListener('message', gradingEmbedHandler);
    gradingEmbedHandler = null;
  }
};

const runGradingInline = (targetRoute: any) => {
  closeGradingInline();
  gradingEmbedLoading.value = true;
  gradingEmbedUrl.value = router.resolve(targetRoute).href;
  gradingEmbedHandler = async (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'teacher-grading-auto-done') return;
    const ok = Boolean(event.data.ok);
    closeGradingInline();
    if (ok) {
      await loadGradingRecords();
      ElMessage.success('评分完成');
      return;
    }
    // 未配置阅卷模板/校验失败：露出配置页让教师处理
    router.push(targetRoute);
  };
  window.addEventListener('message', gradingEmbedHandler);
};

const loadMcpServices = async () => {
  if (mcpServices.value.length || mcpLoading.value) return;
  mcpLoading.value = true;
  try {
    const response = await listServices(undefined, true);
    const responseData = response.data as McpServiceInfo[] | { items?: McpServiceInfo[] } | undefined;
    if (Array.isArray(responseData)) {
      mcpServices.value = responseData;
    } else if (Array.isArray(responseData?.items)) {
      mcpServices.value = responseData.items;
    } else {
      mcpServices.value = [];
    }
  } catch (error) {
    console.error('获取MCP服务失败', error);
    ElMessage.error('获取MCP服务失败');
  } finally {
    mcpLoading.value = false;
  }
};

const loadLatestStandard = async () => {
  try {
    const response = await getLatestGradingStandard(String(route.params.subjectId), String(route.params.examId));
    latestStandard.value = response.data || null;
    latestStandardVersion.value = Number(response.data?.version_no || 0);
  } catch (error) {
    latestStandard.value = null;
    latestStandardVersion.value = 0;
  }
};

const loadGradingStandardVersions = async () => {
  try {
    const response = await getGradingStandardVersions(String(route.params.subjectId), String(route.params.examId));
    gradingStandardVersions.value = response.data || [];
  } catch (error: any) {
    console.error('获取阅卷标准版本失败', error);
    ElMessage.error(error?.response?.data?.message || error?.message || '获取阅卷标准版本失败');
  }
};

const loadGradingTemplates = async () => {
  try {
    const response = await getGradingTemplates(String(route.params.subjectId), String(route.params.examId));
    if (response.code === 0 || response.code === 200) {
      gradingTemplates.value = response.data || [];
    }
  } catch (error) {
    console.error('获取阅卷模板失败', error);
  }
};

const questionTypeLabelMap: Record<string, string> = {
  short_answer: '简答题',
  image: '图片题',
  operation: '操作题',
  code: '代码题',
  file: '文件题',
  // 兼容已经保存的旧阅卷标准，新建标准不会再提供这些选项。
  subjective: '主观题',
  calculation: '计算题'
};

const getQuestionTypeLabel = (value?: string) => {
  const key = String(value || '').trim();
  return questionTypeLabelMap[key] || key || '未设置类型';
};

const normalizeCriteriaText = (value?: string) => String(value || '').replace(/\s+/g, ' ').trim();

const getTemplateStandardOptions = (questionNo: string) => {
  return getQuestionStandardVersions(questionNo)
    .map((version) => {
      const questionTypeLabel = getQuestionTypeLabel(version.item.question_type);
      const gradingCriteria = normalizeCriteriaText(version.item.grading_criteria);
      const shortCriteria = gradingCriteria.length > 42 ? `${gradingCriteria.slice(0, 42)}...` : gradingCriteria;
      const versionLabel = `本题 V${version.version_no}`;
      return {
        value: `${version.standard_id}:${version.item.item_id || version.version_no}`,
        label: `${versionLabel} / ${questionTypeLabel}${shortCriteria ? ` / ${shortCriteria}` : ''}`,
        versionLabel,
        questionTypeLabel,
        gradingCriteria
      };
    });
};
const openTemplateDialog = async () => {
  templateDialogVisible.value = true;
  templateForm.value = {
    template_name: '科目考试阅卷模板',
    description: ''
  };
  templateSelections.value = {};
  await Promise.all([loadGradingStandardVersions(), loadGradingTemplates()]);
  templateQuestionRows.value.forEach((row) => {
    const options = getTemplateStandardOptions(row.question_no);
    if (options.length) {
      templateSelections.value[row.question_no] = options[0].value;
    }
  });
};

const saveGradingTemplate = async () => {
  const selectedItems = templateQuestionRows.value
    .map((row) => {
      const selectedValue = templateSelections.value[row.question_no];
      const [standardIdText, itemIdText] = String(selectedValue || '').split(':');
      const standardId = Number(standardIdText || 0);
      const itemId = Number(itemIdText || 0);
      return {
        question_no: row.question_no,
        standard_id: standardId || undefined,
        item_id: itemId || undefined
      };
    })
    .filter((item): item is { question_no: string; standard_id: number; item_id: number | undefined } => Boolean(item.standard_id));

  if (!selectedItems.length) {
    ElMessage.warning('请至少选择一道题的评阅标准版本');
    return;
  }
  if (selectedItems.length !== templateQuestionRows.value.length) {
    ElMessage.warning('请为每道题选择评阅标准版本');
    return;
  }

  templateSaving.value = true;
  try {
    const response = await createGradingTemplate(String(route.params.subjectId), String(route.params.examId), {
      template_name: templateForm.value.template_name || '科目考试阅卷模板',
      description: templateForm.value.description,
      template_items: selectedItems
    });
    if (response.code === 0 || response.code === 200) {
      ElMessage.success('科目考试阅卷模板保存成功');
      templateDialogVisible.value = false;
      await loadGradingTemplates();
    } else {
      ElMessage.error(response.message || '保存阅卷模板失败');
    }
  } catch (error: any) {
    console.error('保存阅卷模板失败', error);
    ElMessage.error(error?.response?.data?.message || error?.message || '保存阅卷模板失败');
  } finally {
    templateSaving.value = false;
  }
};
const makeLocalId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const createEmptyStandardItem = (row?: TemplateQuestionRow): StandardFormItem => ({
  local_id: makeLocalId(),
  question_no: row?.question_no || '',
  question_text: row?.question_text || '',
  question_type: 'short_answer',
  mcp_service_id: '',
  mcp_service_ids: [],
  mcp_service_name: '',
  reference_answer: '',
  grading_criteria: '',
  question_version_no: 1,
  source_standard_version_no: nextStandardVersion.value,
  mcp_params: {}
});

const getOriginalStandardItem = (questionNo: string) => originalStandardItemMap.value[String(questionNo || '').trim()];

const normalizeStandardText = (value?: string | number) => String(value ?? '').replace(/\s+/g, ' ').trim();

const stableStringify = (value: any): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? '');
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const normalizeMcpParams = (value?: Record<string, any>) => {
  if (!value || typeof value !== 'object') return '';
  return stableStringify(value);
};

const isStandardItemChanged = (item: StandardFormItem) => {
  const original = getOriginalStandardItem(item.question_no);
  if (!original) return true;
  return normalizeStandardText(item.question_type) !== normalizeStandardText(original.question_type)
    || String(item.mcp_service_id || '') !== String(original.mcp_service_id || '')
    || normalizeStandardText(item.reference_answer) !== normalizeStandardText(original.reference_answer)
    || normalizeStandardText(item.grading_criteria) !== normalizeStandardText(original.grading_criteria)
    || normalizeMcpParams(item.mcp_params) !== normalizeMcpParams(original.mcp_params);
};

const getMaxQuestionVersionNo = (questionNo: string) => getQuestionStandardVersions(questionNo)
  .reduce((max, version) => Math.max(max, Number(version.version_no || 0)), 0);

const getNextQuestionVersionNo = (questionNo: string) => Math.max(1, getMaxQuestionVersionNo(questionNo) + 1);

const getStandardCurrentVersionLabel = (item: StandardFormItem) => {
  const original = getOriginalStandardItem(item.question_no);
  const version = standardDialogMode.value === 'view'
    ? Number(item.question_version_no || currentQuestionDisplayVersion.value || 0)
    : Number(original?.question_version_no || getMaxQuestionVersionNo(item.question_no) || 0);
  return version > 0 ? `当前版本：V${version}` : '当前版本：暂无';
};

const getStandardSaveVersionLabel = (item: StandardFormItem) => {
  const original = getOriginalStandardItem(item.question_no);
  if (!original) return '保存后：新建 V1';
  const currentVersion = Number(original.question_version_no || getMaxQuestionVersionNo(item.question_no) || 1);
  if (!isStandardItemChanged(item)) return `保存后：沿用 V${currentVersion}`;
  return `保存后：另存 V${getNextQuestionVersionNo(item.question_no)}`;
};

const getStandardSaveTagType = (item: StandardFormItem) => {
  const original = getOriginalStandardItem(item.question_no);
  if (!original) return 'success';
  return isStandardItemChanged(item) ? 'warning' : 'info';
};

const buildStandardItemsFromQuestions = () => {
  const nextMap: Record<string, GradingStandardItem | undefined> = {};
  const items = templateQuestionRows.value.map((row) => {
    const versions = getQuestionStandardVersions(row.question_no);
    const latestQuestionStandard = versions[versions.length - 1];
    if (!latestQuestionStandard) {
      return createEmptyStandardItem(row);
    }
    nextMap[row.question_no] = latestQuestionStandard.item;
    return {
      ...cloneStandardItem(latestQuestionStandard.item),
      question_no: row.question_no,
      question_text: row.question_text || latestQuestionStandard.item.question_text || '',
      reference_answer: latestQuestionStandard.item.reference_answer || '',
      grading_criteria: latestQuestionStandard.item.grading_criteria || ''
    };
  });
  originalStandardItemMap.value = nextMap;
  standardItems.value = items;
  if (standardDialogMode.value === 'create') {
    initializeStandardMajorMcpSelections();
  }
};

const syncStandardMcpName = (item: StandardFormItem) => {
  // 多选：把选中的服务 id 合并回 mcp_service_id，名称按顺序拼接
  item.mcp_service_id = joinMcpServiceIds(item.mcp_service_ids || []);
  const names = (item.mcp_service_ids || [])
    .map((id) => {
      const service = mcpServices.value.find((serviceItem) => String(getMcpServiceValue(serviceItem)) === String(id));
      return service ? getMcpServiceLabel(service) : '';
    })
    .filter(Boolean);
  item.mcp_service_name = names.join('、');
};

const openStandardDialog = async () => {
  standardDialogMode.value = 'create';
  editingQuestionNo.value = '';
  questionStandardVersions.value = [];
  currentQuestionVersionIndex.value = 0;
  standardDialogVisible.value = true;
  await Promise.all([loadMcpServices(), loadLatestStandard(), loadGradingStandardVersions()]);
  buildStandardItemsFromQuestions();
};

const openQuestionStandardDialog = async (topicIndex: number, subIndex: number) => {
  await Promise.all([loadMcpServices(), loadLatestStandard(), loadGradingStandardVersions()]);
  const questionNo = getQuestionNo(topicIndex, subIndex);
  const versions = getQuestionStandardVersions(questionNo);
  if (!versions.length) {
    ElMessage.warning('未找到本题阅卷标准');
    return;
  }
  standardDialogMode.value = 'view';
  editingQuestionNo.value = questionNo;
  questionStandardVersions.value = versions;
  currentQuestionVersionIndex.value = versions.length - 1;
  originalStandardItemMap.value = { [questionNo]: versions[versions.length - 1].item };
  applyCurrentQuestionStandardVersion();
  standardDialogVisible.value = true;
};

const toPayloadStandardItem = (item: StandardFormItem, questionVersionNo: number, sourceStandardVersionNo: number): GradingStandardItem => ({
  item_id: item.item_id,
  question_no: String(item.question_no || '').trim(),
  question_text: item.question_text || '',
  question_type: item.question_type,
  // 多选 MCP 以逗号分隔存储
  mcp_service_id: joinMcpServiceIds(item.mcp_service_ids || splitMcpServiceIds(item.mcp_service_id)),
  mcp_service_name: item.mcp_service_name || '',
  reference_answer: item.reference_answer || '',
  grading_criteria: item.grading_criteria || '',
  question_version_no: questionVersionNo,
  source_standard_version_no: sourceStandardVersionNo,
  mcp_params: item.mcp_params || {}
});

const saveStandard = async () => {
  if (!standardItems.value.length) {
    ElMessage.warning('当前试卷包没有可保存的题目');
    return;
  }
  syncAllStandardMajorMcpSelections();

  for (const group of standardMajorGroups.value) {
    if (!standardMajorMcpSelections.value[group.topicNo]?.length) {
      ElMessage.warning(`大题 ${group.topicNo} 请选择 MCP`);
      return;
    }
  }

  for (let index = 0; index < standardItems.value.length; index += 1) {
    const item = standardItems.value[index];
    const questionNo = String(item.question_no || '').trim();
    if (!questionNo) {
      ElMessage.warning(`第 ${index + 1} 题缺少题号，请检查试卷包解析结果`);
      return;
    }
    if (!item.question_type) {
      ElMessage.warning(`题号 ${questionNo} 请选择试题类型`);
      return;
    }
  }

  const nextWholeVersion = nextStandardVersion.value;
  let createdCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;
  const payloadItems = standardItems.value.map((item) => {
    syncStandardMcpName(item);
    const original = getOriginalStandardItem(item.question_no);
    if (!original) {
      createdCount += 1;
      return toPayloadStandardItem(item, 1, nextWholeVersion);
    }
    if (!isStandardItemChanged(item)) {
      unchangedCount += 1;
      return toPayloadStandardItem(
        { ...cloneStandardItem(original), question_text: item.question_text || original.question_text || '' },
        Number(original.question_version_no || getMaxQuestionVersionNo(item.question_no) || 1),
        Number(original.source_standard_version_no || latestStandardVersion.value || 1)
      );
    }
    changedCount += 1;
    return toPayloadStandardItem({ ...item, item_id: undefined }, getNextQuestionVersionNo(item.question_no), nextWholeVersion);
  });

  if (!createdCount && !changedCount) {
    ElMessage.info('未检测到改动，已有题目评阅标准保持原版本');
    return;
  }

  standardSaving.value = true;
  try {
    const response = await createGradingStandard(String(route.params.subjectId), String(route.params.examId), {
      standard_items: payloadItems
    });
    latestStandard.value = response.data || null;
    latestStandardVersion.value = Number(response.data?.version_no || nextWholeVersion);
    await loadGradingStandardVersions();
    buildStandardItemsFromQuestions();
    standardDialogVisible.value = false;
    ElMessage.success(`阅卷标准已保存：新增 ${createdCount} 题，另存新版 ${changedCount} 题，沿用 ${unchangedCount} 题`);
  } catch (error: any) {
    console.error('保存阅卷标准失败', error);
    ElMessage.error(error?.response?.data?.message || error?.message || '保存阅卷标准失败');
  } finally {
    standardSaving.value = false;
  }
};

const parseScoreNumber = (value: any): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const matched = String(value).match(/(\d+(?:\.\d+)?)/);
  if (!matched) return null;
  const score = Number(matched[1]);
  return Number.isFinite(score) ? score : null;
};

const getQuestionDeclaredScore = (question: any) => parseScoreNumber(question?.question) ?? parseScoreNumber(question?.score);

const parseQuestionNoToIndexes = (questionNo?: string) => {
  const [topicText, subText] = String(questionNo || '').split('.');
  const topicIndex = Number(topicText) - 1;
  const subIndex = subText === undefined ? -1 : Number(subText) - 1;
  if (!Number.isInteger(topicIndex) || topicIndex < 0) return null;
  if (subText !== undefined && (!Number.isInteger(subIndex) || subIndex < 0)) return null;
  return {
    topicIndex,
    subIndex,
    questionNo: subIndex >= 0 ? `${topicIndex + 1}.${subIndex + 1}` : String(topicIndex + 1)
  };
};

const getTemplateById = (templateId?: number) => gradingTemplates.value.find((item) => item.template_id === templateId) || null;
const selectedFormalTemplate = computed(() => getTemplateById(formalForm.value.template_id));

const getStudentQuestions = (student: LocalStudentAnswer) => getQuestionList(student.answer_json || null);
const collectAnswerFileItems = (value: any): any[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectAnswerFileItems(item));
  if (typeof value !== 'object') return [];
  const directFile = value.file_name || value.fileName || value.url || value.storage_path || value.relative_path;
  if (directFile) return [value];
  return Object.values(value).flatMap((item) => collectAnswerFileItems(item));
};
const getQuestionAnswerFileText = (question: any) => {
  const files = collectAnswerFileItems(question?.answer_files);
  if (!files.length) return '';
  const seen = new Set<string>();
  const lines = files.flatMap((file) => {
    const name = file.file_name || file.name || '答案文件';
    const type = file.file_type || file.type || '附件';
    const link = file.url || file.storage_path || file.relative_path || file.path || '';
    const key = `${name}|${link}`;
    if (!link || seen.has(key)) return [];
    seen.add(key);
    return [`${type}：${name}，地址：${link}`];
  });
  return lines.length ? `【附件答案】\n${lines.join('\n')}` : '';
};
const getQuestionAnswerText = (question: any) => [
  getDisplayText(question?.answer),
  getQuestionAnswerFileText(question)
].filter(Boolean).join('\n\n');
const getQuestionNode = (student: LocalStudentAnswer, questionNo: string) => {
  const parsed = parseQuestionNoToIndexes(questionNo);
  if (!parsed) return null;
  const topic = getStudentQuestions(student)[parsed.topicIndex];
  if (!topic) return null;
  if (parsed.subIndex < 0) return topic;
  if (Array.isArray(topic.sub_question) && topic.sub_question.length) {
    return topic.sub_question[parsed.subIndex] || null;
  }
  // 历史评分记录可能把无子题的大题保存成 1.1，兼容回退到大题本身。
  return parsed.subIndex === 0 ? topic : null;
};
const getQuestionMaxScore = (student: LocalStudentAnswer, questionNo: string) => getQuestionDeclaredScore(getQuestionNode(student, questionNo));

// 阅卷标准里教师指定的总分优先，缺失时回退题干解析出的分值
const getTemplateItemMaxScore = (standardItem: any) => {
  const raw = standardItem?.max_score;
  const score = Number(raw);
  return raw !== undefined && raw !== null && raw !== '' && Number.isFinite(score) && score > 0 ? score : null;
};

const getGradingMaxScore = (student: LocalStudentAnswer, questionNo: string, standardItem: any) => (
  getTemplateItemMaxScore(standardItem) ?? getQuestionMaxScore(student, questionNo)
);

const getQuestionImageFile = (student: LocalStudentAnswer, questionNo: string) => {
  const question = getQuestionNode(student, questionNo);
  for (const imagePath of getQuestionDisplayImages(question)) {
    const found = findLocalImage(localPackage.value?.images || [], imagePath);
    if (found) return found;
  }
  return null;
};

const buildFormalQuestionText = (student: LocalStudentAnswer, questionNo: string, templateItem: any) => {
  const question = getQuestionNode(student, questionNo);
  const standard = templateItem?.standard_item || {};
  const maxScore = getGradingMaxScore(student, questionNo, standard);
  const maxScoreText = maxScore !== null ? `本题满分：${maxScore}分\n` : '';
  return `题号 Q${questionNo}\n${maxScoreText}题目：${question?.question || ''}\n作答：${getQuestionAnswerText(question)}\n\n【正式评阅采用的评分依据】\n参考答案：${standard.reference_answer || '暂无'}\n评分标准：${standard.grading_criteria || '暂无'}`;
};

const groupFormalTargetsByTopic = (candidates: Array<{ target: BatchGradingTarget | null; skipped: boolean; invalid: boolean }>) => {
  const passthrough = candidates.filter((item) => !item.target);
  const grouped = new Map<string, {
    target: BatchGradingTarget;
    subTargets: BatchGradingTarget[];
    topicIndex: number;
  }>();

  candidates.forEach((item) => {
    if (!item.target) return;
    const target = item.target;
    const parsed = parseQuestionNoToIndexes(String(target.question_no || ''));
    if (!parsed) {
      passthrough.push(item);
      return;
    }
    const topicNo = String(parsed.topicIndex + 1);
    const groupKey = `${target.student_no}__${topicNo}__${target.service_uuid}`;
    const existing = grouped.get(groupKey);
    if (existing) {
      existing.subTargets.push(target);
      existing.target.multi_service = Boolean(existing.target.multi_service || target.multi_service);
      if (!existing.target.image && target.image) {
        existing.target.image = target.image;
        existing.target.image_name = target.image_name;
      }
      return;
    }
    grouped.set(groupKey, {
      topicIndex: parsed.topicIndex,
      subTargets: [target],
      target: {
        ...target,
        key: groupKey,
        question_no: topicNo,
        question_label: `Q${topicNo}`,
        standard_id: undefined,
        standard_version_no: undefined,
        question_version_no: undefined,
        standard_label: `正式评阅：${target.template_name || '阅卷模板'} / Q${topicNo}`,
        sub_questions: []
      }
    });
  });

  const groupedCandidates = Array.from(grouped.values()).map((group) => {
    const sortedSubTargets = [...group.subTargets].sort((left, right) => {
      const leftParsed = parseQuestionNoToIndexes(String(left.question_no || ''));
      const rightParsed = parseQuestionNoToIndexes(String(right.question_no || ''));
      return (leftParsed?.subIndex ?? 0) - (rightParsed?.subIndex ?? 0);
    });
    const maxScoreTotal = sortedSubTargets.reduce((sum, target) => sum + (numericScore(target.max_score) || 0), 0);
    group.target.max_score = maxScoreTotal || null;
    group.target.answer_text = sortedSubTargets
      .map((target) => `Q${target.question_no}：${target.answer_text || ''}`)
      .filter(Boolean)
      .join('\n\n');
    group.target.question_text = [
      `大题 Q${group.topicIndex + 1}`,
      ...sortedSubTargets.map((target) => target.question_text),
      '请按照每道小题各自的参考答案、评分标准和满分独立评分，并按小题题号返回每道题的分数和评语。'
    ].filter(Boolean).join('\n\n');
    group.target.sub_questions = sortedSubTargets.map((target) => ({
      key: target.key,
      question_no: target.question_no || '',
      question_label: target.question_label,
      question_text: target.question_text,
      answer_text: target.answer_text,
      max_score: target.max_score,
      standard_id: target.standard_id,
      standard_version_no: target.standard_version_no,
      question_version_no: target.question_version_no,
      template_id: target.template_id,
      template_name: target.template_name,
      standard_label: target.standard_label
    }));
    return { target: group.target, skipped: false, invalid: false };
  });

  return [...passthrough, ...groupedCandidates];
};

const getFormalSourceStudents = () => {
  if (formalForm.value.scope === 'current' && currentStudent.value) return [currentStudent.value];
  return localPackage.value?.students || [];
};

const buildFormalCandidates = () => {
  const template = selectedFormalTemplate.value;
  if (!template) return [];
  const selectedKeys = new Set(selectedQuestionKeys.value);
  const candidates: Array<{ target: BatchGradingTarget | null; skipped: boolean; invalid: boolean }> = [];
  const students = getFormalSourceStudents();
  students.forEach((student) => {
    (template.template_items || []).forEach((templateItem: any) => {
      const questionNo = String(templateItem.question_no || '').trim();
      const parsed = parseQuestionNoToIndexes(questionNo);
      if (!parsed) return;
      const key = parsed.subIndex >= 0
        ? makeQuestionKey(student.student_no, parsed.topicIndex, parsed.subIndex)
        : `${student.student_no}__${parsed.topicIndex + 1}`;
      const topicSelected = Array.from(selectedKeys).some((selectedKey) => (
        selectedKey.startsWith(`${student.student_no}__${parsed.topicIndex + 1}__`)
      ));
      if (formalForm.value.scope === 'selected' && !selectedKeys.has(key) && !topicSelected) return;
      const existing = gradingRecordMap.value.get(gradingRecordKey(student.student_no, questionNo));
      if (existing && (formalForm.value.scope === 'ungraded' || formalForm.value.overwrite === 'skip')) {
        candidates.push({ target: null, skipped: true, invalid: false });
        return;
      }
      const standard = templateItem.standard_item;
      const imageFile = getQuestionImageFile(student, questionNo);
      // 与试阅一致：正式评阅按当前题目在模板绑定的阅卷标准项选择 MCP。
      const serviceUuids = splitMcpServiceIds(standard?.mcp_service_id);
      if (!standard || !serviceUuids.length) {
        candidates.push({ target: null, skipped: false, invalid: true });
        return;
      }
      serviceUuids.forEach((serviceUuid, serviceIndex) => {
        const target: BatchGradingTarget = {
          key: serviceUuids.length > 1 ? `${key}__svc${serviceIndex + 1}` : key,
          question_no: questionNo,
          service_uuid: String(serviceUuid),
          student_no: student.student_no,
          question_label: serviceUuids.length > 1
            ? `Q${questionNo}（服务${serviceIndex + 1}）`
            : `Q${questionNo}`,
          question_text: buildFormalQuestionText(student, questionNo, templateItem),
          answer_text: getQuestionAnswerText(getQuestionNode(student, questionNo)),
          max_score: getGradingMaxScore(student, questionNo, standard),
          // 多服务分工评阅：各服务按评分标准中自己部分的满分评分
          multi_service: serviceUuids.length > 1,
          standard_id: templateItem.standard_id,
          standard_version_no: templateItem.standard_version_no,
          question_version_no: templateItem.question_version_no || standard.question_version_no,
          template_id: template.template_id,
          template_name: template.template_name,
          standard_label: `正式评阅：${template.template_name} / Q${questionNo} / V${templateItem.question_version_no || standard.question_version_no || '-'}`
        };
        if (imageFile) {
          target.image = imageFile.blob;
          target.image_name = imageFile.name;
        }
        candidates.push({
          skipped: false,
          invalid: false,
          target
        });
      });
    });
  });
  return groupFormalTargetsByTopic(candidates);
};

const formalPreview = computed(() => {
  const candidates = buildFormalCandidates();
  return {
    total: candidates.filter((item) => item.target).length,
    skipped: candidates.filter((item) => item.skipped).length,
    invalid: candidates.filter((item) => item.invalid).length
  };
});

const startFormalGrading = async () => {
  const targets = buildFormalCandidates().map((item) => item.target).filter((item): item is BatchGradingTarget => Boolean(item));
  if (!selectedFormalTemplate.value) {
    ElMessage.warning('请选择阅卷模板');
    return;
  }
  if (!targets.length) {
    ElMessage.warning('没有可正式评阅的题目，请检查范围、覆盖策略、评分标准和 MCP 服务');
    return;
  }
  if (formalForm.value.overwrite === 'overwrite') {
    await ElMessageBox.confirm('将重新评阅并覆盖已有正式结果，确定继续吗？', '覆盖确认', { type: 'warning' });
  }
  // 后端持久化图片的 blob 是空占位，提交评阅前先按 url 拉取真实内容
  await Promise.all(targets.map(async (target) => {
    if (target.image) {
      const found = localPackage.value?.images.find((image) => image.name === target.image_name);
      if (found) target.image = (await ensureImageBlob(found)) || target.image;
    }
  }));
  formalGradingRunning.value = true;
  formalBatchResult.value = null;
  formalProgress.value = { completed: 0, total: targets.length, failed: 0 };
  const results: BatchGradingResult['results'] = [];
  const batchSize = Math.max(1, Number(formalForm.value.batch_size || 4));
  try {
    for (let index = 0; index < targets.length; index += batchSize) {
      const chunk = targets.slice(index, index + batchSize);
      const response = await gradeBatchWithMcp({
        subject_id: String(route.params.subjectId),
        exam_id: String(route.params.examId),
        local_package_id: localPackage.value?.local_package_id || packageId.value,
        package_fingerprint: localPackage.value?.package_fingerprint,
        quick_fingerprint: localPackage.value?.quick_fingerprint,
        student_no_hash: localPackage.value?.student_no_hash,
        is_trial: false,
        mode: 'formal-grade',
        targets: chunk
      });
      const batch = response.data as BatchGradingResult;
      results.push(...(batch?.results || []));
      formalProgress.value.completed += chunk.length;
      formalProgress.value.failed += Number(batch?.failed_count || 0);
    }
    formalBatchResult.value = {
      status: formalProgress.value.failed ? 'partial_success' : 'success',
      mode: 'formal-grade',
      total: targets.length,
      success_count: targets.length - formalProgress.value.failed,
      failed_count: formalProgress.value.failed,
      results
    };
    await loadGradingRecords();
    formalDialogVisible.value = false;
    formalResultTab.value = 'summary';
    ElMessage.success('正式评阅完成');
  } catch (error: any) {
    console.error('正式评阅失败', error);
    ElMessage.error(error?.response?.data?.message || error?.message || '正式评阅失败');
  } finally {
    formalGradingRunning.value = false;
  }
};

const numericScore = (value: any) => {
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
};

const formatScoreValue = (value: number) => Number(value.toFixed(2));

// 指定模式的学生总分：只累加该模式的评分记录，没有任何记录时返回 null（不回退历史分数）
const getStudentTotalScoreForMode = (student: LocalStudentAnswer, mode: 'trial' | 'formal'): number | null => {
  const questions = getQuestionList(student.answer_json || null);
  const scores: number[] = [];
  questions.forEach((topic: any, topicIndex: number) => {
    const subQuestions = topic?.sub_question || [];
    if (subQuestions.length) {
      subQuestions.forEach((_: any, subIndex: number) => {
        const score = getQuestionScoreValueForMode(student.student_no, topicIndex, subIndex, mode);
        if (score !== null) scores.push(score);
      });
      return;
    }
    const score = numericScore(getRecordForMode(student.student_no, String(topicIndex + 1), mode)?.score);
    if (score !== null) scores.push(score);
  });
  return scores.length ? scores.reduce((sum: number, score: number) => sum + score, 0) : null;
};

const hasStudentRecordForMode = (student: LocalStudentAnswer, mode: 'trial' | 'formal') => {
  const questions = getQuestionList(student.answer_json || null);
  return questions.some((topic: any, topicIndex: number) => {
    const subQuestions = topic?.sub_question || [];
    if (subQuestions.length) {
      return subQuestions.some((_: any, subIndex: number) =>
        Boolean(getRecordForMode(student.student_no, getQuestionNo(topicIndex, subIndex), mode)));
    }
    return Boolean(getRecordForMode(student.student_no, String(topicIndex + 1), mode));
  });
};

const getStudentTotalScoreText = (student: LocalStudentAnswer, mode: 'trial' | 'formal') => {
  const total = getStudentTotalScoreForMode(student, mode);
  return total === null ? '暂无' : formatScoreValue(total);
};

const getDisplayedStudentTotalScore = (student: LocalStudentAnswer) => {
  const mode = scoringMode.value === 'trial' ? 'trial' : 'formal';
  const total = getStudentTotalScoreForMode(student, mode);
  return total === null ? null : formatScoreValue(total);
};

const formalQuestionNos = computed(() => {
  const templateNos = (selectedFormalTemplate.value?.template_items || [])
    .map((item: any) => String(item.question_no || '').trim())
    .filter(Boolean);
  return templateNos.length ? templateNos : templateQuestionRows.value.map((row) => row.question_no);
});
const formalTotalTargets = computed(() => (localPackage.value?.students.length || 0) * formalQuestionNos.value.length);
const trialScopedRecords = computed(() => {
  const questionNos = new Set(formalQuestionNos.value);
  const studentNos = new Set((localPackage.value?.students || []).map((student) => student.student_no));
  return gradingRecords.value.filter((record) => (
    Boolean(record.is_trial)
    && recordMatchesQuestionSet(record, questionNos)
    && studentNos.has(record.student_no)
  ));
});
const getRecordSortTime = (record: LocalGradingRecordItem) => {
  const timeValue = record.graded_at || record.updated_at || '';
  const time = timeValue ? new Date(timeValue).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
};

const sortGradingRecords = (records: LocalGradingRecordItem[]) => [...records].sort((a, b) => {
  const timeDiff = getRecordSortTime(a) - getRecordSortTime(b);
  if (timeDiff) return timeDiff;
  return Number(a.record_id || 0) - Number(b.record_id || 0);
});

const trialScopedRecordGroupMap = computed(() => {
  const map = new Map<string, LocalGradingRecordItem[]>();
  trialScopedRecords.value.forEach((record) => {
    const key = gradingRecordKey(record.student_no, record.question_no);
    const records = map.get(key) || [];
    records.push(record);
    map.set(key, records);
  });
  map.forEach((records, key) => map.set(key, sortGradingRecords(records)));
  return map;
});

const getTrialRecords = (studentNo: string, questionNo: string) => trialScopedRecordGroupMap.value.get(gradingRecordKey(studentNo, questionNo)) || [];

// 多服务评阅合并规则：同一题可能由多个 MCP 服务各评一次，
// 每个服务取其最新一条记录，得分按服务求和。
const getLatestRecordPerService = (records: LocalGradingRecordItem[]) => {
  const byService = new Map<string, LocalGradingRecordItem>();
  records.forEach((record) => {
    const serviceKey = String(record.mcp_service_id ?? record.mcp_service_name ?? '');
    const previous = byService.get(serviceKey);
    if (!previous || getRecordSortTime(record) >= getRecordSortTime(previous)) {
      byService.set(serviceKey, record);
    }
  });
  return [...byService.values()];
};

const mergeRecordsBySum = (records: LocalGradingRecordItem[]): LocalGradingRecordItem | null => {
  const latestPerService = getLatestRecordPerService(records);
  if (!latestPerService.length) return null;
  if (latestPerService.length === 1) return latestPerService[0];
  const totalScore = latestPerService.reduce((sum, item) => sum + (numericScore(item.score) || 0), 0);
  const comments = latestPerService
    .map((item) => {
      const label = String(item.mcp_service_name || item.mcp_service_id || 'MCP').trim();
      const comment = String(item.grading_desc || '').trim();
      return comment ? `${label}：${comment}` : '';
    })
    .filter(Boolean)
    .join('\n');
  return {
    ...latestPerService[latestPerService.length - 1],
    score: Number(totalScore.toFixed(2)),
    grading_desc: comments || latestPerService[latestPerService.length - 1].grading_desc,
    merged_service_count: latestPerService.length
  } as LocalGradingRecordItem;
};

const getLatestTrialRecord = (studentNo: string, questionNo: string) => mergeRecordsBySum(getTrialRecords(studentNo, questionNo));

// 一次批量/整卷评阅产生的记录按时间聚为一轮；两条记录间隔超过该值视为新一轮
const GRADING_ROUND_GAP_MS = 10 * 60 * 1000;

type GradingRoundInfo = {
  start: number;
  end: number;
  records: LocalGradingRecordItem[];
  note: string;
  starred: boolean;
  creatorName: string;
  timeText: string;
};

const buildGradingRounds = (records: LocalGradingRecordItem[]): GradingRoundInfo[] => {
  const rounds: Array<{ start: number; end: number; records: LocalGradingRecordItem[] }> = [];
  sortGradingRecords(records).forEach((record) => {
    const time = getRecordSortTime(record);
    const current = rounds[rounds.length - 1];
    if (current && time - current.end <= GRADING_ROUND_GAP_MS) {
      current.end = Math.max(current.end, time);
      current.records.push(record);
    } else {
      rounds.push({ start: time, end: time, records: [record] });
    }
  });
  return rounds.map((round) => ({
    ...round,
    note: round.records.reduceRight((found, record) => found || String(record.round_note || '').trim(), ''),
    starred: round.records.some((record) => Boolean(record.round_starred)),
    creatorName: round.records.find((record) => record.creator_name)?.creator_name || '-',
    timeText: String(round.records[0]?.graded_at || round.records[0]?.updated_at || '').slice(0, 16)
  }));
};

const buildRoundIdMap = (rounds: Array<{ records: LocalGradingRecordItem[] }>) => {
  const map = new Map<number, number>();
  rounds.forEach((round, index) => round.records.forEach((record) => map.set(record.record_id, index + 1)));
  return map;
};

// 取某题在第 roundIndex 轮（含）之前最近一次的评阅记录：
// 该轮新评的题用该轮记录，未重评的题沿用之前最近一轮的记录
const getRecordsCarriedToRound = (records: LocalGradingRecordItem[], roundIdMap: Map<number, number>, roundIndex: number) => {
  if (!roundIndex) return records;
  const eligible = records.filter((record) => (roundIdMap.get(record.record_id) || 0) <= roundIndex);
  if (!eligible.length) return [];
  const latestRound = eligible.reduce((max, record) => Math.max(max, roundIdMap.get(record.record_id) || 0), 0);
  return eligible.filter((record) => (roundIdMap.get(record.record_id) || 0) === latestRound);
};

// 1..K = 按时间正数的第 N 轮试阅；默认展示最新一轮
const trialSummaryAttempt = ref(0);

watch(trialResultDrawerVisible, (visible) => {
  if (visible) trialSummaryAttempt.value = trialGradingRounds.value.length;
});

const trialGradingRounds = computed(() => buildGradingRounds(trialScopedRecords.value));

// 星标轮次置顶，其余按时间倒序（最新在上）
const trialAttemptOptions = computed(() => {
  const entries = trialGradingRounds.value.map((round, index) => ({ round, roundIndex: index + 1 }));
  const sortDesc = (list: typeof entries) => list.slice().sort((a, b) => b.roundIndex - a.roundIndex);
  return [
    ...sortDesc(entries.filter((item) => item.round.starred)),
    ...sortDesc(entries.filter((item) => !item.round.starred))
  ].map((item) => ({
    value: item.roundIndex,
    label: `第${item.roundIndex}轮｜${item.round.timeText}${item.round.starred ? ' ★' : ''}`
  }));
});

watch(() => trialGradingRounds.value.length, (length) => {
  if (!length) {
    trialSummaryAttempt.value = 0;
    return;
  }
  if (trialSummaryAttempt.value < 1 || trialSummaryAttempt.value > length) {
    trialSummaryAttempt.value = length;
  }
});

const currentTrialRound = computed(() => {
  const index = Math.min(Math.max(trialSummaryAttempt.value, 1), trialGradingRounds.value.length);
  const round = trialGradingRounds.value[index - 1];
  return round ? { round, roundIndex: index } : null;
});

const trialRoundIdMap = computed(() => buildRoundIdMap(trialGradingRounds.value));

const getTrialRecordForSummary = (studentNo: string, questionNo: string) => {
  const roundIndex = trialSummaryAttempt.value || trialGradingRounds.value.length;
  const carried = getRecordsCarriedToRound(getTrialRecords(studentNo, questionNo), trialRoundIdMap.value, roundIndex);
  return mergeRecordsBySum(carried);
};

const roundActionLoading = ref(false);

type RoundMode = 'trial' | 'formal';

const roundsByMode = (mode: RoundMode) => (mode === 'trial' ? trialGradingRounds.value : formalGradingRounds.value);

const currentRoundByMode = (mode: RoundMode) => (mode === 'trial' ? currentTrialRound.value : currentFormalRound.value);

const getRoundRecordIds = (mode: RoundMode, roundIndex: number) => roundsByMode(mode)[roundIndex - 1]?.records.map((record) => record.record_id) || [];

// 乐观更新轮次备注/星标：先本地写入让界面即时响应，请求失败时回滚，无需全量刷新评分记录
const applyRoundUpdateOptimistic = async (recordIds: number[], data: { note?: string | null; starred?: boolean }) => {
  const localPackageId = localPackage.value?.local_package_id || packageId.value;
  if (!localPackageId || !recordIds.length) return false;
  const idSet = new Set(recordIds);
  const targetRecords = gradingRecords.value.filter((record) => idSet.has(record.record_id));
  const previousNotes = targetRecords.map((record) => record.round_note);
  const previousFlags = targetRecords.map((record) => record.round_starred);
  // 与后端保持一致：备注去首尾空白，空字符串存 null
  const nextNote = 'note' in data ? (String(data.note ?? '').trim() || null) : undefined;
  if (nextNote !== undefined) targetRecords.forEach((record) => { record.round_note = nextNote; });
  if ('starred' in data) targetRecords.forEach((record) => { record.round_starred = Boolean(data.starred); });
  roundActionLoading.value = true;
  try {
    await updateLocalGradingRound(String(route.params.subjectId), String(route.params.examId), localPackageId, {
      record_ids: recordIds,
      ...data
    });
    return true;
  } catch (error) {
    targetRecords.forEach((record, index) => {
      record.round_note = previousNotes[index];
      record.round_starred = previousFlags[index];
    });
    console.error('更新评阅轮次失败', error);
    ElMessage.error('更新轮次信息失败');
    return false;
  } finally {
    roundActionLoading.value = false;
  }
};

const toggleRoundStar = async (mode: RoundMode) => {
  const current = currentRoundByMode(mode);
  if (!current) return;
  const ok = await applyRoundUpdateOptimistic(getRoundRecordIds(mode, current.roundIndex), { starred: !current.round.starred });
  if (ok) ElMessage.success(current.round.starred ? '已取消星标' : '已星标');
};

const roundNoteDialogVisible = ref(false);
const roundNoteDraft = ref('');
const roundEditMode = ref<RoundMode>('trial');

const openRoundNoteDialog = (mode: RoundMode) => {
  roundEditMode.value = mode;
  roundNoteDraft.value = currentRoundByMode(mode)?.round.note || '';
  roundNoteDialogVisible.value = true;
};

const saveRoundNote = async () => {
  const mode = roundEditMode.value;
  const current = currentRoundByMode(mode);
  if (!current) return;
  const ok = await applyRoundUpdateOptimistic(getRoundRecordIds(mode, current.roundIndex), { note: roundNoteDraft.value });
  if (ok) {
    roundNoteDialogVisible.value = false;
    ElMessage.success('轮次备注已保存');
  }
};

const roundManageVisible = ref(false);
const roundManageSelection = ref<number[]>([]);

const roundManageRows = computed(() => roundsByMode(roundEditMode.value)
  .map((round, index) => ({ round, roundIndex: index + 1 }))
  .reverse());

const openRoundManageDialog = (mode: RoundMode) => {
  roundEditMode.value = mode;
  roundManageSelection.value = [];
  roundManageVisible.value = true;
};

const deleteRounds = async (roundIndexes: number[]) => {
  const mode = roundEditMode.value;
  if (mode !== 'trial') {
    ElMessage.warning('正式评阅记录不支持删除');
    return;
  }
  if (!roundIndexes.length) {
    ElMessage.warning('请先勾选要删除的轮次');
    return;
  }
  const recordIds = Array.from(new Set(roundIndexes.flatMap((index) => getRoundRecordIds(mode, index))));
  if (!recordIds.length) return;
  try {
    await ElMessageBox.confirm(
      `将删除 ${roundIndexes.length} 个轮次的 ${recordIds.length} 条评分记录，删除后不可恢复。确定删除吗？`,
      '删除评阅轮次',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    );
  } catch {
    return;
  }
  const localPackageId = localPackage.value?.local_package_id || packageId.value;
  if (!localPackageId) return;
  roundActionLoading.value = true;
  try {
    await deleteLocalGradingRecords(String(route.params.subjectId), String(route.params.examId), localPackageId, recordIds);
    await loadGradingRecords();
    roundManageSelection.value = [];
    ElMessage.success('评阅轮次已删除');
  } catch (error) {
    console.error('删除评阅轮次失败', error);
    ElMessage.error('删除评阅轮次失败');
  } finally {
    roundActionLoading.value = false;
  }
};
const getRecordStandardVersionText = (record?: LocalGradingRecordItem | null) => {
  if (!record) return '标准版本 -';
  const standardVersion = positiveVersionNo(record.standard_version_no);
  const questionVersion = getResolvedRecordQuestionVersionNo(record);
  if (standardVersion !== null && questionVersion !== null) return `标准 V${standardVersion} / 本题 V${questionVersion}`;
  if (standardVersion !== null) return `标准 V${standardVersion}`;
  if (questionVersion !== null) return `本题 V${questionVersion}`;
  if (record.standard_id) return `标准 #${record.standard_id}`;
  return '标准版本未记录';
};
const getRecordQuestionVersionText = (record?: LocalGradingRecordItem | null) => {
  const questionVersion = getResolvedRecordQuestionVersionNo(record);
  return questionVersion !== null ? `本题 V${questionVersion}` : '本题版本未记录';
};
const formalScopedRecords = computed(() => {
  const questionNos = new Set(formalQuestionNos.value);
  const studentNos = new Set((localPackage.value?.students || []).map((student) => student.student_no));
  return gradingRecords.value.filter((record) => (
    !record.is_trial
    && recordMatchesQuestionSet(record, questionNos)
    && studentNos.has(record.student_no)
  ));
});
const formalScopedRecordMap = computed(() => {
  // 多服务：同一题按服务分组，每服务取最新后求和合并
  const grouped = new Map<string, LocalGradingRecordItem[]>();
  formalScopedRecords.value.forEach((record) => {
    const key = gradingRecordKey(record.student_no, record.question_no);
    const records = grouped.get(key) || [];
    records.push(record);
    grouped.set(key, records);
  });
  const map = new Map<string, LocalGradingRecordItem>();
  grouped.forEach((records, key) => {
    const merged = mergeRecordsBySum(sortGradingRecords(records));
    if (merged) map.set(key, merged);
  });
  return map;
});

const formalScopedRecordGroupMap = computed(() => {
  const map = new Map<string, LocalGradingRecordItem[]>();
  formalScopedRecords.value.forEach((record) => {
    const key = gradingRecordKey(record.student_no, record.question_no);
    const records = map.get(key) || [];
    records.push(record);
    map.set(key, records);
  });
  map.forEach((records, key) => map.set(key, sortGradingRecords(records)));
  return map;
});

// 1..K = 按时间正数的第 N 轮正式评阅；默认展示最新一轮
const formalSummaryAttempt = ref(0);

watch(formalResultDrawerVisible, (visible) => {
  if (visible) formalSummaryAttempt.value = formalGradingRounds.value.length;
});

const formalGradingRounds = computed(() => buildGradingRounds(formalScopedRecords.value));

// 星标轮次置顶，其余按时间倒序（最新在上）
const formalAttemptOptions = computed(() => {
  const entries = formalGradingRounds.value.map((round, index) => ({ round, roundIndex: index + 1 }));
  const sortDesc = (list: typeof entries) => list.slice().sort((a, b) => b.roundIndex - a.roundIndex);
  return [
    ...sortDesc(entries.filter((item) => item.round.starred)),
    ...sortDesc(entries.filter((item) => !item.round.starred))
  ].map((item) => ({
    value: item.roundIndex,
    label: `第${item.roundIndex}轮｜${item.round.timeText}${item.round.starred ? ' ★' : ''}`
  }));
});

watch(() => formalGradingRounds.value.length, (length) => {
  if (!length) {
    formalSummaryAttempt.value = 0;
    return;
  }
  if (formalSummaryAttempt.value < 1 || formalSummaryAttempt.value > length) {
    formalSummaryAttempt.value = length;
  }
});

const currentFormalRound = computed(() => {
  const index = Math.min(Math.max(formalSummaryAttempt.value, 1), formalGradingRounds.value.length);
  const round = formalGradingRounds.value[index - 1];
  return round ? { round, roundIndex: index } : null;
});

const formalRoundIdMap = computed(() => buildRoundIdMap(formalGradingRounds.value));

const getFormalRecordForSummary = (studentNo: string, questionNo: string) => {
  const roundIndex = formalSummaryAttempt.value || formalGradingRounds.value.length;
  const records = formalScopedRecordGroupMap.value.get(gradingRecordKey(studentNo, questionNo)) || [];
  const carried = getRecordsCarriedToRound(records, formalRoundIdMap.value, roundIndex);
  return mergeRecordsBySum(carried);
};

const trialSummaryRowMap = computed(() => new Map(trialSummaryRows.value.map((row) => [row.student_no, row] as const)));
const formalSummaryRowMap = computed(() => new Map(formalSummaryRows.value.map((row) => [row.student_no, row] as const)));

const trialStudentResults = computed(() => (localPackage.value?.students || []).map((student) => {
  const items = formalQuestionNos.value.flatMap((questionNo) => getTrialRecords(student.student_no, questionNo).map((record, index) => ({
    ...record,
    attemptNo: index + 1,
    standardVersionText: getRecordQuestionVersionText(record)
  })));
  // 与「汇总结果」保持同一取数口径（按当前所选轮次结转），避免两个标签页总分不一致
  const latestItems = formalQuestionNos.value
    .map((questionNo) => getTrialRecordForSummary(student.student_no, questionNo))
    .filter(Boolean) as LocalGradingRecordItem[];
  const totalScore = latestItems.reduce((sum, item) => sum + (numericScore(item.score) || 0), 0);
  const manualTotal = numericScore(student.total_score ?? calculateTotalScore(student.answer_json));
  const diff = manualTotal === null ? null : Number((totalScore - manualTotal).toFixed(2));
  return {
    student_no: student.student_no,
    items,
    attemptCount: items.length,
    totalScore: latestItems.length ? Number(totalScore.toFixed(2)) : '-',
    manualTotal: manualTotal ?? '-',
    diffText: diff === null || !latestItems.length ? '-' : `${diff > 0 ? '+' : ''}${diff}`,
    paperRow: trialSummaryRowMap.value.get(student.student_no) || null
  };
}));

const trialStudentResultTotalPages = computed(() => Math.max(1, Math.ceil(trialStudentResults.value.length / studentResultPageSize)));
const pagedTrialStudentResults = computed(() => {
  const start = (trialStudentResultPage.value - 1) * studentResultPageSize;
  return trialStudentResults.value.slice(start, start + studentResultPageSize);
});

type StudentComparisonQuestion = {
  question_no: string;
  questionText: string;
  record: LocalGradingRecordItem | null;
  attemptCount?: number;
  scoreValue: number | null;
  manualScoreValue: number | null;
  scoreText: string;
  comment: string;
  manualScoreText?: string;
  manualDiffText?: string;
  manualDiffClass?: string;
};

type StudentComparisonRow = {
  student_no: string;
  questionCount: number;
  gradedCount: number;
  completed: boolean;
  statusText: string;
  totalScore: number | string;
  diffText: string;
  questions: StudentComparisonQuestion[];
};

type PaperSummaryQuestion = {
  question_no: string;
  questionText: string;
  answerText: string;
  scoreText: string;
  commentText: string;
  versionText: string;
  maxScore: number;
  record: LocalGradingRecordItem | null;
};

type PaperSummaryRow = {
  student_no: string;
  questionCount: number;
  gradedCount: number;
  totalScore: number | null;
  totalScoreText: number | string;
  maxTotal: number;
  threshold: number;
  thresholdText: number | string;
  abnormal: boolean;
  questions: PaperSummaryQuestion[];
};

const getManualQuestionScore = (student: LocalStudentAnswer, questionNo: string) => numericScore(getQuestionNode(student, questionNo)?.score);

const trialStudentComparisonRows = computed<StudentComparisonRow[]>(() => (localPackage.value?.students || []).map((student) => {
  const questions = formalQuestionNos.value.map((questionNo) => {
    const records = getTrialRecords(student.student_no, questionNo);
    const record = records.slice(-1)[0] || null;
    const scoreValue = numericScore(record?.score);
    const manualScoreValue = getManualQuestionScore(student, questionNo);
    return {
      question_no: questionNo,
      questionText: getDisplayQuestionText(questionNo),
      record,
      attemptCount: records.length,
      scoreValue,
      manualScoreValue,
      scoreText: record ? String(record.score ?? '-') + '/' + String(record.max_score ?? '-') : '未评',
      comment: record?.grading_desc || '暂无评语'
    };
  });
  const gradedQuestions = questions.filter((question) => question.record);
  const totalScore = gradedQuestions.reduce((sum, question) => sum + (question.scoreValue || 0), 0);
  const completed = Boolean(formalQuestionNos.value.length) && gradedQuestions.length === formalQuestionNos.value.length;
  return {
    student_no: student.student_no,
    questionCount: formalQuestionNos.value.length,
    gradedCount: gradedQuestions.length,
    completed,
    statusText: completed ? '已完成' : '已评 ' + gradedQuestions.length + '/' + formalQuestionNos.value.length,
    totalScore: gradedQuestions.length ? Number(totalScore.toFixed(2)) : '-',
    diffText: '-',
    questions
  };
}).filter((student) => student.gradedCount > 0));
const filterStudentComparisonRows = <T extends { student_no: string }>(rows: T[], selectedStudents: string[]) => {
  if (!selectedStudents.length) return rows;
  const selectedSet = new Set(selectedStudents.map((item) => String(item)));
  return rows.filter((row) => selectedSet.has(String(row.student_no)));
};

const paginateStudentComparisonRows = <T,>(rows: T[], page: number, pageSize: number) => {
  const start = (Math.max(1, page) - 1) * pageSize;
  return rows.slice(start, start + pageSize);
};

const formatCompareNumber = (value: number | null) => value === null ? '-' : String(Number(value.toFixed(2)));

const formatAbsoluteCompareDiff = (value: number | null) => value === null ? '-' : formatCompareNumber(Math.abs(value));

const getCompareDiffClass = (value: number | null) => {
  if (value === null || value === 0) return 'peer-diff-neutral';
  return 'peer-diff-negative';
};

const decorateStudentComparisonRows = (pageRows: StudentComparisonRow[], _scopeRows: StudentComparisonRow[]) => pageRows.map((row) => {
  let maxManualAbsDiff: number | null = null;
  const questions = row.questions.map((question) => {
    const manualDiff = question.scoreValue !== null && question.manualScoreValue !== null
      ? Number((question.scoreValue - question.manualScoreValue).toFixed(2))
      : null;
    if (manualDiff !== null) maxManualAbsDiff = Math.max(maxManualAbsDiff ?? 0, Math.abs(manualDiff));
    return {
      ...question,
      manualScoreText: formatCompareNumber(question.manualScoreValue),
      manualDiffText: formatAbsoluteCompareDiff(manualDiff),
      manualDiffClass: getCompareDiffClass(manualDiff)
    };
  });
  return {
    ...row,
    diffText: formatCompareNumber(maxManualAbsDiff),
    questions
  };
});

const filteredTrialStudentComparisonRows = computed(() => filterStudentComparisonRows(trialStudentComparisonRows.value, trialStudentCompareStudent.value ? [trialStudentCompareStudent.value] : []));
const trialStudentComparePageSize = computed(() => studentCompareDefaultPageSize);
const trialStudentComparePageHint = computed(() => '每页 1 位');
const trialStudentCompareTotalPages = computed(() => Math.max(1, Math.ceil(filteredTrialStudentComparisonRows.value.length / trialStudentComparePageSize.value)));
const pagedTrialStudentComparisonRows = computed(() => decorateStudentComparisonRows(
  paginateStudentComparisonRows(filteredTrialStudentComparisonRows.value, trialStudentComparePage.value, trialStudentComparePageSize.value),
  filteredTrialStudentComparisonRows.value
));

const trialStats = computed(() => {
  const scores = trialScopedRecords.value.map((item) => numericScore(item.score)).filter((score): score is number => score !== null);
  const avg = scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)) : '-';
  return {
    studentCount: localPackage.value?.students.length || 0,
    totalTargets: formalTotalTargets.value,
    gradedCount: trialScopedRecords.value.length,
    avgScore: avg,
    maxScore: scores.length ? Math.max(...scores) : '-',
    minScore: scores.length ? Math.min(...scores) : '-'
  };
});

const REVIEW_EXCEPTION_THRESHOLD_SCORE = 10;

const getDisplayQuestionText = (questionNo: string) => {
  const fromTemplate = templateQuestionRows.value.find((row) => questionNoMatches(row.question_no, questionNo))?.question_text;
  if (fromTemplate) return fromTemplate;
  const firstStudent = localPackage.value?.students?.[0];
  return firstStudent ? (getQuestionNode(firstStudent, questionNo)?.question || '') : '';
};

const formatStatNumber = (value: number | null) => value === null ? '-' : Number(value.toFixed(2));

const getQuestionMaxScoreFallback = (student: LocalStudentAnswer, questionNo: string, record?: LocalGradingRecordItem | null) => {
  return numericScore(record?.max_score) ?? getQuestionMaxScore(student, questionNo) ?? 0;
};

const getStudentAnswerForQuestion = (student: LocalStudentAnswer, questionNo: string) => {
  return getQuestionAnswerText(getQuestionNode(student, questionNo)).trim();
};

const getLatestTrialRecordsForQuestion = (questionNo: string) => (localPackage.value?.students || [])
  .map((student) => getLatestTrialRecord(student.student_no, questionNo))
  .filter(Boolean) as LocalGradingRecordItem[];

const buildQuestionStat = (questionNo: string, records: LocalGradingRecordItem[], attemptCount?: number) => {
  const scores = records
    .map((record) => numericScore(record.score))
    .filter((score): score is number => score !== null);
  const avg = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const max = scores.length ? Math.max(...scores) : null;
  const min = scores.length ? Math.min(...scores) : null;
  return {
    question_no: questionNo,
    questionText: getDisplayQuestionText(questionNo),
    paperCount: localPackage.value?.students.length || 0,
    count: scores.length,
    attemptCount: attemptCount ?? records.length,
    avgScore: formatStatNumber(avg),
    maxScore: formatStatNumber(max),
    minScore: formatStatNumber(min),
    spread: scores.length && max !== null && min !== null ? Number((max - min).toFixed(2)) : '-'
  };
};

const trialQuestionStats = computed(() => formalQuestionNos.value.map((questionNo) => {
  const latestRecords = getLatestTrialRecordsForQuestion(questionNo);
  const attemptCount = trialScopedRecords.value.filter((record) => questionNoMatches(record.question_no, questionNo)).length;
  return buildQuestionStat(questionNo, latestRecords, attemptCount);
}));

const formalStudentResults = computed(() => (localPackage.value?.students || []).map((student) => {
  // 与「汇总结果」保持同一取数口径（按当前所选轮次结转），避免两个标签页总分不一致
  const items = (formalQuestionNos.value
    .map((questionNo) => getFormalRecordForSummary(student.student_no, questionNo))
    .filter(Boolean) as LocalGradingRecordItem[])
    .map((item) => ({ ...item, standardVersionText: getRecordStandardVersionText(item) }));
  const totalScore = items.reduce((sum, item) => sum + (numericScore(item.score) || 0), 0);
  const manualTotal = numericScore(student.total_score ?? calculateTotalScore(student.answer_json));
  const diff = manualTotal === null ? null : Number((totalScore - manualTotal).toFixed(2));
  return {
    student_no: student.student_no,
    items,
    totalScore: Number(totalScore.toFixed(2)),
    manualTotal: manualTotal ?? '-',
    diffText: diff === null ? '-' : `${diff > 0 ? '+' : ''}${diff}`,
    paperRow: formalSummaryRowMap.value.get(student.student_no) || null
  };
}));

const formalStudentResultTotalPages = computed(() => Math.max(1, Math.ceil(formalStudentResults.value.length / studentResultPageSize)));
const pagedFormalStudentResults = computed(() => {
  const start = (formalStudentResultPage.value - 1) * studentResultPageSize;
  return formalStudentResults.value.slice(start, start + studentResultPageSize);
});

watch(trialStudentResults, () => {
  if (trialStudentResultPage.value > trialStudentResultTotalPages.value) {
    trialStudentResultPage.value = trialStudentResultTotalPages.value;
  }
});

watch(formalStudentResults, () => {
  if (formalStudentResultPage.value > formalStudentResultTotalPages.value) {
    formalStudentResultPage.value = formalStudentResultTotalPages.value;
  }
});

const buildPaperSummaryRows = (
  getRecord: (studentNo: string, questionNo: string) => LocalGradingRecordItem | null,
  getVersionText: (record?: LocalGradingRecordItem | null) => string
): PaperSummaryRow[] => (localPackage.value?.students || []).map((student) => {
  const questions = formalQuestionNos.value.map((questionNo) => {
    const record = getRecord(student.student_no, questionNo);
    const score = numericScore(record?.score);
    const maxScore = getQuestionMaxScoreFallback(student, questionNo, record);
    return {
      question_no: questionNo,
      questionText: getDisplayQuestionText(questionNo),
      answerText: getStudentAnswerForQuestion(student, questionNo),
      scoreText: record ? `${score ?? '-'}/${maxScore || '-'}` : '未评',
      commentText: record?.grading_desc || '暂无评分说明',
      versionText: record ? getVersionText(record) : '未评',
      maxScore,
      record
    };
  });
  const records = formalQuestionNos.value
    .map((questionNo) => getRecord(student.student_no, questionNo))
    .filter(Boolean) as LocalGradingRecordItem[];
  const totalScore = records.length
    ? Number(records.reduce((sum, record) => sum + (numericScore(record.score) || 0), 0).toFixed(2))
    : null;
  const maxTotal = formalQuestionNos.value.reduce((sum, questionNo) => sum + getQuestionMaxScoreFallback(student, questionNo, getRecord(student.student_no, questionNo)), 0);
  const threshold = REVIEW_EXCEPTION_THRESHOLD_SCORE;
  const fullyGraded = Boolean(formalQuestionNos.value.length) && records.length === formalQuestionNos.value.length;
  const abnormal = fullyGraded && totalScore !== null && (totalScore === 0 || totalScore < threshold);
  return {
    student_no: student.student_no,
    questionCount: formalQuestionNos.value.length,
    gradedCount: records.length,
    totalScore,
    totalScoreText: totalScore ?? '未完成',
    maxTotal,
    threshold,
    thresholdText: threshold,
    abnormal,
    questions
  };
});

const buildPaperSummaryStats = (rows: PaperSummaryRow[]) => {
  const completedRows = rows.filter((row) => row.gradedCount === row.questionCount && row.totalScore !== null);
  const scores = completedRows.map((row) => row.totalScore).filter((score): score is number => score !== null);
  const avg = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  return {
    paperCount: completedRows.length,
    maxScore: formatStatNumber(scores.length ? Math.max(...scores) : null),
    minScore: formatStatNumber(scores.length ? Math.min(...scores) : null),
    avgScore: formatStatNumber(avg),
    abnormalCount: rows.filter((row) => row.abnormal).length
  };
};

const trialSummaryRows = computed(() => buildPaperSummaryRows(
  getTrialRecordForSummary,
  getRecordQuestionVersionText
));

const formalSummaryRows = computed(() => buildPaperSummaryRows(
  getFormalRecordForSummary,
  getRecordQuestionVersionText
));

const trialSummaryStats = computed(() => buildPaperSummaryStats(trialSummaryRows.value));
const formalSummaryStats = computed(() => buildPaperSummaryStats(formalSummaryRows.value));

const formalStudentComparisonRows = computed<StudentComparisonRow[]>(() => (localPackage.value?.students || []).map((student) => {
  const questions = formalQuestionNos.value.map((questionNo) => {
    const record = formalScopedRecordMap.value.get(gradingRecordKey(student.student_no, questionNo)) || null;
    const scoreValue = numericScore(record?.score);
    const manualScoreValue = getManualQuestionScore(student, questionNo);
    return {
      question_no: questionNo,
      questionText: getDisplayQuestionText(questionNo),
      record,
      scoreValue,
      manualScoreValue,
      scoreText: record ? String(record.score ?? '-') + '/' + String(record.max_score ?? '-') : '未评',
      comment: record?.grading_desc || '暂无评语'
    };
  });
  const gradedQuestions = questions.filter((question) => question.record);
  const totalScore = gradedQuestions.reduce((sum, question) => sum + (question.scoreValue || 0), 0);
  const completed = Boolean(formalQuestionNos.value.length) && gradedQuestions.length === formalQuestionNos.value.length;
  return {
    student_no: student.student_no,
    questionCount: formalQuestionNos.value.length,
    gradedCount: gradedQuestions.length,
    completed,
    statusText: completed ? '已完成' : '已评 ' + gradedQuestions.length + '/' + formalQuestionNos.value.length,
    totalScore: gradedQuestions.length ? Number(totalScore.toFixed(2)) : '-',
    diffText: '-',
    questions
  };
}).filter((student) => student.gradedCount > 0));

const filteredFormalStudentComparisonRows = computed(() => filterStudentComparisonRows(formalStudentComparisonRows.value, formalStudentCompareStudents.value));
const formalStudentComparePageSize = computed(() => studentCompareDefaultPageSize);
const formalStudentCompareTotalPages = computed(() => Math.max(1, Math.ceil(filteredFormalStudentComparisonRows.value.length / formalStudentComparePageSize.value)));

watch(trialStudentCompareStudent, () => {
  trialStudentComparePage.value = 1;
});

watch(formalStudentCompareStudents, () => {
  formalStudentComparePage.value = 1;
});

watch(filteredTrialStudentComparisonRows, () => {
  if (trialStudentComparePage.value > trialStudentCompareTotalPages.value) trialStudentComparePage.value = trialStudentCompareTotalPages.value;
});

watch(filteredFormalStudentComparisonRows, () => {
  if (formalStudentComparePage.value > formalStudentCompareTotalPages.value) formalStudentComparePage.value = formalStudentCompareTotalPages.value;
});


const formalStats = computed(() => {
  const scores = formalScopedRecords.value.map((item) => numericScore(item.score)).filter((score): score is number => score !== null);
  const avg = scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)) : '-';
  return {
    studentCount: localPackage.value?.students.length || 0,
    totalTargets: formalTotalTargets.value,
    gradedCount: formalScopedRecords.value.length,
    avgScore: avg,
    maxScore: scores.length ? Math.max(...scores) : '-',
    minScore: scores.length ? Math.min(...scores) : '-'
  };
});

const formalQuestionStats = computed(() => formalQuestionNos.value.map((questionNo) => {
  const records = (localPackage.value?.students || [])
    .map((student) => formalScopedRecordMap.value.get(gradingRecordKey(student.student_no, questionNo)))
    .filter(Boolean) as LocalGradingRecordItem[];
  return buildQuestionStat(questionNo, records);
}));

const getCompletePaperRecords = (
  getRecords: (student: LocalStudentAnswer) => LocalGradingRecordItem[]
) => (localPackage.value?.students || []).map((student) => {
  const requiredQuestionNos = formalQuestionNos.value;
  const records = getRecords(student);
  if (!requiredQuestionNos.length || !records.length) return { student, records: [] as LocalGradingRecordItem[] };
  const completed = requiredQuestionNos.every((questionNo) => (
    records.some((record) => questionNoMatches(record.question_no, questionNo))
  ));
  return { student, records: completed ? records : [] as LocalGradingRecordItem[] };
});

const completeTrialPaperRecords = computed(() => getCompletePaperRecords((student) => formalQuestionNos.value
  .map((questionNo) => getLatestTrialRecord(student.student_no, questionNo))
  .filter(Boolean) as LocalGradingRecordItem[]));

const completeFormalPaperRecords = computed(() => getCompletePaperRecords((student) => formalQuestionNos.value
  .map((questionNo) => formalScopedRecordMap.value.get(gradingRecordKey(student.student_no, questionNo)))
  .filter(Boolean) as LocalGradingRecordItem[]));

const buildAbnormalPapers = (paperRecords: Array<{ student: LocalStudentAnswer; records: LocalGradingRecordItem[] }>) => paperRecords.flatMap(({ student, records }) => {
  if (!records.length) return [];
  const questionNos = records.map((record) => record.question_no).filter(Boolean);
  const totalScore = records.reduce((sum, record) => sum + (numericScore(record.score) || 0), 0);
  const threshold = REVIEW_EXCEPTION_THRESHOLD_SCORE;
  const isAbnormal = totalScore === 0 || totalScore < threshold;
  if (!isAbnormal) return [];
  return [{
    key: `${student.student_no}__${questionNos.join('_')}`,
    student_no: student.student_no,
    scoreText: Number(totalScore.toFixed(2)),
    thresholdText: threshold,
    questionCount: records.length
  }];
});

const trialAbnormalPapers = computed(() => buildAbnormalPapers(completeTrialPaperRecords.value));

const formalAbnormalPapers = computed(() => buildAbnormalPapers(completeFormalPaperRecords.value));

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closePreview();
};

</script>

<style scoped>
.package-detail-page {
  padding: 20px;
}

/* 试阅/正式结果独立页面（替代原抽屉展示） */
.result-page-panel {
  background: #fff;
  border-radius: 10px;
  padding: 16px 20px 24px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
}

.result-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.result-page-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}


.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.header-actions,
.viewer-toolbar,
.pagination-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.viewer-toolbar {
  margin-bottom: 18px;
}

.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
}

.paper-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-left: 8px;
}

.paper-student-select {
  width: 260px;
}

.paper-range-select {
  width: 150px;
}

.paper-range-sep {
  color: #64748b;
  font-size: 13px;
  white-space: nowrap;
}

.selected-count {
  color: #dc2626;
  font-size: 13px;
  font-weight: 600;
}

.paper-selected-count {
  color: #475569;
  font-size: 13px;
  white-space: nowrap;
}

.page-info {
  min-width: 80px;
  color: #606266;
  text-align: center;
}

.answer-search {
  width: 260px;
  margin-left: auto;
}

.answer-search :deep(.el-input__wrapper) {
  border-radius: 999px;
}

.answer-viewer {
  min-height: 320px;
}



.student-card {
  position: relative;
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #ffffff;
}

.student-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.student-title {
  color: #111827;
  font-size: 16px;
}

.score-text,
.score-note {
  color: #dc2626;
}

.score-text {
  margin-left: 8px;
}

.meta-text {
  margin-top: 4px;
  color: #606266;
  font-size: 13px;
}

.question-block {
  padding: 10px 0;
  border-top: 1px dashed #e6eef8;
}

.question-block summary {
  cursor: pointer;
  outline: none;
}

.review-status-tag {
  margin-left: 8px;
  vertical-align: middle;
}

.sub-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.question-tag {
  display: inline-block;
  margin-right: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 12px;
}

.score-note {
  margin-top: 4px;
  line-height: 1.5;
}

.manual-score-block {
  color: #dc2626;
}


.question-content {
  padding-top: 8px;
}

.question-title,
.sub-title {
  font-weight: 600;
}

.answer-text {
  margin-top: 6px;
  white-space: pre-wrap;
}

.sub-score-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin-top: 8px;
  color: #606266;
  font-size: 13px;
  line-height: 1.5;
}

.sub-score-summary span:first-child {
  color: #dc2626;
  font-weight: 600;
}

.topic-score-summary {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #ebeef5;
  color: #b91c1c;
  font-size: 14px;
  text-align: right;
}

.topic-review-actions {
  display: inline-flex;
  gap: 8px;
}

.topic-select-check {
  margin-right: auto;
}

.trial-attempt-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.trial-attempt-label {
  font-size: 13px;
  color: #475569;
}

.trial-attempt-select {
  width: 230px;
}

.trial-attempt-hint {
  font-size: 12px;
  color: #94a3b8;
}

.trial-attempt-static {
  font-size: 13px;
  color: #475569;
}

.trial-attempt-bar .trial-round-star-btn,
.trial-attempt-bar .trial-round-note-btn,
.trial-attempt-bar .trial-round-clean-btn {
  font-weight: 600;
}

.trial-attempt-bar .trial-round-star-btn {
  color: #b45309;
}

.trial-attempt-bar .trial-round-star-btn.is-starred {
  color: #92400e;
}

.trial-attempt-bar .trial-round-note-btn {
  color: #334155;
}

.trial-attempt-bar .trial-round-clean-btn {
  color: #dc2626;
}

.trial-snapshot-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
  font-size: 13px;
  color: #475569;
}

.trial-snapshot-bar strong {
  color: #0f172a;
}

.rich-image-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.rich-image-content .answer-text,
.rich-image-content .question-title {
  width: 100%;
}

.embedded-thumb {
  display: block;
  margin-top: 4px;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.thumb {
  width: 120px;
  height: 80px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  object-fit: cover;
  cursor: pointer;
}

.image-missing {
  color: #909399;
  font-size: 12px;
}

.sub-question {
  position: relative;
  padding: 10px 0;
}

.sub-question-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

.batch-check {
  margin-right: auto;
}

.batch-check :deep(.el-checkbox__label) {
  color: #374151;
  font-size: 13px;
}

.paper-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}


.standard-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  color: #606266;
  font-size: 13px;
}

.standard-meta-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex-wrap: wrap;
}

.standard-version-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.version-count {
  color: #909399;
  font-size: 12px;
}

.standard-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.standard-list {
  max-height: 58vh;
  overflow-y: auto;
  padding-right: 4px;
}

.standard-major-service-list {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.standard-major-service-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: #f8fbff;
}

.standard-major-service-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.standard-major-service-main span {
  color: #64748b;
  font-size: 13px;
}

.standard-major-service-select {
  width: min(460px, 52%);
  min-width: 320px;
}

.standard-item {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #ffffff;
}

.standard-item-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.standard-item-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.standard-question-text {
  color: #606266;
  font-size: 13px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.standard-version-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  min-width: 220px;
}

.standard-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 14px;
}

.standard-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.standard-form :deep(.standard-form-grid .el-form-item) {
  margin-bottom: 0;
}

.full-width {
  width: 100%;
}

.template-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.template-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 6px 0 12px;
  color: #606266;
  font-size: 13px;
}

.template-table {
  width: 100%;
}

.template-standard-select :deep(.el-input__inner) {
  text-overflow: ellipsis;
}

.template-standard-select-dropdown {
  max-width: min(760px, 86vw);
}

.template-standard-select-dropdown .el-select-dropdown__item {
  height: auto;
  min-height: 74px;
  padding: 8px 12px;
  line-height: 1.4;
  white-space: normal;
}

.template-standard-option {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.template-standard-option-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.template-standard-version,
.template-standard-type {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.template-standard-version {
  background: #ecf5ff;
  color: #1d4ed8;
}

.template-standard-type {
  background: #f4f4f5;
  color: #374151;
}

.template-standard-criteria {
  color: #303133;
  font-size: 13px;
  line-height: 1.45;
  white-space: normal;
  word-break: break-word;
}
.template-history {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.template-history-title {
  margin-bottom: 8px;
  color: #303133;
  font-weight: 600;
}

.template-history-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px 70px;
  gap: 8px;
  padding: 7px 0;
  color: #606266;
  font-size: 13px;
}

.template-history-item strong {
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grading-template-dialog :deep(.el-dialog__body) {
  padding-top: 12px;
}
.grading-standard-dialog :deep(.el-dialog__body) {
  padding-top: 12px;
}
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
}

.lightbox-image {
  max-width: 92vw;
  max-height: 92vh;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

.lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: #ef4444;
  color: #ffffff;
  cursor: pointer;
}


.formal-overview {
  margin-bottom: 16px;
  padding: 14px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
}


.formal-subtitle,
.formal-section-desc {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}

.formal-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}


.evidence-card,
.analysis-card {
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}


.formal-results-panel,
.trial-results-panel {
  min-height: 100%;
  margin-bottom: 0;
  padding: 18px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

:deep(.trial-result-drawer .el-drawer__header),
:deep(.formal-result-drawer .el-drawer__header) {
  margin-bottom: 0;
  padding: 16px 22px;
  border-bottom: 1px solid #e5e7eb;
  color: #111827;
  font-weight: 700;
}

:deep(.trial-result-drawer .el-drawer__body),
:deep(.formal-result-drawer .el-drawer__body) {
  padding: 16px 22px 22px;
  background: #f5f7fb;
}

.result-tabs {
  min-width: 0;
}

.result-tabs :deep(.el-radio-group) {
  position: sticky;
  top: 0;
  z-index: 2;
  margin: 0 0 16px;
  padding: 12px 0 10px;
  background: #ffffff;
}

.result-tab-content {
  min-width: 0;
}

.result-tab-pane {
  min-width: 0;
}

:deep(.trial-result-drawer .el-table),
:deep(.formal-result-drawer .el-table) {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

:deep(.trial-result-drawer .el-table th.el-table__cell),
:deep(.formal-result-drawer .el-table th.el-table__cell) {
  background: #f8fafc;
  color: #334155;
  font-weight: 700;
}

:deep(.trial-result-drawer .el-table td.el-table__cell),
:deep(.formal-result-drawer .el-table td.el-table__cell) {
  vertical-align: top;
}

:deep(.trial-result-drawer .el-empty),
:deep(.formal-result-drawer .el-empty) {
  padding: 34px 0;
}

.formal-section-head,
.trial-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -2px 0 14px;
  padding: 14px 16px;
  border: 1px solid #e0e7ff;
  border-radius: 8px;
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
}

.formal-section-title,
.trial-section-title {
  color: #111827;
  font-size: 17px;
  font-weight: 700;
}

.trial-section-desc,
.formal-section-desc {
  max-width: 720px;
  line-height: 1.6;
}

.formal-table,
.trial-table {
  width: 100%;
}

.score-matrix-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 76px;
}

.score-matrix-cell strong {
  color: #111827;
  font-size: 13px;
  font-weight: 700;
}

.score-matrix-cell span {
  overflow: hidden;
  color: #64748b;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.student-result-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.student-compare-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.student-compare-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.student-compare-search {
  max-width: 380px;
}

.student-compare-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  color: #64748b;
  font-size: 13px;
}

.student-compare-pager :deep(.el-button) {
  border-color: #dbe3ef;
  background: #ffffff;
}

.student-compare-page {
  min-width: 58px;
  padding: 3px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #111827;
  text-align: center;
  font-weight: 600;
}

.student-compare-card {
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
}

.student-compare-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eef2f7;
}

.student-compare-title {
  color: #111827;
  font-size: 16px;
  font-weight: 700;
}

.student-compare-meta {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}

.student-compare-badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.student-question-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 12px;
}

.student-question-card {
  min-height: 156px;
  padding: 12px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #fbfdff;
}

.student-question-card.is-empty {
  border-color: #e5e7eb;
  background: #f8fafc;
  color: #94a3b8;
}

.student-question-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.student-question-top strong {
  color: #111827;
  font-size: 15px;
}

.student-question-name {
  display: -webkit-box;
  min-height: 38px;
  margin-top: 8px;
  overflow: hidden;
  color: #374151;
  font-size: 13px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.student-question-meta {
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
}

.student-question-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
}

.student-question-metrics span {
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.student-question-metrics small,
.student-question-metrics b {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.student-question-metrics small {
  color: #64748b;
  font-size: 11px;
}

.student-question-metrics b {
  margin-top: 2px;
  color: #111827;
  font-size: 13px;
}

.peer-diff-positive {
  color: #047857 !important;
}

.peer-diff-negative {
  color: #b91c1c !important;
}

.peer-diff-neutral {
  color: #475569 !important;
}

.student-question-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

.student-comment-button {
  min-width: 54px;
  padding: 4px 10px;
  border-radius: 6px;
  background: #eef6ff;
  font-weight: 600;
}

.student-comment-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
}

.student-comment-dialog-body {
  max-height: 48vh;
  overflow: auto;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
  color: #1f2937;
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.student-result-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  color: #374151;
  font-size: 13px;
  line-height: 1.6;
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.03);
}

.student-result-item.is-compact {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
}

.student-result-item.is-compact .student-comment-button {
  justify-self: end;
}

.result-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.result-item-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.result-score {
  flex: 0 0 auto;
  padding: 3px 9px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  font-size: 13px;
  font-weight: 700;
}

.standard-version-tag {
  padding: 2px 7px;
  border-radius: 999px;
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}
.result-item-meta {
  color: #64748b;
  font-size: 12px;
}

.result-comment {
  padding-top: 10px;
  border-top: 1px dashed #dbe3ef;
  color: #1f2937;
  white-space: pre-wrap;
  word-break: break-word;
}

.trial-attempt-item {
  border-color: #dbeafe;
  background: #fbfdff;
}

.formal-result-item {
  background: #ffffff;
}

.attempt-tag {
  padding: 2px 7px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
}
.analysis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.summary-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-overview-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.summary-stat-card {
  padding: 12px 14px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
}

.summary-stat-label {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.summary-stat-value {
  display: block;
  margin-top: 4px;
  color: #111827;
  font-size: 22px;
  font-weight: 700;
}

.summary-section {
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.summary-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.summary-section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.student-result-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.summary-section-title {
  color: #111827;
  font-size: 15px;
  font-weight: 700;
}

.summary-section-desc {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.summary-paper-list {
  display: flex;
  flex-direction: column;
}

.summary-paper-row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) auto auto;
  align-items: center;
  gap: 22px;
  width: 100%;
  min-height: 54px;
  padding: 12px 2px;
  border: 0;
  border-bottom: 1px solid #eef2f7;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.summary-paper-row:last-child {
  border-bottom: 0;
}

.summary-paper-row:hover {
  background: #f8fafc;
}

.summary-paper-id {
  overflow: hidden;
  color: #111827;
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-paper-inline-meta,
.summary-paper-badges {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #64748b;
  font-size: 12px;
}

.summary-paper-inline-meta strong {
  color: #111827;
  font-size: 13px;
}

.summary-paper-badges {
  justify-content: flex-end;
}

.summary-paper-arrow {
  color: #94a3b8;
  font-size: 16px;
}

:deep(.paper-summary-detail-drawer .el-drawer__header) {
  margin-bottom: 0;
  padding: 18px 22px;
  border-bottom: 1px solid #e5e7eb;
}

:deep(.paper-summary-detail-drawer .el-drawer__body) {
  padding: 0;
  background: #f8fafc;
}

.paper-summary-detail-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
}

.paper-summary-detail-head,
.paper-summary-detail-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.paper-summary-detail-head {
  padding: 16px 18px;
}

.paper-summary-detail-title {
  color: #111827;
  font-size: 20px;
  font-weight: 700;
}

.paper-summary-detail-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  color: #64748b;
  font-size: 13px;
}

.paper-summary-detail-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.paper-summary-detail-item {
  padding: 14px;
}

.paper-summary-detail-item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #dbe3ef;
}

.paper-summary-detail-question {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.paper-summary-detail-question strong {
  color: #111827;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

.paper-summary-detail-grid {
  display: grid;
  grid-template-columns: minmax(220px, 1.25fr) minmax(120px, 0.55fr) minmax(240px, 1.4fr);
  gap: 10px;
  margin-top: 12px;
}

.paper-summary-review-action {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.manual-review-form {
  margin-top: 18px;
}

.manual-review-max {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
}

.paper-summary-detail-block {
  min-width: 0;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.paper-summary-detail-block span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.paper-summary-detail-block p {
  margin: 4px 0 0;
  color: #111827;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.analysis-card {
  padding: 14px;
  border-color: #e5e7eb;
  background: #ffffff;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
}

.analysis-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.analysis-card-head {
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid #eef2f7;
}

.analysis-card-title {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.analysis-card-title strong {
  color: #111827;
  line-height: 1.5;
}

.analysis-average {
  flex: 0 0 auto;
  padding: 3px 9px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  font-size: 12px;
  font-weight: 700;
}

.analysis-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.analysis-metric {
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.analysis-metric span,
.analysis-footnote {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.analysis-metric b {
  display: block;
  margin-top: 4px;
  color: #111827;
  font-size: 16px;
}

@media (max-width: 1280px) {
  .summary-overview-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .summary-overview-grid,
  .paper-summary-detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .summary-overview-grid,
  .paper-summary-detail-grid {
    grid-template-columns: 1fr;
  }
  .summary-paper-row {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 12px 0;
  }
  .summary-paper-badges {
    justify-content: flex-start;
  }
  .paper-summary-detail-item-head {
    flex-direction: column;
  }
}

.analysis-footnote {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e5e7eb;
}

.exception-panel {
  margin-top: 0;
  padding: 14px;
  border: 1px solid #fde68a;
  border-radius: 8px;
  background: #fffbeb;
}

.exception-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.exception-title {
  color: #92400e;
  font-weight: 700;
}

.exception-desc,
.exception-item-meta {
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.exception-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.exception-item {
  padding: 12px 14px;
  border: 1px solid #fde68a;
  border-radius: 8px;
  background: #ffffff;
}

.exception-item-main,
.exception-item-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
}

.exception-item-main strong {
  color: #111827;
}

.formal-form {
  margin-top: 14px;
}

.formal-preview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  background: #f8fafc;
  color: #374151;
  font-size: 13px;
}

@media (max-width: 760px) {
  .viewer-toolbar,
  .student-header {
    align-items: stretch;
    flex-direction: column;
  }

  .batch-toolbar {
    align-items: stretch;
    flex-direction: column;
    margin-left: 0;
  }

  .paper-toolbar {
    align-items: stretch;
    flex-direction: column;
    margin-left: 0;
  }

  .paper-student-select {
    width: 100%;
  }

  .paper-range-select {
    width: 100%;
  }

  .answer-search {
    width: 100%;
    margin-left: 0;
  }

  .student-compare-toolbar,
  .student-compare-head,
  .formal-section-head,
  .trial-section-head {
    align-items: stretch;
    flex-direction: column;
  }

  .student-compare-search {
    max-width: none;
  }


  .student-result-item.is-compact {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .student-result-item.is-compact .result-score,
  .student-result-item.is-compact .student-comment-button {
    justify-self: start;
  }

  .student-compare-pager,
  .student-compare-badges {
    justify-content: flex-start;
  }

  .analysis-grid,
  .analysis-metrics {
    grid-template-columns: 1fr;
  }
}

.grading-embed-frame {
  position: fixed;
  left: -10000px;
  top: 0;
  width: 1px;
  height: 1px;
  border: 0;
  opacity: 0;
  pointer-events: none;
}

.grading-embed-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
}

.grading-embed-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 28px 42px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
}

.grading-embed-spinner {
  width: 34px;
  height: 34px;
  border: 3px solid #dbeafe;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: grading-embed-spin 0.8s linear infinite;
}

.grading-embed-text {
  font-size: 14px;
  color: #1f2937;
}

@keyframes grading-embed-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>


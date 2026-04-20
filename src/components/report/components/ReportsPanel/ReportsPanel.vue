<script setup lang="ts">
import MoodTrendChart from '../MoodTrendChart/MoodTrendChart.vue'
import TagCloudView from '../TagCloudView/TagCloudView.vue'
import type {
  RangeReport,
  ReportHeatmapPoint,
  ReportLocationPatternsSection,
  ReportMoodPoint,
  ReportStatsSection,
  ReportTagCloudItem,
  ReportTimePatternsSection,
} from '../../../../types/dairy'
import { useReportsPanelView } from '../../composables/useReportsPanelView'

const props = defineProps<{
  workspacePath: string | null
  hasWorkspace: boolean
  emptyStateTitle: string
  emptyStateDescription: string
  activeReport: RangeReport | null
  isLoadingReport: boolean
  activeStats: ReportStatsSection | null
  activeHeatmapPoints: ReportHeatmapPoint[]
  activeMoodPoints: ReportMoodPoint[]
  activeTagItems: ReportTagCloudItem[]
  activeLocationPatterns: ReportLocationPatternsSection | null
  activeTimePatterns: ReportTimePatternsSection | null
}>()

const {
  MAX_EXPORT_DOCUMENT_WIDTH,
  MAX_EXPORT_IMAGE_SCALE,
  MIN_EXPORT_DOCUMENT_WIDTH,
  MIN_EXPORT_IMAGE_SCALE,
  activeSummaryGroups,
  buildTimeAnchorTitle,
  canOpenExportDialog,
  canStartExport,
  closeExportDialog,
  exportDialogMessage,
  exportSectionOptions,
  formatPreset,
  getMaxWordsInOneDay,
  getPatternCount,
  getPatternListClass,
  getRankingFillWidth,
  getSummaryItemKey,
  handleExportReport,
  heatmapCells,
  heatmapMonthLabels,
  heatmapScrollerRef,
  heatmapSizingStyle,
  heatmapWeekdayLabels,
  isExportDialogVisible,
  isExportSectionAvailable,
  isExportSectionSelected,
  isExporting,
  openExportDialog,
  selectedExportDocumentWidth,
  selectedExportImageScale,
  stepExportDocumentWidth,
  stepExportImageScale,
  toggleExportSection,
  visibleLocationRanking,
  visibleTimeBuckets,
} = useReportsPanelView(props)
</script>

<template>
  <section v-if="!hasWorkspace" class="report-empty-state">
    <h2>请先选择一个工作区</h2>
    <p>区间总结会扫描工作区里的日记文件，并把结果缓存到 `reports/` 目录。</p>
  </section>

  <section v-else class="reports-panel">
    <header class="reports-header">
      <div class="reports-heading">
        <p class="reports-kicker">Reports</p>
        <h2 class="reports-title">总结报告</h2>
        <p class="reports-description">这段时间你过得怎么样呢</p>
      </div>

      <div class="reports-actions">
        <button
          class="report-export-button"
          type="button"
          :disabled="!canOpenExportDialog"
          @click="openExportDialog"
        >
          导出 PNG
        </button>
      </div>
    </header>

    <section class="report-content">
      <div v-if="isLoadingReport" class="report-empty-state">
        <h3>正在读取报告</h3>
        <p>稍等一下，正在加载你之前生成的区间总结。</p>
      </div>

      <div v-else-if="!activeReport" class="report-empty-state">
        <h3>{{ emptyStateTitle }}</h3>
        <p>{{ emptyStateDescription }}</p>
      </div>

      <article v-else class="report-article">
        <header class="report-hero">
          <p class="report-label">{{ formatPreset(activeReport.preset) }}</p>
          <h3 class="report-title">{{ activeReport.period.label }}</h3>
          <p class="report-subtitle">{{ activeReport.period.startDate }} 至 {{ activeReport.period.endDate }}</p>

          <div class="report-hero-divider"></div>

          <div class="report-hero-stats">
            <p class="report-hero-stats-label">基础统计</p>

            <div class="report-hero-stats-grid">
              <article class="report-hero-stat">
                <span>记录天数</span>
                <strong>{{ activeReport.source.entryDays }}<small>天</small></strong>
              </article>
              <article class="report-hero-stat">
                <span>缺失天数</span>
                <strong>{{ activeReport.source.missingDays }}<small>天</small></strong>
              </article>
              <article class="report-hero-stat">
                <span>总字数</span>
                <strong>{{ activeReport.source.totalWords }}<small>字</small></strong>
              </article>
              <article class="report-hero-stat">
                <span>最长连续记录</span>
                <strong>{{ activeReport.source.longestStreak }}<small>天</small></strong>
              </article>
              <article class="report-hero-stat">
                <span>平均字数</span>
                <strong>{{ activeReport.source.averageWords }}<small>字</small></strong>
              </article>
              <article class="report-hero-stat">
                <span>单日最高字数</span>
                <strong>{{ getMaxWordsInOneDay(activeReport) }}<small>字</small></strong>
              </article>
            </div>
          </div>
        </header>

        <section class="summary-card">
          <div class="summary-card-head">
            <p class="summary-kicker">Overview</p>
            <h4>区间概览</h4>
          </div>

          <p class="summary-overview">{{ activeReport.summary.text }}</p>

          <div v-if="activeSummaryGroups.length" class="summary-groups">
            <section
              v-for="group in activeSummaryGroups"
              :key="group.key"
              class="summary-group-panel"
            >
              <header class="summary-group-header">
                <span class="summary-group-title">{{ group.title }}</span>
              </header>

              <div class="summary-item-list">
                <article
                  v-for="item in group.items"
                  :key="getSummaryItemKey(group.key, item)"
                  class="summary-item-card"
                  :title="buildTimeAnchorTitle(item.timeAnchor)"
                >
                  <span class="summary-item-time">{{ item.timeAnchor.label }}</span>
                  <p class="summary-item-text">{{ item.text }}</p>
                </article>
              </div>
            </section>
          </div>
        </section>

        <section
          v-if="activeReport.generation.warnings.length > 0"
          class="content-card content-card--warning"
        >
          <div class="content-card-header">
            <h4>生成提示</h4>
            <span>{{ activeReport.generation.warnings.length }} 条</span>
          </div>

          <ul class="summary-list">
            <li v-for="warning in activeReport.generation.warnings" :key="warning">
              {{ warning }}
            </li>
          </ul>
        </section>

        <section v-if="activeHeatmapPoints.length > 0" class="content-card">
          <div class="content-card-header">
            <h4>字数热力图</h4>
            <span>{{ activeHeatmapPoints.length }} 天</span>
          </div>

          <div class="heatmap-shell" :style="heatmapSizingStyle">
            <div class="heatmap-body">
              <div class="heatmap-weekdays" aria-hidden="true">
                <span
                  v-for="(label, index) in heatmapWeekdayLabels"
                  :key="`${label}-${index}`"
                  class="heatmap-weekday-label"
                >
                  {{ label }}
                </span>
              </div>

              <div ref="heatmapScrollerRef" class="heatmap-scroller">
                <div class="heatmap-scroll-content">
                  <div v-if="heatmapMonthLabels.length > 0" class="heatmap-months">
                    <span
                      v-for="month in heatmapMonthLabels"
                      :key="month.key"
                      class="heatmap-month-label"
                      :style="{ gridColumn: String(month.column) }"
                    >
                      {{ month.label }}
                    </span>
                  </div>

                  <div class="heatmap-grid">
                    <div
                      v-for="cell in heatmapCells"
                      :key="cell.date"
                      class="heatmap-cell"
                      :class="[
                        `heatmap-cell--level-${cell.level}`,
                        {
                          'heatmap-cell--muted': cell.isInDisplayRange && !cell.isInFocusRange,
                          'heatmap-cell--outside': !cell.isInDisplayRange,
                        },
                      ]"
                      :title="`${cell.date} · ${cell.value} 字`"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-if="activeMoodPoints.length > 0" class="content-card">
          <div class="content-card-header">
            <h4>情绪变化</h4>
            <span>
              平均心情
              {{ activeReport.sections.moodTrend?.averageMood ?? '暂无' }}
            </span>
          </div>

          <MoodTrendChart :points="activeMoodPoints" />
        </section>

        <section v-if="activeTagItems.length > 0" class="content-card">
          <div class="content-card-header">
            <h4>标签词云</h4>
          </div>

          <TagCloudView :items="activeTagItems" />
        </section>

        <section v-if="activeLocationPatterns" class="content-card">
          <div class="content-card-header">
            <h4>地点分析</h4>
          </div>

          <div
            class="pattern-layout"
            :class="{ 'pattern-layout--single': visibleLocationRanking.length === 0 }"
          >
            <article class="pattern-summary-card">
              <span class="pattern-summary-label">最常地点</span>
              <div class="pattern-summary-main">
                <strong>{{ activeLocationPatterns.topLocation?.name ?? '暂无' }}</strong>
                <em v-if="activeLocationPatterns.topLocation">{{ activeLocationPatterns.topLocation.count }} 次</em>
              </div>
            </article>

            <article class="pattern-summary-card pattern-summary-card--accent">
              <span class="pattern-summary-label">特别地点</span>
              <div class="pattern-summary-main">
                <strong>{{ activeLocationPatterns.uniqueLocation?.name ?? '暂无' }}</strong>
                <em v-if="getPatternCount(activeLocationPatterns.uniqueLocation) !== null">
                  {{ getPatternCount(activeLocationPatterns.uniqueLocation) }} 次
                </em>
              </div>
            </article>

            <div
              v-if="visibleLocationRanking.length > 0"
              class="pattern-compact-list"
              :class="getPatternListClass(visibleLocationRanking.length)"
            >
              <div
                v-for="(item, index) in visibleLocationRanking"
                :key="item.name"
                class="pattern-compact-row"
              >
                <span class="pattern-compact-rank">{{ String(index + 1).padStart(2, '0') }}</span>
                <strong class="pattern-compact-label">{{ item.name }}</strong>
                <div class="pattern-compact-track">
                  <div
                    class="pattern-compact-fill"
                    :style="{
                      width: getRankingFillWidth(
                        item.count,
                        activeLocationPatterns.topLocation?.count ?? item.count,
                      ),
                    }"
                  ></div>
                </div>
                <span class="pattern-compact-count">{{ item.count }} 次</span>
              </div>
            </div>
          </div>
        </section>

        <section v-if="activeTimePatterns" class="content-card">
          <div class="content-card-header">
            <h4>时间段分析</h4>
          </div>

          <div
            class="pattern-layout"
            :class="{ 'pattern-layout--single': visibleTimeBuckets.length === 0 }"
          >
            <article class="pattern-summary-card">
              <span class="pattern-summary-label">最常时间段</span>
              <div class="pattern-summary-main">
                <strong>{{ activeTimePatterns.topTimeBucket?.label ?? '暂无' }}</strong>
                <em v-if="activeTimePatterns.topTimeBucket">{{ activeTimePatterns.topTimeBucket.count }} 次</em>
              </div>
            </article>

            <article class="pattern-summary-card pattern-summary-card--accent">
              <span class="pattern-summary-label">特别时间段</span>
              <div class="pattern-summary-main">
                <strong>{{ activeTimePatterns.uniqueTimeBucket?.label ?? '暂无' }}</strong>
                <em v-if="getPatternCount(activeTimePatterns.uniqueTimeBucket) !== null">
                  {{ getPatternCount(activeTimePatterns.uniqueTimeBucket) }} 次
                </em>
              </div>
            </article>

            <div
              v-if="visibleTimeBuckets.length > 0"
              class="pattern-compact-list"
              :class="getPatternListClass(visibleTimeBuckets.length)"
            >
              <div
                v-for="(item, index) in visibleTimeBuckets"
                :key="item.label"
                class="pattern-compact-row"
              >
                <span class="pattern-compact-rank">{{ String(index + 1).padStart(2, '0') }}</span>
                <strong class="pattern-compact-label">{{ item.label }}</strong>
                <div class="pattern-compact-track">
                  <div
                    class="pattern-compact-fill"
                    :style="{
                      width: getRankingFillWidth(
                        item.count,
                        activeTimePatterns.topTimeBucket?.count ?? item.count,
                      ),
                    }"
                  ></div>
                </div>
                <span class="pattern-compact-count">{{ item.count }} 次</span>
              </div>
            </div>
          </div>
        </section>
      </article>
    </section>

    <div
      v-if="isExportDialogVisible"
      class="export-dialog-mask"
      @click.self="closeExportDialog"
    >
      <section class="export-dialog">
        <header class="export-dialog-header">
          <h3>导出图片</h3>
          <p>仅导出当前已打开报告，未生成的模块会禁用显示。</p>
        </header>

        <div class="export-dialog-content">
          <section class="export-setting-group">
            <h4>导出内容</h4>

            <div class="export-check-list">
              <label
                v-for="option in exportSectionOptions"
                :key="option.key"
                class="export-check-row"
                :class="{ 'export-check-row--disabled': !isExportSectionAvailable(option.key) }"
              >
                <input
                  :checked="isExportSectionSelected(option.key)"
                  :disabled="!isExportSectionAvailable(option.key)"
                  type="checkbox"
                  @change="toggleExportSection(option.key)"
                />
                <span class="export-check-copy">
                  <strong>{{ option.label }}</strong>
                  <small>
                    {{ option.description }}
                    <template v-if="!isExportSectionAvailable(option.key)">
                      （当前报告未生成该模块）
                    </template>
                  </small>
                </span>
              </label>
            </div>
          </section>

          <section class="export-setting-group">
            <h4>导出宽度</h4>

            <div class="export-scale-field">
              <label class="export-scale-input-wrap">
                <span>宽度</span>
                <div class="export-scale-control">
                  <input
                    v-model="selectedExportDocumentWidth"
                    class="export-scale-input"
                    type="number"
                    inputmode="numeric"
                    :min="MIN_EXPORT_DOCUMENT_WIDTH"
                    :max="MAX_EXPORT_DOCUMENT_WIDTH"
                    step="100"
                  />
                  <div class="export-scale-stepper">
                    <button
                      class="export-scale-stepper-button export-scale-stepper-button--up"
                      type="button"
                      :disabled="isExporting"
                      @click="stepExportDocumentWidth(100)"
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                    <button
                      class="export-scale-stepper-button export-scale-stepper-button--down"
                      type="button"
                      :disabled="isExporting"
                      @click="stepExportDocumentWidth(-100)"
                    >
                      <span aria-hidden="true">-</span>
                    </button>
                  </div>
                </div>
                <em>px</em>
              </label>

              <p class="export-scale-hint">
                可输入 {{ MIN_EXPORT_DOCUMENT_WIDTH }} 到 {{ MAX_EXPORT_DOCUMENT_WIDTH }} 之间的数字，单位为像素。
              </p>
            </div>
          </section>

          <section class="export-setting-group">
            <h4>渲染倍率</h4>

            <div class="export-scale-field">
              <label class="export-scale-input-wrap">
                <span>倍率</span>
                <div class="export-scale-control">
                  <input
                    v-model="selectedExportImageScale"
                    class="export-scale-input"
                    type="number"
                    inputmode="decimal"
                    :min="MIN_EXPORT_IMAGE_SCALE"
                    :max="MAX_EXPORT_IMAGE_SCALE"
                    step="0.5"
                  />
                  <div class="export-scale-stepper">
                    <button
                      class="export-scale-stepper-button export-scale-stepper-button--up"
                      type="button"
                      :disabled="isExporting"
                      @click="stepExportImageScale(0.5)"
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                    <button
                      class="export-scale-stepper-button export-scale-stepper-button--down"
                      type="button"
                      :disabled="isExporting"
                      @click="stepExportImageScale(-0.5)"
                    >
                      <span aria-hidden="true">-</span>
                    </button>
                  </div>
                </div>
                <em>x</em>
              </label>

              <p class="export-scale-hint">
                可输入 {{ MIN_EXPORT_IMAGE_SCALE }} 到 {{ MAX_EXPORT_IMAGE_SCALE }} 之间的数字，数值越大越清晰，但导出速度越慢。
              </p>
            </div>
          </section>
        </div>

        <p v-if="exportDialogMessage" class="export-dialog-status">
          {{ exportDialogMessage }}
        </p>

        <footer class="export-dialog-footer">
          <button
            class="export-button export-button--ghost"
            type="button"
            :disabled="isExporting"
            @click="closeExportDialog"
          >
            取消
          </button>
          <button
            class="export-button export-button--primary"
            type="button"
            :disabled="!canStartExport"
            @click="handleExportReport"
          >
            {{ isExporting ? '正在导出...' : '开始导出' }}
          </button>
        </footer>
      </section>
    </div>
  </section>
</template>

<style scoped src="./ReportsPanel.css"></style>

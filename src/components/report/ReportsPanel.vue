<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import MoodTrendChart from './MoodTrendChart.vue'
import TagCloudView from './TagCloudView.vue'
import type {
  RangeReport,
  ReportHeatmapPoint,
  ReportLocationPatternsSection,
  ReportMoodPoint,
  ReportPreset,
  ReportSummaryItem,
  ReportSummaryTimeAnchor,
  ReportStatsSection,
  ReportTagCloudItem,
  ReportTimePatternsSection,
} from '../../types/dairy'

const props = defineProps<{
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

const activeSummaryGroups = computed(() => {
  if (!props.activeReport) {
    return []
  }

  return [
    {
      key: 'progress',
      title: '推进',
      items: props.activeReport.summary.progress,
    },
    {
      key: 'blockers',
      title: '阻塞',
      items: props.activeReport.summary.blockers,
    },
    {
      key: 'memorableMoments',
      title: '值得记住',
      items: props.activeReport.summary.memorableMoments,
    },
  ].filter((group) => group.items.length > 0)
})

function formatPreset(presetValue: ReportPreset) {
  if (presetValue === 'month') {
    return '月度'
  }

  if (presetValue === 'year') {
    return '年度'
  }

  return '自定义'
}

function getHeatLevel(value: number) {
  if (value >= 700) {
    return 4
  }

  if (value >= 400) {
    return 3
  }

  if (value >= 150) {
    return 2
  }

  if (value > 0) {
    return 1
  }

  return 0
}

function getMaxWordsInOneDay(report: RangeReport) {
  if (typeof report.sections.stats?.maxWordsInOneDay === 'number') {
    return report.sections.stats.maxWordsInOneDay
  }

  return report.dailyEntries.reduce((maxValue, entry) => Math.max(maxValue, entry.wordCount), 0)
}

function buildTimeAnchorTitle(timeAnchor: ReportSummaryTimeAnchor) {
  if (timeAnchor.type === 'day') {
    return `对应日期：${timeAnchor.startDate ?? timeAnchor.label}`
  }

  if (timeAnchor.type === 'range') {
    return `对应时间范围：${timeAnchor.startDate ?? timeAnchor.label} 至 ${timeAnchor.endDate ?? timeAnchor.label}`
  }

  if (timeAnchor.type === 'multiple') {
    return `主要对应日期：${timeAnchor.dates?.join('、') ?? timeAnchor.label}`
  }

  if (timeAnchor.startDate && timeAnchor.endDate) {
    return `大致时间范围：${timeAnchor.startDate} 至 ${timeAnchor.endDate}`
  }

  if (timeAnchor.dates?.length) {
    return `综合这些日期：${timeAnchor.dates.join('、')}`
  }

  return `大致对应时间：${timeAnchor.label}`
}

function getSummaryItemKey(groupKey: string, item: ReportSummaryItem) {
  return `${groupKey}-${item.timeAnchor.label}-${item.text}`
}

function getRankingFillWidth(value: number, maxValue: number) {
  if (maxValue <= 0) {
    return '0%'
  }

  return `${Math.max((value / maxValue) * 100, 18)}%`
}

function getPatternCount(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const payload = value as { count?: unknown; countInRange?: unknown }
  const nextCount =
    typeof payload.count === 'number'
      ? payload.count
      : typeof payload.countInRange === 'number'
        ? payload.countInRange
        : null

  return nextCount
}
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

          <div class="heatmap-grid">
            <div
              v-for="point in activeHeatmapPoints"
              :key="point.date"
              class="heatmap-cell"
              :class="`heatmap-cell--level-${getHeatLevel(point.value)}`"
              :title="`${point.date} · ${point.value} 字`"
            >
              <span>{{ dayjs(point.date).date() }}</span>
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

          <div class="pattern-overview">
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
          </div>

          <div v-if="activeLocationPatterns.ranking.length > 0" class="pattern-compact-list">
            <div
              v-for="(item, index) in activeLocationPatterns.ranking"
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
        </section>

        <section v-if="activeTimePatterns" class="content-card">
          <div class="content-card-header">
            <h4>时间段分析</h4>
          </div>

          <div class="pattern-overview">
            <article class="pattern-summary-card">
              <span class="pattern-summary-label">最常时间段</span>
              <div class="pattern-summary-main">
                <strong>{{ activeTimePatterns.topTimeBucket?.label ?? '暂无' }}</strong>
                <em v-if="activeTimePatterns.topTimeBucket">{{ activeTimePatterns.topTimeBucket.count }} 次</em>
              </div>
            </article>

            <article class="pattern-summary-card pattern-summary-card--accent">
              <span class="pattern-summary-label">特别时段</span>
              <div class="pattern-summary-main">
                <strong>{{ activeTimePatterns.uniqueTimeBucket?.label ?? '暂无' }}</strong>
                <em v-if="getPatternCount(activeTimePatterns.uniqueTimeBucket) !== null">
                  {{ getPatternCount(activeTimePatterns.uniqueTimeBucket) }} 次
                </em>
              </div>
            </article>
          </div>

          <div v-if="activeTimePatterns.buckets.length > 0" class="pattern-compact-list">
            <div
              v-for="(item, index) in activeTimePatterns.buckets"
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
        </section>
      </article>
    </section>
  </section>
</template>

<style scoped>
.reports-panel {
  display: grid;
  gap: 1rem;
  min-height: 0;
  overflow: hidden;
}

.reports-header {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.reports-heading {
  display: grid;
  gap: 0.35rem;
}

.reports-kicker {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.report-label {
  margin: 0;
  font-size: 0.92rem;
  letter-spacing: 0.04em;
  color: var(--color-text-subtle);
}

.reports-title,
.report-title {
  margin: 0;
  color: var(--color-text-main);
}

.reports-title {
  font-size: 1.9rem;
}

.reports-description,
.report-subtitle,
.reports-status {
  margin: 0;
  color: var(--color-text-subtle);
  line-height: 1.7;
}

.reports-status {
  max-width: 24rem;
  text-align: right;
}

.report-content,
.report-article {
  min-height: 0;
}

.summary-card,
.content-card,
.report-empty-state {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
}

.summary-card,
.content-card {
  padding: 1rem;
}

.summary-card {
  position: relative;
  overflow: hidden;
  padding: 1.25rem;
  border-color: rgba(217, 203, 159, 0.95);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.82);
}

.report-empty-state {
  display: grid;
  gap: 0.6rem;
  align-content: center;
  justify-items: start;
  min-height: 100%;
  padding: 1.5rem;
}

.report-empty-state h2,
.report-empty-state h3,
.summary-card h4,
.content-card h4 {
  margin: 0;
}

.report-empty-state p,
.summary-card p {
  margin: 0;
  color: var(--color-text-subtle);
  line-height: 1.7;
}

.summary-card-head {
  display: grid;
  gap: 0.18rem;
  padding-bottom: 0.5rem;
}

.summary-kicker {
  margin: 0;
  font-size: 0.76rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.summary-overview {
  margin-top: 0;
  font-size: 1rem;
  line-height: 1.9;
  color: var(--color-text-main);
}

.content-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.content-card-header span {
  color: var(--color-text-soft);
  font-size: 0.85rem;
}

.report-content {
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #d8ccb0 transparent;
}

.report-content::-webkit-scrollbar {
  width: 10px;
}

.report-content::-webkit-scrollbar-track {
  background: transparent;
}

.report-content::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 999px;
  background: linear-gradient(180deg, #ded3b8 0%, #cec09b 100%);
  background-clip: padding-box;
}

.report-content::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #d3c5a0 0%, #bda977 100%);
  background-clip: padding-box;
}

.report-content::-webkit-scrollbar-corner {
  background: transparent;
}

.report-article {
  display: grid;
  gap: 1rem;
}

.report-hero {
  display: grid;
  gap: 0.7rem;
  padding: 1.2rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
}

.report-hero-divider {
  height: 1px;
  margin: 0.2rem 0 0.05rem;
  background: var(--color-border);
}

.report-hero-stats {
  display: grid;
  gap: 0.75rem;
}

.report-hero-stats-label {
  margin: 0;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  color: var(--color-text-subtle);
}

.report-hero-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
}

.report-hero-stat {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.8rem 0.9rem;
  border: 1px solid rgba(229, 220, 197, 0.9);
  border-radius: 12px;
  background: rgba(250, 246, 234, 0.42);
}

.report-hero-stat span {
  color: var(--color-text-subtle);
  font-size: 0.8rem;
  line-height: 1.4;
}

.report-hero-stat strong {
  display: flex;
  align-items: baseline;
  gap: 0.18rem;
  min-width: 0;
  font-size: 1.22rem;
  line-height: 1.1;
  color: var(--color-text-main);
}

.report-hero-stat small {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--color-text-subtle);
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(2.4rem, 1fr));
  gap: 0.45rem;
  margin-top: 1rem;
}

.heatmap-cell {
  display: grid;
  place-items: center;
  aspect-ratio: 1 / 1;
  border: 1px solid var(--color-border-soft);
  border-radius: 8px;
  background: #fcfbf6;
  font-size: 0.82rem;
  color: var(--color-text-subtle);
}

.heatmap-cell--level-1 {
  background: #f8f2df;
}

.heatmap-cell--level-2 {
  background: #f3e7c4;
}

.heatmap-cell--level-3 {
  background: #ead89f;
  color: #54472d;
}

.heatmap-cell--level-4 {
  background: #ddc170;
  color: #47391f;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

.tag-cloud--compact {
  margin-top: 0.55rem;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  min-height: 2.2rem;
  padding: 0 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: #fffdf8;
  color: var(--color-text-main);
}

.tag-chip--sm {
  font-size: 0.86rem;
}

.summary-groups {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
  margin-top: 1.1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(217, 203, 159, 0.8);
}

.summary-group-panel {
  display: grid;
  grid-template-columns: 6rem minmax(0, 1fr);
  gap: 0.95rem;
  align-items: start;
  min-width: 0;
  padding: 0.9rem 0;
  background: transparent;
}

.summary-group-panel + .summary-group-panel {
  border-top: 1px solid rgba(229, 220, 197, 0.9);
}

.summary-group-header {
  padding-top: 0.2rem;
}

.summary-group-title {
  color: var(--color-text-main);
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.summary-item-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.summary-item-card {
  display: grid;
  gap: 0.28rem;
  min-width: min(100%, 16rem);
  max-width: 22rem;
  padding: 0.2rem 0;
  background: transparent;
  flex: 1 1 15rem;
}

.summary-item-time {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-height: auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #ad945f;
  font-size: 0.76rem;
  font-weight: 500;
}

.summary-item-text {
  margin: 0;
  color: var(--color-text-main);
  line-height: 1.72;
}

.summary-list {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding-left: 1.15rem;
  color: var(--color-text-main);
}

.summary-list li {
  line-height: 1.7;
}

.content-card--warning {
  background: #fff9eb;
  border-color: #e2d3a8;
}

.highlight-list {
  display: grid;
  gap: 0.8rem;
  margin-top: 1rem;
}

.highlight-card {
  display: grid;
  gap: 0.45rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: #fffef9;
}

.highlight-head {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  justify-content: space-between;
}

.highlight-head span,
.highlight-card p {
  color: var(--color-text-subtle);
}

.highlight-card p {
  margin: 0;
  line-height: 1.7;
}

.pattern-overview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
  margin-top: 0.85rem;
}

.pattern-summary-card {
  display: grid;
  gap: 0.32rem;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: #fffef9;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.pattern-summary-card--accent {
  background: #fffef9;
}

.pattern-summary-card:hover {
  background: #faf6eb;
  border-color: #dccda8;
  box-shadow: 0 10px 22px rgba(102, 82, 32, 0.08);
  transform: translateY(-1px);
}

.pattern-summary-label {
  color: var(--color-text-subtle);
  font-size: 0.78rem;
  letter-spacing: 0.02em;
}

.pattern-summary-main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.pattern-summary-main strong {
  color: var(--color-text-main);
  font-size: 1rem;
  line-height: 1.35;
}

.pattern-summary-main em {
  font-style: normal;
  color: #9d8657;
  font-size: 0.8rem;
  white-space: nowrap;
}

.pattern-compact-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 0.65rem;
  margin-top: 0.8rem;
}

.pattern-compact-row {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) minmax(3.2rem, 6.5rem) auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0.62rem 0.72rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 9px;
  background: #fffef9;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.pattern-compact-row:hover {
  background: #f8f3e7;
  border-color: #dbcba4;
  box-shadow: 0 8px 18px rgba(102, 82, 32, 0.06);
  transform: translateY(-1px);
}

.pattern-compact-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.5rem;
  border-radius: 999px;
  background: #f6efdf;
  color: #9d8657;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.pattern-compact-label {
  color: var(--color-text-main);
  font-size: 0.88rem;
  line-height: 1.35;
  min-width: 0;
}

.pattern-compact-track {
  overflow: hidden;
  width: 100%;
  height: 0.32rem;
  border-radius: 999px;
  background: #efe6d3;
}

.pattern-compact-fill {
  height: 100%;
  border-radius: inherit;
  background: #ccb278;
}

.pattern-compact-count {
  color: var(--color-text-subtle);
  font-size: 0.79rem;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 768px) {
  .reports-header {
    flex-direction: column;
  }

  .reports-status {
    text-align: left;
  }

  .report-hero-stats-grid {
    grid-template-columns: 1fr 1fr;
  }

  .summary-groups {
    grid-template-columns: 1fr;
  }

  .summary-group-panel {
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }

  .summary-group-panel + .summary-group-panel {
    padding-top: 1rem;
  }

  .pattern-overview,
  .pattern-compact-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .report-hero-stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>

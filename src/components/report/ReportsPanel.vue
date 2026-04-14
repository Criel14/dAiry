<script setup lang="ts">
import dayjs from 'dayjs'
import MoodTrendChart from './MoodTrendChart.vue'
import TagCloudView from './TagCloudView.vue'
import type {
  RangeReport,
  ReportHeatmapPoint,
  ReportHighlightEvent,
  ReportLocationPatternsSection,
  ReportMoodPoint,
  ReportPreset,
  ReportStatsSection,
  ReportTagCloudItem,
  ReportTimePatternsSection,
} from '../../types/dairy'

defineProps<{
  hasWorkspace: boolean
  emptyStateTitle: string
  emptyStateDescription: string
  activeReport: RangeReport | null
  isLoadingReport: boolean
  activeStats: ReportStatsSection | null
  activeHeatmapPoints: ReportHeatmapPoint[]
  activeMoodPoints: ReportMoodPoint[]
  activeTagItems: ReportTagCloudItem[]
  activeHighlights: ReportHighlightEvent[]
  activeLocationPatterns: ReportLocationPatternsSection | null
  activeTimePatterns: ReportTimePatternsSection | null
}>()

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

function formatPercentScore(score: number) {
  return `${Math.round(score * 100)} 分`
}

function getMaxWordsInOneDay(report: RangeReport) {
  if (typeof report.sections.stats?.maxWordsInOneDay === 'number') {
    return report.sections.stats.maxWordsInOneDay
  }

  return report.dailyEntries.reduce((maxValue, entry) => Math.max(maxValue, entry.wordCount), 0)
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
          <h4>区间概览</h4>
          <p>{{ activeReport.summary.text }}</p>

          <div
            v-if="
              activeReport.summary.themes.length ||
              activeReport.summary.progress.length ||
              activeReport.summary.blockers.length ||
              activeReport.summary.memorableMoments.length
            "
            class="summary-groups"
          >
            <div v-if="activeReport.summary.themes.length" class="summary-group">
              <span>主题</span>
              <div class="tag-cloud tag-cloud--compact">
                <span v-for="item in activeReport.summary.themes" :key="item" class="tag-chip tag-chip--sm">
                  {{ item }}
                </span>
              </div>
            </div>

            <div v-if="activeReport.summary.progress.length" class="summary-group">
              <span>推进</span>
              <ul class="summary-list">
                <li v-for="item in activeReport.summary.progress" :key="item">{{ item }}</li>
              </ul>
            </div>

            <div v-if="activeReport.summary.blockers.length" class="summary-group">
              <span>阻塞</span>
              <ul class="summary-list">
                <li v-for="item in activeReport.summary.blockers" :key="item">{{ item }}</li>
              </ul>
            </div>

            <div v-if="activeReport.summary.memorableMoments.length" class="summary-group">
              <span>值得记住</span>
              <ul class="summary-list">
                <li v-for="item in activeReport.summary.memorableMoments" :key="item">{{ item }}</li>
              </ul>
            </div>
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

        <section v-if="activeHighlights.length > 0" class="content-card">
          <div class="content-card-header">
            <h4>重点事件</h4>
            <span>{{ activeHighlights.length }} 条</span>
          </div>

          <div class="highlight-list">
            <article
              v-for="event in activeHighlights"
              :key="`${event.date}-${event.title}`"
              class="highlight-card"
            >
              <div class="highlight-head">
                <strong>{{ event.title }}</strong>
                <span>{{ event.date }} · {{ formatPercentScore(event.score) }}</span>
              </div>
              <p>{{ event.summary }}</p>
              <div v-if="event.tags.length > 0" class="tag-cloud tag-cloud--compact">
                <span v-for="tag in event.tags" :key="tag" class="tag-chip tag-chip--sm">
                  {{ tag }}
                </span>
              </div>
            </article>
          </div>
        </section>

        <section v-if="activeLocationPatterns" class="content-card">
          <div class="content-card-header">
            <h4>地点分析</h4>
            <span>{{ activeLocationPatterns.ranking.length }} 个地点</span>
          </div>

          <div class="pattern-grid">
            <article class="pattern-card">
              <span>最常地点</span>
              <strong>{{ activeLocationPatterns.topLocation?.name ?? '暂无' }}</strong>
              <small>
                {{
                  activeLocationPatterns.topLocation
                    ? `出现 ${activeLocationPatterns.topLocation.count} 次`
                    : '这个区间还没有可用地点数据'
                }}
              </small>
            </article>

            <article class="pattern-card">
              <span>最独特点</span>
              <strong>{{ activeLocationPatterns.uniqueLocation?.name ?? '暂无' }}</strong>
              <small>{{ activeLocationPatterns.uniqueLocation?.reason ?? '这个区间还没有可用地点数据' }}</small>
            </article>
          </div>

          <div v-if="activeLocationPatterns.ranking.length > 0" class="ranking-list">
            <div v-for="item in activeLocationPatterns.ranking" :key="item.name" class="ranking-row">
              <span>{{ item.name }}</span>
              <strong>{{ item.count }}</strong>
            </div>
          </div>
        </section>

        <section v-if="activeTimePatterns" class="content-card">
          <div class="content-card-header">
            <h4>时间段分析</h4>
            <span>{{ activeTimePatterns.buckets.length }} 个时间段</span>
          </div>

          <div class="pattern-grid">
            <article class="pattern-card">
              <span>最常时间段</span>
              <strong>{{ activeTimePatterns.topTimeBucket?.label ?? '暂无' }}</strong>
              <small>
                {{
                  activeTimePatterns.topTimeBucket
                    ? `出现 ${activeTimePatterns.topTimeBucket.count} 次`
                    : '这个区间还没有可用写作时间数据'
                }}
              </small>
            </article>

            <article class="pattern-card">
              <span>最独特时间段</span>
              <strong>{{ activeTimePatterns.uniqueTimeBucket?.label ?? '暂无' }}</strong>
              <small>{{ activeTimePatterns.uniqueTimeBucket?.reason ?? '这个区间还没有可用写作时间数据' }}</small>
            </article>
          </div>

          <div v-if="activeTimePatterns.buckets.length > 0" class="ranking-list">
            <div
              v-for="item in activeTimePatterns.buckets"
              :key="item.label"
              class="ranking-row"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.count }}</strong>
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
  gap: 0.85rem;
  margin-top: 1rem;
}

.summary-group {
  display: grid;
  gap: 0.45rem;
}

.summary-group > span {
  color: var(--color-text-subtle);
  font-size: 0.84rem;
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

.highlight-card,
.pattern-card {
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
.highlight-card p,
.pattern-card span,
.pattern-card small {
  color: var(--color-text-subtle);
}

.highlight-card p,
.pattern-card small {
  margin: 0;
  line-height: 1.7;
}

.pattern-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  margin-top: 1rem;
}

.ranking-list {
  display: grid;
  gap: 0.55rem;
  margin-top: 1rem;
}

.ranking-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 10px;
  background: #fffef9;
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

  .pattern-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .report-hero-stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>

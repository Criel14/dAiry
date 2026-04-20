<script setup lang="ts">
import MoodTrendChart from '../../../components/MoodTrendChart/MoodTrendChart.vue'
import TagCloudView from '../../../components/TagCloudView/TagCloudView.vue'
import type { RangeReport, ReportExportSectionKey } from '../../../../../types/dairy'
import { useReportExportDocument } from '../../composables/useReportExportDocument'

const props = withDefaults(
  defineProps<{
    report: RangeReport
    sections: ReportExportSectionKey[]
    documentWidth?: number
  }>(),
  {
    documentWidth: 1200,
  },
)

const {
  buildTimeAnchorTitle,
  formatPreset,
  getPatternCount,
  getPatternListClass,
  getRankingFillWidth,
  getSummaryItemKey,
  heatmapCells,
  heatmapMonthLabels,
  heatmapScrollerRef,
  heatmapSizingStyle,
  heatmapWeekdayLabels,
  maxWordsInOneDay,
  shouldShowSection,
  summaryGroups,
  visibleLocationRanking,
  visibleTimeBuckets,
} = useReportExportDocument(props)
</script>

<template>
  <article class="report-export-document" :style="{ width: `${documentWidth}px` }">
    <header v-if="shouldShowSection('cover')" class="report-hero">
      <p class="report-label">{{ formatPreset(report.preset) }}</p>
      <h1 class="report-title">{{ report.period.label }}</h1>
      <p class="report-subtitle">{{ report.period.startDate }} 至 {{ report.period.endDate }}</p>
    </header>

    <section v-if="shouldShowSection('stats')" class="content-card">
      <div class="card-header">
        <h2>基础统计</h2>
      </div>

      <div class="section-body">
        <div class="stats-grid">
          <article class="stat-item">
            <span>记录天数</span>
            <strong>{{ report.source.entryDays }}<small>天</small></strong>
          </article>
          <article class="stat-item">
            <span>缺失天数</span>
            <strong>{{ report.source.missingDays }}<small>天</small></strong>
          </article>
          <article class="stat-item">
            <span>总字数</span>
            <strong>{{ report.source.totalWords }}<small>字</small></strong>
          </article>
          <article class="stat-item">
            <span>最长连续记录</span>
            <strong>{{ report.source.longestStreak }}<small>天</small></strong>
          </article>
          <article class="stat-item">
            <span>平均字数</span>
            <strong>{{ report.source.averageWords }}<small>字</small></strong>
          </article>
          <article class="stat-item">
            <span>单日最高字数</span>
            <strong>{{ maxWordsInOneDay }}<small>字</small></strong>
          </article>
        </div>
      </div>
    </section>

    <section v-if="shouldShowSection('summary')" class="content-card summary-card">
      <div class="card-header">
        <h2>区间概览</h2>
      </div>

      <div class="section-body section-body--summary">
        <p class="summary-text">{{ report.summary.text }}</p>

        <div v-if="summaryGroups.length > 0" class="summary-groups">
          <section
            v-for="group in summaryGroups"
            :key="group.key"
            class="summary-group"
          >
            <header class="summary-group-head">
              <span>{{ group.title }}</span>
            </header>

            <div class="summary-items">
              <article
                v-for="item in group.items"
                :key="getSummaryItemKey(group.key, item)"
                class="summary-item"
                :title="buildTimeAnchorTitle(item.timeAnchor)"
              >
                <span class="summary-item-time">{{ item.timeAnchor.label }}</span>
                <p>{{ item.text }}</p>
              </article>
            </div>
          </section>
        </div>
      </div>
    </section>

    <section
      v-if="shouldShowSection('heatmap') && report.sections.heatmap"
      class="content-card"
    >
      <div class="card-header">
        <h2>字数热力图</h2>
        <span>{{ report.sections.heatmap.points.length }} 天</span>
      </div>

      <div class="section-body">
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
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      v-if="shouldShowSection('moodTrend') && report.sections.moodTrend"
      class="content-card"
    >
      <div class="card-header">
        <h2>情绪变化</h2>
        <span>平均心情 {{ report.sections.moodTrend.averageMood ?? '暂无' }}</span>
      </div>
      <div class="section-body section-body--flush">
        <MoodTrendChart :points="report.sections.moodTrend.points" />
      </div>
    </section>

    <section
      v-if="shouldShowSection('tagCloud') && report.sections.tagCloud"
      class="content-card"
    >
      <div class="card-header">
        <h2>标签词云</h2>
      </div>
      <div class="section-body section-body--flush">
        <TagCloudView :items="report.sections.tagCloud.items" />
      </div>
    </section>

    <section
      v-if="shouldShowSection('locationPatterns') && report.sections.locationPatterns"
      class="content-card"
    >
      <div class="card-header">
        <h2>地点分析</h2>
      </div>

      <div class="section-body">
        <div class="pattern-layout" :class="{ 'pattern-layout--single': visibleLocationRanking.length === 0 }">
          <article class="pattern-summary-card">
            <span>最常地点</span>
            <strong>{{ report.sections.locationPatterns.topLocation?.name ?? '暂无' }}</strong>
            <em v-if="report.sections.locationPatterns.topLocation">
              {{ report.sections.locationPatterns.topLocation.count }} 次
            </em>
          </article>

          <article class="pattern-summary-card pattern-summary-card--accent">
            <span>特别地点</span>
            <strong>{{ report.sections.locationPatterns.uniqueLocation?.name ?? '暂无' }}</strong>
            <em v-if="getPatternCount(report.sections.locationPatterns.uniqueLocation) !== null">
              {{ getPatternCount(report.sections.locationPatterns.uniqueLocation) }} 次
            </em>
          </article>

          <div
            v-if="visibleLocationRanking.length > 0"
            class="pattern-list"
            :class="getPatternListClass(visibleLocationRanking.length)"
          >
            <div
              v-for="(item, index) in visibleLocationRanking"
              :key="item.name"
              class="pattern-row"
            >
              <span class="rank">{{ String(index + 1).padStart(2, '0') }}</span>
              <strong class="label">{{ item.name }}</strong>
              <div class="track">
                <div
                  class="fill"
                  :style="{ width: getRankingFillWidth(item.count, report.sections.locationPatterns.topLocation?.count ?? item.count) }"
                ></div>
              </div>
              <span class="count">{{ item.count }} 次</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      v-if="shouldShowSection('timePatterns') && report.sections.timePatterns"
      class="content-card"
    >
      <div class="card-header">
        <h2>时间段分析</h2>
      </div>

      <div class="section-body">
        <div class="pattern-layout" :class="{ 'pattern-layout--single': visibleTimeBuckets.length === 0 }">
          <article class="pattern-summary-card">
            <span>最常时间段</span>
            <strong>{{ report.sections.timePatterns.topTimeBucket?.label ?? '暂无' }}</strong>
            <em v-if="report.sections.timePatterns.topTimeBucket">
              {{ report.sections.timePatterns.topTimeBucket.count }} 次
            </em>
          </article>

          <article class="pattern-summary-card pattern-summary-card--accent">
            <span>特别时间段</span>
            <strong>{{ report.sections.timePatterns.uniqueTimeBucket?.label ?? '暂无' }}</strong>
            <em v-if="getPatternCount(report.sections.timePatterns.uniqueTimeBucket) !== null">
              {{ getPatternCount(report.sections.timePatterns.uniqueTimeBucket) }} 次
            </em>
          </article>

          <div
            v-if="visibleTimeBuckets.length > 0"
            class="pattern-list"
            :class="getPatternListClass(visibleTimeBuckets.length)"
          >
            <div
              v-for="(item, index) in visibleTimeBuckets"
              :key="item.label"
              class="pattern-row"
            >
              <span class="rank">{{ String(index + 1).padStart(2, '0') }}</span>
              <strong class="label">{{ item.label }}</strong>
              <div class="track">
                <div
                  class="fill"
                  :style="{ width: getRankingFillWidth(item.count, report.sections.timePatterns.topTimeBucket?.count ?? item.count) }"
                ></div>
              </div>
              <span class="count">{{ item.count }} 次</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </article>
</template>

<style scoped src="./ReportExportDocument.css"></style>

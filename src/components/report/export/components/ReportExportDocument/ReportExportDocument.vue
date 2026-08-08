<script setup lang="ts">
import MoodTrendChart from '../../../components/MoodTrendChart/MoodTrendChart.vue'
import TagCloudView from '../../../components/TagCloudView/TagCloudView.vue'
import ReportHeatmapView from '../../../components/ReportHeatmapView/ReportHeatmapView.vue'
import ReportPatternListView from '../../../components/ReportPatternListView/ReportPatternListView.vue'
import type { RangeReport, ReportExportSectionKey } from '../../../../../types/report'
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

/** 导出热力图格子尺寸上限：52 周场景下 2400px 文档宽约需 41px/格，放宽到 56 保证填满 */
const EXPORT_HEATMAP_MAX_CELL_SIZE = 56

const {
  buildTimeAnchorTitle,
  formatPreset,
  getSummaryItemKey,
  locationPatternView,
  maxWordsInOneDay,
  shouldShowSection,
  summaryGroups,
  timePatternView,
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
        <ReportHeatmapView
          :report="report"
          :points="report.sections.heatmap.points"
          :max-cell-size="EXPORT_HEATMAP_MAX_CELL_SIZE"
        />
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
        <ReportPatternListView
          :summary-cards="locationPatternView.summaryCards"
          :ranking="locationPatternView.ranking"
        />
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
        <ReportPatternListView
          :summary-cards="timePatternView.summaryCards"
          :ranking="timePatternView.ranking"
        />
      </div>
    </section>
  </article>
</template>

<style scoped src="./ReportExportDocument.css"></style>

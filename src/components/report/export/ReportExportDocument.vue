<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import MoodTrendChart from '../MoodTrendChart.vue'
import TagCloudView from '../TagCloudView.vue'
import type {
  RangeReport,
  ReportExportSectionKey,
  ReportSummaryItem,
  ReportSummaryTimeAnchor,
} from '../../../types/dairy'

const props = withDefaults(defineProps<{
  report: RangeReport
  sections: ReportExportSectionKey[]
  documentWidth?: number
}>(), {
  documentWidth: 1200,
})

const maxPatternItems = 6
const heatmapCellGap = 3
const heatmapScrollerRef = ref<HTMLElement | null>(null)
const heatmapMinCellSize = 10
const heatmapMaxCellSize = 22
const heatmapDefaultCellSize = 12
const heatmapCustomContextMonthCount = 13
const heatmapWeekdayLabels = ['周一', '', '周三', '', '周五', '', '']
const heatmapCellSize = ref(heatmapDefaultCellSize)
let heatmapMeasureFrame = 0
let heatmapResizeObserver: ResizeObserver | null = null
let pendingHeatmapWidth: number | null = null

const sectionSet = computed(() => new Set(props.sections))
const summaryGroups = computed(() => [
  {
    key: 'progress',
    title: '推进',
    items: props.report.summary.progress,
  },
  {
    key: 'blockers',
    title: '阻塞',
    items: props.report.summary.blockers,
  },
  {
    key: 'memorableMoments',
    title: '值得记住',
    items: props.report.summary.memorableMoments,
  },
].filter((group) => group.items.length > 0))

const visibleLocationRanking = computed(
  () => props.report.sections.locationPatterns?.ranking.slice(0, maxPatternItems) ?? [],
)
const visibleTimeBuckets = computed(
  () => props.report.sections.timePatterns?.buckets.slice(0, maxPatternItems) ?? [],
)

const heatmapDisplayRange = computed(() => {
  if (!props.report.sections.heatmap) {
    return null
  }

  const focusStart = dayjs(props.report.period.startDate).startOf('day')
  const focusEnd = dayjs(props.report.period.endDate).startOf('day')

  if (!focusStart.isValid() || !focusEnd.isValid()) {
    return null
  }

  if (props.report.preset === 'year') {
    return {
      displayStart: focusStart.startOf('year'),
      displayEnd: focusEnd.endOf('year'),
      focusStart,
      focusEnd,
    }
  }

  if (props.report.preset === 'month' || props.report.preset === 'custom') {
    const focusMonthStart = focusStart.startOf('month')
    const focusMonthEnd = focusEnd.endOf('month')

    if (props.report.preset === 'custom') {
      const focusMonthCount = focusMonthEnd.startOf('month').diff(focusMonthStart, 'month') + 1

      if (focusMonthCount >= heatmapCustomContextMonthCount) {
        return {
          displayStart: focusMonthStart,
          displayEnd: focusMonthEnd,
          focusStart,
          focusEnd,
        }
      }

      const extraMonths = heatmapCustomContextMonthCount - focusMonthCount
      const beforeMonths = Math.floor(extraMonths * 0.4)
      const afterMonths = extraMonths - beforeMonths

      return {
        displayStart: focusMonthStart.subtract(beforeMonths, 'month'),
        displayEnd: focusMonthEnd.add(afterMonths, 'month'),
        focusStart,
        focusEnd,
      }
    }

    return {
      displayStart: focusMonthStart.startOf('year'),
      displayEnd: focusMonthEnd.endOf('year'),
      focusStart,
      focusEnd,
    }
  }

  return {
    displayStart: focusStart,
    displayEnd: focusEnd,
    focusStart,
    focusEnd,
  }
})

const heatmapCells = computed(() => {
  if (!props.report.sections.heatmap || !heatmapDisplayRange.value) {
    return []
  }

  const pointMap = new Map(props.report.sections.heatmap.points.map((point) => [point.date, point.value]))
  const { displayStart, displayEnd, focusStart, focusEnd } = heatmapDisplayRange.value
  const gridStart = displayStart.subtract((displayStart.day() + 6) % 7, 'day')
  const gridEnd = displayEnd.add(6 - ((displayEnd.day() + 6) % 7), 'day')
  const totalDays = gridEnd.diff(gridStart, 'day') + 1

  return Array.from({ length: totalDays }, (_, index) => {
    const currentDate = gridStart.add(index, 'day')
    const dateKey = currentDate.format('YYYY-MM-DD')
    const value = pointMap.get(dateKey) ?? 0

    return {
      date: dateKey,
      value,
      level: getHeatLevel(value),
      isInDisplayRange:
        !currentDate.isBefore(displayStart, 'day') && !currentDate.isAfter(displayEnd, 'day'),
      isInFocusRange:
        !currentDate.isBefore(focusStart, 'day') && !currentDate.isAfter(focusEnd, 'day'),
    }
  })
})

const heatmapWeekCount = computed(() => Math.ceil(heatmapCells.value.length / 7))

const heatmapSpansMultipleYears = computed(() => {
  if (!heatmapDisplayRange.value) {
    return false
  }

  return heatmapDisplayRange.value.displayStart.year() !== heatmapDisplayRange.value.displayEnd.year()
})

function updateHeatmapCellSize(scrollerWidth = heatmapScrollerRef.value?.clientWidth ?? 0) {
  const weekCount = Math.max(heatmapWeekCount.value, 1)

  if (scrollerWidth <= 0) {
    heatmapCellSize.value = heatmapDefaultCellSize
    return
  }

  const totalGap = Math.max(weekCount - 1, 0) * heatmapCellGap
  const rawSize = Math.floor((scrollerWidth - totalGap) / weekCount)
  const nextSize = Math.max(heatmapMinCellSize, Math.min(heatmapMaxCellSize, rawSize))

  if (nextSize !== heatmapCellSize.value) {
    heatmapCellSize.value = nextSize
  }
}

function scheduleHeatmapCellSizeUpdate(scrollerWidth?: number) {
  if (typeof scrollerWidth === 'number') {
    pendingHeatmapWidth = scrollerWidth
  }

  if (heatmapMeasureFrame) {
    cancelAnimationFrame(heatmapMeasureFrame)
  }

  heatmapMeasureFrame = window.requestAnimationFrame(() => {
    heatmapMeasureFrame = 0
    updateHeatmapCellSize(pendingHeatmapWidth ?? undefined)
    pendingHeatmapWidth = null
  })
}

function stopObservingHeatmapScroller() {
  heatmapResizeObserver?.disconnect()
  heatmapResizeObserver = null
}

function startObservingHeatmapScroller() {
  stopObservingHeatmapScroller()

  if (!heatmapScrollerRef.value) {
    return
  }

  scheduleHeatmapCellSizeUpdate(heatmapScrollerRef.value.clientWidth)

  if (typeof ResizeObserver === 'undefined') {
    return
  }

  heatmapResizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]

    if (!entry) {
      return
    }

    const nextWidth = Math.round(entry.contentRect.width)

    if (nextWidth > 0) {
      scheduleHeatmapCellSizeUpdate(nextWidth)
    }
  })
  heatmapResizeObserver.observe(heatmapScrollerRef.value)
}

const heatmapSizingStyle = computed(() => ({
  '--heatmap-cell-size': `${heatmapCellSize.value}px`,
  '--heatmap-cell-gap': `${heatmapCellGap}px`,
  '--heatmap-week-count': String(Math.max(heatmapWeekCount.value, 1)),
}))

const heatmapMonthLabels = computed(() => {
  const labels: Array<{ key: string; label: string; column: number }> = []
  let lastMonthKey = ''
  let lastYear: number | null = null

  for (let index = 0; index < heatmapCells.value.length; index += 7) {
    const weekCells = heatmapCells.value.slice(index, index + 7)
    const firstInRangeCell = weekCells.find((cell) => cell.isInDisplayRange)

    if (!firstInRangeCell) {
      continue
    }

    const monthKey = firstInRangeCell.date.slice(0, 7)
    if (monthKey === lastMonthKey) {
      continue
    }

    const currentDate = dayjs(firstInRangeCell.date)
    const year = currentDate.year()
    const showYear = heatmapSpansMultipleYears.value && year !== lastYear

    labels.push({
      key: monthKey,
      label: showYear ? `${year}年${currentDate.month() + 1}月` : `${currentDate.month() + 1}月`,
      column: index / 7 + 1,
    })

    lastMonthKey = monthKey
    lastYear = year
  }

  return labels
})

const maxWordsInOneDay = computed(() => {
  if (typeof props.report.sections.stats?.maxWordsInOneDay === 'number') {
    return props.report.sections.stats.maxWordsInOneDay
  }

  return props.report.dailyEntries.reduce((maxValue, entry) => Math.max(maxValue, entry.wordCount), 0)
})

function shouldShowSection(sectionKey: ReportExportSectionKey) {
  return sectionSet.value.has(sectionKey)
}

function formatPreset(preset: RangeReport['preset']) {
  if (preset === 'month') {
    return '月度'
  }

  if (preset === 'year') {
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

  return `${Math.max((value / maxValue) * 100, 16)}%`
}

function getPatternCount(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const payload = value as { count?: unknown; countInRange?: unknown }

  if (typeof payload.count === 'number') {
    return payload.count
  }

  if (typeof payload.countInRange === 'number') {
    return payload.countInRange
  }

  return null
}

function getPatternListClass(count: number) {
  if (count >= 5) {
    return 'pattern-list--cols-3'
  }

  if (count >= 3) {
    return 'pattern-list--cols-2'
  }

  return 'pattern-list--cols-1'
}

onMounted(() => {
  startObservingHeatmapScroller()
})

watch(
  [heatmapWeekCount, () => props.report.reportId, () => props.documentWidth],
  async () => {
    await nextTick()
    scheduleHeatmapCellSizeUpdate()
  },
  { flush: 'post' },
)

watch(
  heatmapScrollerRef,
  async () => {
    await nextTick()
    startObservingHeatmapScroller()
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  if (heatmapMeasureFrame) {
    cancelAnimationFrame(heatmapMeasureFrame)
  }

  stopObservingHeatmapScroller()
})
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
    </section>

    <section v-if="shouldShowSection('summary')" class="content-card summary-card">
      <div class="card-header">
        <h2>区间概览</h2>
      </div>

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
    </section>

    <section
      v-if="shouldShowSection('heatmap') && report.sections.heatmap"
      class="content-card"
    >
      <div class="card-header">
        <h2>字数热力图</h2>
        <span>{{ report.sections.heatmap.points.length }} 天</span>
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
                ></div>
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
      <MoodTrendChart :points="report.sections.moodTrend.points" />
    </section>

    <section
      v-if="shouldShowSection('tagCloud') && report.sections.tagCloud"
      class="content-card"
    >
      <div class="card-header">
        <h2>标签词云</h2>
      </div>
      <TagCloudView :items="report.sections.tagCloud.items" />
    </section>

    <section
      v-if="shouldShowSection('locationPatterns') && report.sections.locationPatterns"
      class="content-card"
    >
      <div class="card-header">
        <h2>地点分析</h2>
      </div>

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
    </section>

    <section
      v-if="shouldShowSection('timePatterns') && report.sections.timePatterns"
      class="content-card"
    >
      <div class="card-header">
        <h2>时间段分析</h2>
      </div>

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
    </section>
  </article>
</template>

<style scoped>
.report-export-document {
  display: grid;
  gap: 18px;
  margin: 0 auto;
  padding: 28px 24px 30px;
  background: var(--color-background);
}

.report-export-document * {
  animation: none !important;
  transition: none !important;
}

.report-hero,
.content-card {
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
}

.report-hero {
  display: grid;
  gap: 8px;
  padding: 22px 24px;
}

.report-label {
  margin: 0;
  color: var(--color-text-subtle);
  letter-spacing: 0.06em;
  font-size: 0.88rem;
}

.report-title {
  margin: 0;
  color: var(--color-text-main);
  font-size: 2rem;
  line-height: 1.35;
}

.report-subtitle {
  margin: 0;
  color: var(--color-text-subtle);
  line-height: 1.7;
}

.content-card {
  display: grid;
  gap: 6px;
  padding: 20px;
}

.summary-card {
  border-color: rgba(217, 203, 159, 0.95);
  background: rgba(255, 255, 255, 0.88);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-header h2 {
  margin: 0;
  color: var(--color-text-main);
  font-size: 1.1rem;
}

.card-header span {
  color: var(--color-text-soft);
  font-size: 0.84rem;
}

.content-card :deep(.mood-chart),
.content-card :deep(.word-cloud-card) {
  margin-top: 0;
}

.content-card :deep(.mood-chart) {
  gap: 0.55rem;
}

.content-card :deep(.word-cloud-card) {
  gap: 0.55rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.stat-item {
  display: grid;
  gap: 5px;
  padding: 12px;
  border: 1px solid rgba(229, 220, 197, 0.9);
  border-radius: 12px;
  background: rgba(250, 246, 234, 0.42);
}

.stat-item span {
  color: var(--color-text-subtle);
  font-size: 0.82rem;
}

.stat-item strong {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  color: var(--color-text-main);
  font-size: 1.2rem;
}

.stat-item small {
  color: var(--color-text-subtle);
  font-size: 0.76rem;
  font-weight: 500;
}

.summary-text {
  margin: 0;
  color: var(--color-text-main);
  line-height: 1.9;
}

.summary-groups {
  display: grid;
  gap: 0;
  padding-top: 6px;
  border-top: 1px solid rgba(217, 203, 159, 0.75);
}

.summary-group {
  display: grid;
  grid-template-columns: 6rem minmax(0, 1fr);
  gap: 14px;
  padding: 12px 0;
}

.summary-group + .summary-group {
  border-top: 1px solid rgba(229, 220, 197, 0.85);
}

.summary-group-head {
  padding-top: 4px;
}

.summary-group-head span {
  color: var(--color-text-main);
  font-weight: 600;
}

.summary-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.summary-item {
  display: grid;
  gap: 4px;
  padding: 4px 0 4px 12px;
  border-left: 1px solid rgba(217, 203, 159, 0.45);
}

.summary-item-time {
  color: #a08855;
  font-size: 0.78rem;
}

.summary-item p {
  margin: 0;
  color: var(--color-text-main);
  line-height: 1.72;
}

.heatmap-shell {
  --heatmap-cell-size: 12px;
  --heatmap-cell-gap: 3px;
  --heatmap-weekdays-width: 2.5rem;
  --heatmap-body-gap: 0.55rem;
  --heatmap-label-top-offset: 1.4rem;

  display: grid;
  gap: 0.45rem;
  margin-top: 0.35rem;
}

.heatmap-body {
  display: flex;
  gap: var(--heatmap-body-gap);
  align-items: flex-start;
}

.heatmap-weekdays {
  display: grid;
  grid-template-rows: repeat(7, var(--heatmap-cell-size));
  gap: var(--heatmap-cell-gap);
  flex: 0 0 var(--heatmap-weekdays-width);
  padding-top: var(--heatmap-label-top-offset);
  box-sizing: border-box;
}

.heatmap-weekday-label {
  display: flex;
  align-items: center;
  height: var(--heatmap-cell-size);
  font-size: 0.82rem;
  color: var(--color-text-subtle);
}

.heatmap-scroller {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  overflow: visible;
  padding-bottom: 0;
}

.heatmap-months {
  display: grid;
  grid-template-columns: repeat(var(--heatmap-week-count), var(--heatmap-cell-size));
  column-gap: var(--heatmap-cell-gap);
}

.heatmap-month-label {
  font-size: 0.84rem;
  line-height: 1;
  color: var(--color-text-subtle);
  white-space: nowrap;
}

.heatmap-scroll-content {
  display: grid;
  gap: 0.45rem;
  width: max-content;
}

.heatmap-grid {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(7, var(--heatmap-cell-size));
  grid-auto-columns: var(--heatmap-cell-size);
  gap: var(--heatmap-cell-gap);
}

.heatmap-cell {
  position: relative;
  width: var(--heatmap-cell-size);
  height: var(--heatmap-cell-size);
  border: 1px solid rgba(217, 203, 159, 0.18);
  border-radius: 3px;
  background-color: #f4efe1;
  box-sizing: border-box;
  overflow: hidden;
}

.heatmap-cell--outside {
  border-color: transparent;
  background: transparent;
}

.heatmap-cell--level-1:not(.heatmap-cell--muted):not(.heatmap-cell--outside) {
  background-color: #e7dcc0;
}

.heatmap-cell--level-2:not(.heatmap-cell--muted):not(.heatmap-cell--outside) {
  background-color: #d9c89d;
}

.heatmap-cell--level-3:not(.heatmap-cell--muted):not(.heatmap-cell--outside) {
  background-color: #c8ad6f;
}

.heatmap-cell--level-4:not(.heatmap-cell--muted):not(.heatmap-cell--outside) {
  background-color: #a5803c;
}

.heatmap-cell--muted {
  border-color: rgba(138, 129, 109, 0.1);
  background-color: #f1efea;
}

.heatmap-cell--muted::after {
  content: '';
  position: absolute;
  top: 50%;
  left: -20%;
  width: 140%;
  height: 1.4px;
  border-radius: 999px;
  background: rgba(138, 129, 109, 0.2);
  transform: translateY(-50%) rotate(-45deg);
  transform-origin: center;
  pointer-events: none;
}

.pattern-layout {
  display: grid;
  grid-template-columns: 1fr 1fr minmax(0, 1.6fr);
  gap: 12px;
}

.pattern-layout--single {
  grid-template-columns: 1fr 1fr;
}

.pattern-summary-card {
  display: grid;
  gap: 4px;
  align-content: start;
  min-height: 86px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: #fffef9;
}

.pattern-summary-card span {
  color: var(--color-text-subtle);
  font-size: 0.78rem;
}

.pattern-summary-card strong {
  color: var(--color-text-main);
  font-size: 1.02rem;
}

.pattern-summary-card em {
  color: #9d8657;
  font-size: 0.76rem;
  font-style: normal;
}

.pattern-list {
  display: grid;
  gap: 8px 10px;
}

.pattern-list--cols-1 {
  grid-template-columns: minmax(0, 1fr);
}

.pattern-list--cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.pattern-list--cols-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.pattern-row {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1.4fr) minmax(60px, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 10px;
  border: 1px solid var(--color-border-soft);
  border-radius: 11px;
  background: #fffef9;
}

.rank {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  min-height: 1.4rem;
  border-radius: 999px;
  background: #f6efdf;
  color: #9d8657;
  font-size: 0.74rem;
}

.label {
  color: var(--color-text-main);
  font-size: 0.86rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track {
  width: 100%;
  height: 5px;
  border-radius: 999px;
  overflow: hidden;
  background: #efe6d3;
}

.fill {
  height: 100%;
  border-radius: inherit;
  background: #ccb278;
}

.count {
  color: var(--color-text-subtle);
  font-size: 0.78rem;
  white-space: nowrap;
}
</style>

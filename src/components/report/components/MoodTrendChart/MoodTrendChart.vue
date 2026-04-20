<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type { ReportMoodPoint } from '../../../../types/dairy'

interface RenderPoint {
  date: string
  value: number
  x: number
  y: number
}

const props = defineProps<{
  points: ReportMoodPoint[]
}>()

const hoveredPoint = ref<RenderPoint | null>(null)
const shellRef = ref<HTMLElement | null>(null)
const chartId = `mood-trend-${Math.random().toString(36).slice(2, 10)}`

const DEFAULT_CHART_WIDTH = 860
const CHART_HEIGHT = 300
const PADDING_TOP = 18
const PADDING_RIGHT = 20
const PADDING_BOTTOM = 40
const PADDING_LEFT = 52
const MOOD_MIN = -5
const MOOD_MAX = 5

const svgWidth = ref(DEFAULT_CHART_WIDTH)
const shellPaddingLeft = ref(14)
const shellPaddingTop = ref(13)
let resizeObserver: ResizeObserver | null = null

const chartWidth = computed(() => Math.max(svgWidth.value, PADDING_LEFT + PADDING_RIGHT + 120))
const plotWidth = computed(() => chartWidth.value - PADDING_LEFT - PADDING_RIGHT)
const plotHeight = computed(() => CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM)

function clampMood(value: number) {
  return Math.max(MOOD_MIN, Math.min(MOOD_MAX, value))
}

function getYByMood(value: number) {
  const ratio = (MOOD_MAX - clampMood(value)) / (MOOD_MAX - MOOD_MIN)
  return PADDING_TOP + ratio * plotHeight.value
}

function formatTickDate(value: string, totalDays: number) {
  if (!dayjs(value).isValid()) {
    return value
  }

  return totalDays >= 90 ? dayjs(value).format('M月') : dayjs(value).format('M/D')
}

function formatTooltipDate(value: string) {
  return dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD') : value
}

function buildLinePath(points: RenderPoint[]) {
  if (points.length === 0) {
    return ''
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`
    }

    return `${path} L ${point.x} ${point.y}`
  }, '')
}

function buildAreaPath(points: RenderPoint[]) {
  if (points.length === 0) {
    return ''
  }

  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  const linePart = buildLinePath(points).replace(/^M [^ ]+ [^ ]+/, '')

  return `M ${firstPoint.x} ${zeroY.value} L ${firstPoint.x} ${firstPoint.y}${linePart} L ${lastPoint.x} ${zeroY.value} Z`
}

function getPointTone(value: number) {
  if (value > 0) {
    return 'positive'
  }

  if (value < 0) {
    return 'negative'
  }

  return 'neutral'
}

function handlePointEnter(point: RenderPoint) {
  hoveredPoint.value = point
}

function handlePointLeave() {
  hoveredPoint.value = null
}

function getNearestPointByX(targetX: number) {
  if (renderPoints.value.length === 0) {
    return null
  }

  return renderPoints.value.reduce((nearest, current) => {
    if (!nearest) {
      return current
    }

    return Math.abs(current.x - targetX) < Math.abs(nearest.x - targetX) ? current : nearest
  }, null as RenderPoint | null)
}

function handleChartMove(event: MouseEvent) {
  const currentTarget = event.currentTarget

  if (!(currentTarget instanceof SVGSVGElement)) {
    return
  }

  const rect = currentTarget.getBoundingClientRect()

  if (rect.width <= 0) {
    return
  }

  const relativeX = ((event.clientX - rect.left) / rect.width) * chartWidth.value
  hoveredPoint.value = getNearestPointByX(relativeX)
}

function handleChartLeave() {
  hoveredPoint.value = null
}

function updateShellMetrics() {
  if (!shellRef.value) {
    return
  }

  const shellStyles = window.getComputedStyle(shellRef.value)
  const paddingLeft = Number.parseFloat(shellStyles.paddingLeft) || 0
  const paddingRight = Number.parseFloat(shellStyles.paddingRight) || 0
  const paddingTop = Number.parseFloat(shellStyles.paddingTop) || 0
  const nextWidth = shellRef.value.clientWidth - paddingLeft - paddingRight

  shellPaddingLeft.value = paddingLeft
  shellPaddingTop.value = paddingTop
  svgWidth.value = Math.max(nextWidth, PADDING_LEFT + PADDING_RIGHT + 120)
}

function stopObservingShell() {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
}

function startObservingShell() {
  stopObservingShell()

  if (!shellRef.value) {
    return
  }

  updateShellMetrics()

  if (typeof ResizeObserver === 'undefined') {
    return
  }

  resizeObserver = new ResizeObserver(() => {
    updateShellMetrics()
  })
  resizeObserver.observe(shellRef.value)
}

const zeroY = computed(() => getYByMood(0))

const chartPoints = computed(() =>
  props.points.map((point, index) => {
    const x =
      props.points.length <= 1
        ? PADDING_LEFT + plotWidth.value / 2
        : PADDING_LEFT + (plotWidth.value * index) / (props.points.length - 1)

    return {
      date: point.date,
      value: point.value,
      x,
      y: point.value === null ? null : getYByMood(point.value),
    }
  }),
)

const renderPoints = computed<RenderPoint[]>(() =>
  chartPoints.value.flatMap((point) =>
    point.value === null || point.y === null
      ? []
      : [
          {
            date: point.date,
            value: point.value,
            x: point.x,
            y: point.y,
          },
        ],
  ),
)

const lineSegments = computed(() => {
  const segments: Array<{
    key: string
    points: RenderPoint[]
    linePath: string
    areaPath: string
  }> = []
  let current: RenderPoint[] = []

  chartPoints.value.forEach((point, index) => {
    if (point.value === null || point.y === null) {
      if (current.length > 0) {
        segments.push({
          key: `${current[0].date}-${current[current.length - 1].date}-${index}`,
          points: current,
          linePath: buildLinePath(current),
          areaPath: buildAreaPath(current),
        })
        current = []
      }

      return
    }

    current.push({
      date: point.date,
      value: point.value,
      x: point.x,
      y: point.y,
    })
  })

  if (current.length > 0) {
    segments.push({
      key: `${current[0].date}-${current[current.length - 1].date}-last`,
      points: current,
      linePath: buildLinePath(current),
      areaPath: buildAreaPath(current),
    })
  }

  return segments
})

const yTicks = computed(() =>
  Array.from({ length: MOOD_MAX - MOOD_MIN + 1 }, (_, index) => {
    const value = MOOD_MAX - index

    return {
      value,
      y: getYByMood(value),
      isMajor: value === MOOD_MAX || value === 0 || value === MOOD_MIN,
      isZero: value === 0,
    }
  }),
)

const xTicks = computed(() => {
  if (props.points.length === 0) {
    return []
  }

  const totalDays = Math.max(
    dayjs(props.points[props.points.length - 1]?.date).diff(dayjs(props.points[0]?.date), 'day') + 1,
    1,
  )

  if (props.points.length === 1) {
    return [
      {
        key: props.points[0].date,
        x: PADDING_LEFT + plotWidth.value / 2,
        shortLabel: formatTickDate(props.points[0].date, totalDays),
        fullLabel: props.points[0].date,
      },
    ]
  }

  const firstDate = dayjs(props.points[0].date)
  const lastDate = dayjs(props.points[props.points.length - 1].date)

  if (!firstDate.isValid() || !lastDate.isValid()) {
    return []
  }

  const tickDates: string[] = [firstDate.format('YYYY-MM-DD')]

  if (totalDays <= 45) {
    let cursor = firstDate.add(7, 'day')

    while (cursor.isBefore(lastDate, 'day')) {
      tickDates.push(cursor.format('YYYY-MM-DD'))
      cursor = cursor.add(7, 'day')
    }
  } else if (totalDays <= 400) {
    const totalMonths = lastDate.startOf('month').diff(firstDate.startOf('month'), 'month') + 1
    const monthStep = totalMonths <= 6 ? 1 : Math.ceil(totalMonths / 6)
    let cursor = firstDate.startOf('month').add(monthStep, 'month')

    while (cursor.isBefore(lastDate, 'day')) {
      tickDates.push(cursor.format('YYYY-MM-DD'))
      cursor = cursor.add(monthStep, 'month')
    }
  } else {
    const totalYears = lastDate.startOf('year').diff(firstDate.startOf('year'), 'year') + 1
    const yearStep = totalYears <= 6 ? 1 : Math.ceil(totalYears / 6)
    let cursor = firstDate.startOf('year').add(yearStep, 'year')

    while (cursor.isBefore(lastDate, 'day')) {
      tickDates.push(cursor.format('YYYY-MM-DD'))
      cursor = cursor.add(yearStep, 'year')
    }
  }

  tickDates.push(lastDate.format('YYYY-MM-DD'))

  const dateIndexMap = new Map(props.points.map((point, index) => [point.date, index]))

  return Array.from(new Set(tickDates))
    .map((date) => {
      const index = dateIndexMap.get(date)

      if (typeof index !== 'number') {
        return null
      }

      return {
        key: `${date}-${index}`,
        x: chartPoints.value[index]?.x ?? PADDING_LEFT,
        shortLabel: formatTickDate(date, totalDays),
        fullLabel: date,
      }
    })
    .filter((tick): tick is { key: string; x: number; shortLabel: string; fullLabel: string } => Boolean(tick))
})

const hasRenderablePoints = computed(() => renderPoints.value.length > 0)
const positiveClipId = `${chartId}-positive`
const negativeClipId = `${chartId}-negative`
const positiveAreaGradientId = `${chartId}-positive-area`
const negativeAreaGradientId = `${chartId}-negative-area`
const tooltipStyle = computed(() => {
  if (!hoveredPoint.value) {
    return null
  }

  return {
    left: `${hoveredPoint.value.x + shellPaddingLeft.value}px`,
    top: `${hoveredPoint.value.y + shellPaddingTop.value}px`,
  }
})

watch(
  [hasRenderablePoints, shellRef],
  async ([nextHasRenderablePoints]) => {
    if (!nextHasRenderablePoints) {
      stopObservingShell()
      return
    }

    await nextTick()
    startObservingShell()
  },
  {
    immediate: true,
    flush: 'post',
  },
)

onBeforeUnmount(() => {
  stopObservingShell()
})
</script>

<template>
  <div class="mood-chart">
    <div v-if="hasRenderablePoints" ref="shellRef" class="mood-chart-shell">
      <svg
        class="mood-chart-svg"
        :width="chartWidth"
        :height="CHART_HEIGHT"
        role="img"
        aria-label="情绪变化折线图"
        @mousemove="handleChartMove"
        @mouseleave="handleChartLeave"
      >
        <defs>
          <linearGradient :id="positiveAreaGradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#66a86e" stop-opacity="0.18" />
            <stop offset="55%" stop-color="#66a86e" stop-opacity="0.08" />
            <stop offset="100%" stop-color="#66a86e" stop-opacity="0.02" />
          </linearGradient>
          <linearGradient :id="negativeAreaGradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#cb6363" stop-opacity="0.02" />
            <stop offset="45%" stop-color="#cb6363" stop-opacity="0.08" />
            <stop offset="100%" stop-color="#cb6363" stop-opacity="0.18" />
          </linearGradient>
          <clipPath :id="positiveClipId">
            <rect
              :x="PADDING_LEFT"
              :y="PADDING_TOP"
              :width="plotWidth"
              :height="zeroY - PADDING_TOP"
            />
          </clipPath>
          <clipPath :id="negativeClipId">
            <rect
              :x="PADDING_LEFT"
              :y="zeroY"
              :width="plotWidth"
              :height="PADDING_TOP + plotHeight - zeroY"
            />
          </clipPath>
        </defs>

        <g class="mood-chart-grid">
          <line
            v-for="tick in yTicks"
            :key="`grid-${tick.value}`"
            :x1="PADDING_LEFT"
            :x2="PADDING_LEFT + plotWidth"
            :y1="tick.y"
            :y2="tick.y"
            :class="[
              'mood-chart-grid-line',
              tick.isMajor ? 'mood-chart-grid-line--major' : '',
              tick.isZero ? 'mood-chart-grid-line--zero' : '',
            ]"
          />
        </g>

        <g class="mood-chart-axis">
          <line
            :x1="PADDING_LEFT"
            :x2="PADDING_LEFT"
            :y1="PADDING_TOP"
            :y2="PADDING_TOP + plotHeight"
            class="mood-chart-axis-line"
          />
          <line
            :x1="PADDING_LEFT"
            :x2="PADDING_LEFT + plotWidth"
            :y1="zeroY"
            :y2="zeroY"
            class="mood-chart-axis-line mood-chart-axis-line--zero"
          />
        </g>

        <g class="mood-chart-y-labels">
          <text
            v-for="tick in yTicks"
            :key="`label-${tick.value}`"
            :x="PADDING_LEFT - 12"
            :y="tick.y + 4"
            :class="[
              'mood-chart-y-label',
              tick.isMajor ? 'mood-chart-y-label--major' : '',
            ]"
            text-anchor="end"
          >
            {{ tick.value }}
          </text>
        </g>

        <g class="mood-chart-areas">
          <path
            v-for="segment in lineSegments"
            :key="`${segment.key}-positive`"
            :d="segment.areaPath"
            class="mood-chart-area mood-chart-area--positive"
            :fill="`url(#${positiveAreaGradientId})`"
            :clip-path="`url(#${positiveClipId})`"
          />
          <path
            v-for="segment in lineSegments"
            :key="`${segment.key}-negative`"
            :d="segment.areaPath"
            class="mood-chart-area mood-chart-area--negative"
            :fill="`url(#${negativeAreaGradientId})`"
            :clip-path="`url(#${negativeClipId})`"
          />
        </g>

        <g class="mood-chart-lines">
          <path
            v-for="segment in lineSegments"
            :key="`${segment.key}-line-positive`"
            :d="segment.linePath"
            class="mood-chart-line mood-chart-line--positive"
            :clip-path="`url(#${positiveClipId})`"
          />
          <path
            v-for="segment in lineSegments"
            :key="`${segment.key}-line-negative`"
            :d="segment.linePath"
            class="mood-chart-line mood-chart-line--negative"
            :clip-path="`url(#${negativeClipId})`"
          />
        </g>

        <g v-if="hoveredPoint" class="mood-chart-hover">
          <line
            :x1="hoveredPoint.x"
            :x2="hoveredPoint.x"
            :y1="PADDING_TOP"
            :y2="PADDING_TOP + plotHeight"
            class="mood-chart-hover-line"
          />
          <circle
            :key="`${hoveredPoint.date}-${hoveredPoint.value}`"
            :cx="hoveredPoint.x"
            :cy="hoveredPoint.y"
            r="5"
            :class="`mood-chart-active-point mood-chart-active-point--${getPointTone(hoveredPoint.value)}`"
          />
        </g>

        <g class="mood-chart-hit-areas">
          <circle
            v-for="point in renderPoints"
            :key="`${point.date}-${point.value}`"
            :cx="point.x"
            :cy="point.y"
            r="9"
            class="mood-chart-hit-area"
            tabindex="0"
            @mouseenter="handlePointEnter(point)"
            @mouseleave="handlePointLeave"
            @focus="handlePointEnter(point)"
            @blur="handlePointLeave"
          />
        </g>

        <g class="mood-chart-x-labels">
          <text
            v-for="tick in xTicks"
            :key="tick.key"
            :x="tick.x"
            :y="CHART_HEIGHT - 12"
            class="mood-chart-x-label"
            text-anchor="middle"
          >
            {{ tick.shortLabel }}
            <title>{{ tick.fullLabel }}</title>
          </text>
        </g>
      </svg>

      <div
        v-if="hoveredPoint && tooltipStyle"
        :key="`${hoveredPoint.date}-${hoveredPoint.value}`"
        class="mood-chart-tooltip"
        :style="tooltipStyle"
      >
        <strong>{{ hoveredPoint.value > 0 ? `+${hoveredPoint.value}` : hoveredPoint.value }}</strong>
        <span>{{ formatTooltipDate(hoveredPoint.date) }}</span>
      </div>
    </div>

    <div v-else class="mood-chart-empty">
      这个区间还没有可绘制的情绪数据。
    </div>

    <div class="mood-chart-legend">
      <span class="legend-item">
        <i class="legend-swatch legend-swatch--positive" />
        正面情绪
      </span>
      <span class="legend-item">
        <i class="legend-swatch legend-swatch--negative" />
        负面情绪
      </span>
    </div>
  </div>
</template>

<style scoped src="./MoodTrendChart.css"></style>


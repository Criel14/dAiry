<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import type { ReportMoodPoint } from '../../types/dairy'

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
const chartId = `mood-trend-${Math.random().toString(36).slice(2, 10)}`

const CHART_WIDTH = 860
const CHART_HEIGHT = 280
const PADDING_TOP = 18
const PADDING_RIGHT = 20
const PADDING_BOTTOM = 40
const PADDING_LEFT = 42
const MOOD_MIN = -5
const MOOD_MAX = 5

const plotWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT
const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM

function clampMood(value: number) {
  return Math.max(MOOD_MIN, Math.min(MOOD_MAX, value))
}

function getYByMood(value: number) {
  const ratio = (MOOD_MAX - clampMood(value)) / (MOOD_MAX - MOOD_MIN)
  return PADDING_TOP + ratio * plotHeight
}

function formatTickDate(value: string) {
  return dayjs(value).isValid() ? dayjs(value).format('M/D') : value
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

    const previous = points[index - 1]
    const previousPrevious = points[index - 2]
    const next = points[index + 1]
    const startControl = getControlPoint(previous, previousPrevious, point)
    const endControl = getControlPoint(point, previous, next, true)

    return `${path} C ${startControl.x} ${startControl.y}, ${endControl.x} ${endControl.y}, ${point.x} ${point.y}`
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

function getControlPoint(
  current: RenderPoint,
  previous?: RenderPoint,
  next?: RenderPoint,
  reverse = false,
) {
  const fallbackPrevious = previous ?? current
  const fallbackNext = next ?? current
  const angle =
    Math.atan2(fallbackNext.y - fallbackPrevious.y, fallbackNext.x - fallbackPrevious.x) +
    (reverse ? Math.PI : 0)
  const length =
    Math.hypot(fallbackNext.x - fallbackPrevious.x, fallbackNext.y - fallbackPrevious.y) * 0.18

  return {
    x: current.x + Math.cos(angle) * length,
    y: current.y + Math.sin(angle) * length,
  }
}

function handlePointEnter(point: RenderPoint) {
  hoveredPoint.value = point
}

function handlePointLeave() {
  hoveredPoint.value = null
}

const zeroY = computed(() => getYByMood(0))

const chartPoints = computed(() =>
  props.points.map((point, index) => {
    const x =
      props.points.length <= 1
        ? PADDING_LEFT + plotWidth / 2
        : PADDING_LEFT + (plotWidth * index) / (props.points.length - 1)

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

  if (props.points.length === 1) {
    return [
      {
        key: props.points[0].date,
        x: PADDING_LEFT + plotWidth / 2,
        shortLabel: formatTickDate(props.points[0].date),
        fullLabel: props.points[0].date,
      },
    ]
  }

  const tickCount = Math.min(props.points.length, 6)
  const indexSet = new Set<number>()

  for (let index = 0; index < tickCount; index += 1) {
    indexSet.add(Math.round((index * (props.points.length - 1)) / (tickCount - 1)))
  }

  return Array.from(indexSet)
    .sort((left, right) => left - right)
    .map((index) => ({
      key: props.points[index].date,
      x: chartPoints.value[index]?.x ?? PADDING_LEFT,
      shortLabel: formatTickDate(props.points[index].date),
      fullLabel: props.points[index].date,
    }))
})

const hasRenderablePoints = computed(() => renderPoints.value.length > 0)
const positiveClipId = `${chartId}-positive`
const negativeClipId = `${chartId}-negative`
const tooltipStyle = computed(() => {
  if (!hoveredPoint.value) {
    return null
  }

  return {
    left: `${(hoveredPoint.value.x / CHART_WIDTH) * 100}%`,
    top: `${(hoveredPoint.value.y / CHART_HEIGHT) * 100}%`,
  }
})
</script>

<template>
  <div class="mood-chart">
    <div v-if="hasRenderablePoints" class="mood-chart-shell">
      <svg
        class="mood-chart-svg"
        :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`"
        role="img"
        aria-label="情绪变化折线图"
      >
        <defs>
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
            :x="PADDING_LEFT - 10"
            :y="tick.y + 4"
            :class="[
              'mood-chart-y-label',
              tick.isMajor ? 'mood-chart-y-label--major' : '',
            ]"
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
            :clip-path="`url(#${positiveClipId})`"
          />
          <path
            v-for="segment in lineSegments"
            :key="`${segment.key}-negative`"
            :d="segment.areaPath"
            class="mood-chart-area mood-chart-area--negative"
            :clip-path="`url(#${negativeClipId})`"
          />
        </g>

        <g class="mood-chart-lines">
          <path
            v-for="segment in lineSegments"
            :key="`${segment.key}-line`"
            :d="segment.linePath"
            class="mood-chart-line"
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
        </g>

        <g class="mood-chart-points">
          <circle
            v-for="point in renderPoints"
            :key="`${point.date}-${point.value}`"
            :cx="point.x"
            :cy="point.y"
            r="4"
            :class="`mood-chart-point mood-chart-point--${getPointTone(point.value)}`"
            tabindex="0"
            @mouseenter="handlePointEnter(point)"
            @mouseleave="handlePointLeave"
            @focus="handlePointEnter(point)"
            @blur="handlePointLeave"
          >
            <title>{{ point.date }} · {{ point.value }} 分</title>
          </circle>
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
        正向情绪
      </span>
      <span class="legend-item">
        <i class="legend-swatch legend-swatch--negative" />
        负向情绪
      </span>
    </div>
  </div>
</template>

<style scoped>
.mood-chart {
  display: grid;
  gap: 0.8rem;
  margin-top: 1rem;
}

.mood-chart-shell,
.mood-chart-empty {
  border: 1px solid var(--color-border-soft);
  border-radius: 14px;
  background: #fffef9;
}

.mood-chart-shell {
  position: relative;
  padding: 0.8rem 0.9rem 0.5rem;
}

.mood-chart-empty {
  padding: 1rem;
  color: var(--color-text-subtle);
  line-height: 1.7;
}

.mood-chart-svg {
  display: block;
  width: 100%;
  height: auto;
}

.mood-chart-grid-line {
  stroke: rgba(217, 203, 159, 0.34);
  stroke-width: 1;
}

.mood-chart-grid-line--major {
  stroke: rgba(217, 203, 159, 0.55);
}

.mood-chart-grid-line--zero {
  stroke: rgba(124, 110, 82, 0.48);
}

.mood-chart-axis-line {
  stroke: rgba(138, 129, 109, 0.62);
  stroke-width: 1.2;
}

.mood-chart-axis-line--zero {
  stroke-width: 1.4;
}

.mood-chart-y-label,
.mood-chart-x-label {
  fill: var(--color-text-subtle);
  font-size: 12px;
}

.mood-chart-y-label--major {
  fill: var(--color-text-main);
}

.mood-chart-area {
  stroke: none;
}

.mood-chart-area--positive {
  fill: rgba(102, 168, 110, 0.24);
}

.mood-chart-area--negative {
  fill: rgba(203, 99, 99, 0.24);
}

.mood-chart-line {
  fill: none;
  stroke: #74674d;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mood-chart-hover-line {
  stroke: rgba(138, 129, 109, 0.42);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.mood-chart-point {
  stroke: rgba(255, 255, 255, 0.9);
  stroke-width: 2;
  cursor: pointer;
  transition:
    r 0.18s ease,
    stroke 0.18s ease,
    stroke-width 0.18s ease;
}

.mood-chart-point:hover,
.mood-chart-point:focus-visible {
  r: 5.5;
  stroke: rgba(255, 255, 255, 1);
  stroke-width: 2.4;
  outline: none;
}

.mood-chart-point--positive {
  fill: #5a9f61;
}

.mood-chart-point--negative {
  fill: #c76767;
}

.mood-chart-point--neutral {
  fill: #97876b;
}

.mood-chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  align-items: center;
  color: var(--color-text-subtle);
  font-size: 0.84rem;
}

.legend-item {
  display: inline-flex;
  gap: 0.45rem;
  align-items: center;
}

.legend-item--hint {
  color: var(--color-text-soft);
}

.legend-swatch {
  display: inline-block;
  width: 0.85rem;
  height: 0.85rem;
  border-radius: 999px;
}

.legend-swatch--positive {
  background: rgba(102, 168, 110, 0.72);
}

.legend-swatch--negative {
  background: rgba(203, 99, 99, 0.72);
}

.mood-chart-tooltip {
  position: absolute;
  display: grid;
  gap: 0.1rem;
  min-width: 5.2rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid rgba(217, 203, 159, 0.95);
  border-radius: 10px;
  background: rgba(255, 253, 248, 0.96);
  box-shadow: 0 10px 28px rgba(61, 56, 45, 0.1);
  color: var(--color-text-main);
  font-size: 0.78rem;
  line-height: 1.5;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 0.9rem));
}

.mood-chart-tooltip strong {
  font-size: 0.92rem;
}

.mood-chart-tooltip span {
  color: var(--color-text-subtle);
}
</style>

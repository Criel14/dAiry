<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ReportTagCloudItem } from '../../../../types/report'

const props = defineProps<{
  items: ReportTagCloudItem[]
}>()

interface PositionedWord {
  label: string
  value: number
  x: number
  y: number
  fontSize: number
  color: string
  opacity: number
}

const TAG_CLOUD_PALETTE = [
  'var(--color-tag-cloud-1)',
  'var(--color-tag-cloud-2)',
  'var(--color-tag-cloud-3)',
  'var(--color-tag-cloud-4)',
  'var(--color-tag-cloud-5)',
  'var(--color-tag-cloud-6)',
]

const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(0)
let resizeObserver: ResizeObserver | null = null

const sortedItems = computed(() =>
  [...props.items].sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, 'zh-CN')),
)

const layout = computed(() => buildWordCloudLayout(sortedItems.value, containerWidth.value))

onMounted(() => {
  if (!containerRef.value) {
    return
  }

  containerWidth.value = Math.round(containerRef.value.clientWidth)
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) {
      return
    }

    containerWidth.value = Math.round(entry.contentRect.width)
  })
  resizeObserver.observe(containerRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function estimateLabelWidth(label: string, fontSize: number) {
  let units = 0

  for (const char of label) {
    if (/[\u3400-\u9fff\uF900-\uFAFF]/u.test(char)) {
      units += 1
      continue
    }

    if (/[A-Z0-9]/.test(char)) {
      units += 0.72
      continue
    }

    if (/[a-z]/.test(char)) {
      units += 0.58
      continue
    }

    units += 0.45
  }

  return fontSize * Math.max(units, 2)
}

function getWordColor(index: number, total: number) {
  return TAG_CLOUD_PALETTE[index % Math.min(TAG_CLOUD_PALETTE.length, Math.max(total, 1))]
}

function createWordBox(
  item: ReportTagCloudItem,
  index: number,
  total: number,
  minValue: number,
  maxValue: number,
  width: number,
  fontScale: number,
) {
  const range = maxValue - minValue
  const normalized = range === 0 ? 1 : (item.value - minValue) / range
  const minFont = clamp(width * 0.025, 13, 18)
  const maxFont = clamp(width * 0.078, 34, 52)
  const fontSize = (minFont + (maxFont - minFont) * Math.pow(normalized, 0.72)) * fontScale
  const textWidth = estimateLabelWidth(item.label, fontSize)
  const paddingX = clamp(fontSize * 0.16, 5, 10)
  const paddingY = clamp(fontSize * 0.1, 2, 5)

  return {
    label: item.label,
    value: item.value,
    fontSize: Math.round(fontSize * 10) / 10,
    color: getWordColor(index, total),
    opacity: 0.5 + normalized * 0.42,
    boxWidth: textWidth + paddingX * 2,
    boxHeight: fontSize + paddingY * 2,
  }
}

function intersects(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
) {
  return !(
    left.x + left.width < right.x ||
    right.x + right.width < left.x ||
    left.y + left.height < right.y ||
    right.y + right.height < left.y
  )
}

function attemptLayout(items: ReportTagCloudItem[], width: number, height: number, fontScale: number) {
  const maxValue = Math.max(...items.map((item) => item.value))
  const minValue = Math.min(...items.map((item) => item.value))
  const placedBoxes: Array<{ x: number; y: number; width: number; height: number }> = []
  const words: PositionedWord[] = []
  const centerX = width / 2
  const centerY = height / 2

  items.forEach((item, index) => {
    const word = createWordBox(item, index, items.length, minValue, maxValue, width, fontScale)
    let placed = false

    for (let step = 0; step < 2800; step += 1) {
      const angle = step * 0.33
      const radius = 1 + step * 0.52
      const x = centerX + Math.cos(angle) * radius - word.boxWidth / 2
      const y = centerY + Math.sin(angle) * radius * 0.78 - word.boxHeight / 2

      if (x < 6 || y < 6 || x + word.boxWidth > width - 6 || y + word.boxHeight > height - 6) {
        continue
      }

      const currentBox = {
        x,
        y,
        width: word.boxWidth,
        height: word.boxHeight,
      }

      if (placedBoxes.some((existingBox) => intersects(existingBox, currentBox))) {
        continue
      }

      placedBoxes.push(currentBox)
      words.push({
        label: word.label,
        value: word.value,
        x: x + word.boxWidth / 2,
        y: y + word.boxHeight / 2,
        fontSize: word.fontSize,
        color: word.color,
        opacity: word.opacity,
      })
      placed = true
      break
    }

    if (!placed) {
      words.push({
        label: word.label,
        value: word.value,
        x: centerX,
        y: centerY,
        fontSize: word.fontSize * 0.88,
        color: word.color,
        opacity: word.opacity,
      })
    }
  })

  return words
}

function buildWordCloudLayout(items: ReportTagCloudItem[], measuredWidth: number) {
  const width = Math.max(measuredWidth || 0, 320)
  const height = clamp(Math.round(width * 0.5), 220, 340)

  if (items.length === 0) {
    return {
      width,
      height,
      words: [] as PositionedWord[],
    }
  }

  let fontScale = 1
  let words = attemptLayout(items, width, height, fontScale)

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const overlapsCenter = words.filter((word) => word.x === width / 2 && word.y === height / 2).length
    if (overlapsCenter <= 1) {
      break
    }

    fontScale *= 0.9
    words = attemptLayout(items, width, height, fontScale)
  }

  return {
    width,
    height,
    words,
  }
}
</script>

<template>
  <div ref="containerRef" class="word-cloud-card">
    <div class="word-cloud-stage">
      <svg
        class="word-cloud-svg"
        :viewBox="`0 0 ${layout.width} ${layout.height}`"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="标签词云"
      >
        <g v-for="word in layout.words" :key="word.label">
          <text
            class="word-cloud-text"
            :x="word.x"
            :y="word.y"
            text-anchor="middle"
            dominant-baseline="middle"
            :font-size="word.fontSize"
            font-weight="400"
            :fill="word.color"
            :fill-opacity="word.opacity"
          >
            <title>{{ word.label }} · {{ word.value }} 次</title>
            {{ word.label }}
          </text>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped src="./TagCloudView.css"></style>


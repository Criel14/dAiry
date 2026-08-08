<script setup lang="ts">
import { computed } from 'vue'
import type { RangeReport, ReportHeatmapPoint } from '../../../../types/report'
import { useHeatmapLayout } from '../../composables/useHeatmapLayout'
import { buildReportHeatmapCells } from '../../shared/report-view'

const props = withDefaults(
  defineProps<{
    report: RangeReport | null
    points: ReportHeatmapPoint[]
    showTooltip?: boolean
    watchKeys?: () => unknown[]
    /** 格子尺寸上限；导出文档传更大值让热力图随宽度填满 */
    maxCellSize?: number
  }>(),
  {
    showTooltip: false,
    watchKeys: () => [],
    maxCellSize: undefined,
  },
)

const heatmapCells = computed(() => buildReportHeatmapCells(props.report, props.points))

const {
  heatmapMonthLabels,
  heatmapScrollerRef,
  heatmapSizingStyle,
  heatmapWeekdayLabels,
} = useHeatmapLayout(heatmapCells, () => [props.report?.reportId, ...props.watchKeys()], {
  maxCellSize: props.maxCellSize,
})
</script>

<template>
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
              :title="showTooltip ? `${cell.date} · ${cell.value} 字` : undefined"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.heatmap-shell {
  --heatmap-cell-size: 12px;
  --heatmap-cell-gap: 3px;
  --heatmap-weekdays-width: 2.5rem;
  --heatmap-body-gap: 0.55rem;
  --heatmap-label-top-offset: 1.4rem;

  display: grid;
  gap: 0.45rem;
  margin-top: 0;
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
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 0.2rem;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb-color) transparent;
}

.heatmap-scroller::-webkit-scrollbar {
  height: 8px;
}

.heatmap-scroller::-webkit-scrollbar-track {
  background: transparent;
}

.heatmap-scroller::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--color-glass-shadow-90);
}

.heatmap-scroll-content {
  display: grid;
  gap: 0.45rem;
  width: max-content;
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
  border: 1px solid var(--color-glass-accent-18);
  border-radius: 3px;
  background-color: var(--color-surface-status);
  box-sizing: border-box;
  overflow: hidden;
}

.heatmap-cell--outside {
  border-color: transparent;
  background-color: transparent;
}

.heatmap-cell--level-1:not(.heatmap-cell--muted):not(.heatmap-cell--outside) {
  background-color: var(--color-surface-report-heat-1);
}

.heatmap-cell--level-2:not(.heatmap-cell--muted):not(.heatmap-cell--outside) {
  background-color: var(--color-surface-report-heat-2);
}

.heatmap-cell--level-3:not(.heatmap-cell--muted):not(.heatmap-cell--outside) {
  background-color: var(--color-surface-report-heat-3);
}

.heatmap-cell--level-4:not(.heatmap-cell--muted):not(.heatmap-cell--outside) {
  background-color: var(--color-surface-report-heat-4);
}

.heatmap-cell--muted {
  border-color: var(--color-glass-shadow-10);
  background-color: var(--color-surface-report-heat-0);
}

.heatmap-cell--muted::after {
  content: '';
  position: absolute;
  top: 50%;
  left: -20%;
  width: 140%;
  height: 1.4px;
  border-radius: 999px;
  background: var(--color-glass-shadow-20);
  transform: translateY(-50%) rotate(-45deg);
  transform-origin: center;
  pointer-events: none;
}
</style>

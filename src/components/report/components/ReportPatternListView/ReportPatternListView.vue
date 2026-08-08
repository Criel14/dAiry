<script setup lang="ts">
import { computed } from 'vue'
import {
  getReportPatternListClass,
  getReportRankingFillWidth,
  type ReportPatternRankingItem,
  type ReportPatternSummaryCard,
} from '../../shared/report-view'

const props = defineProps<{
  summaryCards: ReportPatternSummaryCard[]
  ranking: ReportPatternRankingItem[]
}>()

const maxRankingCount = computed(() =>
  props.ranking.reduce((maxValue, item) => Math.max(maxValue, item.count), 0),
)
</script>

<template>
  <div
    class="pattern-layout"
    :class="{ 'pattern-layout--single': ranking.length === 0 }"
  >
    <article
      v-for="card in summaryCards"
      :key="card.title"
      class="pattern-summary-card"
      :class="{ 'pattern-summary-card--accent': card.accent }"
    >
      <span class="pattern-summary-label">{{ card.title }}</span>
      <div class="pattern-summary-main">
        <strong>{{ card.value }}</strong>
        <em v-if="card.count !== null">{{ card.count }} 次</em>
      </div>
    </article>

    <div
      v-if="ranking.length > 0"
      class="pattern-list"
      :class="getReportPatternListClass(ranking.length)"
    >
      <div
        v-for="(item, index) in ranking"
        :key="item.label"
        class="pattern-row"
      >
        <span class="rank">{{ String(index + 1).padStart(2, '0') }}</span>
        <strong class="label">{{ item.label }}</strong>
        <div class="track">
          <div
            class="fill"
            :style="{ width: getReportRankingFillWidth(item.count, maxRankingCount) }"
          ></div>
        </div>
        <span class="count">{{ item.count }} 次</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pattern-layout {
  display: grid;
  grid-template-columns: minmax(9.8rem, 10.6rem) minmax(9.8rem, 10.6rem) minmax(0, 1fr);
  gap: 0.85rem;
  margin-top: 0;
  align-items: stretch;
}

.pattern-layout--single {
  grid-template-columns: repeat(2, minmax(9.8rem, 10.6rem));
}

.pattern-summary-card {
  display: grid;
  align-content: start;
  gap: 0.28rem;
  min-height: 4.9rem;
  padding: 0.72rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface-elevated);
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.pattern-summary-card--accent {
  background: var(--color-surface-elevated);
}

.pattern-summary-card:hover {
  background: var(--color-glass-white-88);
  border-color: var(--color-border-report-hover);
  box-shadow: var(--shadow-report-hover);
  transform: translateY(-1px);
}

.pattern-summary-label {
  color: var(--color-text-subtle);
  font-size: 0.76rem;
  letter-spacing: 0.02em;
}

.pattern-summary-main {
  display: grid;
  gap: 0.16rem;
}

.pattern-summary-main strong {
  color: var(--color-text-main);
  font-size: 1.02rem;
  line-height: 1.25;
}

.pattern-summary-main em {
  font-style: normal;
  color: var(--color-text-report-soft);
  font-size: 0.77rem;
  line-height: 1.2;
  white-space: nowrap;
}

.pattern-list {
  display: grid;
  --pattern-label-column: minmax(0, 1.45fr);
  --pattern-track-column: minmax(3.8rem, 1.05fr);
  gap: 0.55rem 0.7rem;
  height: 100%;
  align-content: stretch;
}

.pattern-list--single {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
}

.pattern-list--cols-1 {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: repeat(2, minmax(0, 1fr));
}

.pattern-list--cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
}

.pattern-list--cols-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
  --pattern-label-column: minmax(0, 1.2fr);
  --pattern-track-column: minmax(2.8rem, 0.9fr);
}

.pattern-list--cols-3 .pattern-row {
  grid-template-columns: 2rem var(--pattern-label-column) var(--pattern-track-column) auto;
  gap: 0.45rem;
}

.pattern-row {
  display: grid;
  grid-template-columns: 2rem var(--pattern-label-column) var(--pattern-track-column) auto;
  align-items: center;
  align-content: center;
  gap: 0.55rem;
  height: 100%;
  min-height: 3rem;
  padding: 0.68rem 0.76rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 11px;
  background: var(--color-surface-elevated);
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.pattern-row:hover {
  background: var(--color-glass-white-88);
  border-color: var(--color-border-report-hover);
  box-shadow: var(--shadow-report-hover);
  transform: translateY(-1px);
}

.rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.5rem;
  border-radius: 999px;
  background: var(--color-surface-report-note);
  color: var(--color-text-report-soft);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.label {
  color: var(--color-text-main);
  font-size: 0.88rem;
  line-height: 1.35;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: keep-all;
}

.track {
  overflow: hidden;
  width: 100%;
  height: 0.32rem;
  border-radius: 999px;
  background: var(--color-surface-report-chip);
}

.fill {
  height: 100%;
  border-radius: inherit;
  background: var(--color-accent-strong);
}

.count {
  color: var(--color-text-subtle);
  font-size: 0.8rem;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .pattern-layout {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .pattern-list {
    grid-column: 1 / -1;
  }

  .pattern-list--cols-1 {
    grid-template-columns: minmax(0, 1fr);
  }

  .pattern-list--cols-2,
  .pattern-list--cols-3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .pattern-layout,
  .pattern-list {
    grid-template-columns: 1fr;
  }
}
</style>

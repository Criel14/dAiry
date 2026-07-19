<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { ChevronsLeft, ChevronsRight } from 'lucide-vue-next'

const props = defineProps<{
  selectedYear: number
  hasDataYears: Set<string>
}>()

const emit = defineEmits<{
  'update:selectedYear': [year: number]
}>()

const yearPickerPage = ref(Math.floor(dayjs().year() / 12) * 12)

const yearPickerStart = computed(() => yearPickerPage.value)

const yearPickerTitle = computed(() => `${yearPickerStart.value} - ${yearPickerStart.value + 11}`)

const yearCells = computed(() =>
  Array.from({ length: 12 }, (_, index) => {
    const year = yearPickerStart.value + index
    const key = `${year}`

    return {
      key,
      label: `${year} 年`,
      isSelected: year === props.selectedYear,
      isCurrent: year === dayjs().year(),
      hasData: props.hasDataYears.has(key) && year !== props.selectedYear,
    }
  }),
)

function selectYear(key: string) {
  emit('update:selectedYear', Number.parseInt(key, 10))
}

function shiftYearPage(delta: number) {
  yearPickerPage.value += delta * 12
}

function goToCurrentYear() {
  emit('update:selectedYear', dayjs().year())
}
</script>

<template>
  <section class="selector-card">
    <header class="selector-toolbar">
      <button class="toolbar-button" type="button" title="上一组年份" aria-label="上一组年份" @click="shiftYearPage(-1)">
        <ChevronsLeft class="toolbar-icon" aria-hidden="true" />
      </button>
      <strong class="selector-title">{{ yearPickerTitle }}</strong>
      <button class="toolbar-button" type="button" title="下一组年份" aria-label="下一组年份" @click="shiftYearPage(1)">
        <ChevronsRight class="toolbar-icon" aria-hidden="true" />
      </button>
    </header>

    <div class="picker-grid picker-grid--year">
      <button
        v-for="cell in yearCells"
        :key="cell.key"
        class="picker-cell"
        :class="{
          'picker-cell--selected': cell.isSelected,
          'picker-cell--current': cell.isCurrent,
          'picker-cell--has-data': cell.hasData,
        }"
        type="button"
        @click="selectYear(cell.key)"
      >
        {{ cell.label }}
      </button>
    </div>

    <button class="today-button" type="button" @click="goToCurrentYear">
      回到本年
    </button>
  </section>
</template>

<style scoped>
.selector-card {
  display: grid;
  gap: 0.9rem;
}

.selector-toolbar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.75rem;
  align-items: center;
}

.selector-title {
  text-align: center;
  font-size: 0.98rem;
  color: var(--color-text-main);
}

.toolbar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-subtle);
  transition:
    transform 160ms ease,
    color 160ms ease,
    opacity 160ms ease;
}

.toolbar-button:hover {
  color: var(--color-text-main);
  opacity: 0.9;
  transform: translateY(-1px);
}

.toolbar-icon {
  width: 1rem;
  height: 1rem;
}

.picker-grid {
  display: grid;
  gap: 0.55rem;
}

.picker-grid--year {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.picker-cell {
  min-height: 3rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text-main);
  text-align: center;
  transition:
    transform 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    color 160ms ease;
}

.picker-cell:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

.picker-cell--has-data {
  background: var(--color-accent-muted);
  border-color: var(--color-border-report-picker);
}

.picker-cell--current {
  border-color: var(--color-border-calendar-today);
}

.picker-cell--selected {
  border-width: 2px;
  border-color: var(--color-border-selected-strong);
  font-weight: 600;
}

.today-button {
  min-height: 2.25rem;
  justify-self: start;
  padding: 0 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-subtle);
  font-size: 0.88rem;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;
}

.today-button:hover {
  color: var(--color-text-main);
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-soft-sm);
  transform: translateY(-1px);
}

@media (max-width: 640px) {
  .picker-grid--year {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

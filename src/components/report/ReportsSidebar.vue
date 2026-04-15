<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import {
  MAX_CUSTOM_REPORT_RANGE_YEARS,
  type ReportListItem,
  type ReportPreset,
  type ReportSectionKey,
} from '../../types/dairy'

const props = defineProps<{
  hasWorkspace: boolean
  preset: ReportPreset
  monthValue: string
  yearValue: string
  customStartDate: string
  customEndDate: string
  selectedSections: ReportSectionKey[]
  sectionOptions: Array<{
    key: ReportSectionKey
    label: string
    description: string
  }>
  monthReports: ReportListItem[]
  yearReports: ReportListItem[]
  customReportList: ReportListItem[]
  selectedReportId: string | null
  isLoadingList: boolean
  isGenerating: boolean
  statusMessage: string
}>()

const emit = defineEmits<{
  'update:preset': [value: ReportPreset]
  'update:monthValue': [value: string]
  'update:yearValue': [value: string]
  'update:customStartDate': [value: string]
  'update:customEndDate': [value: string]
  toggleSection: [value: ReportSectionKey]
  selectReport: [reportId: string]
  generate: []
}>()

const monthLabels = ['1 月', '2 月', '3 月', '4 月', '5 月', '6 月', '7 月', '8 月', '9 月', '10 月', '11 月', '12 月']
const isSectionOptionsExpanded = ref(false)
const monthPickerYear = ref(parseMonthYear(props.monthValue))
const yearPickerStart = ref(getYearPageStart(parseYearValue(props.yearValue)))

watch(
  () => props.monthValue,
  (value) => {
    monthPickerYear.value = parseMonthYear(value)
  },
  { immediate: true },
)

watch(
  () => props.yearValue,
  (value) => {
    yearPickerStart.value = getYearPageStart(parseYearValue(value))
  },
  { immediate: true },
)

const selectedSectionSummary = computed(() => {
  const selectedCount = new Set(['stats', ...props.selectedSections]).size

  if (selectedCount === 0) {
    return '暂未选择'
  }

  return `已选 ${selectedCount} 项`
})
const isRequiredSection = (sectionKey: ReportSectionKey) => sectionKey === 'stats'
const isSectionSelected = (sectionKey: ReportSectionKey) =>
  isRequiredSection(sectionKey) || props.selectedSections.includes(sectionKey)

const monthReportKeys = computed(
  () => new Set(props.monthReports.map((item) => dayjs(item.startDate).format('YYYY-MM'))),
)

const yearReportKeys = computed(
  () => new Set(props.yearReports.map((item) => dayjs(item.startDate).format('YYYY'))),
)

const monthPickerTitle = computed(() => `${monthPickerYear.value} 年`)
const yearPickerTitle = computed(
  () => `${yearPickerStart.value} - ${yearPickerStart.value + 11}`,
)
const customStartMinDate = computed(() => {
  const endDate = dayjs(props.customEndDate)
  return endDate.isValid()
    ? endDate.subtract(MAX_CUSTOM_REPORT_RANGE_YEARS, 'year').format('YYYY-MM-DD')
    : undefined
})
const customEndMaxDate = computed(() => {
  const startDate = dayjs(props.customStartDate)
  return startDate.isValid()
    ? startDate.add(MAX_CUSTOM_REPORT_RANGE_YEARS, 'year').format('YYYY-MM-DD')
    : undefined
})

const monthCells = computed(() =>
  monthLabels.map((label, index) => {
    const date = dayjs().year(monthPickerYear.value).month(index).startOf('month')
    const key = date.format('YYYY-MM')

    return {
      key,
      label,
      isSelected: key === props.monthValue,
      isCurrent: key === dayjs().format('YYYY-MM'),
      hasReport: monthReportKeys.value.has(key),
    }
  }),
)

const yearCells = computed(() =>
  Array.from({ length: 12 }, (_, index) => {
    const year = yearPickerStart.value + index
    const key = `${year}`

    return {
      key,
      label: `${year} 年`,
      isSelected: key === props.yearValue,
      isCurrent: key === dayjs().format('YYYY'),
      hasReport: yearReportKeys.value.has(key),
    }
  }),
)

const generateButtonText = computed(() => {
  if (props.isGenerating) {
    return '正在生成'
  }

  if (props.preset === 'month') {
    return '生成当前月份报告'
  }

  if (props.preset === 'year') {
    return '生成当前年份报告'
  }

  return '生成并保存报告'
})

function parseMonthYear(value: string) {
  const parsedDate = dayjs(`${value}-01`)
  return parsedDate.isValid() ? parsedDate.year() : dayjs().year()
}

function parseYearValue(value: string) {
  const parsedDate = dayjs(`${value}-01-01`)
  return parsedDate.isValid() ? parsedDate.year() : dayjs().year()
}

function getYearPageStart(year: number) {
  return Math.floor(year / 12) * 12
}

function formatDateTime(value: string) {
  return dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD HH:mm') : value
}

function shiftMonthPickerYear(amount: number) {
  monthPickerYear.value += amount
}

function selectMonth(key: string) {
  emit('update:monthValue', key)
}

function goToCurrentMonth() {
  const currentMonth = dayjs().format('YYYY-MM')
  monthPickerYear.value = dayjs().year()
  emit('update:monthValue', currentMonth)
}

function shiftYearPickerPage(amount: number) {
  yearPickerStart.value += amount * 12
}

function selectYear(key: string) {
  emit('update:yearValue', key)
}

function goToCurrentYear() {
  const currentYear = dayjs().format('YYYY')
  yearPickerStart.value = getYearPageStart(dayjs().year())
  emit('update:yearValue', currentYear)
}
</script>

<template>
  <div v-if="!hasWorkspace" class="reports-sidebar-empty">
    <h3>区间总结</h3>
    <p>先选择一个工作区，左侧这里会显示总结选项、月报年报选择器和历史自定义报告。</p>
  </div>

  <div v-else class="reports-sidebar-stack">
    <section class="panel-card">
      <h3 class="panel-title">生成报告</h3>

      <div class="preset-tabs">
        <button
          class="preset-tab"
          :class="{ 'preset-tab--active': preset === 'month' }"
          type="button"
          @click="emit('update:preset', 'month')"
        >
          本月
        </button>
        <button
          class="preset-tab"
          :class="{ 'preset-tab--active': preset === 'year' }"
          type="button"
          @click="emit('update:preset', 'year')"
        >
          本年
        </button>
        <button
          class="preset-tab"
          :class="{ 'preset-tab--active': preset === 'custom' }"
          type="button"
          @click="emit('update:preset', 'custom')"
        >
          自定义
        </button>
      </div>

      <section v-if="preset === 'month'" class="selector-card">
        <header class="selector-toolbar">
          <button class="toolbar-button" type="button" title="上一年" aria-label="上一年" @click="shiftMonthPickerYear(-1)">
            <Icon class="toolbar-icon" icon="lucide:chevrons-left" aria-hidden="true" />
          </button>
          <strong class="selector-title">{{ monthPickerTitle }}</strong>
          <button class="toolbar-button" type="button" title="下一年" aria-label="下一年" @click="shiftMonthPickerYear(1)">
            <Icon class="toolbar-icon" icon="lucide:chevrons-right" aria-hidden="true" />
          </button>
        </header>

        <div class="picker-grid picker-grid--month">
          <button
            v-for="item in monthCells"
            :key="item.key"
            class="picker-cell"
            :class="{
              'picker-cell--selected': item.isSelected,
              'picker-cell--current': item.isCurrent,
              'picker-cell--has-report': item.hasReport,
            }"
            type="button"
            @click="selectMonth(item.key)"
          >
            {{ item.label }}
          </button>
        </div>

        <button class="today-button" type="button" @click="goToCurrentMonth">
          回到本月
        </button>
      </section>

      <section v-else-if="preset === 'year'" class="selector-card">
        <header class="selector-toolbar">
          <button class="toolbar-button" type="button" title="上一组年份" aria-label="上一组年份" @click="shiftYearPickerPage(-1)">
            <Icon class="toolbar-icon" icon="lucide:chevrons-left" aria-hidden="true" />
          </button>
          <strong class="selector-title">{{ yearPickerTitle }}</strong>
          <button class="toolbar-button" type="button" title="下一组年份" aria-label="下一组年份" @click="shiftYearPickerPage(1)">
            <Icon class="toolbar-icon" icon="lucide:chevrons-right" aria-hidden="true" />
          </button>
        </header>

        <div class="picker-grid picker-grid--year">
          <button
            v-for="item in yearCells"
            :key="item.key"
            class="picker-cell"
            :class="{
              'picker-cell--selected': item.isSelected,
              'picker-cell--current': item.isCurrent,
              'picker-cell--has-report': item.hasReport,
            }"
            type="button"
            @click="selectYear(item.key)"
          >
            {{ item.label }}
          </button>
        </div>

        <button class="today-button" type="button" @click="goToCurrentYear">
          回到本年
        </button>
      </section>

      <div v-else class="field-group">
        <label class="field-label">
          开始日期
          <input
            :min="customStartMinDate"
            :value="customStartDate"
            class="field-input"
            type="date"
            @input="emit('update:customStartDate', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <label class="field-label">
          结束日期
          <input
            :max="customEndMaxDate"
            :value="customEndDate"
            class="field-input"
            type="date"
            @input="emit('update:customEndDate', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <p class="field-hint">自定义区间最长支持 {{ MAX_CUSTOM_REPORT_RANGE_YEARS }} 年跨度。</p>
      </div>

      <div class="field-group">
        <button
          class="section-toggle"
          type="button"
          :aria-expanded="isSectionOptionsExpanded"
          @click="isSectionOptionsExpanded = !isSectionOptionsExpanded"
        >
          <span class="section-toggle-copy">
            <span class="section-toggle-label">总结选项</span>
            <strong class="section-toggle-summary">{{ selectedSectionSummary }}</strong>
          </span>
          <Icon
            class="section-toggle-icon"
            :icon="isSectionOptionsExpanded ? 'lucide:chevron-up' : 'lucide:chevron-down'"
            aria-hidden="true"
          />
        </button>

        <div v-if="isSectionOptionsExpanded" class="check-list">
          <label
            v-for="option in sectionOptions"
            :key="option.key"
            class="check-row"
            :class="{ 'check-row--disabled': isRequiredSection(option.key) }"
          >
            <input
              :checked="isSectionSelected(option.key)"
              :disabled="isRequiredSection(option.key)"
              class="check-input"
              type="checkbox"
              @change="emit('toggleSection', option.key)"
            />
            <span>
              <strong>
                {{ isRequiredSection(option.key) ? `${option.label}（必选）` : option.label }}
              </strong>
              <small>{{ option.description }}</small>
            </span>
          </label>
        </div>
      </div>

      <button
        class="primary-button"
        type="button"
        :disabled="isGenerating"
        @click="emit('generate')"
      >
        <span>{{ generateButtonText }}</span>
        <Icon
          v-if="isGenerating"
          class="button-loading-icon"
          icon="lucide:loader-circle"
          aria-hidden="true"
        />
      </button>

      <p v-if="statusMessage" class="report-status-inline">{{ statusMessage }}</p>
    </section>

    <section v-if="preset === 'custom'" class="panel-card report-list-card">
      <div class="panel-title-row">
        <h3 class="panel-title">历史自定义报告</h3>
        <span class="panel-meta">{{ isLoadingList ? '读取中...' : `${customReportList.length} 份` }}</span>
      </div>

      <div v-if="customReportList.length === 0" class="empty-inline">
        还没有已保存的自定义区间总结。
      </div>

      <div v-else class="report-list">
        <button
          v-for="item in customReportList"
          :key="item.reportId"
          class="report-list-item"
          :class="{ 'report-list-item--active': item.reportId === selectedReportId }"
          type="button"
          @click="emit('selectReport', item.reportId)"
        >
          <strong>{{ item.label }}</strong>
          <small>{{ formatDateTime(item.generatedAt) }}</small>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.reports-sidebar-stack {
  display: grid;
  gap: 1.5rem;
  align-content: start;
}

.panel-card {
  display: grid;
  gap: 0.9rem;
  align-content: start;
  padding: 0;
}

.panel-card + .panel-card {
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.reports-sidebar-empty {
  display: grid;
  gap: 0.6rem;
  padding: 0.4rem 0 0;
}

.reports-sidebar-empty h3,
.panel-title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--color-text-subtle);
}

.reports-sidebar-empty p,
.empty-inline {
  margin: 0;
  color: var(--color-text-subtle);
  line-height: 1.7;
}

.report-status-inline {
  margin: -0.15rem 0 0;
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--color-text-subtle);
}

.button-loading-icon {
  width: 1rem;
  height: 1rem;
  animation: report-button-spin 0.8s linear infinite;
}

@keyframes report-button-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.preset-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.preset-tab,
.primary-button,
.report-list-item {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fffdf8;
  color: var(--color-text-main);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease,
    opacity 160ms ease;
}

.preset-tab,
.primary-button {
  min-height: 2.3rem;
  padding: 0 0.95rem;
}

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
}

.preset-tab--active,
.primary-button {
  background: #f5ebc3;
  border-color: var(--color-border-strong);
}

.preset-tab:hover,
.primary-button:hover,
.report-list-item:hover,
.picker-cell:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(95, 82, 42, 0.08);
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
  box-shadow: none;
}

.selector-card,
.field-group {
  display: grid;
  gap: 0.9rem;
  margin-top: 0.8rem;
}

.selector-card {
  padding: 1rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 14px;
  background: rgba(255, 254, 249, 0.72);
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

.picker-grid--month,
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

.picker-cell--has-report {
  background: #f8f0d7;
  border-color: #dfc98f;
}

.picker-cell--current {
  border-color: #d8c991;
}

.picker-cell--selected {
  border-width: 2px;
  border-color: #766543;
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
  box-shadow: 0 6px 14px rgba(95, 82, 42, 0.08);
  transform: translateY(-1px);
}

.section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  width: 100%;
  padding: 0.15rem 0 0.35rem;
  border: 0;
  border-bottom: 1px solid var(--color-border-soft);
  background: transparent;
  color: var(--color-text-main);
  text-align: left;
  transition:
    color 160ms ease,
    border-color 160ms ease;
}

.section-toggle:hover {
  border-color: var(--color-border);
}

.section-toggle-copy {
  display: grid;
  gap: 0.18rem;
}

.section-toggle-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.section-toggle-summary {
  font-size: 0.84rem;
  font-weight: 400;
  color: var(--color-text-subtle);
}

.section-toggle-icon {
  width: 1.4rem;
  height: 1.4rem;
  flex: 0 0 auto;
  color: var(--color-text-subtle);
}

.check-list {
  display: grid;
  gap: 0.7rem;
}

.field-label {
  display: grid;
  gap: 0.4rem;
  color: var(--color-text-subtle);
  font-size: 0.88rem;
}

.field-input {
  min-height: 2.5rem;
  padding: 0 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fffef9;
  color: var(--color-text-main);
  outline: none;
}

.field-hint {
  margin: -0.25rem 0 0;
  font-size: 0.82rem;
  color: var(--color-text-subtle);
}

.check-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.85rem;
  align-items: start;
  padding: 0.85rem 0.9rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 10px;
  background: rgba(255, 254, 249, 0.72);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.check-row:hover {
  border-color: #d6c48f;
  background: rgba(250, 245, 228, 0.92);
  box-shadow: 0 8px 18px rgba(95, 82, 42, 0.06);
}

.check-input {
  appearance: none;
  width: 1rem;
  height: 1rem;
  margin-top: 0.15rem;
  border: 1px solid #ccb97d;
  border-radius: 0.28rem;
  background: #ffffff;
  transition:
    background-color 160ms ease,
    border-color 160ms ease;
  cursor: pointer;
}

.check-input:checked {
  border-color: #c0ab6d;
  background-color: #d9cb9f;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.4 6.4 11.3 12.5 4.9' fill='none' stroke='%23fffaf0' stroke-linecap='round' stroke-linejoin='round' stroke-width='2.1'/%3E%3C/svg%3E");
  background-position: center;
  background-repeat: no-repeat;
  background-size: 0.78rem;
}

.check-row:hover .check-input {
  border-color: #c5b177;
  background-color: #f8f3e4;
}

.check-row:hover .check-input:checked {
  border-color: #b59f63;
  background-color: #cfbf88;
}

.check-row--disabled {
  cursor: default;
  opacity: 0.96;
}

.check-row--disabled:hover {
  border-color: var(--color-border-soft);
  background: rgba(255, 254, 249, 0.72);
  box-shadow: none;
}

.check-row--disabled .check-input {
  cursor: not-allowed;
}

.check-row strong,
.check-row small {
  display: block;
}

.check-row strong {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text-main);
}

.check-row small {
  margin-top: 0.28rem;
  color: var(--color-text-soft);
  line-height: 1.65;
}

.panel-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.panel-meta {
  color: var(--color-text-soft);
  font-size: 0.85rem;
}

.report-list-card {
  min-height: 0;
}

.report-list {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.report-list-item {
  display: grid;
  gap: 0.38rem;
  justify-items: start;
  width: 100%;
  padding: 0.85rem 0.95rem;
  text-align: left;
}

.report-list-item strong,
.report-list-item small {
  display: block;
}

.report-list-item small {
  color: var(--color-text-subtle);
}

.report-list-item--active {
  background: #f9f2dd;
  border-color: var(--color-border-strong);
}

@media (max-width: 640px) {
  .picker-grid--month,
  .picker-grid--year {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

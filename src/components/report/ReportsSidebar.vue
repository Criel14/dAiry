<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import type { ReportListItem, ReportPreset, ReportSectionKey } from '../../types/dairy'

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
  reportList: ReportListItem[]
  selectedReportId: string | null
  isLoadingList: boolean
  isGenerating: boolean
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

const isSectionOptionsExpanded = ref(false)

const selectedSectionSummary = computed(() => {
  if (props.selectedSections.length === 0) {
    return '暂未选择'
  }

  return `已选 ${props.selectedSections.length} 项`
})

function formatDateTime(value: string) {
  return dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD HH:mm') : value
}

function formatPreset(presetValue: ReportPreset) {
  if (presetValue === 'month') {
    return '月度'
  }

  if (presetValue === 'year') {
    return '年度'
  }

  return '自定义'
}
</script>

<template>
  <div v-if="!hasWorkspace" class="reports-sidebar-empty">
    <h3>区间总结</h3>
    <p>先选择一个工作区，左侧这里会显示生成报告和历史报告菜单。</p>
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

      <div class="field-group">
        <label v-if="preset === 'month'" class="field-label">
          月份
          <input
            :value="monthValue"
            class="field-input"
            type="month"
            @input="emit('update:monthValue', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <label v-else-if="preset === 'year'" class="field-label">
          年份
          <input
            :value="yearValue"
            class="field-input"
            type="number"
            min="2000"
            max="2100"
            @input="emit('update:yearValue', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <template v-else>
          <label class="field-label">
            开始日期
            <input
              :value="customStartDate"
              class="field-input"
              type="date"
              @input="emit('update:customStartDate', ($event.target as HTMLInputElement).value)"
            />
          </label>

          <label class="field-label">
            结束日期
            <input
              :value="customEndDate"
              class="field-input"
              type="date"
              @input="emit('update:customEndDate', ($event.target as HTMLInputElement).value)"
            />
          </label>
        </template>
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
          <span
            class="section-toggle-icon"
            :class="{ 'section-toggle-icon--expanded': isSectionOptionsExpanded }"
            aria-hidden="true"
          >
            ▾
          </span>
        </button>

        <div v-if="isSectionOptionsExpanded" class="check-list">
          <label
            v-for="option in sectionOptions"
            :key="option.key"
            class="check-row"
          >
            <input
              :checked="selectedSections.includes(option.key)"
              type="checkbox"
              @change="emit('toggleSection', option.key)"
            />
            <span>
              <strong>{{ option.label }}</strong>
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
        {{ isGenerating ? '正在生成...' : '生成并保存报告' }}
      </button>
    </section>

    <section class="panel-card report-list-card">
      <div class="panel-title-row">
        <h3 class="panel-title">历史报告</h3>
        <span class="panel-meta">{{ isLoadingList ? '读取中...' : `${reportList.length} 份` }}</span>
      </div>

      <div v-if="reportList.length === 0" class="empty-inline">
        还没有已保存的区间总结。
      </div>

      <div v-else class="report-list">
        <button
          v-for="item in reportList"
          :key="item.reportId"
          class="report-list-item"
          :class="{ 'report-list-item--active': item.reportId === selectedReportId }"
          type="button"
          @click="emit('selectReport', item.reportId)"
        >
          <span class="report-list-tag">{{ formatPreset(item.preset) }}</span>
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

.panel-card {
  padding: 0;
}

.panel-card + .panel-card {
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
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

.preset-tab--active,
.primary-button {
  background: #f5ebc3;
  border-color: var(--color-border-strong);
}

.preset-tab:hover,
.primary-button:hover,
.report-list-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(95, 82, 42, 0.08);
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
  box-shadow: none;
}

.field-group {
  display: grid;
  gap: 0.9rem;
  margin-top: 0.8rem;
}

.field-title {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
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
  font-size: 1.18rem;
  line-height: 1;
  color: var(--color-text-subtle);
  transition: transform 160ms ease;
}

.section-toggle-icon--expanded {
  transform: rotate(180deg);
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

.check-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.85rem;
  align-items: start;
  padding: 0.85rem 0.9rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 10px;
  background: rgba(255, 254, 249, 0.72);
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
.report-list-item small,
.report-list-tag {
  display: block;
}

.report-list-item small,
.report-list-tag {
  color: var(--color-text-subtle);
}

.report-list-item--active {
  background: #f9f2dd;
  border-color: var(--color-border-strong);
}
</style>

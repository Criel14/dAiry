<script setup lang="ts">
import {
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  LoaderCircle,
} from 'lucide-vue-next'
import {
  useReportsSidebar,
  type ReportsSidebarEmits,
  type ReportsSidebarProps,
} from '../../composables/useReportsSidebar'

const props = defineProps<ReportsSidebarProps>()

const emit = defineEmits<ReportsSidebarEmits>()

const {
  MAX_CUSTOM_REPORT_RANGE_YEARS,
  customEndMaxDate,
  customStartMinDate,
  formatDateTime,
  generateButtonText,
  goToCurrentMonth,
  goToCurrentYear,
  isRequiredSection,
  isSectionOptionsExpanded,
  isSectionSelected,
  monthCells,
  monthPickerTitle,
  selectMonth,
  selectYear,
  selectedSectionSummary,
  shiftMonthPickerYear,
  shiftYearPickerPage,
  yearCells,
  yearPickerTitle,
} = useReportsSidebar(props, emit)
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
          月度
        </button>
        <button
          class="preset-tab"
          :class="{ 'preset-tab--active': preset === 'year' }"
          type="button"
          @click="emit('update:preset', 'year')"
        >
          年度
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
            <ChevronsLeft class="toolbar-icon" aria-hidden="true" />
          </button>
          <strong class="selector-title">{{ monthPickerTitle }}</strong>
          <button class="toolbar-button" type="button" title="下一年" aria-label="下一年" @click="shiftMonthPickerYear(1)">
            <ChevronsRight class="toolbar-icon" aria-hidden="true" />
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
            <ChevronsLeft class="toolbar-icon" aria-hidden="true" />
          </button>
          <strong class="selector-title">{{ yearPickerTitle }}</strong>
          <button class="toolbar-button" type="button" title="下一组年份" aria-label="下一组年份" @click="shiftYearPickerPage(1)">
            <ChevronsRight class="toolbar-icon" aria-hidden="true" />
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
          <component
            :is="isSectionOptionsExpanded ? ChevronUp : ChevronDown"
            class="section-toggle-icon"
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

      <div class="generate-action">
        <button
          class="primary-button"
          type="button"
          :disabled="isGenerating"
          @click="emit('generate')"
        >
          <span>{{ generateButtonText }}</span>
          <LoaderCircle
            v-if="isGenerating"
            class="button-loading-icon"
            aria-hidden="true"
          />
        </button>

        <p v-if="isGenerating" class="generate-hint">
          文字较多，可能需要几分钟的时间...
        </p>
      </div>

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
<style scoped src="./ReportsSidebar.css"></style>

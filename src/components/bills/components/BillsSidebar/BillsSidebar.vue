<script setup lang="ts">
import { ChevronDown, ChevronUp, ChevronsLeft, ChevronsRight, Download, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { useBillsSidebar, type BillsSidebarEmits, type BillsSidebarProps } from '../../composables/useBillsSidebar'
import { iconForName } from '../../bills-icons'

const props = defineProps<BillsSidebarProps>()
const emit = defineEmits<BillsSidebarEmits>()

const {
  categoriesOfTab,
  categoryError,
  categoryPanelTab,
  goToCurrentMonth,
  handleCreateCategory,
  handleCreateKeydown,
  handleDeleteCategory,
  handleRenamePrompt,
  isCategoryPanelExpanded,
  isMutatingCategory,
  monthCells,
  monthPickerTitle,
  newCategoryName,
  selectMonth,
  shiftMonthPickerYear,
  switchCategoryTab,
  typeTabs,
} = useBillsSidebar(props, emit)
</script>

<template>
  <div v-if="!hasWorkspace" class="bills-sidebar-empty">
    <h3>记账</h3>
    <p>先选择一个工作区，这里会显示月份选择、分类管理和导出入口。</p>
  </div>

  <div v-else class="bills-sidebar-stack">
    <section class="panel-card">
      <h3 class="panel-title">记账月份</h3>

      <section class="selector-card">
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
            }"
            type="button"
            @click="selectMonth(item.key)"
          >
            {{ item.label }}
          </button>
        </div>

        <button class="today-button" type="button" @click="goToCurrentMonth">回到本月</button>
      </section>
    </section>

    <section class="panel-card">
      <button
        class="section-toggle"
        type="button"
        :aria-expanded="isCategoryPanelExpanded"
        @click="isCategoryPanelExpanded = !isCategoryPanelExpanded"
      >
        <span class="section-toggle-copy">
          <span class="section-toggle-label">分类管理</span>
          <span class="section-toggle-summary">内置分类不可删除，新增分类自动分配样式</span>
        </span>
        <component :is="isCategoryPanelExpanded ? ChevronUp : ChevronDown" class="section-toggle-icon" aria-hidden="true" />
      </button>

      <div v-if="isCategoryPanelExpanded" class="category-panel">
        <div class="category-type-tabs">
          <button
            v-for="tab in typeTabs"
            :key="tab.type"
            class="category-type-tab"
            :class="{ 'category-type-tab--active': categoryPanelTab === tab.type }"
            type="button"
            @click="switchCategoryTab(tab.type)"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="category-list">
          <div v-for="category in categoriesOfTab" :key="`${category.type}:${category.name}`" class="category-row">
            <span class="category-swatch" :style="{ backgroundColor: category.color }">
              <component :is="iconForName(category.icon)" class="category-swatch-icon" aria-hidden="true" />
            </span>
            <span class="category-name">{{ category.name }}</span>
            <template v-if="category.builtin">
              <span class="category-builtin-badge">内置</span>
            </template>
            <template v-else>
              <button
                class="category-action"
                type="button"
                title="重命名"
                aria-label="重命名"
                @click="handleRenamePrompt(category.name)"
              >
                <Pencil class="category-action-icon" aria-hidden="true" />
              </button>
              <button
                class="category-action category-action--danger"
                type="button"
                title="删除"
                aria-label="删除"
                @click="handleDeleteCategory(category.type, category.name)"
              >
                <Trash2 class="category-action-icon" aria-hidden="true" />
              </button>
            </template>
          </div>
        </div>

        <div class="category-create-row">
          <input
            v-model="newCategoryName"
            class="field-input category-create-input"
            type="text"
            maxlength="12"
            placeholder="新分类名"
            @keydown.enter="handleCreateKeydown"
          />
          <button
            class="primary-button category-create-button"
            type="button"
            :disabled="isMutatingCategory"
            @click="handleCreateCategory"
          >
            <Plus class="button-icon" aria-hidden="true" />
            新增
          </button>
        </div>
        <p v-if="categoryError" class="category-error">{{ categoryError }}</p>
      </div>
    </section>

    <section class="panel-card">
      <button
        class="primary-button export-button"
        type="button"
        :disabled="isExporting"
        @click="emit('export')"
      >
        <Download class="button-icon" aria-hidden="true" />
        <span>{{ isExporting ? '正在导出...' : '导出 Excel' }}</span>
      </button>
      <p v-if="statusMessage" class="report-status-inline">{{ statusMessage }}</p>
    </section>
  </div>
</template>

<style scoped src="./BillsSidebar.css"></style>

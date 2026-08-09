<script setup lang="ts">
import { computed } from 'vue'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import type { Bill, BillCategory } from '../../../../types/bills'
import type { BillsModalState } from '../../composables/useBillsPanel'
import {
  aggregateRecords,
  formatCents,
  formatPlainCents,
  groupBillsByDay,
  resolveCategory,
} from '../../composables/useBillsPanel'
import { iconForName } from '../../bills-icons'
import BillsRecordModal from '../BillsRecordModal/BillsRecordModal.vue'
import BillsCharts from '../BillsCharts/BillsCharts.vue'

const props = defineProps<{
  hasWorkspace: boolean
  workspacePath: string | null
  selectedMonth: string
  monthRecords: Bill[]
  yearRecords: Bill[]
  categories: BillCategory[]
  activeTab: 'detail' | 'stats'
  statsScope: 'month' | 'year'
  isLoading: boolean
  statusMessage: string
  modalState: BillsModalState
}>()

const emit = defineEmits<{
  'update:activeTab': [value: 'detail' | 'stats']
  'update:statsScope': [value: 'month' | 'year']
  openCreate: []
  openEdit: [bill: Bill]
  closeModal: []
  'record-saved': []
  deleteRecord: [bill: Bill]
}>()

const WEEK_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const detailGroups = computed(() => groupBillsByDay(props.monthRecords))
const detailSummary = computed(() => aggregateRecords(props.monthRecords, props.categories))

const yearText = computed(() => props.selectedMonth.slice(0, 4))
const monthText = computed(() => props.selectedMonth.slice(5, 7))

function dayLabel(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const weekday = WEEK_NAMES[new Date(year, month - 1, day).getDay()]
  return `${month}月${day}日 ${weekday}`
}

function daySummary(records: Bill[]) {
  return aggregateRecords(records, props.categories)
}

function recordIconName(record: Bill): string {
  return resolveCategory(props.categories, record.amountCents, record.category).icon
}

function recordColor(record: Bill): string {
  return resolveCategory(props.categories, record.amountCents, record.category).color
}
</script>

<template>
  <section class="bills-panel">
    <div v-if="!hasWorkspace" class="bills-panel-empty">
      <h2>记账</h2>
      <p>先选择一个工作区，即可开始记录每天的收支。</p>
    </div>

    <div v-else class="bills-panel-content">
      <header class="bills-toolbar">
        <div class="bills-tabs" role="tablist">
          <button
            class="bills-tab"
            :class="{ 'bills-tab--active': activeTab === 'detail' }"
            type="button"
            role="tab"
            @click="emit('update:activeTab', 'detail')"
          >
            明细
          </button>
          <button
            class="bills-tab"
            :class="{ 'bills-tab--active': activeTab === 'stats' }"
            type="button"
            role="tab"
            @click="emit('update:activeTab', 'stats')"
          >
            统计
          </button>
        </div>
        <button class="add-button" type="button" @click="emit('openCreate')">
          <Plus class="add-button-icon" aria-hidden="true" />
          记一笔
        </button>
      </header>

      <p v-if="statusMessage" class="bills-status">{{ statusMessage }}</p>

      <template v-if="activeTab === 'detail'">
        <div class="summary-bar">
          <span>
            {{ Number(yearText) }}年{{ Number(monthText) }}月 · 共
            <strong>{{ detailSummary.count }}</strong>
            笔 · 支出 {{ formatPlainCents(detailSummary.expense) }} · 收入
            {{ formatPlainCents(detailSummary.income) }}
          </span>
        </div>

        <div v-if="detailGroups.length === 0" class="placeholder-box">本月暂无账单记录</div>

        <div v-else class="day-list">
          <article v-for="[date, records] in detailGroups" :key="date" class="day-card">
            <header class="day-header">
              <span class="day-date">{{ dayLabel(date) }}</span>
              <span class="day-sum">
                <span class="sum-expense">支出 {{ formatPlainCents(daySummary(records).expense) }}</span>
                <span class="sum-income">收入 {{ formatPlainCents(daySummary(records).income) }}</span>
              </span>
            </header>
            <hr class="day-divider" />
            <div v-for="record in records" :key="record.id" class="record-row">
              <span class="record-icon" :style="{ backgroundColor: recordColor(record) }">
                <component :is="iconForName(recordIconName(record))" class="record-icon-svg" aria-hidden="true" />
              </span>
              <div class="record-body">
                <span class="record-category">{{ record.category }}</span>
                <span v-if="record.note" class="record-note">{{ record.note }}</span>
              </div>
              <span class="record-amount" :class="record.amountCents < 0 ? 'amount-expense' : 'amount-income'">
                {{ formatCents(record.amountCents) }}
              </span>
              <span class="record-actions">
                <button class="record-action" type="button" title="编辑" aria-label="编辑" @click="emit('openEdit', record)">
                  <Pencil class="record-action-icon" aria-hidden="true" />
                </button>
                <button class="record-action record-action--danger" type="button" title="删除" aria-label="删除" @click="emit('deleteRecord', record)">
                  <Trash2 class="record-action-icon" aria-hidden="true" />
                </button>
              </span>
            </div>
          </article>
        </div>
      </template>

      <div v-else class="stats-view">
        <div class="stats-scope-tabs">
          <button
            class="stats-scope-tab"
            :class="{ 'stats-scope-tab--active': statsScope === 'month' }"
            type="button"
            @click="emit('update:statsScope', 'month')"
          >
            本月
          </button>
          <button
            class="stats-scope-tab"
            :class="{ 'stats-scope-tab--active': statsScope === 'year' }"
            type="button"
            @click="emit('update:statsScope', 'year')"
          >
            全年
          </button>
        </div>
        <BillsCharts
          :records="statsScope === 'month' ? monthRecords : yearRecords"
          :categories="categories"
          :scope="statsScope"
          :selected-month="selectedMonth"
        />
      </div>
    </div>

    <BillsRecordModal
      :modal-state="modalState"
      :categories="categories"
      :workspace-path="workspacePath"
      @close="emit('closeModal')"
      @saved="emit('record-saved')"
    />
  </section>
</template>

<style scoped src="./BillsPanel.css"></style>

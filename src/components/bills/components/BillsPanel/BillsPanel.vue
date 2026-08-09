<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import type { Bill, BillCategory, BillsWindowTotal } from '../../../../types/bills'
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
import BillsCategorySelect from '../BillsCategorySelect/BillsCategorySelect.vue'

const props = defineProps<{
  hasWorkspace: boolean
  workspacePath: string | null
  selectedMonth: string
  records: Bill[]
  detailRecords: Bill[]
  categories: BillCategory[]
  activeTab: 'detail' | 'stats'
  statsMode: 'month' | 'year'
  selectedYear: number
  detailMonthFilter: 'all' | string
  windowTotals: BillsWindowTotal[]
  isLoading: boolean
  statusMessage: string
  modalState: BillsModalState
}>()

const emit = defineEmits<{
  'update:activeTab': [value: 'detail' | 'stats']
  'update:detailMonthFilter': [value: 'all' | string]
  openCreate: []
  openEdit: [bill: Bill]
  closeModal: []
  'record-saved': []
  deleted: []
}>()

const WEEK_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const categoryFilter = ref('')

const filteredRecords = computed(() =>
  categoryFilter.value
    ? props.detailRecords.filter((r) => r.category === categoryFilter.value)
    : props.detailRecords,
)

const detailGroups = computed(() => groupBillsByDay(filteredRecords.value))
const detailSummary = computed(() => aggregateRecords(filteredRecords.value, props.categories))

const periodText = computed(() =>
  props.statsMode === 'year'
    ? `${props.selectedYear}年`
    : `${Number(props.selectedMonth.slice(0, 4))}年${Number(props.selectedMonth.slice(5, 7))}月`,
)

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

function amountClass(record: Bill): string {
  const type = resolveCategory(props.categories, record.amountCents, record.category).type
  if (type === 'transfer') return 'amount-transfer'
  return record.amountCents < 0 ? 'amount-expense' : 'amount-income'
}

function formatAmount(record: Bill): string {
  const type = resolveCategory(props.categories, record.amountCents, record.category).type
  return type === 'transfer' ? formatPlainCents(record.amountCents) : formatCents(record.amountCents)
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
        <button v-if="activeTab === 'detail'" class="add-button" type="button" @click="emit('openCreate')">
          <Plus class="add-button-icon" aria-hidden="true" />
          记一笔
        </button>
      </header>

      <p v-if="statusMessage" class="bills-status">{{ statusMessage }}</p>

      <template v-if="activeTab === 'detail'">
        <div class="summary-bar">
          <span>
            {{ periodText }} · 共
            <strong>{{ detailSummary.count }}</strong>
            笔 · 支出 <span class="summary-expense">{{ formatPlainCents(detailSummary.expense) }}</span> · 收入
            <span class="summary-income">{{ formatPlainCents(detailSummary.income) }}</span>
          </span>
          <div class="summary-filters">
            <select
              v-if="statsMode === 'year'"
              class="summary-filter-select"
              :value="detailMonthFilter"
              @change="emit('update:detailMonthFilter', ($event.target as HTMLSelectElement).value)"
            >
              <option value="all">全部月份</option>
              <option v-for="m in 12" :key="m" :value="String(m).padStart(2, '0')">{{ m }}月</option>
            </select>
            <BillsCategorySelect
              class="summary-filter"
              :categories="categories"
              v-model="categoryFilter"
              placeholder="全部分类"
              clearable
            />
          </div>
        </div>

        <div v-if="detailGroups.length === 0" class="placeholder-box">
          {{ categoryFilter
            ? '该分类下暂无账单记录'
            : statsMode === 'year'
              ? (detailMonthFilter === 'all' ? '该年暂无账单记录' : '该月份暂无账单记录')
              : '本月暂无账单记录' }}
        </div>

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
            <div
              v-for="record in records"
              :key="record.id"
              class="record-row"
              role="button"
              tabindex="0"
              @click="emit('openEdit', record)"
              @keydown.enter="emit('openEdit', record)"
              @keydown.space.prevent="emit('openEdit', record)"
            >
              <span class="record-icon" :style="{ backgroundColor: recordColor(record) }">
                <component :is="iconForName(recordIconName(record))" class="record-icon-svg" aria-hidden="true" />
              </span>
              <div class="record-body">
                <span class="record-category">{{ record.category }}</span>
                <span v-if="record.note" class="record-note">{{ record.note }}</span>
              </div>
              <span class="record-amount" :class="amountClass(record)">
                {{ formatAmount(record) }}
              </span>
            </div>
          </article>
        </div>
      </template>

      <div v-else class="stats-view">
        <BillsCharts
          :records="records"
          :categories="categories"
          :scope="statsMode"
          :selected-month="selectedMonth"
          :scope-year="statsMode === 'year' ? String(selectedYear) : selectedMonth.slice(0, 4)"
          :window-totals="windowTotals"
        />
      </div>
    </div>

    <BillsRecordModal
      :modal-state="modalState"
      :categories="categories"
      :workspace-path="workspacePath"
      @close="emit('closeModal')"
      @saved="emit('record-saved')"
      @deleted="emit('deleted')"
    />
  </section>
</template>

<style scoped src="./BillsPanel.css"></style>

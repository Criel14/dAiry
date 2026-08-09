import { computed, ref, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import type { Bill, BillCategory, BillsWindowTotal } from '../../../types/bills'
import { getReadableErrorMessage } from '../../../utils/error'
import {
  aggregateRecords,
  buildMonthWindow,
  buildYearWindow,
  expenseTotal,
  filterBillsByMonth,
  formatCents,
  formatPlainCents,
  resolveCategory,
} from '../../../shared/bills-logic'

export interface BillsModalState {
  open: boolean
  editing: Bill | null
}

export interface BillsRecordForm {
  date: string
  type: 'expense' | 'income' | 'transfer'
  amount: string
  category: string
  note: string
}

export function useBillsPanel(workspacePath: Ref<string | null>) {
  const selectedMonth = ref(dayjs().format('YYYY-MM'))
  const activeTab = ref<'detail' | 'stats'>('detail')
  const statsMode = ref<'month' | 'year'>('month')
  const selectedYear = ref(dayjs().year())
  const detailMonthFilter = ref<'all' | string>('all')
  const windowTotals = ref<BillsWindowTotal[]>([])
  let windowLoadSequence = 0
  const monthRecords = ref<Bill[]>([])
  const yearRecords = ref<Bill[]>([])
  const categories = ref<BillCategory[]>([])
  const isLoading = ref(false)
  const isExporting = ref(false)
  const statusMessage = ref('')
  const sidebarStatusMessage = ref('')
  const modalState = ref<BillsModalState>({ open: false, editing: null })
  let loadSequence = 0
  let yearLoadSequence = 0
  let categoryLoadSequence = 0

  const hasWorkspace = computed(() => Boolean(workspacePath.value))
  const selectedYearText = computed(() => String(selectedYear.value))
  const statsYear = computed(() =>
    statsMode.value === 'year' ? selectedYearText.value : selectedMonth.value.slice(0, 4),
  )

  const detailRecords = computed(() => {
    if (statsMode.value === 'year') {
      if (detailMonthFilter.value === 'all') {
        return yearRecords.value
      }
      return filterBillsByMonth(yearRecords.value, detailMonthFilter.value)
    }
    return monthRecords.value
  })

  const statsRecords = computed(() =>
    statsMode.value === 'month' ? monthRecords.value : yearRecords.value,
  )

  watch(
    workspacePath,
    () => {
      void handleWorkspaceChange()
    },
    { immediate: true },
  )

  watch(selectedMonth, () => {
    void reloadMonthRecords()
    void reloadWindowTotals()
  })

  watch(statsYear, () => {
    void reloadYearRecords()
    void reloadWindowTotals()
  })

  watch(statsMode, () => {
    windowTotals.value = []
    void reloadWindowTotals()
  })

  async function handleWorkspaceChange() {
    if (!workspacePath.value) {
      monthRecords.value = []
      yearRecords.value = []
      categories.value = []
      return
    }

    await Promise.all([
      loadCategories(),
      reloadMonthRecords(),
      reloadYearRecords(),
      reloadWindowTotals(),
    ])
  }

  async function loadCategories() {
    if (!workspacePath.value) return
    const current = ++categoryLoadSequence
    try {
      statusMessage.value = ''
      const records = await window.dairy.getBillCategories({ workspacePath: workspacePath.value })
      if (current === categoryLoadSequence) {
        categories.value = records
      }
    } catch (error) {
      statusMessage.value = getReadableErrorMessage(error, '读取分类失败')
    }
  }

  async function reloadMonthRecords() {
    if (!workspacePath.value) return
    const current = ++loadSequence
    try {
      statusMessage.value = ''
      const records = await window.dairy.listBillsByMonth({
        workspacePath: workspacePath.value,
        month: selectedMonth.value,
      })
      if (current === loadSequence) {
        monthRecords.value = records
      }
    } catch (error) {
      statusMessage.value = getReadableErrorMessage(error, '读取账单失败')
    }
  }

  async function reloadYearRecords() {
    if (!workspacePath.value) return
    const current = ++yearLoadSequence
    try {
      statusMessage.value = ''
      const records = await window.dairy.listBillsByYear({
        workspacePath: workspacePath.value,
        year: statsYear.value,
      })
      if (current === yearLoadSequence) {
        yearRecords.value = records
      }
    } catch (error) {
      statusMessage.value = getReadableErrorMessage(error, '读取账单失败')
    }
  }

  async function reloadWindowTotals() {
    if (!workspacePath.value) {
      windowTotals.value = []
      return
    }
    const current = ++windowLoadSequence
    try {
      statusMessage.value = ''
      if (statsMode.value === 'month') {
        const periods = buildMonthWindow(selectedMonth.value, 6)
        const results = await Promise.all(
          periods.map((period) =>
            window.dairy.listBillsByMonth({ workspacePath: workspacePath.value!, month: period }),
          ),
        )
        if (current === windowLoadSequence) {
          windowTotals.value = periods.map((period, index) => ({
            period,
            total: expenseTotal(results[index], categories.value),
          }))
        }
      } else {
        const periods = buildYearWindow(selectedYearText.value, 6)
        const results = await Promise.all(
          periods.map((year) =>
            window.dairy.listBillsByYear({ workspacePath: workspacePath.value!, year }),
          ),
        )
        if (current === windowLoadSequence) {
          windowTotals.value = periods.map((period, index) => ({
            period,
            total: expenseTotal(results[index], categories.value),
          }))
        }
      }
    } catch (error) {
      statusMessage.value = getReadableErrorMessage(error, '读取账单失败')
    }
  }

  function openCreateModal() {
    modalState.value = { open: true, editing: null }
  }

  function openEditModal(bill: Bill) {
    modalState.value = { open: true, editing: bill }
  }

  function closeModal() {
    modalState.value = { open: false, editing: null }
  }

  async function handleRecordSaved() {
    closeModal()
    await Promise.all([reloadMonthRecords(), reloadYearRecords(), reloadWindowTotals()])
  }

  async function handleDeleteRecord(bill: Bill) {
    if (!workspacePath.value) return
    const confirmed = window.confirm('确定删除这笔账单记录？')
    if (!confirmed) return

    try {
      await window.dairy.deleteBill({ workspacePath: workspacePath.value, id: bill.id })
      await Promise.all([reloadMonthRecords(), reloadYearRecords(), reloadWindowTotals()])
    } catch (error) {
      statusMessage.value = getReadableErrorMessage(error, '删除账单失败')
    }
  }

  async function handleDeleteFromModal() {
    const bill = modalState.value.editing
    if (!bill) return
    const confirmed = window.confirm('确定删除这笔账单记录？')
    if (!confirmed) return
    if (!workspacePath.value) return

    try {
      await window.dairy.deleteBill({ workspacePath: workspacePath.value, id: bill.id })
      closeModal()
      await Promise.all([reloadMonthRecords(), reloadYearRecords(), reloadWindowTotals()])
    } catch (error) {
      statusMessage.value = getReadableErrorMessage(error, '删除账单失败')
    }
  }

  async function handleCategoriesChanged() {
    await loadCategories()
    await Promise.all([reloadMonthRecords(), reloadYearRecords(), reloadWindowTotals()])
  }

  async function handleExportExcel() {
    if (!workspacePath.value || isExporting.value) return
    isExporting.value = true
    sidebarStatusMessage.value = ''
    try {
      const result = await window.dairy.exportBillsExcel({ workspacePath: workspacePath.value })
      if (result.canceled) {
        sidebarStatusMessage.value = '已取消导出'
      } else {
        sidebarStatusMessage.value = `已导出：${result.path}`
      }
    } catch (error) {
      sidebarStatusMessage.value = getReadableErrorMessage(error, '导出失败')
    } finally {
      isExporting.value = false
    }
  }

  return {
    activeTab,
    categories,
    closeModal,
    detailMonthFilter,
    detailRecords,
    handleCategoriesChanged,
    handleDeleteFromModal,
    handleDeleteRecord,
    handleExportExcel,
    handleRecordSaved,
    hasWorkspace,
    isLoading,
    isExporting,
    modalState,
    monthRecords,
    openCreateModal,
    openEditModal,
    selectedMonth,
    selectedYear,
    sidebarStatusMessage,
    statsMode,
    statsRecords,
    statusMessage,
    windowTotals,
    yearRecords,
  }
}

export function toCentsFromInput(amountText: string, type: 'expense' | 'income' | 'transfer') {
  const parsed = Number.parseFloat(amountText)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('请输入有效的金额。')
  }
  const cents = Math.round(parsed * 100)
  return type === 'expense' ? -cents : cents
}

export function groupBillsByDay(records: Bill[]): Array<[string, Bill[]]> {
  const map = new Map<string, Bill[]>()
  for (const record of records) {
    const list = map.get(record.date) ?? []
    list.push(record)
    map.set(record.date, list)
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
}

export { aggregateRecords, formatCents, formatPlainCents, resolveCategory }

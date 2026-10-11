import { computed, ref, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import type {
  Bill,
  BillCategory,
  BillsCategoryChange,
  BillsChartJumpPayload,
  BillsSavedPayload,
  BillsSearchMutation,
  BillsSearchWindow,
  BillsWindowTotal,
} from '../../../types/bills'
import { getReadableErrorMessage } from '../../../utils/error'
import {
  aggregateRecords,
  applyBillsMutation,
  applyCategoryRenameToBill,
  BILLS_SEARCH_PAGE_SIZE,
  buildMonthWindow,
  buildYearWindow,
  expenseTotal,
  filterBillsByMonth,
  formatCents,
  formatPlainCents,
  incomeTotal,
  resolveCategory,
  sliceLatestMonths,
  splitNoteByKeyword,
} from '../../../shared/bills-logic'
import { confirmDialog } from '../../../shared/dialog'

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

  const loadedMonthCount = ref(1)
  const LOAD_MORE_STEP = 3

  function distinctMonthCount(records: Bill[]): number {
    const months = new Set<string>()
    for (const record of records) {
      months.add(record.date.slice(0, 7))
    }
    return months.size
  }

  const categoryFilter = ref('')
  const scrollTargetDate = ref<string | null>(null)

  const filteredRecords = computed(() =>
    categoryFilter.value
      ? detailRecords.value.filter((r) => r.category === categoryFilter.value)
      : detailRecords.value,
  )

  const renderedDetailRecords = computed(() => {
    if (statsMode.value === 'year' && detailMonthFilter.value === 'all') {
      return sliceLatestMonths(filteredRecords.value, loadedMonthCount.value)
    }
    return filteredRecords.value
  })

  const hasMoreMonths = computed(() => {
    if (statsMode.value !== 'year' || detailMonthFilter.value !== 'all') {
      return false
    }
    return distinctMonthCount(filteredRecords.value) > loadedMonthCount.value
  })

  const remainingMonthCount = computed(() =>
    Math.max(0, distinctMonthCount(filteredRecords.value) - loadedMonthCount.value),
  )

  function loadMoreMonths() {
    loadedMonthCount.value += LOAD_MORE_STEP
  }

  function handleChartJump(payload: BillsChartJumpPayload) {
    activeTab.value = 'detail'
    if (payload.kind !== 'category') {
      categoryFilter.value = ''
    }
    switch (payload.kind) {
      case 'category':
        categoryFilter.value = payload.category
        break
      case 'day':
        scrollTargetDate.value = payload.date
        break
      case 'month':
        selectedMonth.value = payload.month
        break
      case 'monthOfYear':
        detailMonthFilter.value = payload.month
        if (payload.scrollDate) {
          scrollTargetDate.value = payload.scrollDate
        }
        break
      case 'year':
        selectedYear.value = Number(payload.year)
        detailMonthFilter.value = 'all'
        break
    }
  }

  const statsRecords = computed(() =>
    statsMode.value === 'month' ? monthRecords.value : yearRecords.value,
  )

  // ===== 备注搜索 =====

  const searchInput = ref('')
  const searchKeyword = ref('')
  const searchWindow = ref<BillsSearchWindow>({ records: [], total: 0, income: 0, expense: 0 })
  const isSearchLoading = ref(false)
  const isSearchLoadingMore = ref(false)
  const searchErrorMessage = ref('')
  // 搜索相关异步响应的竞态守卫（沿用 loadSequence 模式）
  let searchSequence = 0

  function resetSearchWindow() {
    searchWindow.value = { records: [], total: 0, income: 0, expense: 0 }
  }

  // 退出搜索（幂等）：清关键词/输入/窗口/加载态；浏览状态（月份/年度/筛选）保持不动
  function exitSearch() {
    searchSequence += 1
    searchKeyword.value = ''
    searchInput.value = ''
    resetSearchWindow()
    isSearchLoading.value = false
    isSearchLoadingMore.value = false
    searchErrorMessage.value = ''
  }

  async function submitSearch() {
    if (!workspacePath.value || isSearchLoading.value) return
    const keyword = searchInput.value.trim()
    if (!keyword) {
      exitSearch()
      return
    }

    searchKeyword.value = keyword
    resetSearchWindow()
    searchErrorMessage.value = ''
    isSearchLoading.value = true
    isSearchLoadingMore.value = false
    const current = ++searchSequence

    try {
      const result = await window.dairy.searchBills({
        workspacePath: workspacePath.value,
        keyword,
        offset: 0,
        limit: BILLS_SEARCH_PAGE_SIZE,
      })
      if (current !== searchSequence) return
      searchWindow.value = {
        records: result.records,
        total: result.total,
        income: result.income,
        expense: result.expense,
      }
    } catch (error) {
      if (current !== searchSequence) return
      searchErrorMessage.value = getReadableErrorMessage(error, '搜索失败')
    } finally {
      if (current === searchSequence) {
        isSearchLoading.value = false
      }
    }
  }

  async function loadMoreSearch() {
    if (!workspacePath.value || !searchKeyword.value) return
    if (isSearchLoading.value || isSearchLoadingMore.value) return
    if (searchWindow.value.total <= searchWindow.value.records.length) return

    const current = searchSequence
    isSearchLoadingMore.value = true
    try {
      const result = await window.dairy.searchBills({
        workspacePath: workspacePath.value,
        keyword: searchKeyword.value,
        offset: searchWindow.value.records.length,
        limit: BILLS_SEARCH_PAGE_SIZE,
      })
      if (current !== searchSequence) return
      // 追加并直接采用响应中的全量统计（顺带修正任何漂移）
      searchWindow.value = {
        records: [...searchWindow.value.records, ...result.records],
        total: result.total,
        income: result.income,
        expense: result.expense,
      }
    } catch {
      // 加载更多失败静默：保持已加载列表，用户可再次点击重试
    } finally {
      if (current === searchSequence) {
        isSearchLoadingMore.value = false
      }
    }
  }

  async function refillSearchWindow() {
    if (!workspacePath.value || !searchKeyword.value || isSearchLoadingMore.value) return

    const current = searchSequence
    isSearchLoadingMore.value = true
    try {
      const result = await window.dairy.searchBills({
        workspacePath: workspacePath.value,
        keyword: searchKeyword.value,
        offset: searchWindow.value.records.length,
        limit: 1,
      })
      if (current !== searchSequence) return
      searchWindow.value = {
        ...searchWindow.value,
        records: [...searchWindow.value.records, ...result.records],
        total: result.total,
        income: result.income,
        expense: result.expense,
      }
    } catch {
      // 补位失败静默：窗口暂时少一条，offset 不变式不受影响
    } finally {
      if (current === searchSequence) {
        isSearchLoadingMore.value = false
      }
    }
  }

  async function refreshSearchSummary() {
    if (!workspacePath.value || !searchKeyword.value) return

    const current = searchSequence
    try {
      const result = await window.dairy.searchBills({
        workspacePath: workspacePath.value,
        keyword: searchKeyword.value,
        offset: searchWindow.value.records.length,
        limit: 1,
      })
      if (current !== searchSequence) return
      searchWindow.value = {
        ...searchWindow.value,
        total: result.total,
        income: result.income,
        expense: result.expense,
      }
    } catch {
      // 统计刷新失败静默：下次取数时修正
    }
  }

  function applySearchMutation(mutation: BillsSearchMutation) {
    if (!searchKeyword.value) return
    const next = applyBillsMutation(searchWindow.value, mutation, categories.value, searchKeyword.value)
    searchWindow.value = next.window
    if (next.needsRefill) {
      void refillSearchWindow()
    }
  }

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
    loadedMonthCount.value = 1
    void reloadYearRecords()
    void reloadWindowTotals()
  })

  watch(statsMode, () => {
    loadedMonthCount.value = 1
    windowTotals.value = []
    void reloadWindowTotals()
  })

  watch(detailMonthFilter, () => {
    loadedMonthCount.value = 1
  })

  watch(categoryFilter, () => {
    loadedMonthCount.value = 1
  })

  async function handleWorkspaceChange() {
    exitSearch()
    if (!workspacePath.value) {
      monthRecords.value = []
      yearRecords.value = []
      windowTotals.value = []
      categories.value = []
      loadedMonthCount.value = 1
      return
    }

    await loadCategories()
    await Promise.all([reloadMonthRecords(), reloadYearRecords(), reloadWindowTotals()])
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
            income: incomeTotal(results[index], categories.value),
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
            income: incomeTotal(results[index], categories.value),
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

  async function handleRecordSaved(payload?: BillsSavedPayload) {
    closeModal()
    if (payload) {
      applySearchMutation(payload)
    }
    await Promise.all([reloadMonthRecords(), reloadYearRecords(), reloadWindowTotals()])
  }

  async function handleDeleteRecord(bill: Bill) {
    if (!workspacePath.value) return
    const confirmed = await confirmDialog('确定删除这笔账单记录？')
    if (!confirmed) return

    try {
      await window.dairy.deleteBill({ workspacePath: workspacePath.value, id: bill.id })
      applySearchMutation({ kind: 'delete', bill })
      await Promise.all([reloadMonthRecords(), reloadYearRecords(), reloadWindowTotals()])
    } catch (error) {
      statusMessage.value = getReadableErrorMessage(error, '删除账单失败')
    }
  }

  async function handleDeleteFromModal() {
    const bill = modalState.value.editing
    if (!bill) return
    const confirmed = await confirmDialog('确定删除这笔账单记录？')
    if (!confirmed) return
    if (!workspacePath.value) return

    try {
      await window.dairy.deleteBill({ workspacePath: workspacePath.value, id: bill.id })
      closeModal()
      applySearchMutation({ kind: 'delete', bill })
      await Promise.all([reloadMonthRecords(), reloadYearRecords(), reloadWindowTotals()])
    } catch (error) {
      statusMessage.value = getReadableErrorMessage(error, '删除账单失败')
    }
  }

  async function handleCategoriesChanged(change?: BillsCategoryChange) {
    await loadCategories()
    if (searchKeyword.value) {
      if (change?.kind === 'rename') {
        searchWindow.value = {
          ...searchWindow.value,
          records: searchWindow.value.records.map((bill) => applyCategoryRenameToBill(bill, change)),
        }
      }
      // 分类增删改会改变 resolveCategory 的解析口径，必须静默刷新全量统计
      void refreshSearchSummary()
    }
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
    categoryFilter,
    closeModal,
    detailMonthFilter,
    detailRecords,
    exitSearch,
    filteredRecords,
    handleCategoriesChanged,
    handleChartJump,
    handleDeleteFromModal,
    handleDeleteRecord,
    handleExportExcel,
    handleRecordSaved,
    hasMoreMonths,
    hasWorkspace,
    isLoading,
    isExporting,
    isSearchLoading,
    isSearchLoadingMore,
    loadMoreMonths,
    loadMoreSearch,
    modalState,
    monthRecords,
    openCreateModal,
    openEditModal,
    remainingMonthCount,
    renderedDetailRecords,
    selectedMonth,
    selectedYear,
    scrollTargetDate,
    searchErrorMessage,
    searchInput,
    searchKeyword,
    searchWindow,
    sidebarStatusMessage,
    statsMode,
    statsRecords,
    statusMessage,
    submitSearch,
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

export { aggregateRecords, formatCents, formatPlainCents, resolveCategory, splitNoteByKeyword }

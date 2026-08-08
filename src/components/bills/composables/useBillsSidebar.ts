import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type { BillCategory, BillType } from '../../../types/bills'
import { BILL_TYPE_LABELS, BILL_TYPES } from '../../../types/bills'
import { getReadableErrorMessage } from '../../../utils/error'

export interface BillsSidebarProps {
  hasWorkspace: boolean
  workspacePath: string | null
  selectedMonth: string
  categories: BillCategory[]
  isLoadingCategories: boolean
  isExporting: boolean
  statusMessage: string
}

export type BillsSidebarEmits = {
  'update:selectedMonth': [value: string]
  categoryChanged: []
  export: []
}

type BillsSidebarEmitFn = <K extends keyof BillsSidebarEmits>(
  event: K,
  ...args: BillsSidebarEmits[K]
) => void

const monthLabels = [
  '1 月', '2 月', '3 月', '4 月', '5 月', '6 月',
  '7 月', '8 月', '9 月', '10 月', '11 月', '12 月',
]

export function useBillsSidebar(props: BillsSidebarProps, emit: BillsSidebarEmitFn) {
  const monthPickerYear = ref(parseMonthYear(props.selectedMonth))
  const isCategoryPanelExpanded = ref(false)
  const categoryPanelTab = ref<BillType>('expense')
  const newCategoryName = ref('')
  const categoryError = ref('')
  const isMutatingCategory = ref(false)

  watch(
    () => props.selectedMonth,
    (value) => {
      monthPickerYear.value = parseMonthYear(value)
    },
    { immediate: true },
  )

  const monthPickerTitle = computed(() => `${monthPickerYear.value} 年`)
  const monthCells = computed(() =>
    monthLabels.map((label, index) => {
      const key = dayjs().year(monthPickerYear.value).month(index).format('YYYY-MM')
      return {
        key,
        label,
        isSelected: key === props.selectedMonth,
        isCurrent: key === dayjs().format('YYYY-MM'),
      }
    }),
  )

  const categoriesOfTab = computed(() =>
    props.categories.filter((c) => c.type === categoryPanelTab.value),
  )
  const typeTabs = computed(() =>
    BILL_TYPES.map((type) => ({ type, label: BILL_TYPE_LABELS[type] })),
  )

  function shiftMonthPickerYear(amount: number) {
    monthPickerYear.value += amount
  }

  function selectMonth(key: string) {
    emit('update:selectedMonth', key)
  }

  function goToCurrentMonth() {
    monthPickerYear.value = dayjs().year()
    emit('update:selectedMonth', dayjs().format('YYYY-MM'))
  }

  function switchCategoryTab(type: BillType) {
    categoryPanelTab.value = type
    categoryError.value = ''
  }

  async function handleCreateCategory() {
    if (isMutatingCategory.value) return
    if (!props.workspacePath) return
    const name = newCategoryName.value.trim()
    if (!name) {
      categoryError.value = '请输入分类名'
      return
    }
    isMutatingCategory.value = true
    try {
      await window.dairy.createBillCategory({
        workspacePath: props.workspacePath,
        type: categoryPanelTab.value,
        name,
      })
      newCategoryName.value = ''
      categoryError.value = ''
      emit('categoryChanged')
    } catch (error) {
      categoryError.value = getReadableErrorMessage(error, '创建分类失败')
    } finally {
      isMutatingCategory.value = false
    }
  }

  function handleCreateKeydown(event: KeyboardEvent) {
    if (!event.isComposing) {
      void handleCreateCategory()
    }
  }

  async function handleRenameCategory(type: BillType, name: string, newName: string) {
    if (isMutatingCategory.value) return
    if (!props.workspacePath) return
    isMutatingCategory.value = true
    try {
      await window.dairy.renameBillCategory({
        workspacePath: props.workspacePath,
        type,
        name,
        newName,
      })
      emit('categoryChanged')
    } catch (error) {
      categoryError.value = getReadableErrorMessage(error, '重命名分类失败')
    } finally {
      isMutatingCategory.value = false
    }
  }

  function handleRenamePrompt(name: string) {
    const newName = window.prompt('输入新的分类名', name)
    if (!newName || newName.trim() === '' || newName.trim() === name) {
      return
    }
    void handleRenameCategory(categoryPanelTab.value, name, newName.trim())
  }

  async function handleDeleteCategory(type: BillType, name: string) {
    if (isMutatingCategory.value) return
    if (!props.workspacePath) return
    const confirmed = window.confirm(`删除分类「${name}」？历史账单将回退为其他样式。`)
    if (!confirmed) return
    isMutatingCategory.value = true
    try {
      await window.dairy.deleteBillCategory({
        workspacePath: props.workspacePath,
        type,
        name,
      })
      emit('categoryChanged')
    } catch (error) {
      categoryError.value = getReadableErrorMessage(error, '删除分类失败')
    } finally {
      isMutatingCategory.value = false
    }
  }

  return {
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
  }
}

function parseMonthYear(value: string) {
  const parsedDate = dayjs(`${value}-01`)
  return parsedDate.isValid() ? parsedDate.year() : dayjs().year()
}

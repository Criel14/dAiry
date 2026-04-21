import { computed, ref, watch } from 'vue'
import type { ReportExportSectionKey } from '../../../../types/report'
import {
  REPORT_EXPORT_SECTION_OPTIONS,
  getAvailableExportSections,
  getDefaultExportSections,
} from '../../config/export-config'
import type { ReportsPanelProps } from './types'

const DEFAULT_EXPORT_IMAGE_SCALE = '1.5'
const MIN_EXPORT_IMAGE_SCALE = 1
const MAX_EXPORT_IMAGE_SCALE = 3
const DEFAULT_EXPORT_DOCUMENT_WIDTH = '1200'
const MIN_EXPORT_DOCUMENT_WIDTH = 1000
const MAX_EXPORT_DOCUMENT_WIDTH = 2400

export function useReportExportDialog(props: ReportsPanelProps) {
  const isExportDialogVisible = ref(false)
  const isExporting = ref(false)
  const exportDialogMessage = ref('')
  const selectedExportSections = ref<ReportExportSectionKey[]>([])
  const selectedExportDocumentWidth = ref(DEFAULT_EXPORT_DOCUMENT_WIDTH)
  const selectedExportImageScale = ref(DEFAULT_EXPORT_IMAGE_SCALE)
  const exportSectionOptions = REPORT_EXPORT_SECTION_OPTIONS

  const availableExportSections = computed(() => getAvailableExportSections(props.activeReport))
  const parsedExportDocumentWidth = computed(() =>
    parseExportDocumentWidth(selectedExportDocumentWidth.value),
  )
  const parsedExportImageScale = computed(() => parseExportImageScale(selectedExportImageScale.value))
  const canOpenExportDialog = computed(() => Boolean(props.activeReport) && !props.isLoadingReport)
  const canStartExport = computed(
    () =>
      Boolean(props.activeReport) &&
      Boolean(props.workspacePath?.trim()) &&
      selectedExportSections.value.length > 0 &&
      parsedExportDocumentWidth.value !== null &&
      parsedExportImageScale.value !== null &&
      !isExporting.value,
  )

  watch(
    () => props.activeReport?.reportId,
    () => {
      isExportDialogVisible.value = false
      exportDialogMessage.value = ''
      selectedExportSections.value = getDefaultExportSections(props.activeReport)
      selectedExportDocumentWidth.value = DEFAULT_EXPORT_DOCUMENT_WIDTH
      selectedExportImageScale.value = DEFAULT_EXPORT_IMAGE_SCALE
    },
    { immediate: true },
  )

  function openExportDialog() {
    if (!canOpenExportDialog.value) {
      return
    }

    exportDialogMessage.value = ''
    selectedExportSections.value = getDefaultExportSections(props.activeReport)
    selectedExportDocumentWidth.value = DEFAULT_EXPORT_DOCUMENT_WIDTH
    selectedExportImageScale.value = DEFAULT_EXPORT_IMAGE_SCALE
    isExportDialogVisible.value = true
  }

  function closeExportDialog() {
    if (isExporting.value) {
      return
    }

    exportDialogMessage.value = ''
    isExportDialogVisible.value = false
  }

  function isExportSectionSelected(sectionKey: ReportExportSectionKey) {
    return selectedExportSections.value.includes(sectionKey)
  }

  function isExportSectionAvailable(sectionKey: ReportExportSectionKey) {
    return availableExportSections.value.has(sectionKey)
  }

  function toggleExportSection(sectionKey: ReportExportSectionKey) {
    if (!isExportSectionAvailable(sectionKey) || isExporting.value) {
      return
    }

    if (isExportSectionSelected(sectionKey)) {
      selectedExportSections.value = selectedExportSections.value.filter((item) => item !== sectionKey)
      return
    }

    selectedExportSections.value = [...selectedExportSections.value, sectionKey]
  }

  function parseExportDocumentWidth(rawValue: string) {
    const trimmedValue = rawValue.trim()

    if (!trimmedValue) {
      return null
    }

    const parsedValue = Number(trimmedValue)

    if (!Number.isFinite(parsedValue)) {
      return null
    }

    if (parsedValue < MIN_EXPORT_DOCUMENT_WIDTH || parsedValue > MAX_EXPORT_DOCUMENT_WIDTH) {
      return null
    }

    return Math.round(parsedValue)
  }

  function parseExportImageScale(rawValue: string) {
    const trimmedValue = rawValue.trim()

    if (!trimmedValue) {
      return null
    }

    const parsedValue = Number(trimmedValue)

    if (!Number.isFinite(parsedValue)) {
      return null
    }

    if (parsedValue < MIN_EXPORT_IMAGE_SCALE || parsedValue > MAX_EXPORT_IMAGE_SCALE) {
      return null
    }

    return Math.round(parsedValue * 10) / 10
  }

  function formatExportImageScale(value: number) {
    const normalizedValue = Math.round(value * 10) / 10

    return Number.isInteger(normalizedValue)
      ? String(normalizedValue)
      : normalizedValue.toFixed(1)
  }

  function stepExportDocumentWidth(delta: number) {
    const currentValue =
      parseExportDocumentWidth(selectedExportDocumentWidth.value) ??
      Number(DEFAULT_EXPORT_DOCUMENT_WIDTH)
    const nextValue = Math.min(
      MAX_EXPORT_DOCUMENT_WIDTH,
      Math.max(MIN_EXPORT_DOCUMENT_WIDTH, currentValue + delta),
    )

    selectedExportDocumentWidth.value = String(Math.round(nextValue))
  }

  function stepExportImageScale(delta: number) {
    const currentValue =
      parseExportImageScale(selectedExportImageScale.value) ?? Number(DEFAULT_EXPORT_IMAGE_SCALE)
    const nextValue = Math.min(
      MAX_EXPORT_IMAGE_SCALE,
      Math.max(MIN_EXPORT_IMAGE_SCALE, currentValue + delta),
    )

    selectedExportImageScale.value = formatExportImageScale(nextValue)
  }

  async function handleExportReport() {
    if (!props.activeReport || !props.workspacePath?.trim()) {
      exportDialogMessage.value = '当前没有可导出的报告。'
      return
    }

    if (selectedExportSections.value.length === 0) {
      exportDialogMessage.value = '请至少选择一个导出内容。'
      return
    }

    if (parsedExportDocumentWidth.value === null) {
      exportDialogMessage.value = `导出宽度请输入 ${MIN_EXPORT_DOCUMENT_WIDTH} 到 ${MAX_EXPORT_DOCUMENT_WIDTH} 之间的数字。`
      return
    }

    if (parsedExportImageScale.value === null) {
      exportDialogMessage.value = `渲染倍率请输入 ${MIN_EXPORT_IMAGE_SCALE} 到 ${MAX_EXPORT_IMAGE_SCALE} 之间的数字。`
      return
    }

    isExporting.value = true
    exportDialogMessage.value = '正在准备图片...'

    try {
      const result = await window.dairy.exportRangeReportPng({
        workspacePath: props.workspacePath,
        reportId: props.activeReport.reportId,
        sections: [...selectedExportSections.value],
        documentWidth: parsedExportDocumentWidth.value,
        imageScale: parsedExportImageScale.value,
      })

      if (result.canceled) {
        exportDialogMessage.value = '已取消导出。'
        return
      }

      exportDialogMessage.value = '图片已导出。'
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出失败，请稍后重试。'
      exportDialogMessage.value = message
    } finally {
      isExporting.value = false
    }
  }

  return {
    DEFAULT_EXPORT_DOCUMENT_WIDTH,
    DEFAULT_EXPORT_IMAGE_SCALE,
    MAX_EXPORT_DOCUMENT_WIDTH,
    MAX_EXPORT_IMAGE_SCALE,
    MIN_EXPORT_DOCUMENT_WIDTH,
    MIN_EXPORT_IMAGE_SCALE,
    canOpenExportDialog,
    canStartExport,
    closeExportDialog,
    exportDialogMessage,
    exportSectionOptions,
    handleExportReport,
    isExportDialogVisible,
    isExportSectionAvailable,
    isExportSectionSelected,
    isExporting,
    openExportDialog,
    selectedExportDocumentWidth,
    selectedExportImageScale,
    stepExportDocumentWidth,
    stepExportImageScale,
    toggleExportSection,
  }
}

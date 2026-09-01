import { ref, type Ref } from 'vue'
import type { TimelineEvent, TimelineYearData } from '../../../types/timeline'
import dayjs from 'dayjs'
import { confirmDialog, showAlertMessage } from '../../../shared/dialog'

export function useTimeline(workspacePath: Ref<string | null>) {
  const selectedTimelineYear = ref(dayjs().year())
  const timelineData = ref<TimelineYearData | null>(null)
  const hasDataYears = ref<Set<string>>(new Set())
  const isRebuildingTimeline = ref(false)
  const isCancellingTimelineRebuild = ref(false)
  const timelineRebuildProgress = ref<{ weekLabel: string; current: number; total: number } | null>(null)
  const eventModalOpen = ref(false)
  const editingEvent = ref<TimelineEvent | null>(null)
  let unlistenProgress: (() => void) | null = null

  async function loadTimeline(year: number) {
    if (!workspacePath.value) return
    timelineData.value = await window.dairy.getTimeline({
      workspacePath: workspacePath.value,
      year,
    })
  }

  function handleSelectTimelineYear(year: number) {
    selectedTimelineYear.value = year
    loadTimeline(year)
  }

  async function handleRebuildTimeline() {
    if (!workspacePath.value) return
    isRebuildingTimeline.value = true

    unlistenProgress = window.dairy.onTimelineRebuildProgress((progress) => {
      timelineRebuildProgress.value = progress
    })

    try {
      const result = await window.dairy.rebuildTimeline({
        workspacePath: workspacePath.value,
        year: selectedTimelineYear.value,
      })
      if (result.skipped) {
        await showAlertMessage(
          `未找到 ${selectedTimelineYear.value} 年的日记，未生成时间轴，请确认该年份已写入日记。`,
        )
      }
      await loadTimeline(selectedTimelineYear.value)
    } catch (err) {
      await showAlertMessage(err instanceof Error ? err.message : '时间轴整理失败，请稍后重试。')
    } finally {
      isRebuildingTimeline.value = false
      isCancellingTimelineRebuild.value = false
      timelineRebuildProgress.value = null
      if (unlistenProgress) {
        unlistenProgress()
        unlistenProgress = null
      }
    }
  }

  function handleCancelTimelineRebuild() {
    isCancellingTimelineRebuild.value = true
    window.dairy.cancelTimelineRebuild()
  }

  function openCreateEventModal() {
    editingEvent.value = null
    eventModalOpen.value = true
  }

  function openEditEventModal(event: TimelineEvent) {
    editingEvent.value = event
    eventModalOpen.value = true
  }

  function closeEventModal() {
    eventModalOpen.value = false
    editingEvent.value = null
  }

  async function handleEventModalSaved() {
    eventModalOpen.value = false
    editingEvent.value = null
    await loadTimeline(selectedTimelineYear.value)
  }

  async function handleDeleteEvent(event: TimelineEvent) {
    if (!workspacePath.value) return

    const confirmed = await confirmDialog('确定删除这条时间线事件吗？')
    if (!confirmed) return

    try {
      const result = await window.dairy.deleteTimelineEvent({
        workspacePath: workspacePath.value,
        id: event.id,
      })
      if (!result.ok) {
        await showAlertMessage('未找到该事件，可能已被删除。')
        return
      }
      await loadTimeline(selectedTimelineYear.value)
    } catch (err) {
      await showAlertMessage(err instanceof Error ? err.message : '删除失败，请稍后重试。')
    }
  }

  async function openTimelinePage() {
    if (!workspacePath.value) return
    loadTimeline(selectedTimelineYear.value)
    const years = await window.dairy.getJournalYearsWithEntries(workspacePath.value)
    hasDataYears.value = new Set(years)
  }

  return {
    selectedTimelineYear,
    timelineData,
    hasDataYears,
    isRebuildingTimeline,
    isCancellingTimelineRebuild,
    timelineRebuildProgress,
    eventModalOpen,
    editingEvent,
    handleSelectTimelineYear,
    handleRebuildTimeline,
    handleCancelTimelineRebuild,
    openCreateEventModal,
    openEditEventModal,
    closeEventModal,
    handleEventModalSaved,
    handleDeleteEvent,
    openTimelinePage,
    loadTimeline,
  }
}

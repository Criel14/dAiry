import { ref, type Ref } from 'vue'
import type { TimelineYearData } from '../../../types/timeline'
import dayjs from 'dayjs'

export function useTimeline(workspacePath: Ref<string | null>) {
  const selectedTimelineYear = ref(dayjs().year())
  const timelineData = ref<TimelineYearData | null>(null)
  const isRebuildingTimeline = ref(false)
  const timelineRebuildProgress = ref<{ weekLabel: string; current: number; total: number } | null>(null)
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
      await window.dairy.rebuildTimeline(workspacePath.value)
      await loadTimeline(selectedTimelineYear.value)
    } finally {
      isRebuildingTimeline.value = false
      timelineRebuildProgress.value = null
      if (unlistenProgress) {
        unlistenProgress()
        unlistenProgress = null
      }
    }
  }

  function handleCancelTimelineRebuild() {
    window.dairy.cancelTimelineRebuild()
  }

  function openTimelinePage() {
    if (!workspacePath.value) return
    loadTimeline(selectedTimelineYear.value)
  }

  return {
    selectedTimelineYear,
    timelineData,
    isRebuildingTimeline,
    timelineRebuildProgress,
    handleSelectTimelineYear,
    handleRebuildTimeline,
    handleCancelTimelineRebuild,
    openTimelinePage,
    loadTimeline,
  }
}

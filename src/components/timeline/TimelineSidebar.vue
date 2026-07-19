<script setup lang="ts">
import YearPickerGrid from '../shared/YearPickerGrid.vue'

defineProps<{
  selectedYear: number
  hasDataYears: Set<string>
  isRebuilding: boolean
  rebuildProgress: { weekLabel: string; current: number; total: number } | null
}>()

const emit = defineEmits<{
  selectYear: [year: number]
  rebuild: []
  cancelRebuild: []
}>()

function handleRebuild() {
  const confirmed = window.confirm(
    'AI 将完整扫描本年所有日记重新生成时间轴，预计消耗较多 token，确定继续？',
  )
  if (confirmed) {
    emit('rebuild')
  }
}
</script>

<template>
  <aside class="timeline-sidebar">
    <YearPickerGrid
      :selected-year="selectedYear"
      :has-data-years="hasDataYears"
      @update:selected-year="year => emit('selectYear', year)"
    />

    <div class="timeline-actions">
      <button
        v-if="!isRebuilding"
        class="rebuild-button"
        @click="handleRebuild"
      >
        重新整理本年度时间轴
      </button>
      <div v-else class="rebuild-status">
        <p class="rebuild-progress-text">
          正在整理... {{ rebuildProgress?.weekLabel }}
          （{{ rebuildProgress?.current }}/{{ rebuildProgress?.total }}）
        </p>
        <button class="cancel-button" @click="emit('cancelRebuild')">
          取消
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped src="./TimelineSidebar.css"></style>

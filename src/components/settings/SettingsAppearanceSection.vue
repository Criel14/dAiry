<script setup lang="ts">
import SettingsToggleRow from './SettingsToggleRow.vue'

defineProps<{
  journalHeatmapEnabled: boolean
  isSavingJournalHeatmap: boolean
  heatmapSaveMessage: string
}>()

const emit = defineEmits<{
  'update:journalHeatmapEnabled': [value: boolean]
}>()
</script>

<template>
  <div class="settings-section">
    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">日历显示</span>
      </div>

      <SettingsToggleRow
        title="字数热力图"
        description="开启后，月历会按当天日记字数显示深浅变化。"
        tip-text="按照以下的字数划分等级: 0, 1~149, 151~399, 400~699, 700+, 颜色由浅到深"
        :active="journalHeatmapEnabled"
        :disabled="isSavingJournalHeatmap"
        :button-label="journalHeatmapEnabled ? '关闭字数热力图' : '开启字数热力图'"
        @toggle="emit('update:journalHeatmapEnabled', !journalHeatmapEnabled)"
      />

      <p v-if="heatmapSaveMessage" class="setting-feedback">
        {{ heatmapSaveMessage }}
      </p>
    </section>
  </div>
</template>

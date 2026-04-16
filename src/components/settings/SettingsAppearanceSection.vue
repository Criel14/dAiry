<script setup lang="ts">
import SettingsToggleRow from './SettingsToggleRow.vue'
import { WINDOW_ZOOM_OPTIONS } from './config'
import { formatWindowZoomPercent } from '../../shared/window-zoom'

defineProps<{
  windowZoomFactor: number
  isSavingWindowZoomFactor: boolean
  windowZoomFactorSaveMessage: string
  journalHeatmapEnabled: boolean
  isSavingJournalHeatmap: boolean
  heatmapSaveMessage: string
}>()

const emit = defineEmits<{
  'update:windowZoomFactor': [value: number]
  'update:journalHeatmapEnabled': [value: boolean]
}>()

function handleWindowZoomFactorChange(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) {
    return
  }

  emit('update:windowZoomFactor', Number(target.value))
}
</script>

<template>
  <div class="settings-section">
    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">界面缩放</span>
      </div>

      <div class="setting-row setting-row--compact">
        <div class="setting-copy">
          <div class="setting-title-row">
            <strong class="panel-value">缩放比例</strong>
          </div>
          <p class="panel-description">
            当前为 {{ formatWindowZoomPercent(windowZoomFactor) }}。
          </p>
        </div>

        <select
          class="setting-select"
          :value="windowZoomFactor"
          :disabled="isSavingWindowZoomFactor"
          aria-label="选择界面缩放比例"
          @change="handleWindowZoomFactorChange"
        >
          <option v-for="option in WINDOW_ZOOM_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <p v-if="windowZoomFactorSaveMessage" class="setting-feedback">
        {{ windowZoomFactorSaveMessage }}
      </p>
    </section>

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

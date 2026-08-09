<script setup lang="ts">
import { computed } from 'vue'
import SettingsToggleRow from '../components/SettingsToggleRow/SettingsToggleRow.vue'
import AppSelect from '../../shared/AppSelect/AppSelect.vue'
import { THEME_OPTIONS, WINDOW_ZOOM_OPTIONS } from '../config/config'
import { formatWindowZoomPercent } from '../../../shared/window-zoom'
import type { AppTheme } from '../../../types/app'

defineProps<{
  theme: AppTheme
  isSavingTheme: boolean
  themeSaveMessage: string
  windowZoomFactor: number
  isSavingWindowZoomFactor: boolean
  windowZoomFactorSaveMessage: string
  journalHeatmapEnabled: boolean
  isSavingJournalHeatmap: boolean
  heatmapSaveMessage: string
}>()

const emit = defineEmits<{
  'update:theme': [value: AppTheme]
  'update:windowZoomFactor': [value: number]
  'update:journalHeatmapEnabled': [value: boolean]
}>()

const zoomOptions = computed(() =>
  WINDOW_ZOOM_OPTIONS.map((option) => ({ value: String(option.value), label: option.label })),
)

function handleThemeChange(value: string) {
  if (value === 'system' || value === 'light' || value === 'dark') {
    emit('update:theme', value)
  }
}

function handleWindowZoomFactorChange(value: string) {
  emit('update:windowZoomFactor', Number(value))
}
</script>

<template>
  <div class="settings-section">
    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">主题模式</span>
      </div>

      <div class="setting-row setting-row--compact">
        <div class="setting-copy">
          <div class="setting-title-row">
            <strong class="panel-value">主题切换</strong>
          </div>
          <p class="panel-description">
            支持跟随系统、浅色和深色模式，深色主题会同步应用到写作、报告浏览和 PNG 导出。
          </p>
        </div>

        <AppSelect
          class="setting-select"
          :model-value="theme"
          :options="THEME_OPTIONS"
          :disabled="isSavingTheme"
          aria-label="选择主题模式"
          @update:model-value="handleThemeChange"
        />
      </div>

      <p v-if="themeSaveMessage" class="setting-feedback">
        {{ themeSaveMessage }}
      </p>
    </section>

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

        <AppSelect
          class="setting-select"
          :model-value="String(windowZoomFactor)"
          :options="zoomOptions"
          :disabled="isSavingWindowZoomFactor"
          aria-label="选择界面缩放比例"
          @update:model-value="handleWindowZoomFactorChange"
        />
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

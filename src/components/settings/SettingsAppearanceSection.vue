<script setup lang="ts">
import SettingsToggleRow from './SettingsToggleRow.vue'
import { THEME_OPTIONS, WINDOW_ZOOM_OPTIONS } from './config'
import { formatWindowZoomPercent } from '../../shared/window-zoom'
import type { AppTheme } from '../../types/dairy'

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

function handleThemeChange(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) {
    return
  }

  if (target.value === 'system' || target.value === 'light' || target.value === 'dark') {
    emit('update:theme', target.value)
  }
}

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
        <span class="panel-label">主题模式</span>
      </div>

      <div class="setting-row setting-row--compact">
        <div class="setting-copy">
          <div class="setting-title-row">
            <strong class="panel-value">主题预留</strong>
          </div>
          <p class="panel-description">
            先接入主题变量和切换入口，当前视觉仍保持不变，后续再逐步补齐深色样式。
          </p>
        </div>

        <select
          class="setting-select"
          :value="theme"
          :disabled="isSavingTheme"
          aria-label="选择主题模式"
          @change="handleThemeChange"
        >
          <option v-for="option in THEME_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
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

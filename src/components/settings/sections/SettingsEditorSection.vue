<script setup lang="ts">
import SettingsInfoTip from '../components/SettingsInfoTip/SettingsInfoTip.vue'
import type { FrontmatterVisibilityConfig, WindowCloseBehavior } from '../../../types/app'
import { DAY_START_HOUR_OPTIONS, WINDOW_CLOSE_BEHAVIOR_OPTIONS } from '../config/config'
import SettingsToggleRow from '../components/SettingsToggleRow/SettingsToggleRow.vue'

const props = defineProps<{
  dayStartHour: number
  isSavingDayStartHour: boolean
  dayStartHourSaveMessage: string
  windowCloseBehavior: WindowCloseBehavior
  isSavingWindowCloseBehavior: boolean
  windowCloseBehaviorSaveMessage: string
  frontmatterVisibility: FrontmatterVisibilityConfig
  isSavingFrontmatterVisibility: boolean
  frontmatterVisibilitySaveMessage: string
}>()

const emit = defineEmits<{
  'update:dayStartHour': [value: number]
  'update:windowCloseBehavior': [value: WindowCloseBehavior]
  'update:frontmatterVisibility': [value: FrontmatterVisibilityConfig]
}>()

function handleDayStartHourChange(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) {
    return
  }

  emit('update:dayStartHour', Number(target.value))
}

function handleWindowCloseBehaviorChange(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) {
    return
  }

  if (target.value === 'tray' || target.value === 'quit') {
    emit('update:windowCloseBehavior', target.value)
  }
}

function toggleFrontmatterField(field: keyof FrontmatterVisibilityConfig) {
  emit('update:frontmatterVisibility', {
    ...props.frontmatterVisibility,
    [field]: !props.frontmatterVisibility[field],
  })
}
</script>

<template>
  <div class="settings-section">
    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">写作时间</span>
      </div>
      <p class="panel-description">根据你的作息时间做出调整。</p>

      <div class="setting-row setting-row--compact">
        <div class="setting-copy">
          <div class="setting-title-row">
            <strong class="panel-value">新一天开始时间</strong>
            <SettingsInfoTip text="设置后，在这个时间之前写的内容仍归到前一天。" />
          </div>
          <p class="panel-description">可选范围为 0 点到 6 点，将凌晨的时间也划在前一天。</p>
        </div>

        <select
          class="setting-select"
          :value="dayStartHour"
          :disabled="isSavingDayStartHour"
          aria-label="选择新一天开始时间"
          @change="handleDayStartHourChange"
        >
          <option v-for="hour in DAY_START_HOUR_OPTIONS" :key="hour" :value="hour">
            {{ hour }} 点
          </option>
        </select>
      </div>

      <p v-if="dayStartHourSaveMessage" class="setting-feedback">
        {{ dayStartHourSaveMessage }}
      </p>
    </section>

    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">应用关闭行为</span>
      </div>
      <p class="panel-description">决定点击右上角关闭按钮时，应用是直接退出还是隐藏到系统托盘。</p>

      <div class="setting-row setting-row--compact">
        <div class="setting-copy">
          <div class="setting-title-row">
            <strong class="panel-value">关闭窗口时</strong>
            <SettingsInfoTip text="选择最小化到托盘后，可通过托盘右键菜单重新打开主窗口或退出应用。" />
          </div>
          <p class="panel-description">最小化到托盘后应用会继续在后台运行；如果直接关闭应用，通知也会随之停止</p>
        </div>

        <select
          class="setting-select"
          :value="windowCloseBehavior"
          :disabled="isSavingWindowCloseBehavior"
          aria-label="选择关闭窗口行为"
          @change="handleWindowCloseBehaviorChange"
        >
          <option v-for="option in WINDOW_CLOSE_BEHAVIOR_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <p v-if="windowCloseBehaviorSaveMessage" class="setting-feedback">
        {{ windowCloseBehaviorSaveMessage }}
      </p>
    </section>

    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">日记信息展示</span>
        <SettingsInfoTip text="通过 markdown 的 frontmatter 实现每个日记文件的元数据管理" />
      </div>
      <p class="panel-description">调整日记所包含的基础信息。</p>

      <div class="settings-grid">
        <SettingsToggleRow
          title="天气"
          description="记录你写日记时的天气情况。"
          tip-text="本应用无法直接获取天气信息"
          :active="frontmatterVisibility.weather"
          :disabled="isSavingFrontmatterVisibility"
          button-label="切换天气显示"
          @toggle="toggleFrontmatterField('weather')"
        />

        <SettingsToggleRow
          title="地点"
          description="记录你写日记时所在的地点。"
          tip-text="本应用无法直接获取定位信息"
          :active="frontmatterVisibility.location"
          :disabled="isSavingFrontmatterVisibility"
          button-label="切换地点显示"
          @toggle="toggleFrontmatterField('location')"
        />

        <SettingsToggleRow
          title="心情"
          description="用 -5 到 5 的整数记录当天整体情绪，适合后续做趋势和总结。"
          tip-text="大模型会分析你的心情，但准确度不能保证"
          :active="frontmatterVisibility.mood"
          :disabled="isSavingFrontmatterVisibility"
          button-label="切换心情显示"
          @toggle="toggleFrontmatterField('mood')"
        />

        <SettingsToggleRow
          title="一句话总结"
          description="为每天的日记生成一份简短总结，方便后续做月度和年度整理。"
          :active="frontmatterVisibility.summary"
          :disabled="isSavingFrontmatterVisibility"
          button-label="切换总结显示"
          @toggle="toggleFrontmatterField('summary')"
        />

        <SettingsToggleRow
          title="标签"
          description="为每天的日记补上关键词，方便后续筛选和总结。"
          :active="frontmatterVisibility.tags"
          :disabled="isSavingFrontmatterVisibility"
          button-label="切换标签显示"
          @toggle="toggleFrontmatterField('tags')"
        />
      </div>

      <p v-if="frontmatterVisibilitySaveMessage" class="setting-feedback">
        {{ frontmatterVisibilitySaveMessage }}
      </p>
    </section>
  </div>
</template>

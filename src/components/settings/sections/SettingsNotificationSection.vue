<script setup lang="ts">
import { computed } from 'vue'
import SettingsDropdownSelect from '../components/SettingsDropdownSelect/SettingsDropdownSelect.vue'
import SettingsInfoTip from '../components/SettingsInfoTip/SettingsInfoTip.vue'
import SettingsToggleRow from '../components/SettingsToggleRow/SettingsToggleRow.vue'
import type { WindowCloseBehavior } from '../../../types/app'

const props = defineProps<{
  notificationEnabled: boolean
  notificationReminderTime: string
  isSavingNotification: boolean
  notificationSaveMessage: string
  windowCloseBehavior: WindowCloseBehavior
}>()

const emit = defineEmits<{
  'update:notificationEnabled': [value: boolean]
  'update:notificationReminderTime': [value: string]
}>()

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => {
  const value = `${index}`.padStart(2, '0')
  return {
    value,
    label: `${value} 时`,
  }
})

const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => {
  const value = `${index}`.padStart(2, '0')
  return {
    value,
    label: `${value} 分`,
  }
})

const reminderTimeParts = computed(() => {
  const matched = props.notificationReminderTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/)

  if (!matched) {
    return {
      hour: '21',
      minute: '30',
    }
  }

  return {
    hour: matched[1],
    minute: matched[2],
  }
})

function updateReminderTime(nextValue: { hour?: string; minute?: string }) {
  const hour = nextValue.hour ?? reminderTimeParts.value.hour
  const minute = nextValue.minute ?? reminderTimeParts.value.minute

  emit('update:notificationReminderTime', `${hour}:${minute}`)
}
</script>

<template>
  <div class="settings-section">
    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">写日记提醒</span>
      </div>
      <p class="panel-description">
        到达设定时间时，应用会在后台弹出系统通知。
      </p>

      <SettingsToggleRow
        title="开启提醒通知"
        description="开启后，dAiry 会按每天固定时间发出写日记提醒。"
        tip-text="只有 dAiry 仍在运行或最小化到托盘时，通知才能生效。托盘驻留时后台占用很小。"
        :active="notificationEnabled"
        :disabled="isSavingNotification"
        :button-label="notificationEnabled ? '关闭写日记提醒' : '开启写日记提醒'"
        @toggle="emit('update:notificationEnabled', !notificationEnabled)"
      />

      <div class="setting-row setting-row--compact">
        <div class="setting-copy">
          <div class="setting-title-row">
            <strong class="panel-value">提醒时间</strong>
            <SettingsInfoTip text="使用应用内自定义下拉，保留两个时间选择框，同时统一下拉面板和滚动条样式。" />
          </div>
          <p class="panel-description">
            当前设定为每天 {{ notificationReminderTime }}。建议选一个你每天准备收尾、复盘或放松的时间。
          </p>
        </div>

        <div class="setting-time-picker-row" aria-label="选择写日记提醒时间">
          <SettingsDropdownSelect
            class="setting-time-dropdown"
            :model-value="reminderTimeParts.hour"
            :options="HOUR_OPTIONS"
            :disabled="isSavingNotification"
            label="选择写日记提醒小时"
            @update:model-value="updateReminderTime({ hour: $event })"
          />

          <span class="setting-time-picker-separator" aria-hidden="true">:</span>

          <SettingsDropdownSelect
            class="setting-time-dropdown"
            :model-value="reminderTimeParts.minute"
            :options="MINUTE_OPTIONS"
            :disabled="isSavingNotification"
            label="选择写日记提醒分钟"
            @update:model-value="updateReminderTime({ minute: $event })"
          />
        </div>
      </div>

      <p v-if="windowCloseBehavior !== 'tray'" class="setting-note">
        当前关闭窗口行为是“直接关闭应用”。窗口开着时仍可按时提醒，但一旦关闭应用，后续提醒就会停止；如果你希望关窗后继续提醒，可以改为“最小化到托盘”。
      </p>

      <p v-if="notificationSaveMessage" class="setting-feedback">
        {{ notificationSaveMessage }}
      </p>
    </section>
  </div>
</template>

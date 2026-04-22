<script setup lang="ts">
import SettingsInfoTip from '../components/SettingsInfoTip/SettingsInfoTip.vue'
import SettingsToggleRow from '../components/SettingsToggleRow/SettingsToggleRow.vue'
import type { WindowCloseBehavior } from '../../../types/app'

defineProps<{
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

function handleReminderTimeChange(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }

  if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(target.value)) {
    emit('update:notificationReminderTime', target.value)
  }
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
          </div>
          <p class="panel-description">
            当前设定为每天 {{ notificationReminderTime }}。建议选一个你每天准备收尾、复盘或放松的时间。
          </p>
        </div>

        <input
          class="setting-time-input"
          type="time"
          :value="notificationReminderTime"
          :disabled="isSavingNotification"
          step="60"
          aria-label="选择写日记提醒时间"
          @change="handleReminderTimeChange"
        >
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

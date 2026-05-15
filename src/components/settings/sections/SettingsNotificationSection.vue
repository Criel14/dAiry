<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SettingsDropdownSelect from '../components/SettingsDropdownSelect/SettingsDropdownSelect.vue'
import SettingsInfoTip from '../components/SettingsInfoTip/SettingsInfoTip.vue'
import SettingsToggleRow from '../components/SettingsToggleRow/SettingsToggleRow.vue'
import type {
  EmailNotificationConfig,
  EmailNotificationSecretStatus,
  WindowCloseBehavior,
} from '../../../types/app'

const props = defineProps<{
  systemNotificationEnabled: boolean
  emailNotificationEnabled: boolean
  notificationReminderTime: string
  emailNotificationConfig: EmailNotificationConfig
  emailNotificationStatus: EmailNotificationSecretStatus
  isSavingNotification: boolean
  notificationSaveMessage: string
  windowCloseBehavior: WindowCloseBehavior
}>()

const emit = defineEmits<{
  'update:systemNotificationEnabled': [value: boolean]
  'update:emailNotificationEnabled': [value: boolean]
  'update:notificationReminderTime': [value: string]
  saveEmailNotificationConfiguration: [
    value: {
      email: EmailNotificationConfig
      authCode: string
    },
  ]
}>()

const draftEmailConfig = ref<EmailNotificationConfig>({ ...props.emailNotificationConfig })
const draftAuthCode = ref('')

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

const isEmailConfigDirty = computed(() => {
  return JSON.stringify(draftEmailConfig.value) !== JSON.stringify(props.emailNotificationConfig)
})

const canSaveEmailConfig = computed(() => {
  return !props.isSavingNotification && (isEmailConfigDirty.value || Boolean(draftAuthCode.value.trim()))
})

const authCodePlaceholder = computed(() => {
  return props.emailNotificationStatus.hasAuthCode ? '已保存授权码，输入新值可覆盖' : '输入邮箱授权码'
})

watch(
  () => props.emailNotificationConfig,
  (value) => {
    if (props.isSavingNotification) {
      return
    }

    draftEmailConfig.value = { ...value }
  },
  { deep: true, immediate: true },
)

watch(
  () => props.isSavingNotification,
  (value, previousValue) => {
    if (!value && previousValue) {
      draftEmailConfig.value = { ...props.emailNotificationConfig }
      draftAuthCode.value = ''
    }
  },
)

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function updateReminderTime(nextValue: { hour?: string; minute?: string }) {
  const hour = nextValue.hour ?? reminderTimeParts.value.hour
  const minute = nextValue.minute ?? reminderTimeParts.value.minute

  emit('update:notificationReminderTime', `${hour}:${minute}`)
}

function handleEmailNotificationToggle() {
  if (!props.emailNotificationEnabled && !props.emailNotificationStatus.isConfigured) {
    window.alert('请先保存可用的邮箱通知配置和授权码。')
    return
  }

  emit('update:emailNotificationEnabled', !props.emailNotificationEnabled)
}

function emitSaveEmailNotificationConfiguration() {
  const smtpHost = draftEmailConfig.value.smtpHost.trim()
  const username = draftEmailConfig.value.username.trim()
  const recipientEmail = draftEmailConfig.value.recipientEmail.trim()

  if (!smtpHost) {
    window.alert('请先填写 SMTP 服务器。')
    return
  }

  if (
    !Number.isInteger(draftEmailConfig.value.smtpPort) ||
    draftEmailConfig.value.smtpPort < 1 ||
    draftEmailConfig.value.smtpPort > 65535
  ) {
    window.alert('请填写 1 到 65535 之间的 SMTP 端口。')
    return
  }

  if (!isValidEmail(username)) {
    window.alert('请填写正确的发件邮箱。')
    return
  }

  if (!isValidEmail(recipientEmail)) {
    window.alert('请填写正确的收件邮箱。')
    return
  }

  if (!draftAuthCode.value.trim() && !props.emailNotificationStatus.hasAuthCode) {
    window.alert('请先填写邮箱授权码。')
    return
  }

  emit('saveEmailNotificationConfiguration', {
    email: {
      smtpHost,
      smtpPort: draftEmailConfig.value.smtpPort,
      secure: draftEmailConfig.value.secure,
      username,
      fromEmail: username,
      recipientEmail,
    },
    authCode: draftAuthCode.value,
  })
}
</script>

<template>
  <div class="settings-section">
    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">写日记提醒</span>
      </div>
      <p class="panel-description">
        到达设定时间时，应用会按开启的方式发出写日记提醒。
      </p>

      <SettingsToggleRow
        title="开启系统提醒通知"
        description="开启后，dAiry 会按每天固定时间弹出系统通知。"
        tip-text="只有 dAiry 仍在运行或最小化到托盘时，通知才能生效。托盘驻留时后台占用很小。"
        :active="systemNotificationEnabled"
        :disabled="isSavingNotification"
        :button-label="systemNotificationEnabled ? '关闭系统提醒通知' : '开启系统提醒通知'"
        @toggle="emit('update:systemNotificationEnabled', !systemNotificationEnabled)"
      />

      <SettingsToggleRow
        title="开启邮箱通知"
        description="开启后，dAiry 会在同一提醒时间向收件邮箱发送提醒邮件。"
        tip-text="邮箱通知需要先保存 SMTP 配置和邮箱授权码。授权码会写入系统安全存储，不会在这里回显明文。"
        :active="emailNotificationEnabled"
        :disabled="isSavingNotification"
        :button-label="emailNotificationEnabled ? '关闭邮箱通知' : '开启邮箱通知'"
        @toggle="handleEmailNotificationToggle"
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

    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">邮箱通知</span>
      </div>
      <p class="panel-description">
        默认按 QQ 邮箱 SMTP 填好服务器和 SSL 设置，其他邮箱可以手动调整服务器、端口和账号信息。
      </p>

      <div class="settings-grid settings-grid--two-columns">
        <label class="field">
          <span class="field-label field-label--with-tip">
            SMTP 服务器
            <SettingsInfoTip text="QQ 邮箱默认使用 smtp.qq.com。其他服务商请填写对应的 SMTP 发送服务器。" />
          </span>
          <input
            v-model="draftEmailConfig.smtpHost"
            class="field-input"
            type="text"
            :disabled="isSavingNotification"
            placeholder="smtp.qq.com"
          />
        </label>

        <label class="field">
          <span class="field-label field-label--with-tip">
            SMTP 端口
            <SettingsInfoTip text="QQ 邮箱 SSL 端口通常为 465，也可按服务商说明使用 587。" />
          </span>
          <input
            v-model.number="draftEmailConfig.smtpPort"
            class="field-input"
            type="number"
            min="1"
            max="65535"
            step="1"
            :disabled="isSavingNotification"
            placeholder="465"
          />
        </label>

        <label class="field">
          <span class="field-label field-label--with-tip">
            发件邮箱
            <SettingsInfoTip text="用于登录 SMTP 并作为邮件发件地址。QQ 邮箱这里填写完整 QQ 邮箱地址即可。" />
          </span>
          <input
            v-model="draftEmailConfig.username"
            class="field-input"
            type="email"
            :disabled="isSavingNotification"
            placeholder="你的QQ邮箱完整地址"
          />
        </label>

        <label class="field">
          <span class="field-label">邮箱授权码</span>
          <input
            v-model="draftAuthCode"
            class="field-input"
            type="password"
            :disabled="isSavingNotification"
            :placeholder="authCodePlaceholder"
          />
        </label>

        <label class="field">
          <span class="field-label">收件邮箱</span>
          <input
            v-model="draftEmailConfig.recipientEmail"
            class="field-input"
            type="email"
            :disabled="isSavingNotification"
            placeholder="接收提醒的邮箱地址"
          />
        </label>
      </div>

      <SettingsToggleRow
        title="使用 SSL"
        description="QQ 邮箱的 465 端口需要开启 SSL。其他邮箱请按服务商说明配置。"
        :active="draftEmailConfig.secure"
        :disabled="isSavingNotification"
        :button-label="draftEmailConfig.secure ? '关闭 SSL' : '开启 SSL'"
        @toggle="draftEmailConfig.secure = !draftEmailConfig.secure"
      />

      <div class="library-actions">
        <button
          class="save-button"
          type="button"
          :disabled="!canSaveEmailConfig"
          @click="emitSaveEmailNotificationConfiguration"
        >
          {{ isSavingNotification ? '正在保存' : '保存邮箱配置' }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SettingsInfoTip from './SettingsInfoTip.vue'
import type { AiProviderType, AiSettings, AiSettingsStatus } from '../../types/dairy'
import { AI_PROVIDER_OPTIONS, getAiDefaults } from './config'

const props = defineProps<{
  aiSettingsStatus: AiSettingsStatus
  isSavingAiSettings: boolean
  aiSettingsSaveMessage: string
  isSavingAiApiKey: boolean
  aiApiKeySaveMessage: string
}>()

const emit = defineEmits<{
  saveAiSettings: [value: AiSettings]
  saveAiApiKey: [
    value: {
      providerType: AiProviderType
      apiKey: string
    },
  ]
}>()

const draftAiSettings = ref<AiSettings>({ ...props.aiSettingsStatus.settings })
const draftApiKey = ref('')

watch(
  () => props.aiSettingsStatus,
  (value) => {
    draftAiSettings.value = { ...value.settings }
    if (!props.isSavingAiApiKey) {
      draftApiKey.value = ''
    }
  },
  { deep: true, immediate: true },
)

const isAiSettingsDirty = computed(() => {
  return JSON.stringify(draftAiSettings.value) !== JSON.stringify(props.aiSettingsStatus.settings)
})

const canSaveAiSettings = computed(() => {
  return (
    !props.isSavingAiSettings &&
    Boolean(draftAiSettings.value.baseURL.trim()) &&
    Boolean(draftAiSettings.value.model.trim()) &&
    isAiSettingsDirty.value
  )
})

const canSaveAiApiKey = computed(
  () => !props.isSavingAiApiKey && Boolean(draftApiKey.value.trim()),
)

const isViewingSavedProvider = computed(
  () => draftAiSettings.value.providerType === props.aiSettingsStatus.settings.providerType,
)

const apiKeyStatusText = computed(() => {
  if (!isViewingSavedProvider.value) {
    return '待保存'
  }

  return props.aiSettingsStatus.hasApiKey ? '已配置密钥' : '未配置密钥'
})

const apiKeyInputPlaceholder = computed(() => {
  if (draftApiKey.value.trim()) {
    return '输入 API Key'
  }

  if (isViewingSavedProvider.value && props.aiSettingsStatus.hasApiKey) {
    return '密钥已保存，输入新值可覆盖'
  }

  return '输入 API Key'
})

function handleProviderTypeChange(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) {
    return
  }

  const providerType = target.value as AiProviderType
  const defaults = getAiDefaults(providerType)
  draftAiSettings.value = {
    ...draftAiSettings.value,
    providerType,
    baseURL: defaults.baseURL,
    model: defaults.model,
  }
}

function emitSaveAiSettings() {
  emit('saveAiSettings', {
    providerType: draftAiSettings.value.providerType,
    baseURL: draftAiSettings.value.baseURL,
    model: draftAiSettings.value.model,
    timeoutMs: draftAiSettings.value.timeoutMs,
  })
}
</script>

<template>
  <div class="settings-section">
    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">大模型配置</span>
      </div>

      <div class="workspace-summary">
        <div class="workspace-summary-copy">
          <p class="panel-description">
            大模型配置完成后才能使用自动整理和总结功能，目前仅支持 OpenAI、DeepSeek、Qwen。
          </p>
        </div>
      </div>

      <div class="settings-grid">
        <label class="field">
          <span class="field-label field-label--with-tip">
            Provider
            <SettingsInfoTip text="选择你要连接的大模型服务商。官方接口就选对应 provider，兼容 OpenAI 协议的网关或中转服务可选 OpenAI Compatible。" />
          </span>
          <select
            class="field-input"
            :value="draftAiSettings.providerType"
            :disabled="isSavingAiSettings"
            @change="handleProviderTypeChange"
          >
            <option
              v-for="option in AI_PROVIDER_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="field">
          <span class="field-label field-label--with-tip">
            Base URL
            <SettingsInfoTip text="填写接口根地址，通常是服务商提供的 API 基础路径，例如以 /v1 结尾的地址；如果使用默认官方地址，一般不需要改。" />
          </span>
          <input
            v-model="draftAiSettings.baseURL"
            class="field-input"
            type="text"
            :disabled="isSavingAiSettings"
            placeholder="https://api.openai.com/v1"
          />
        </label>

        <label class="field">
          <span class="field-label field-label--with-tip">
            Model Name
            <SettingsInfoTip text="填写要调用的具体模型名，需与当前 provider 支持的模型标识一致，例如 gpt-4.1-mini、deepseek-chat 或 qwen-plus。" />
          </span>
          <input
            v-model="draftAiSettings.model"
            class="field-input"
            type="text"
            :disabled="isSavingAiSettings"
            placeholder="gpt-4.1-mini"
          />
        </label>
      </div>

      <div class="library-actions">
        <button
          class="save-button"
          type="button"
          :disabled="!canSaveAiSettings"
          @click="emitSaveAiSettings"
        >
          {{ isSavingAiSettings ? '正在保存' : '保存' }}
        </button>
      </div>

      <p v-if="aiSettingsSaveMessage" class="setting-feedback">
        {{ aiSettingsSaveMessage }}
      </p>
    </section>

    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">API Key</span>
        <SettingsInfoTip text="这里只会写入当前 provider 的 API Key，保存后不会回显明文。" />
      </div>

      <div class="workspace-summary">
        <div class="workspace-summary-copy">
          <p class="panel-description">
            {{
              isViewingSavedProvider
                ? '切换 provider 后，如需使用新的服务商，请重新保存对应密钥。'
                : '你正在编辑尚未保存的 provider，密钥状态会在保存后更新。'
            }}
          </p>
        </div>
      </div>

      <label class="field">
        <span class="field-label">当前密钥</span>
        <input
          v-model="draftApiKey"
          class="field-input"
          type="password"
          :disabled="isSavingAiApiKey"
          :placeholder="apiKeyInputPlaceholder"
        />
      </label>

      <p class="setting-feedback">当前状态：{{ apiKeyStatusText }}</p>

      <div class="library-actions">
        <button
          class="save-button"
          type="button"
          :disabled="!canSaveAiApiKey"
          @click="
            emit('saveAiApiKey', {
              providerType: draftAiSettings.providerType,
              apiKey: draftApiKey,
            })
          "
        >
          {{ isSavingAiApiKey ? '正在保存' : '保存' }}
        </button>
      </div>

      <p v-if="aiApiKeySaveMessage" class="setting-feedback">
        {{ aiApiKeySaveMessage }}
      </p>
    </section>
  </div>
</template>

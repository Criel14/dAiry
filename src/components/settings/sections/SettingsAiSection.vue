<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SettingsInfoTip from '../components/SettingsInfoTip/SettingsInfoTip.vue'
import type {
  AiContextDocument,
  AiProviderType,
  AiSettings,
  AiSettingsStatus,
} from '../../../types/dairy'
import { AI_PROVIDER_OPTIONS, getAiDefaults } from '../config/config'

const props = defineProps<{
  aiSettingsStatus: AiSettingsStatus
  isSavingAiConfig: boolean
  aiSaveMessage: string
  aiContextDocument: AiContextDocument
  isSavingAiContext: boolean
  aiContextSaveMessage: string
}>()

const emit = defineEmits<{
  saveAiConfiguration: [
    value: AiSettings & {
      apiKey: string
    },
  ]
  saveAiContext: [value: string]
}>()

const draftAiSettings = ref<AiSettings>({ ...props.aiSettingsStatus.settings })
const draftApiKey = ref('')
const draftAiContext = ref(props.aiContextDocument.content)

watch(
  () => props.aiSettingsStatus,
  (value) => {
    if (props.isSavingAiConfig) {
      return
    }

    draftAiSettings.value = { ...value.settings }
  },
  { deep: true, immediate: true },
)

watch(
  () => props.isSavingAiConfig,
  (value, previousValue) => {
    if (!value && previousValue) {
      draftAiSettings.value = { ...props.aiSettingsStatus.settings }
      draftApiKey.value = ''
    }
  },
)

watch(
  () => props.aiContextDocument.content,
  (value) => {
    if (props.isSavingAiContext) {
      return
    }

    draftAiContext.value = value
  },
  { immediate: true },
)

const isAiSettingsDirty = computed(() => {
  return JSON.stringify(draftAiSettings.value) !== JSON.stringify(props.aiSettingsStatus.settings)
})

const isAiContextDirty = computed(() => {
  return draftAiContext.value !== props.aiContextDocument.content
})

const canSaveAiConfiguration = computed(() => {
  return !props.isSavingAiConfig && (isAiSettingsDirty.value || Boolean(draftApiKey.value.trim()))
})

const canSaveAiContext = computed(() => {
  return !props.isSavingAiContext && isAiContextDirty.value
})

const isViewingSavedProvider = computed(
  () => draftAiSettings.value.providerType === props.aiSettingsStatus.settings.providerType,
)

const apiKeyInputPlaceholder = computed(() => {
  if (isViewingSavedProvider.value && props.aiSettingsStatus.hasApiKey) {
    return '已保存密钥，输入新值可覆盖'
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

function emitSaveAiConfiguration() {
  if (!draftAiSettings.value.baseURL.trim()) {
    window.alert('请先填写 Base URL。')
    return
  }

  if (!draftAiSettings.value.model.trim()) {
    window.alert('请先填写 Model Name。')
    return
  }

  const hasSavedApiKeyForCurrentDraftProvider =
    isViewingSavedProvider.value && props.aiSettingsStatus.hasApiKey

  if (!draftApiKey.value.trim() && !hasSavedApiKeyForCurrentDraftProvider) {
    window.alert('请先填写 API Key。')
    return
  }

  emit('saveAiConfiguration', {
    providerType: draftAiSettings.value.providerType,
    baseURL: draftAiSettings.value.baseURL,
    model: draftAiSettings.value.model,
    timeoutMs: draftAiSettings.value.timeoutMs,
    apiKey: draftApiKey.value,
  })
}

function emitSaveAiContext() {
  emit('saveAiContext', draftAiContext.value)
}

function handleAiContextKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    event.stopPropagation()

    if (canSaveAiContext.value) {
      emitSaveAiContext()
    }
  }
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
            :disabled="isSavingAiConfig"
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
            :disabled="isSavingAiConfig"
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
            :disabled="isSavingAiConfig"
            placeholder="gpt-4.1-mini"
          />
        </label>

        <label class="field">
          <span class="field-label field-label--with-tip">
            API Key
            <SettingsInfoTip text="这里只会保存当前 provider 的 API Key，写入系统安全存储后不会回显明文。" />
          </span>
          <input
            v-model="draftApiKey"
            class="field-input"
            type="password"
            :disabled="isSavingAiConfig"
            :placeholder="apiKeyInputPlaceholder"
          />
        </label>
      </div>

      <div class="library-actions">
        <button
          class="save-button"
          type="button"
          :disabled="!canSaveAiConfiguration"
          @click="emitSaveAiConfiguration"
        >
          {{ isSavingAiConfig ? '正在保存' : '保存' }}
        </button>
      </div>

      <p v-if="aiSaveMessage" class="setting-feedback">
        {{ aiSaveMessage }}
      </p>
    </section>

    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">补充知识</span>
      </div>

      <div class="workspace-summary">
        <div class="workspace-summary-copy">
          <p class="panel-description">
            这里可以记录一些长期背景、固定术语、人物关系、项目上下文或你希望 AI
            了解的偏好。日总结和区间总结时会把这份内容一并发给 AI 参考。
          </p>
        </div>
      </div>

      <label class="field">
        <span class="field-label field-label--with-tip">
          AI Context
          <SettingsInfoTip text="文件会保存为用户配置目录下的 ai-context.md。" />
        </span>
        <textarea
          v-model="draftAiContext"
          class="field-input field-textarea field-textarea--ai-context"
          :disabled="isSavingAiContext"
          placeholder="例如：我正在做的项目背景、常用缩写、专有名词、重要人物、长期目标、写作习惯等。"
          spellcheck="false"
          @keydown="handleAiContextKeydown"
        ></textarea>
      </label>

      <div class="library-actions">
        <button
          class="save-button"
          type="button"
          :disabled="!canSaveAiContext"
          @click="emitSaveAiContext"
        >
          {{ isSavingAiContext ? '正在保存' : '保存' }}
        </button>
      </div>

      <p v-if="aiContextSaveMessage" class="setting-feedback">
        {{ aiContextSaveMessage }}
      </p>
    </section>
  </div>
</template>

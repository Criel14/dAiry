<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import TagInput from '../form/TagInput.vue'
import SuggestionInput from '../form/SuggestionInput.vue'
import SettingsInfoTip from '../settings/SettingsInfoTip.vue'
import type { FrontmatterVisibilityConfig, JournalEntryMetadata } from '../../types/dairy'

const props = defineProps<{
  metadata: JournalEntryMetadata
  visibility: FrontmatterVisibilityConfig
  suggestedWeatherOptions: string[]
  suggestedLocationOptions: string[]
  suggestedTags: string[]
  isSaving: boolean
  canSave: boolean
  statusMessage: string
  isGeneratingInsights: boolean
  canGenerateInsights: boolean
  insightsStatusMessage: string
}>()

const emit = defineEmits<{
  'update:metadata': [value: JournalEntryMetadata]
  save: []
  generateInsights: []
}>()

const isCollapsed = ref(true)
const showRecordSection = computed(() => props.visibility.weather || props.visibility.location)
const showContentSection = computed(
  () => props.visibility.mood || props.visibility.summary || props.visibility.tags,
)
const generateButtonText = computed(() =>
  props.isGeneratingInsights ? '正在整理' : '自动整理',
)

const moodSummaryText = computed(() => {
  return `${props.metadata.mood > 0 ? '+' : ''}${props.metadata.mood} · ${getMoodLabel(props.metadata.mood)}`
})

function getMoodLabel(value: number) {
  if (value <= -5) {
    return '非常低落'
  }

  if (value <= -3) {
    return '很低落'
  }

  if (value <= -1) {
    return '偏低落'
  }

  if (value == 0) {
    return '平稳'
  }

  if (value <= 2) {
    return '偏积极'
  }

  if (value <= 4) {
    return '很积极'
  }

  if (value <= 5) {
    return '非常积极'
  }

  return '平稳'
}

function updateField(
  field: keyof JournalEntryMetadata,
  value: string | string[] | number,
) {
  emit('update:metadata', {
    ...props.metadata,
    [field]: value,
  })
}

function handleMoodInput(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }

  updateField('mood', Number(target.value))
}
</script>

<template>
  <section class="metadata-panel" :class="{ 'metadata-panel--expanded': !isCollapsed }">
    <header class="metadata-header">
      <div>
        <h3 class="metadata-title">日记信息</h3>
      </div>

      <div class="metadata-header-actions">
        <span v-if="statusMessage" class="metadata-feedback">{{ statusMessage }}</span>
        <button class="ghost-button" type="button" @click="isCollapsed = !isCollapsed">
          <Icon class="toggle-icon" :icon="isCollapsed ? 'lucide:chevron-down' : 'lucide:chevron-up'"
            aria-hidden="true" />
          {{ isCollapsed ? '展开' : '收起' }}
        </button>
      </div>
    </header>

    <div v-if="!isCollapsed" class="metadata-grid">
      <section v-if="showRecordSection" class="metadata-card">
        <p class="group-title">记录信息</p>

        <div class="field-grid field-grid--stacked">
          <label v-if="visibility.weather" class="field">
            <span class="field-label">天气</span>
            <SuggestionInput :model-value="metadata.weather" :suggestions="suggestedWeatherOptions"
              :disabled="isSaving || isGeneratingInsights" placeholder="选择常见天气，或手动输入" toggle-aria-label="切换天气候选"
              @update:model-value="updateField('weather', $event)" />
          </label>

          <label v-if="visibility.location" class="field">
            <span class="field-label">地点</span>
            <SuggestionInput :model-value="metadata.location" :suggestions="suggestedLocationOptions"
              :disabled="isSaving || isGeneratingInsights" placeholder="选择常用地点，或手动输入" toggle-aria-label="切换地点候选"
              @update:model-value="updateField('location', $event)" />
          </label>
        </div>
      </section>

      <section v-if="showContentSection" class="metadata-card">
        <div class="content-header">
          <p class="group-title">内容整理</p>
          <span v-if="insightsStatusMessage" class="metadata-feedback metadata-feedback--warm">
            {{ insightsStatusMessage }}
          </span>
        </div>

        <div class="field-grid field-grid--stacked">
          <div v-if="visibility.mood" class="field field--mood">
            <div class="field-label-row">
              <span class="field-label">心情</span>
              <SettingsInfoTip text="用 -5 到 5 记录这篇日记对应的整体情绪，0 表示平稳或中性。" />
            </div>

            <div class="mood-card">
              <div class="mood-header">
                <strong class="mood-value">{{ moodSummaryText }}</strong>
              </div>

              <input class="mood-slider" type="range" min="-5" max="5" step="1" :value="metadata.mood"
                :disabled="isSaving || isGeneratingInsights" aria-label="调整心情分数" @input="handleMoodInput" />

              <div class="mood-scale">
                <span>-5</span>
                <span>0</span>
                <span>5</span>
              </div>
            </div>
          </div>

          <label v-if="visibility.summary" class="field">
            <span class="field-label">一句话总结</span>
            <textarea class="field-input field-textarea" :value="metadata.summary"
              :disabled="isSaving || isGeneratingInsights" rows="2" placeholder="可手动填写，也可以点击“自动整理”生成"
              @input="updateField('summary', ($event.target as HTMLTextAreaElement).value)" />
          </label>

          <div v-if="visibility.tags" class="field">
            <span class="field-label">标签</span>
            <TagInput :model-value="metadata.tags" :suggestions="suggestedTags"
              :disabled="isSaving || isGeneratingInsights" @update:model-value="updateField('tags', $event)" />
          </div>
        </div>
      </section>
    </div>

    <footer v-if="!isCollapsed" class="metadata-footer">
      <button class="ghost-button" type="button" :disabled="!canGenerateInsights" @click="$emit('generateInsights')">
        <span>{{ generateButtonText }}</span>
        <Icon v-if="isGeneratingInsights" class="button-loading-icon" icon="lucide:loader-circle" aria-hidden="true" />
      </button>

      <button class="save-button" type="button" :disabled="!canSave" @click="$emit('save')">
        {{ isSaving ? '正在保存信息' : '保存信息' }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.metadata-panel {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.2rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: #fffef9;
}

.metadata-panel--expanded {
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
  max-height: calc(100dvh - 13rem);
  overflow: hidden;
}

.metadata-header {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

.field-label,
.group-title {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.field-label-row {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}

.metadata-title {
  margin: 0;
  color: var(--color-text-main);
  font-size: 1.15rem;
}

.metadata-header-actions,
.content-header {
  display: flex;
  gap: 0.7rem;
  align-items: center;
  justify-content: space-between;
}

.metadata-feedback {
  color: var(--color-text-soft);
  font-size: 0.88rem;
}

.metadata-feedback--warm {
  color: #8a7242;
}

.ghost-button,
.save-button {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  justify-content: center;
  min-height: 2.35rem;
  padding: 0 0.95rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease,
    opacity 160ms ease;
}

.ghost-button {
  background: #fffdf8;
  color: var(--color-text-main);
}

.save-button {
  background: #f5ebc3;
  color: #4f4630;
}

.ghost-button:hover:not(:disabled),
.save-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(95, 82, 42, 0.08);
}

.ghost-button:disabled,
.save-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
  box-shadow: none;
}

.toggle-icon {
  width: 1rem;
  height: 1rem;
}

.button-loading-icon {
  width: 1rem;
  height: 1rem;
  animation: metadata-button-spin 0.8s linear infinite;
}

@keyframes metadata-button-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.metadata-grid {
  display: grid;
  gap: 0.9rem;
  min-height: 0;
  overflow-y: auto;
  padding-right: 0.35rem;
  scrollbar-width: thin;
  scrollbar-color: #d8ccb0 transparent;
}

.metadata-grid::-webkit-scrollbar {
  width: 10px;
}

.metadata-grid::-webkit-scrollbar-track {
  background: transparent;
}

.metadata-grid::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 999px;
  background: linear-gradient(180deg, #ded3b8 0%, #cec09b 100%);
  background-clip: padding-box;
}

.metadata-grid::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #d3c5a0 0%, #bda977 100%);
  background-clip: padding-box;
}

.metadata-grid::-webkit-scrollbar-corner {
  background: transparent;
}

.metadata-card {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.field-grid {
  display: grid;
  gap: 0.9rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field-grid--stacked {
  grid-template-columns: 1fr;
}

.field {
  display: grid;
  gap: 0.45rem;
}

.field--mood {
  gap: 0.45rem;
}

.field-input {
  min-height: 2.6rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fffef9;
  color: var(--color-text-main);
  outline: none;
}

.field-input:focus {
  border-color: var(--color-border-strong);
}

.field-input:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.field-textarea {
  min-height: 5rem;
  resize: vertical;
}

.mood-card {
  display: grid;
  gap: 0.5rem;
  padding: 0.65rem 0.8rem 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fdfbf5;
}

.mood-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
}

.mood-value {
  color: var(--color-text-main);
  font-size: 0.9rem;
  font-weight: 600;
}

.mood-slider {
  width: 100%;
  margin: 0;
  height: 1.25rem;
  padding: 0;
  border-radius: 999px;
  background: transparent;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.mood-slider:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.mood-slider::-webkit-slider-runnable-track {
  height: 0.4rem;
  border: 1px solid #eadfca;
  border-radius: 999px;
  background: linear-gradient(90deg, #eadbcc 0%, #f3e5c6 52%, #e8ddcf 100%);
}

.mood-slider::-webkit-slider-thumb {
  width: 0.95rem;
  height: 0.95rem;
  margin-top: -0.32rem;
  border: 1px solid #c8b47a;
  border-radius: 50%;
  background: #fffdf7;
  box-shadow: 0 2px 6px rgba(95, 82, 42, 0.18);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease;
  appearance: none;
  -webkit-appearance: none;
}

.mood-slider:hover::-webkit-slider-thumb,
.mood-slider:focus-visible::-webkit-slider-thumb {
  transform: scale(1.04);
  border-color: #b49a59;
  box-shadow: 0 4px 10px rgba(95, 82, 42, 0.22);
}

.mood-slider::-moz-range-track {
  height: 0.4rem;
  border: 1px solid #eadfca;
  border-radius: 999px;
  background: linear-gradient(90deg, #eadbcc 0%, #f3e5c6 52%, #e8ddcf 100%);
}

.mood-slider::-moz-range-thumb {
  width: 0.95rem;
  height: 0.95rem;
  border: 1px solid #c8b47a;
  border-radius: 50%;
  background: #fffdf7;
  box-shadow: 0 2px 6px rgba(95, 82, 42, 0.18);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease;
}

.mood-slider:hover::-moz-range-thumb,
.mood-slider:focus-visible::-moz-range-thumb {
  transform: scale(1.04);
  border-color: #b49a59;
  box-shadow: 0 4px 10px rgba(95, 82, 42, 0.22);
}

.mood-scale {
  display: flex;
  justify-content: space-between;
  color: var(--color-text-soft);
  font-size: 0.76rem;
}

.metadata-footer {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: flex-end;
  padding-top: 0.2rem;
  border-top: 1px solid rgba(217, 203, 159, 0.55);
}

@media (max-width: 960px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .metadata-panel {
    padding: 1rem;
  }

  .metadata-panel--expanded {
    max-height: calc(100dvh - 9.5rem);
  }

  .metadata-header,
  .metadata-header-actions,
  .content-header,
  .metadata-footer,
  .mood-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

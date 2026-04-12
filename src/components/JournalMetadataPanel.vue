<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import TagInput from './TagInput.vue'
import SuggestionInput from './SuggestionInput.vue'
import type { FrontmatterVisibilityConfig, JournalEntryMetadata } from '../types/dairy'

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
const showContentSection = computed(() => props.visibility.summary || props.visibility.tags)
const generateButtonText = computed(() =>
  props.isGeneratingInsights ? '正在整理' : '自动整理',
)

function updateField(field: keyof JournalEntryMetadata, value: string | string[]) {
  emit('update:metadata', {
    ...props.metadata,
    [field]: value,
  })
}
</script>

<template>
  <section class="metadata-panel">
    <header class="metadata-header">
      <div>
        <h3 class="metadata-title">日记信息</h3>
      </div>

      <div class="metadata-header-actions">
        <span v-if="statusMessage" class="metadata-feedback">{{ statusMessage }}</span>
        <button class="ghost-button" type="button" @click="isCollapsed = !isCollapsed">
          <Icon
            class="toggle-icon"
            :icon="isCollapsed ? 'lucide:chevron-down' : 'lucide:chevron-up'"
            aria-hidden="true"
          />
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
            <SuggestionInput
              :model-value="metadata.weather"
              :suggestions="suggestedWeatherOptions"
              :disabled="isSaving || isGeneratingInsights"
              placeholder="选择常见天气，或手动输入"
              toggle-aria-label="切换天气候选"
              @update:model-value="updateField('weather', $event)"
            />
          </label>

          <label v-if="visibility.location" class="field">
            <span class="field-label">地点</span>
            <SuggestionInput
              :model-value="metadata.location"
              :suggestions="suggestedLocationOptions"
              :disabled="isSaving || isGeneratingInsights"
              placeholder="选择常用地点，或手动输入"
              toggle-aria-label="切换地点候选"
              @update:model-value="updateField('location', $event)"
            />
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
          <label v-if="visibility.summary" class="field">
            <span class="field-label">一句话总结</span>
            <textarea
              class="field-input field-textarea"
              :value="metadata.summary"
              :disabled="isSaving || isGeneratingInsights"
              rows="2"
              placeholder="可手动填写，也可以点击“自动整理”生成"
              @input="updateField('summary', ($event.target as HTMLTextAreaElement).value)"
            />
          </label>

          <div v-if="visibility.tags" class="field">
            <span class="field-label">标签</span>
            <TagInput
              :model-value="metadata.tags"
              :suggestions="suggestedTags"
              :disabled="isSaving || isGeneratingInsights"
              @update:model-value="updateField('tags', $event)"
            />
          </div>
        </div>
      </section>
    </div>

    <footer v-if="!isCollapsed" class="metadata-footer">
      <button
        class="ghost-button"
        type="button"
        :disabled="!canGenerateInsights"
        @click="$emit('generateInsights')"
      >
        {{ generateButtonText }}
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

.metadata-grid {
  display: grid;
  gap: 0.9rem;
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

.metadata-footer {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

@media (max-width: 960px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .metadata-header,
  .metadata-header-actions,
  .content-header,
  .metadata-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>

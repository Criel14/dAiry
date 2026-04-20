<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import TagInput from '../../../form/components/TagInput/TagInput.vue'
import SuggestionInput from '../../../form/components/SuggestionInput/SuggestionInput.vue'
import SettingsInfoTip from '../../../settings/components/SettingsInfoTip/SettingsInfoTip.vue'
import type { FrontmatterVisibilityConfig } from '../../../../types/app'
import type { JournalEntryMetadata } from '../../../../types/journal'

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
              spellcheck="false"
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

<style scoped src="./JournalMetadataPanel.css"></style>


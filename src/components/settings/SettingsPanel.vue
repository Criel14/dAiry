<script setup lang="ts">
import { computed } from 'vue'
import packageJson from '../../../package.json'
import type { AiSettings, AiSettingsStatus, FrontmatterVisibilityConfig } from '../../types/dairy'
import SettingsAboutSection from './SettingsAboutSection.vue'
import SettingsAiSection from './SettingsAiSection.vue'
import SettingsAppearanceSection from './SettingsAppearanceSection.vue'
import SettingsEditorSection from './SettingsEditorSection.vue'
import SettingsLibrariesSection from './SettingsLibrariesSection.vue'
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
  type SettingsSectionItem,
} from './config'
import SettingsWorkspaceSection from './SettingsWorkspaceSection.vue'

const props = defineProps<{
  workspacePath: string | null
  journalHeatmapEnabled: boolean
  isSavingJournalHeatmap: boolean
  heatmapSaveMessage: string
  dayStartHour: number
  isSavingDayStartHour: boolean
  dayStartHourSaveMessage: string
  frontmatterVisibility: FrontmatterVisibilityConfig
  isSavingFrontmatterVisibility: boolean
  frontmatterVisibilitySaveMessage: string
  workspaceTags: string[]
  workspaceWeatherOptions: string[]
  workspaceLocationOptions: string[]
  isSavingWorkspaceLibraries: boolean
  workspaceLibrariesSaveMessage: string
  aiSettingsStatus: AiSettingsStatus
  isSavingAiSettings: boolean
  aiSettingsSaveMessage: string
  isSavingAiApiKey: boolean
  aiApiKeySaveMessage: string
  activeSectionId: SettingsSectionId
}>()

const emit = defineEmits<{
  'update:journalHeatmapEnabled': [value: boolean]
  'update:dayStartHour': [value: number]
  'update:frontmatterVisibility': [value: FrontmatterVisibilityConfig]
  saveWorkspaceLibraries: [
    value: {
      tags: string[]
      weatherOptions: string[]
      locationOptions: string[]
    },
  ]
  saveAiSettings: [value: AiSettings]
  saveAiApiKey: [
    value: {
      providerType: AiSettings['providerType']
      apiKey: string
    },
  ]
}>()

const appVersion = packageJson.version ?? '0.0.0'
const repositoryUrl = 'https://github.com/Criel14/dAiry'
const feedbackEmail = 'chencriel@qq.com'

const activeSection = computed<SettingsSectionItem>(() => {
  return SETTINGS_SECTIONS.find((section) => section.id === props.activeSectionId) ?? SETTINGS_SECTIONS[0]
})

function openRepository() {
  void window.dairy.openExternalLink({ url: repositoryUrl })
}

function openFeedbackEmail() {
  void window.dairy.openExternalLink({ url: `mailto:${feedbackEmail}` })
}

function openDebugPanel() {
  void window.dairy.openDevTools()
}
</script>

<template>
  <section class="settings-panel">
    <div class="settings-content">
      <header class="settings-page-header">
        <h3 class="settings-page-title">{{ activeSection.label }}</h3>
        <p class="panel-description">{{ activeSection.description }}</p>
      </header>

      <SettingsAppearanceSection
        v-if="activeSectionId === 'appearance'"
        :journal-heatmap-enabled="props.journalHeatmapEnabled"
        :is-saving-journal-heatmap="props.isSavingJournalHeatmap"
        :heatmap-save-message="props.heatmapSaveMessage"
        @update:journal-heatmap-enabled="emit('update:journalHeatmapEnabled', $event)"
      />

      <SettingsEditorSection
        v-else-if="activeSectionId === 'display'"
        :day-start-hour="props.dayStartHour"
        :is-saving-day-start-hour="props.isSavingDayStartHour"
        :day-start-hour-save-message="props.dayStartHourSaveMessage"
        :frontmatter-visibility="props.frontmatterVisibility"
        :is-saving-frontmatter-visibility="props.isSavingFrontmatterVisibility"
        :frontmatter-visibility-save-message="props.frontmatterVisibilitySaveMessage"
        @update:day-start-hour="emit('update:dayStartHour', $event)"
        @update:frontmatter-visibility="emit('update:frontmatterVisibility', $event)"
      />

      <SettingsAiSection
        v-else-if="activeSectionId === 'llm'"
        :ai-settings-status="props.aiSettingsStatus"
        :is-saving-ai-settings="props.isSavingAiSettings"
        :ai-settings-save-message="props.aiSettingsSaveMessage"
        :is-saving-ai-api-key="props.isSavingAiApiKey"
        :ai-api-key-save-message="props.aiApiKeySaveMessage"
        @save-ai-settings="emit('saveAiSettings', $event)"
        @save-ai-api-key="emit('saveAiApiKey', $event)"
      />

      <SettingsLibrariesSection
        v-else-if="activeSectionId === 'libraries'"
        :workspace-path="props.workspacePath"
        :workspace-tags="props.workspaceTags"
        :workspace-weather-options="props.workspaceWeatherOptions"
        :workspace-location-options="props.workspaceLocationOptions"
        :is-saving-workspace-libraries="props.isSavingWorkspaceLibraries"
        :workspace-libraries-save-message="props.workspaceLibrariesSaveMessage"
        @save-workspace-libraries="emit('saveWorkspaceLibraries', $event)"
      />

      <SettingsWorkspaceSection
        v-else-if="activeSectionId === 'workspace'"
        :workspace-path="props.workspacePath"
      />

      <SettingsAboutSection
        v-else
        :app-version="appVersion"
        :repository-url="repositoryUrl"
        :feedback-email="feedbackEmail"
        @open-repository="openRepository"
        @open-feedback-email="openFeedbackEmail"
        @open-debug-panel="openDebugPanel"
      />
    </div>
  </section>
</template>

<style src="./settings-panel.css"></style>

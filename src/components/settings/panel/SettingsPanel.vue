<script setup lang="ts">
import { computed } from 'vue'
import packageJson from '../../../../package.json'
import type { AiContextDocument, AiSettings, AiSettingsStatus } from '../../../types/ai'
import type {
  AppTheme,
  FrontmatterVisibilityConfig,
  WindowCloseBehavior,
} from '../../../types/app'
import SettingsAboutSection from '../sections/SettingsAboutSection.vue'
import SettingsAiSection from '../sections/SettingsAiSection.vue'
import SettingsAppearanceSection from '../sections/SettingsAppearanceSection.vue'
import SettingsEditorSection from '../sections/SettingsEditorSection.vue'
import SettingsLibrariesSection from '../sections/SettingsLibrariesSection.vue'
import SettingsShortcutsSection from '../sections/SettingsShortcutsSection.vue'
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
  type SettingsSectionItem,
} from '../config/config'
import SettingsWorkspaceSection from '../sections/SettingsWorkspaceSection.vue'

const props = defineProps<{
  workspacePath: string | null
  theme: AppTheme
  isSavingTheme: boolean
  themeSaveMessage: string
  windowZoomFactor: number
  isSavingWindowZoomFactor: boolean
  windowZoomFactorSaveMessage: string
  journalHeatmapEnabled: boolean
  isSavingJournalHeatmap: boolean
  heatmapSaveMessage: string
  dayStartHour: number
  isSavingDayStartHour: boolean
  dayStartHourSaveMessage: string
  windowCloseBehavior: WindowCloseBehavior
  isSavingWindowCloseBehavior: boolean
  windowCloseBehaviorSaveMessage: string
  frontmatterVisibility: FrontmatterVisibilityConfig
  isSavingFrontmatterVisibility: boolean
  frontmatterVisibilitySaveMessage: string
  workspaceTags: string[]
  workspaceWeatherOptions: string[]
  workspaceLocationOptions: string[]
  isSavingWorkspaceLibraries: boolean
  workspaceLibrariesSaveMessage: string
  aiSettingsStatus: AiSettingsStatus
  isSavingAiConfig: boolean
  aiSaveMessage: string
  aiContextDocument: AiContextDocument
  isSavingAiContext: boolean
  aiContextSaveMessage: string
  activeSectionId: SettingsSectionId
}>()

const emit = defineEmits<{
  'update:theme': [value: AppTheme]
  'update:windowZoomFactor': [value: number]
  'update:journalHeatmapEnabled': [value: boolean]
  'update:dayStartHour': [value: number]
  'update:windowCloseBehavior': [value: WindowCloseBehavior]
  'update:frontmatterVisibility': [value: FrontmatterVisibilityConfig]
  saveWorkspaceLibraries: [
    value: {
      tags: string[]
      weatherOptions: string[]
      locationOptions: string[]
    },
  ]
  saveAiConfiguration: [
    value: AiSettings & {
      apiKey: string
    },
  ]
  saveAiContext: [value: string]
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
        :theme="props.theme"
        :is-saving-theme="props.isSavingTheme"
        :theme-save-message="props.themeSaveMessage"
        :window-zoom-factor="props.windowZoomFactor"
        :is-saving-window-zoom-factor="props.isSavingWindowZoomFactor"
        :window-zoom-factor-save-message="props.windowZoomFactorSaveMessage"
        :journal-heatmap-enabled="props.journalHeatmapEnabled"
        :is-saving-journal-heatmap="props.isSavingJournalHeatmap"
        :heatmap-save-message="props.heatmapSaveMessage"
        @update:theme="emit('update:theme', $event)"
        @update:window-zoom-factor="emit('update:windowZoomFactor', $event)"
        @update:journal-heatmap-enabled="emit('update:journalHeatmapEnabled', $event)"
      />

      <SettingsEditorSection
        v-else-if="activeSectionId === 'display'"
        :day-start-hour="props.dayStartHour"
        :is-saving-day-start-hour="props.isSavingDayStartHour"
        :day-start-hour-save-message="props.dayStartHourSaveMessage"
        :window-close-behavior="props.windowCloseBehavior"
        :is-saving-window-close-behavior="props.isSavingWindowCloseBehavior"
        :window-close-behavior-save-message="props.windowCloseBehaviorSaveMessage"
        :frontmatter-visibility="props.frontmatterVisibility"
        :is-saving-frontmatter-visibility="props.isSavingFrontmatterVisibility"
        :frontmatter-visibility-save-message="props.frontmatterVisibilitySaveMessage"
        @update:day-start-hour="emit('update:dayStartHour', $event)"
        @update:window-close-behavior="emit('update:windowCloseBehavior', $event)"
        @update:frontmatter-visibility="emit('update:frontmatterVisibility', $event)"
      />

      <SettingsShortcutsSection
        v-else-if="activeSectionId === 'shortcuts'"
      />

      <SettingsAiSection
        v-else-if="activeSectionId === 'llm'"
        :ai-settings-status="props.aiSettingsStatus"
        :is-saving-ai-config="props.isSavingAiConfig"
        :ai-save-message="props.aiSaveMessage"
        :ai-context-document="props.aiContextDocument"
        :is-saving-ai-context="props.isSavingAiContext"
        :ai-context-save-message="props.aiContextSaveMessage"
        @save-ai-configuration="emit('saveAiConfiguration', $event)"
        @save-ai-context="emit('saveAiContext', $event)"
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

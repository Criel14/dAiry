<script setup lang="ts">
import WorkspaceSidebar from '../../components/workspace/components/WorkspaceSidebar/WorkspaceSidebar.vue'
import ReportsSidebar from '../../components/report/components/ReportsSidebar/ReportsSidebar.vue'
import SettingsNav from '../../components/settings/components/SettingsNav/SettingsNav.vue'
import JournalCalendar from '../../components/journal/components/JournalCalendar/JournalCalendar.vue'
import JournalHeader from '../../components/journal/components/JournalHeader/JournalHeader.vue'
import JournalMetadataPanel from '../../components/journal/components/JournalMetadataPanel/JournalMetadataPanel.vue'
import JournalEditorPanel from '../../components/journal/components/JournalEditorPanel/JournalEditorPanel.vue'
import ReportsPanel from '../../components/report/components/ReportsPanel/ReportsPanel.vue'
import SettingsPanel from '../../components/settings/panel/SettingsPanel.vue'
import { SETTINGS_SECTIONS } from '../../components/settings/config/config'
import { useAppShell } from '../composables/useAppShell'

const {
  activeSettingsSectionId,
  aiContextDocument,
  aiContextSaveMessage,
  aiSaveMessage,
  aiSettingsStatus,
  canGenerateDailyInsights,
  canSaveEntry,
  canSaveMetadata,
  dailyInsightsStatusMessage,
  dayStartHour,
  dayStartHourSaveMessage,
  editorContent,
  editorMode,
  frontmatter,
  frontmatterVisibility,
  frontmatterVisibilitySaveMessage,
  handleUpdateWindowCloseBehavior,
  handleChooseWorkspace,
  handleCreateEntry,
  handleGenerateDailyInsights,
  handleSaveAiConfiguration,
  handleSaveAiContext,
  handleSaveAll,
  handleSaveEntry,
  handleSaveMetadata,
  handleSaveWorkspaceLibraries,
  handleSelectDate,
  handleUpdateNotificationEnabled,
  handleUpdateNotificationReminderTime,
  handleUpdateTheme,
  handleUpdateDayStartHour,
  handleUpdateFrontmatterVisibility,
  handleUpdateJournalHeatmapEnabled,
  handleUpdateMetadata,
  handleUpdateWindowZoomFactor,
  hasVisibleMetadataFields,
  heatmapSaveMessage,
  isCreatingEntry,
  isDirty,
  isGeneratingDailyInsights,
  isJournalHeatmapEnabled,
  isJournalReady,
  isSavingAiConfig,
  isSavingAiContext,
  isSavingDayStartHour,
  isSavingEntry,
  isSavingFrontmatterVisibility,
  isSavingJournalHeatmap,
  isSavingMetadata,
  isSavingNotification,
  isSavingTheme,
  isSavingWindowCloseBehavior,
  isSavingWindowZoomFactor,
  isSavingWorkspaceLibraries,
  isSelectedDateToday,
  loadEntryForDate,
  metadataDraft,
  metadataStatusMessage,
  notification,
  notificationSaveMessage,
  openJournalPage,
  openReportsPage,
  openSettingsPage,
  reportsPanel,
  rightPanel,
  saveMetaText,
  selectedDate,
  selectedDateText,
  setEditorMode,
  statusMessage,
  theme,
  themeSaveMessage,
  todayText,
  viewState,
  windowCloseBehavior,
  windowCloseBehaviorSaveMessage,
  windowZoomFactor,
  windowZoomFactorSaveMessage,
  workspaceLibrariesSaveMessage,
  workspaceLocationOptions,
  workspacePath,
  workspaceTags,
  workspaceWeatherOptions,
} = useAppShell()
</script>

<template>
  <div class="app-shell">
    <WorkspaceSidebar
      :workspace-path="workspacePath"
      :active-panel="rightPanel"
      @choose-workspace="handleChooseWorkspace"
      @open-journal="openJournalPage"
      @open-reports="openReportsPage"
      @open-settings="openSettingsPage"
    >
      <template #context>
        <JournalCalendar
          v-if="rightPanel === 'journal'"
          :model-value="selectedDate"
          :today-date="todayText"
          :workspace-path="workspacePath"
          :is-heatmap-enabled="isJournalHeatmapEnabled"
          @update:model-value="handleSelectDate"
        />

        <ReportsSidebar
          v-else-if="rightPanel === 'reports'"
          :has-workspace="reportsPanel.hasWorkspace.value"
          :preset="reportsPanel.preset.value"
          :month-value="reportsPanel.monthValue.value"
          :year-value="reportsPanel.yearValue.value"
          :custom-start-date="reportsPanel.customStartDate.value"
          :custom-end-date="reportsPanel.customEndDate.value"
          :selected-sections="reportsPanel.selectedSections.value"
          :section-options="reportsPanel.sectionOptions"
          :month-reports="reportsPanel.monthReports.value"
          :year-reports="reportsPanel.yearReports.value"
          :custom-report-list="reportsPanel.customReportList.value"
          :selected-report-id="reportsPanel.selectedReportId.value"
          :is-loading-list="reportsPanel.isLoadingList.value"
          :is-generating="reportsPanel.isGenerating.value"
          :status-message="reportsPanel.statusMessage.value"
          @update:preset="reportsPanel.preset.value = $event"
          @update:month-value="reportsPanel.monthValue.value = $event"
          @update:year-value="reportsPanel.yearValue.value = $event"
          @update:custom-start-date="reportsPanel.customStartDate.value = $event"
          @update:custom-end-date="reportsPanel.customEndDate.value = $event"
          @toggle-section="reportsPanel.toggleSection"
          @select-report="reportsPanel.loadReport"
          @generate="reportsPanel.handleGenerateReport"
        />

        <SettingsNav
          v-else-if="rightPanel === 'settings'"
          :sections="SETTINGS_SECTIONS"
          :active-section-id="activeSettingsSectionId"
          @select="activeSettingsSectionId = $event"
        />
      </template>
    </WorkspaceSidebar>

    <main class="editor-shell">
      <section v-if="rightPanel === 'journal'" class="journal-top">
        <JournalHeader
          :selected-date-text="selectedDateText"
          :is-selected-date-today="isSelectedDateToday"
          :is-dirty="isDirty"
          :save-meta-text="saveMetaText"
          :editor-mode="editorMode"
          :is-journal-ready="isJournalReady"
          :can-save-entry="canSaveEntry"
          :is-saving-entry="isSavingEntry"
          @update:editor-mode="setEditorMode"
          @save-entry="handleSaveEntry"
        />

        <JournalMetadataPanel
          v-if="viewState === 'ready' && frontmatter && hasVisibleMetadataFields"
          :metadata="metadataDraft"
          :visibility="frontmatterVisibility"
          :suggested-location-options="workspaceLocationOptions"
          :suggested-weather-options="workspaceWeatherOptions"
          :suggested-tags="workspaceTags"
          :is-saving="isSavingMetadata"
          :can-save="canSaveMetadata"
          :status-message="metadataStatusMessage"
          :is-generating-insights="isGeneratingDailyInsights"
          :can-generate-insights="canGenerateDailyInsights"
          :insights-status-message="dailyInsightsStatusMessage"
          @update:metadata="handleUpdateMetadata"
          @save="handleSaveMetadata"
          @generate-insights="handleGenerateDailyInsights"
        />
      </section>

      <SettingsPanel
        v-if="rightPanel === 'settings'"
        :workspace-path="workspacePath"
        :theme="theme"
        :is-saving-theme="isSavingTheme"
        :theme-save-message="themeSaveMessage"
        :window-zoom-factor="windowZoomFactor"
        :is-saving-window-zoom-factor="isSavingWindowZoomFactor"
        :window-zoom-factor-save-message="windowZoomFactorSaveMessage"
        :journal-heatmap-enabled="isJournalHeatmapEnabled"
        :is-saving-journal-heatmap="isSavingJournalHeatmap"
        :heatmap-save-message="heatmapSaveMessage"
        :day-start-hour="dayStartHour"
        :is-saving-day-start-hour="isSavingDayStartHour"
        :day-start-hour-save-message="dayStartHourSaveMessage"
        :window-close-behavior="windowCloseBehavior"
        :is-saving-window-close-behavior="isSavingWindowCloseBehavior"
        :window-close-behavior-save-message="windowCloseBehaviorSaveMessage"
        :notification-enabled="notification.enabled"
        :notification-reminder-time="notification.reminderTime"
        :is-saving-notification="isSavingNotification"
        :notification-save-message="notificationSaveMessage"
        :frontmatter-visibility="frontmatterVisibility"
        :is-saving-frontmatter-visibility="isSavingFrontmatterVisibility"
        :frontmatter-visibility-save-message="frontmatterVisibilitySaveMessage"
        :workspace-tags="workspaceTags"
        :workspace-weather-options="workspaceWeatherOptions"
        :workspace-location-options="workspaceLocationOptions"
        :is-saving-workspace-libraries="isSavingWorkspaceLibraries"
        :workspace-libraries-save-message="workspaceLibrariesSaveMessage"
        :ai-settings-status="aiSettingsStatus"
        :is-saving-ai-config="isSavingAiConfig"
        :ai-save-message="aiSaveMessage"
        :ai-context-document="aiContextDocument"
        :is-saving-ai-context="isSavingAiContext"
        :ai-context-save-message="aiContextSaveMessage"
        :active-section-id="activeSettingsSectionId"
        @update:theme="handleUpdateTheme"
        @update:window-zoom-factor="handleUpdateWindowZoomFactor"
        @update:journal-heatmap-enabled="handleUpdateJournalHeatmapEnabled"
        @update:day-start-hour="handleUpdateDayStartHour"
        @update:window-close-behavior="handleUpdateWindowCloseBehavior"
        @update:notification-enabled="handleUpdateNotificationEnabled"
        @update:notification-reminder-time="handleUpdateNotificationReminderTime"
        @update:frontmatter-visibility="handleUpdateFrontmatterVisibility"
        @save-workspace-libraries="handleSaveWorkspaceLibraries"
        @save-ai-configuration="handleSaveAiConfiguration"
        @save-ai-context="handleSaveAiContext"
      />

      <ReportsPanel
        v-else-if="rightPanel === 'reports'"
        :workspace-path="workspacePath"
        :has-workspace="reportsPanel.hasWorkspace.value"
        :empty-state-title="reportsPanel.emptyStateTitle.value"
        :empty-state-description="reportsPanel.emptyStateDescription.value"
        :active-report="reportsPanel.activeReport.value"
        :is-loading-report="reportsPanel.isLoadingReport.value"
        :active-stats="reportsPanel.activeStats.value"
        :active-heatmap-points="reportsPanel.activeHeatmapPoints.value"
        :active-mood-points="reportsPanel.activeMoodPoints.value"
        :active-tag-items="reportsPanel.activeTagItems.value"
        :active-location-patterns="reportsPanel.activeLocationPatterns.value"
        :active-time-patterns="reportsPanel.activeTimePatterns.value"
      />

      <JournalEditorPanel
        v-else
        class="journal-editor-panel"
        :view-state="viewState"
        :editor-mode="editorMode"
        :editor-content="editorContent"
        :status-message="statusMessage"
        :is-creating-entry="isCreatingEntry"
        :is-selected-date-today="isSelectedDateToday"
        @update:editor-content="editorContent = $event"
        @create-entry="handleCreateEntry"
        @choose-workspace="handleChooseWorkspace"
        @reload-entry="loadEntryForDate(selectedDate)"
        @save-shortcut="handleSaveAll"
      />
    </main>
  </div>
</template>

<style scoped src="../styles/app-shell.css"></style>

<script setup lang="ts">
import AppShellPage from './app/pages/AppShellPage.vue'
import ReportExportModePage from './app/pages/ReportExportModePage.vue'

const isReportExportMode =
  new URLSearchParams(window.location.search).get('mode') === 'report-export'
</script>

<template>
  <ReportExportModePage v-if="isReportExportMode" />
  <AppShellPage v-else />
</template>

<script setup lang="ts">
import type { RightPanel } from '../../../../types/ui'

defineProps<{
  panel: RightPanel
}>()

const KICKER_BY_PANEL: Record<RightPanel, string> = {
  workspace: 'Local Writing Space',
  journal: 'Daily Journal',
  reports: 'Range Reports',
  timeline: 'Life Timeline',
  bills: 'Bills',
  settings: 'App Setting',
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-top">
      <div class="brand-block">
        <p class="brand-kicker">{{ KICKER_BY_PANEL[panel] }}</p>
      </div>
    </div>

    <div v-if="$slots.context" class="sidebar-context">
      <slot name="context" />
    </div>
  </aside>
</template>

<style scoped src="./WorkspaceSidebar.css"></style>

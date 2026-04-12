<script setup lang="ts">
import type { SettingsSectionId, SettingsSectionItem } from './config'

defineProps<{
  sections: SettingsSectionItem[]
  activeSectionId: SettingsSectionId
}>()

const emit = defineEmits<{
  select: [sectionId: SettingsSectionId]
}>()
</script>

<template>
  <aside class="settings-nav">
    <div class="settings-nav-header">
      <h3 class="settings-nav-title">设置</h3>
    </div>

    <nav class="settings-nav-list" aria-label="设置分组">
      <button
        v-for="section in sections"
        :key="section.id"
        class="settings-nav-item"
        :class="{ 'settings-nav-item--active': activeSectionId === section.id }"
        type="button"
        @click="emit('select', section.id)"
      >
        <span class="settings-nav-item-label">{{ section.label }}</span>
      </button>
    </nav>
  </aside>
</template>

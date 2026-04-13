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

<style scoped>
.settings-nav {
  display: grid;
  gap: 0.8rem;
  align-content: start;
  padding: 0.25rem 0 0;
}

.settings-nav-header {
  display: grid;
  gap: 0.2rem;
}

.settings-nav-title {
  margin: 0;
  color: var(--color-text-subtle);
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.settings-nav-list {
  display: grid;
  gap: 0.4rem;
}

.settings-nav-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.78rem 0.9rem;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  transition:
    transform 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease;
}

.settings-nav-item:hover {
  transform: translateY(-1px);
  background: rgba(245, 235, 195, 0.28);
}

.settings-nav-item--active {
  border-color: var(--color-border);
  background: #f4ead1;
}

.settings-nav-item-label {
  color: var(--color-text-main);
  font-size: 0.95rem;
  font-weight: 600;
}
</style>

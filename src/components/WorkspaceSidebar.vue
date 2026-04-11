<script setup lang="ts">
import { Icon } from '@iconify/vue'
import JournalCalendar from './JournalCalendar.vue'

defineProps<{
  workspacePath: string | null
  selectedDate: string
  todayDate: string
  isJournalHeatmapEnabled: boolean
}>()

defineEmits<{
  chooseWorkspace: []
  openSettings: []
  selectDate: [value: string]
}>()
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-top">
      <div class="brand-block">
        <p class="brand-kicker">Local Writing Space</p>
        <h1 class="brand-title">dAiry</h1>
      </div>

      <section class="workspace-card">
        <header class="workspace-header">
          <div class="workspace-copy">
            <span class="workspace-label">当前目录</span>
            <strong
              class="workspace-path"
              :title="workspacePath ?? '请选择一个目录'"
            >
              {{ workspacePath ?? '请选择一个目录' }}
            </strong>
          </div>

          <div class="workspace-actions">
            <button
              class="icon-button"
              type="button"
              title="打开或切换日记目录"
              aria-label="打开或切换日记目录"
              @click="$emit('chooseWorkspace')"
            >
              <Icon class="icon-svg" icon="lucide:folder-open" aria-hidden="true" />
            </button>

            <button
              class="icon-button"
              type="button"
              title="打开设置"
              aria-label="打开设置"
              @click="$emit('openSettings')"
            >
              <Icon class="icon-svg" icon="lucide:settings" aria-hidden="true" />
            </button>
          </div>
        </header>
      </section>

      <JournalCalendar
        :model-value="selectedDate"
        :today-date="todayDate"
        :workspace-path="workspacePath"
        :is-heatmap-enabled="isJournalHeatmapEnabled"
        @update:model-value="$emit('selectDate', $event)"
      />
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 1.5rem;
  padding: 2rem 1.5rem;
  overflow: hidden;
  border-right: 1px solid var(--color-border);
  background: #fbfaf4;
}

.sidebar-top {
  display: grid;
  gap: 1.25rem;
}

.brand-block {
  display: grid;
  gap: 0.4rem;
}

.brand-kicker,
.workspace-label {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.brand-title {
  margin: 0;
  font-size: 2.4rem;
  color: var(--color-text-main);
}

.brand-subtitle {
  margin: 0;
  color: var(--color-text-subtle);
  line-height: 1.7;
}

.workspace-card {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.workspace-header {
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
  justify-content: space-between;
}

.workspace-copy {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
  flex: 1;
}

.workspace-path {
  display: block;
  overflow: hidden;
  color: var(--color-text-main);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.95rem;
}

.workspace-actions {
  display: flex;
  gap: 0.5rem;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.45rem;
  height: 2.45rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #fffdf8;
  color: var(--color-text-main);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}

.icon-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(95, 82, 42, 0.08);
}

.icon-svg {
  width: 1.35rem;
  height: 1.35rem;
}

@media (max-width: 960px) {
  .sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--color-border);
  }
}

@media (max-width: 768px) {
  .sidebar {
    padding: 1.2rem;
  }
}
</style>

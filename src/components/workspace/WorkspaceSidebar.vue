<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  workspacePath: string | null
  activePanel: 'journal' | 'reports' | 'settings'
}>()

defineEmits<{
  chooseWorkspace: []
  openJournal: []
  openReports: []
  openSettings: []
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
          </div>
        </header>
      </section>

      <nav class="primary-nav" aria-label="一级导航">
        <button
          class="nav-button"
          :class="{ 'nav-button--active': activePanel === 'journal' }"
          type="button"
          @click="$emit('openJournal')"
        >
          写作
        </button>
        <button
          class="nav-button"
          :class="{ 'nav-button--active': activePanel === 'reports' }"
          type="button"
          @click="$emit('openReports')"
        >
          报告
        </button>
        <button
          class="nav-button"
          :class="{ 'nav-button--active': activePanel === 'settings' }"
          type="button"
          @click="$emit('openSettings')"
        >
          设置
        </button>
      </nav>
    </div>

    <div v-if="$slots.context" class="sidebar-context">
      <slot name="context" />
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

.sidebar-context {
  flex: 1;
  min-height: 0;
  margin-right: -0.45rem;
  padding-right: 0.45rem;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #d8ccb0 transparent;
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

.workspace-card {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.primary-nav {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}

.nav-button {
  min-height: 2.6rem;
  padding: 0 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fffdf8;
  color: var(--color-text-subtle);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease,
    color 160ms ease;
}

.nav-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(95, 82, 42, 0.08);
  color: var(--color-text-main);
}

.nav-button--active {
  border-color: var(--color-border-strong);
  background: #f5ebc3;
  color: #4f4630;
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

.sidebar-context::-webkit-scrollbar {
  width: 10px;
}

.sidebar-context::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-context::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 999px;
  background: linear-gradient(180deg, #ded3b8 0%, #cec09b 100%);
  background-clip: padding-box;
}

.sidebar-context::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #d3c5a0 0%, #bda977 100%);
  background-clip: padding-box;
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

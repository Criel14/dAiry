<script setup lang="ts">
import {
  ChartColumn,
  FolderOpen,
  PencilLine,
  SlidersHorizontal,
} from 'lucide-vue-next'

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
              <FolderOpen class="icon-svg" aria-hidden="true" />
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
          <PencilLine class="nav-button-icon" aria-hidden="true" />
          <span>写作</span>
        </button>
        <button
          class="nav-button"
          :class="{ 'nav-button--active': activePanel === 'reports' }"
          type="button"
          @click="$emit('openReports')"
        >
          <ChartColumn class="nav-button-icon" aria-hidden="true" />
          <span>报告</span>
        </button>
        <button
          class="nav-button"
          :class="{ 'nav-button--active': activePanel === 'settings' }"
          type="button"
          @click="$emit('openSettings')"
        >
          <SlidersHorizontal class="nav-button-icon" aria-hidden="true" />
          <span>设置</span>
        </button>
      </nav>
    </div>

    <div v-if="$slots.context" class="sidebar-context">
      <slot name="context" />
    </div>
  </aside>
</template>

<style scoped src="./WorkspaceSidebar.css"></style>

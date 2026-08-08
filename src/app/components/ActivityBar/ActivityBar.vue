<script setup lang="ts">
import {
  ChartColumnBig,
  FolderOpen,
  ListFilter,
  PencilLine,
  Settings,
} from 'lucide-vue-next'
import type { RightPanel } from '../../../types/ui'

defineProps<{
  activePanel: RightPanel
}>()

defineEmits<{
  select: [panel: RightPanel]
}>()

const navItems: Array<{
  panel: RightPanel
  label: string
  icon: typeof PencilLine
}> = [
  { panel: 'workspace', label: '工作区', icon: FolderOpen },
  { panel: 'journal', label: '写日记', icon: PencilLine },
  { panel: 'reports', label: '总结报告', icon: ChartColumnBig },
  { panel: 'timeline', label: '大事件时间轴', icon: ListFilter },
  { panel: 'settings', label: '设置', icon: Settings },
]
</script>

<template>
  <nav class="activity-bar" aria-label="一级导航">
    <button
      v-for="item in navItems"
      :key="item.panel"
      class="activity-button"
      :class="{ 'activity-button--active': activePanel === item.panel }"
      type="button"
      :aria-label="item.label"
      :aria-current="activePanel === item.panel ? 'page' : undefined"
      @click="$emit('select', item.panel)"
    >
      <component :is="item.icon" class="activity-icon" aria-hidden="true" />
      <span class="activity-tooltip" role="tooltip">{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped src="./ActivityBar.css"></style>

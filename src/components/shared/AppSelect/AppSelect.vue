<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

export interface AppSelectOption {
  label: string
  value: string
  icon?: Component
  color?: string
  group?: string
}

const props = withDefaults(
  defineProps<{
    options: AppSelectOption[]
    modelValue: string
    placeholder?: string
    clearable?: boolean
    disabled?: boolean
    ariaLabel?: string
  }>(),
  {
    placeholder: '请选择',
    clearable: false,
    disabled: false,
    ariaLabel: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const menuOpen = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuPosition = ref({ left: 0, width: 0, triggerTop: 0, triggerBottom: 0, openUpward: false })

const MENU_MAX_HEIGHT = 224

const selectedOption = computed(
  () => props.options.find((option) => option.value === props.modelValue) ?? null,
)

const groupedOptions = computed(() => {
  const groups: Array<{ label: string | null; items: AppSelectOption[] }> = []
  for (const option of props.options) {
    const last = groups[groups.length - 1]
    if (option.group && last?.label === option.group) {
      last.items.push(option)
    } else {
      groups.push({ label: option.group ?? null, items: [option] })
    }
  }
  return groups
})

function toggleMenu() {
  if (props.disabled) {
    return
  }
  if (menuOpen.value) {
    menuOpen.value = false
    return
  }
  updateMenuPosition()
  menuOpen.value = true
}

function updateMenuPosition() {
  if (!triggerRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const spaceAbove = rect.top - 8
  menuPosition.value = {
    left: rect.left,
    width: rect.width,
    triggerTop: rect.top,
    triggerBottom: rect.bottom,
    openUpward: spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow,
  }
}

function menuStyle() {
  const { left, width, triggerTop, triggerBottom, openUpward } = menuPosition.value
  const maxHeight = openUpward
    ? Math.min(MENU_MAX_HEIGHT, Math.max(96, triggerTop - 20))
    : Math.min(MENU_MAX_HEIGHT, Math.max(96, window.innerHeight - triggerBottom - 12))
  return {
    position: 'fixed' as const,
    left: `${left}px`,
    width: `${width}px`,
    top: openUpward ? 'auto' : `${triggerBottom + 4}px`,
    bottom: openUpward ? `${window.innerHeight - triggerTop + 8}px` : 'auto',
    maxHeight: `${maxHeight}px`,
  }
}

function selectOption(option: AppSelectOption) {
  emit('update:modelValue', option.value)
  menuOpen.value = false
}

function clearSelection() {
  emit('update:modelValue', '')
  menuOpen.value = false
}

function handleDocumentClick(event: MouseEvent) {
  if (!menuOpen.value) return
  const target = event.target as Node
  const insideTrigger = triggerRef.value?.contains(target) ?? false
  const insideMenu = menuRef.value?.contains(target) ?? false
  if (!insideTrigger && !insideMenu) {
    menuOpen.value = false
  }
}

function handleViewportChange() {
  if (menuOpen.value) {
    updateMenuPosition()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentClick)
  window.addEventListener('scroll', handleViewportChange, true)
  window.addEventListener('resize', handleViewportChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentClick)
  window.removeEventListener('scroll', handleViewportChange, true)
  window.removeEventListener('resize', handleViewportChange)
})
</script>

<template>
  <div ref="triggerRef" class="app-select">
    <button
      type="button"
      class="app-select-trigger"
      :class="{ 'app-select-trigger--open': menuOpen }"
      :disabled="disabled"
      :aria-label="ariaLabel || undefined"
      @click="toggleMenu"
    >
      <template v-if="selectedOption">
        <span
          v-if="selectedOption.icon"
          class="app-select-option-icon"
          :style="{ backgroundColor: selectedOption.color }"
        >
          <component :is="selectedOption.icon" class="app-select-option-svg" aria-hidden="true" />
        </span>
        <span class="app-select-option-name">{{ selectedOption.label }}</span>
      </template>
      <span v-else class="app-select-placeholder">{{ placeholder }}</span>
      <ChevronDown class="app-select-arrow" aria-hidden="true" />
    </button>
    <Teleport to="body">
      <div v-if="menuOpen" ref="menuRef" class="app-select-menu" :style="menuStyle()">
        <button
          v-if="clearable"
          type="button"
          class="app-select-menu-item"
          :class="{ 'app-select-menu-item--selected': modelValue === '' }"
          @click="clearSelection"
        >
          <span class="app-select-option-name">全部</span>
        </button>
        <template v-for="(group, groupIndex) in groupedOptions" :key="group.label ?? `group-${groupIndex}`">
          <p v-if="group.label" class="app-select-menu-group">{{ group.label }}</p>
          <button
            v-for="option in group.items"
            :key="option.value"
            type="button"
            class="app-select-menu-item"
            :class="{ 'app-select-menu-item--selected': option.value === modelValue }"
            @click="selectOption(option)"
          >
            <span
              v-if="option.icon"
              class="app-select-option-icon"
              :style="{ backgroundColor: option.color }"
            >
              <component :is="option.icon" class="app-select-option-svg" aria-hidden="true" />
            </span>
            <span class="app-select-option-name">{{ option.label }}</span>
          </button>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<style scoped src="./AppSelect.css"></style>

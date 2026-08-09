<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import type { BillCategory, BillType } from '../../../../types/bills'
import { BILL_TYPE_LABELS } from '../../../../types/bills'
import { iconForName } from '../../bills-icons'

const props = withDefaults(
  defineProps<{
    categories: BillCategory[]
    modelValue: string
    placeholder?: string
    clearable?: boolean
  }>(),
  {
    placeholder: '请选择分类',
    clearable: false,
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

const selectedCategory = computed(() =>
  props.categories.find((c) => c.name === props.modelValue) ?? null,
)

const groupedCategories = computed(() => {
  const order: BillType[] = ['expense', 'income', 'transfer']
  const groups: Array<{ type: BillType; label: string; items: BillCategory[] }> = []
  for (const type of order) {
    const items = props.categories.filter((c) => c.type === type)
    if (items.length > 0) {
      groups.push({ type, label: BILL_TYPE_LABELS[type], items })
    }
  }
  return groups
})

function toggleMenu() {
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

function selectCategory(name: string) {
  emit('update:modelValue', name)
  menuOpen.value = false
}

function clearCategory() {
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
  <div ref="triggerRef" class="category-select">
    <button
      type="button"
      class="category-select-trigger"
      :class="{ 'category-select-trigger--open': menuOpen }"
      @click="toggleMenu"
    >
      <template v-if="selectedCategory">
        <span class="category-option-icon" :style="{ backgroundColor: selectedCategory.color }">
          <component :is="iconForName(selectedCategory.icon)" class="category-option-svg" aria-hidden="true" />
        </span>
        <span class="category-option-name">{{ selectedCategory.name }}</span>
      </template>
      <span v-else class="category-select-placeholder">{{ placeholder }}</span>
      <ChevronDown class="category-select-arrow" aria-hidden="true" />
    </button>
    <Teleport to="body">
      <div v-if="menuOpen" ref="menuRef" class="category-menu" :style="menuStyle()">
        <button
          v-if="clearable"
          type="button"
          class="category-menu-item"
          :class="{ 'category-menu-item--selected': modelValue === '' }"
          @click="clearCategory"
        >
          <span class="category-option-icon category-option-icon--all">
            <component :is="iconForName('ellipsis')" class="category-option-svg" aria-hidden="true" />
          </span>
          <span class="category-option-name">全部</span>
        </button>
        <template v-for="group in groupedCategories" :key="group.type">
          <p class="category-menu-group">{{ group.label }}</p>
          <button
            v-for="category in group.items"
            :key="`${category.type}:${category.name}`"
            type="button"
            class="category-menu-item"
            :class="{ 'category-menu-item--selected': category.name === modelValue }"
            @click="selectCategory(category.name)"
          >
            <span class="category-option-icon" :style="{ backgroundColor: category.color }">
              <component :is="iconForName(category.icon)" class="category-option-svg" aria-hidden="true" />
            </span>
            <span class="category-option-name">{{ category.name }}</span>
          </button>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<style scoped src="./BillsCategorySelect.css"></style>

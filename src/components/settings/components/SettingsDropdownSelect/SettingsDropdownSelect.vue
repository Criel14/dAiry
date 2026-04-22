<script setup lang="ts">
import { Check, ChevronDown } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface SettingsDropdownOption {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: SettingsDropdownOption[]
    label: string
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const GAP = 8
const VIEWPORT_PADDING = 12

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const buttonRef = ref<HTMLButtonElement | null>(null)
const popupRef = ref<HTMLElement | null>(null)
const popupStyle = ref<Record<string, string>>({
  top: '0px',
  left: '0px',
  minWidth: '0px',
})

const selectedOption = computed(
  () => props.options.find((item) => item.value === props.modelValue) ?? props.options[0] ?? null,
)

function closeMenu() {
  isOpen.value = false
}

function updatePopupPosition() {
  if (!buttonRef.value || !popupRef.value) {
    return
  }

  const buttonRect = buttonRef.value.getBoundingClientRect()
  const popupRect = popupRef.value.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let left = buttonRect.left
  if (left + popupRect.width > viewportWidth - VIEWPORT_PADDING) {
    left = viewportWidth - popupRect.width - VIEWPORT_PADDING
  }

  left = Math.max(VIEWPORT_PADDING, left)

  let top = buttonRect.bottom + GAP
  if (top + popupRect.height > viewportHeight - VIEWPORT_PADDING) {
    top = buttonRect.top - popupRect.height - GAP
  }

  top = Math.max(VIEWPORT_PADDING, top)

  popupStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${buttonRect.width}px`,
  }
}

function scrollSelectedOptionIntoView() {
  if (!popupRef.value || !selectedOption.value) {
    return
  }

  const activeElement = popupRef.value.querySelector<HTMLElement>(
    `[data-option-value="${CSS.escape(selectedOption.value.value)}"]`,
  )

  activeElement?.scrollIntoView({
    block: 'nearest',
  })
}

async function openMenu() {
  if (props.disabled || props.options.length === 0 || isOpen.value) {
    return
  }

  isOpen.value = true
  await nextTick()
  updatePopupPosition()
  scrollSelectedOptionIntoView()
}

function toggleMenu() {
  if (isOpen.value) {
    closeMenu()
    return
  }

  void openMenu()
}

function selectOption(value: string) {
  emit('update:modelValue', value)
  closeMenu()
}

function handleDocumentPointerDown(event: MouseEvent) {
  if (!rootRef.value || !popupRef.value) {
    return
  }

  const target = event.target
  if (!(target instanceof Node)) {
    return
  }

  if (rootRef.value.contains(target) || popupRef.value.contains(target)) {
    return
  }

  closeMenu()
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeMenu()
  }
}

function handleWindowChange() {
  if (isOpen.value) {
    updatePopupPosition()
  }
}

watch(
  () => props.disabled,
  (value) => {
    if (value) {
      closeMenu()
    }
  },
)

watch(
  () => props.modelValue,
  async () => {
    if (!isOpen.value) {
      return
    }

    await nextTick()
    scrollSelectedOptionIntoView()
  },
)

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('resize', handleWindowChange)
  window.addEventListener('scroll', handleWindowChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('resize', handleWindowChange)
  window.removeEventListener('scroll', handleWindowChange, true)
})
</script>

<template>
  <div ref="rootRef" class="settings-dropdown">
    <button
      ref="buttonRef"
      class="settings-dropdown-trigger"
      type="button"
      :disabled="disabled"
      :aria-label="label"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      @click="toggleMenu"
    >
      <span class="settings-dropdown-trigger-label">
        {{ selectedOption?.label ?? '--' }}
      </span>
      <ChevronDown class="settings-dropdown-trigger-icon" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <transition name="settings-dropdown-fade">
        <div
          v-if="isOpen"
          ref="popupRef"
          class="settings-dropdown-menu"
          :style="popupStyle"
          role="listbox"
          :aria-label="label"
        >
          <button
            v-for="item in options"
            :key="item.value"
            class="settings-dropdown-option"
            :class="{ 'settings-dropdown-option--selected': item.value === modelValue }"
            type="button"
            :data-option-value="item.value"
            :aria-selected="item.value === modelValue"
            @pointerdown.prevent="selectOption(item.value)"
          >
            <span>{{ item.label }}</span>
            <Check v-if="item.value === modelValue" class="settings-dropdown-option-check" aria-hidden="true" />
          </button>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped src="./SettingsDropdownSelect.css"></style>

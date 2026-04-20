<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'

const props = defineProps<{
  modelValue: string
  suggestions: string[]
  placeholder: string
  toggleAriaLabel: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isOpen = ref(false)
const inputValue = ref(props.modelValue)
const inputRef = ref<HTMLInputElement | null>(null)

function normalizeValue(value: string) {
  return value.trim()
}

watch(
  () => props.modelValue,
  (value) => {
    inputValue.value = value
  },
)

watch(
  () => props.disabled,
  (value) => {
    if (value) {
      isOpen.value = false
    }
  },
)

const filteredSuggestions = computed(() => {
  const keyword = normalizeValue(inputValue.value).toLowerCase()

  return props.suggestions.filter((item) => {
    if (!keyword) {
      return true
    }

    return item.toLowerCase().includes(keyword)
  })
})

function openMenu() {
  if (props.disabled || isOpen.value) {
    return
  }

  isOpen.value = true
}

function closeMenu() {
  isOpen.value = false
}

function focusInput() {
  void nextTick(() => {
    inputRef.value?.focus()
  })
}

function toggleMenu() {
  if (isOpen.value) {
    closeMenu()
    return
  }

  openMenu()
  focusInput()
}

function commitValue(rawValue: string) {
  const nextValue = normalizeValue(rawValue)
  inputValue.value = nextValue
  emit('update:modelValue', nextValue)
  closeMenu()
}

function handleInput() {
  if (!isOpen.value) {
    isOpen.value = true
  }

  emit('update:modelValue', inputValue.value)
}

function handleBlur() {
  window.setTimeout(() => {
    commitValue(inputValue.value)
  }, 120)
}

function handleSuggestionPointerDown(item: string) {
  commitValue(item)
}
</script>

<template>
  <div class="suggestion-input">
    <div class="suggestion-control">
      <input
        ref="inputRef"
        v-model="inputValue"
        class="suggestion-field"
        type="text"
        :placeholder="placeholder"
        :disabled="disabled"
        spellcheck="false"
        @focus="openMenu"
        @input="handleInput"
        @keydown.enter.prevent="commitValue(inputValue)"
        @keydown.esc.prevent="closeMenu"
        @blur="handleBlur"
      />

      <button
        class="suggestion-toggle"
        type="button"
        :disabled="disabled"
        :aria-label="toggleAriaLabel"
        @click="toggleMenu"
      >
        <Icon
          class="suggestion-toggle-icon"
          :icon="isOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'"
          aria-hidden="true"
        />
      </button>
    </div>

    <div v-if="isOpen && filteredSuggestions.length > 0" class="suggestion-list">
      <button
        v-for="item in filteredSuggestions.slice(0, 8)"
        :key="item"
        class="suggestion-item"
        type="button"
        @pointerdown.prevent="handleSuggestionPointerDown(item)"
      >
        {{ item }}
      </button>
    </div>
  </div>
</template>

<style scoped src="./SuggestionInput.css"></style>

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
  if (props.disabled) {
    return
  }

  isOpen.value = true
  void nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

function closeMenu() {
  isOpen.value = false
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
        @click="isOpen ? closeMenu() : openMenu()"
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

<style scoped>
.suggestion-input {
  display: grid;
  gap: 0.55rem;
}

.suggestion-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.6rem;
}

.suggestion-field {
  min-height: 2.6rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fffef9;
  color: var(--color-text-main);
  outline: none;
}

.suggestion-field:focus {
  border-color: var(--color-border-strong);
}

.suggestion-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.6rem;
  min-height: 2.6rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fffdf8;
  color: var(--color-text-main);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    opacity 160ms ease;
}

.suggestion-toggle:hover:not(:disabled),
.suggestion-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(95, 82, 42, 0.08);
}

.suggestion-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
  box-shadow: none;
}

.suggestion-toggle-icon {
  width: 1rem;
  height: 1rem;
}

.suggestion-list {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.suggestion-item {
  min-height: 2rem;
  padding: 0 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: #fffdf8;
  color: var(--color-text-subtle);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}
</style>

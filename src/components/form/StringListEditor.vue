<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

const props = defineProps<{
  modelValue: string[]
  placeholder: string
  emptyText: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const isInputVisible = ref(false)
const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const items = computed(() => props.modelValue)

function normalizeItems(values: string[]) {
  const uniqueItems = new Set<string>()

  for (const value of values) {
    const normalizedValue = value.trim()
    if (!normalizedValue) {
      continue
    }

    uniqueItems.add(normalizedValue)
  }

  return [...uniqueItems]
}

function showInput() {
  if (props.disabled) {
    return
  }

  isInputVisible.value = true
  void nextTick(() => {
    inputRef.value?.focus()
  })
}

function hideInput() {
  isInputVisible.value = false
  inputValue.value = ''
}

function commitItem(rawValue: string) {
  const nextValue = rawValue.trim()

  if (!nextValue) {
    hideInput()
    return
  }

  emit('update:modelValue', normalizeItems([...props.modelValue, nextValue]))
  hideInput()
}

function removeItem(itemToRemove: string) {
  emit(
    'update:modelValue',
    props.modelValue.filter((item) => item !== itemToRemove),
  )
}

function handleInputBlur() {
  window.setTimeout(() => {
    if (inputValue.value.trim()) {
      commitItem(inputValue.value)
      return
    }

    hideInput()
  }, 120)
}
</script>

<template>
  <div class="string-list-editor">
    <div v-if="items.length > 0" class="item-list">
      <span v-for="item in items" :key="item" class="item-chip">
        <span>{{ item }}</span>
        <button
          class="item-chip-remove"
          type="button"
          :disabled="disabled"
          :aria-label="`删除 ${item}`"
          @click="removeItem(item)"
        >
          ×
        </button>
      </span>
    </div>

    <p v-else class="empty-text">{{ emptyText }}</p>

    <div class="editor-actions">
      <button
        v-if="!isInputVisible"
        class="add-button"
        type="button"
        :disabled="disabled"
        @click="showInput"
      >
        添加
      </button>

      <input
        v-else
        ref="inputRef"
        v-model="inputValue"
        class="editor-input"
        type="text"
        :placeholder="placeholder"
        :disabled="disabled"
        @keydown.enter.prevent="commitItem(inputValue)"
        @keydown.esc.prevent="hideInput"
        @blur="handleInputBlur"
      />
    </div>
  </div>
</template>

<style scoped>
.string-list-editor {
  display: grid;
  gap: 0.75rem;
}

.item-list {
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.item-chip {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  min-height: 2rem;
  padding: 0 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: #fcf7e7;
  color: var(--color-text-main);
  font-size: 0.9rem;
}

.item-chip-remove,
.add-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: #fffdf8;
  color: var(--color-text-main);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    opacity 160ms ease;
}

.item-chip-remove {
  min-width: 1.4rem;
  height: 1.4rem;
  border: 0;
  background: transparent;
}

.item-chip-remove:hover:not(:disabled),
.add-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(95, 82, 42, 0.08);
}

.item-chip-remove:disabled,
.add-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
  box-shadow: none;
}

.editor-actions {
  display: grid;
  gap: 0.5rem;
}

.editor-input {
  min-height: 2.6rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fffef9;
  color: var(--color-text-main);
  outline: none;
}

.editor-input:focus {
  border-color: var(--color-border-strong);
}

.empty-text {
  margin: 0;
  color: var(--color-text-soft);
  line-height: 1.7;
}
</style>

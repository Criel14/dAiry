<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string[]
  placeholder: string
  emptyText: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const inputValue = ref('')

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

const currentItems = ref<string[]>(normalizeItems(props.modelValue))

watch(
  () => props.modelValue,
  (value) => {
    currentItems.value = normalizeItems(value)
  },
  { deep: true },
)

watch(
  () => props.disabled,
  (value) => {
    if (value) {
      inputValue.value = ''
    }
  },
)

const items = computed(() => currentItems.value)

function emitItems(nextItems: string[]) {
  const normalizedItems = normalizeItems(nextItems)
  currentItems.value = normalizedItems
  emit('update:modelValue', normalizedItems)
}

function commitItem(rawValue: string) {
  const nextValue = rawValue.trim()

  if (!nextValue) {
    return
  }

  if (currentItems.value.includes(nextValue)) {
    inputValue.value = ''
    return
  }

  emitItems([...currentItems.value, nextValue])
  inputValue.value = ''
}

function removeItem(itemToRemove: string) {
  emitItems(currentItems.value.filter((item) => item !== itemToRemove))
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
      <input
        v-model="inputValue"
        class="editor-input"
        type="text"
        :placeholder="placeholder"
        :disabled="disabled"
        @keydown.enter.prevent="commitItem(inputValue)"
      />

      <button
        class="add-button"
        type="button"
        :disabled="disabled"
        aria-label="添加词库项"
        @click="commitItem(inputValue)"
      >
        添加
      </button>
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
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: center;
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

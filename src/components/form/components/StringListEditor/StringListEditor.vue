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
        spellcheck="false"
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

<style scoped src="./StringListEditor.css"></style>

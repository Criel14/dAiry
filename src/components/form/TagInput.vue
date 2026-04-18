<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string[]
  suggestions: string[]
  placeholder?: string
  addButtonAriaLabel?: string
  removeAriaLabelPrefix?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const isInputVisible = ref(false)
const tagInputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const inputPlaceholder = computed(() => props.placeholder ?? '输入标签后回车')
const addButtonAriaLabel = computed(() => props.addButtonAriaLabel ?? '添加标签')
const removeAriaLabelPrefix = computed(() => props.removeAriaLabelPrefix ?? '删除标签')

function normalizeTag(tag: string) {
  return tag.trim()
}

function normalizeTagList(tags: string[]) {
  const uniqueTags = new Set<string>()

  for (const tag of tags) {
    const normalizedTag = normalizeTag(tag)
    if (!normalizedTag) {
      continue
    }

    uniqueTags.add(normalizedTag)
  }

  return [...uniqueTags]
}

const currentTags = ref<string[]>(normalizeTagList(props.modelValue))

watch(
  () => props.modelValue,
  (value) => {
    currentTags.value = normalizeTagList(value)
  },
  { deep: true },
)

watch(
  () => props.disabled,
  (value) => {
    if (value) {
      isInputVisible.value = false
      tagInputValue.value = ''
    }
  },
)

const filteredSuggestions = computed(() => {
  const selectedTags = new Set(currentTags.value)
  const keyword = normalizeTag(tagInputValue.value).toLowerCase()

  return props.suggestions.filter((tag) => {
    if (selectedTags.has(tag)) {
      return false
    }

    if (!keyword) {
      return true
    }

    return tag.toLowerCase().includes(keyword)
  })
})

function emitTags(nextTags: string[]) {
  const normalizedTags = normalizeTagList(nextTags)
  currentTags.value = normalizedTags
  emit('update:modelValue', normalizedTags)
}

function showInput() {
  if (props.disabled || isInputVisible.value) {
    return
  }

  isInputVisible.value = true
  void nextTick(() => {
    inputRef.value?.focus()
  })
}

function hideInput() {
  isInputVisible.value = false
  tagInputValue.value = ''
}

function commitTag(rawTag: string) {
  const nextTag = normalizeTag(rawTag)
  if (!nextTag) {
    return
  }

  if (currentTags.value.includes(nextTag)) {
    hideInput()
    return
  }

  emitTags([...currentTags.value, nextTag])
  hideInput()
}

function removeTag(tagToRemove: string) {
  emitTags(currentTags.value.filter((tag) => tag !== tagToRemove))
}

function handleInputBlur() {
  window.setTimeout(() => {
    if (!tagInputValue.value.trim()) {
      hideInput()
    }
  }, 120)
}

function handleSuggestionPointerDown(tag: string) {
  commitTag(tag)
}
</script>

<template>
  <div class="tag-input">
    <div class="tag-list">
      <span v-for="tag in currentTags" :key="tag" class="tag-chip">
        <span>{{ tag }}</span>
        <button
          class="tag-chip-remove"
          type="button"
          :disabled="disabled"
          :aria-label="`${removeAriaLabelPrefix} ${tag}`"
          @click="removeTag(tag)"
        >
          ×
        </button>
      </span>

      <button
        v-if="!isInputVisible"
        class="tag-add-button"
        type="button"
        :disabled="disabled"
        :aria-label="addButtonAriaLabel"
        @click="showInput"
      >
        +
      </button>

      <input
        v-else
        ref="inputRef"
        v-model="tagInputValue"
        class="tag-input-inline"
        type="text"
        :placeholder="inputPlaceholder"
        :disabled="disabled"
        @keydown.enter.prevent="commitTag(tagInputValue)"
        @keydown.esc.prevent="hideInput"
        @blur="handleInputBlur"
      />
    </div>

    <div v-if="isInputVisible" class="tag-composer">
      <div v-if="filteredSuggestions.length > 0" class="tag-suggestion-list">
        <button
          v-for="tag in filteredSuggestions.slice(0, 8)"
          :key="tag"
          class="tag-suggestion"
          type="button"
          @pointerdown.prevent="handleSuggestionPointerDown(tag)"
        >
          {{ tag }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tag-input {
  display: grid;
  gap: 0.75rem;
}

.tag-list {
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.tag-chip {
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

.tag-chip-remove,
.tag-add-button {
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

.tag-chip-remove {
  min-width: 1.4rem;
  height: 1.4rem;
  border: 0;
  background: transparent;
}

.tag-chip-remove:hover:not(:disabled),
.tag-add-button:hover:not(:disabled),
.tag-suggestion:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(95, 82, 42, 0.08);
}

.tag-chip-remove:disabled,
.tag-add-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
  box-shadow: none;
}

.tag-composer {
  display: grid;
  gap: 0.5rem;
}

.tag-input-inline {
  min-width: 9rem;
  min-height: 2rem;
  padding: 0 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: #fffef9;
  color: var(--color-text-main);
  outline: none;
}

.tag-input-inline:focus {
  border-color: var(--color-border-strong);
}

.tag-suggestion-list {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tag-suggestion {
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

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

<style scoped src="./TagInput.css"></style>

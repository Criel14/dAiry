<script setup lang="ts">
import { ref, watch } from 'vue'

export interface BillsRenameState {
  type: 'expense' | 'income' | 'transfer'
  name: string
}

const props = defineProps<{
  state: BillsRenameState | null
}>()

const emit = defineEmits<{
  close: []
  confirm: [newName: string]
}>()

const draftName = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.state,
  (state) => {
    if (state) {
      draftName.value = state.name
      requestAnimationFrame(() => {
        inputRef.value?.focus()
        inputRef.value?.select()
      })
    }
  },
)

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    submit()
  } else if (event.key === 'Escape') {
    emit('close')
  }
}

function submit() {
  const newName = draftName.value.trim()
  if (!newName || !props.state || newName === props.state.name) {
    emit('close')
    return
  }
  emit('confirm', newName)
}
</script>

<template>
  <div v-if="state" class="rename-overlay" @click.self="emit('close')">
    <div class="rename-card">
      <h3 class="rename-title">重命名分类</h3>
      <input
        ref="inputRef"
        v-model="draftName"
        class="rename-input"
        type="text"
        maxlength="12"
        placeholder="输入新的分类名"
        @keydown="handleKeydown"
      />
      <div class="rename-actions">
        <button class="rename-button" type="button" @click="emit('close')">取消</button>
        <button class="rename-button rename-button--primary" type="button" @click="submit">
          确认
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped src="./BillsRenameModal.css"></style>

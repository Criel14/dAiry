<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { TimelineEvent } from '../../../../types/timeline'
import { getReadableErrorMessage } from '../../../../utils/error'

const props = defineProps<{
  open: boolean
  editing: TimelineEvent | null
  workspacePath: string | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const form = reactive<{
  date: string
  title: string
  detail: string
}>({
  date: '',
  title: '',
  detail: '',
})

const errorMessage = ref('')
const isSaving = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    if (props.editing) {
      form.date = props.editing.date
      form.title = props.editing.title
      form.detail = props.editing.detail
    } else {
      form.date = ''
      form.title = ''
      form.detail = ''
    }
    errorMessage.value = ''
  },
)

function requestClose() {
  emit('close')
}

async function handleSubmit() {
  errorMessage.value = ''

  if (!form.date) {
    errorMessage.value = '请选择日期'
    return
  }

  if (!form.title.trim()) {
    errorMessage.value = '请输入标题'
    return
  }

  if (!props.workspacePath) {
    errorMessage.value = '请先选择工作区'
    return
  }

  isSaving.value = true
  try {
    if (props.editing) {
      const result = await window.dairy.updateTimelineEvent({
        workspacePath: props.workspacePath,
        id: props.editing.id,
        date: form.date,
        title: form.title.trim(),
        detail: form.detail.trim(),
      })
      if (!result.ok) {
        errorMessage.value =
          result.reason === 'conflict'
            ? '当天已有事件，请换个日期'
            : '未找到该事件，可能已被删除'
        return
      }
    } else {
      const result = await window.dairy.createTimelineEvent({
        workspacePath: props.workspacePath,
        date: form.date,
        title: form.title.trim(),
        detail: form.detail.trim(),
      })
      if (!result.ok) {
        errorMessage.value = '当天已有事件，请换个日期'
        return
      }
    }
    emit('saved')
  } catch (error) {
    errorMessage.value = getReadableErrorMessage(error, '保存失败')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div v-if="open" class="event-modal-overlay" @click.self="requestClose">
    <div
      class="event-modal-card"
      role="dialog"
      aria-modal="true"
      :aria-label="editing ? '编辑事件' : '添加事件'"
    >
      <header class="event-modal-header">
        <h3 class="event-modal-title">{{ editing ? '编辑事件' : '添加事件' }}</h3>
        <button
          class="event-modal-close"
          type="button"
          aria-label="关闭"
          @click="requestClose"
        >
          ×
        </button>
      </header>

      <div class="event-modal-body">
        <label class="event-form-row">
          <span class="event-form-label">日期</span>
          <input v-model="form.date" class="event-field-input" type="date" />
        </label>

        <label class="event-form-row">
          <span class="event-form-label">标题</span>
          <input
            v-model="form.title"
            class="event-field-input"
            type="text"
            maxlength="50"
            placeholder="事件标题"
          />
        </label>

        <label class="event-form-row">
          <span class="event-form-label">详情</span>
          <textarea
            v-model="form.detail"
            class="event-field-input event-field-textarea"
            rows="5"
            maxlength="500"
            placeholder="选填"
          ></textarea>
        </label>

        <p v-if="errorMessage" class="event-form-error">{{ errorMessage }}</p>
      </div>

      <footer class="event-modal-footer">
        <button
          class="event-modal-button event-modal-button--ghost"
          type="button"
          @click="requestClose"
        >
          取消
        </button>
        <button
          class="event-modal-button event-modal-button--primary"
          type="button"
          :disabled="isSaving"
          @click="handleSubmit"
        >
          {{ isSaving ? '保存中...' : '保存' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped src="./TimelineEventModal.css"></style>

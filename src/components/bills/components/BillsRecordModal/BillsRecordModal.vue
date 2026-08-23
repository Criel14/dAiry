<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { BillCategory, BillType } from '../../../../types/bills'
import { BILL_TYPE_LABELS } from '../../../../types/bills'
import { getReadableErrorMessage } from '../../../../utils/error'
import { getJournalDateText } from '../../../../shared/date-utils'
import type { BillsModalState, BillsRecordForm } from '../../composables/useBillsPanel'
import { toCentsFromInput } from '../../composables/useBillsPanel'
import BillsCategorySelect from '../BillsCategorySelect/BillsCategorySelect.vue'

const props = defineProps<{
  modalState: BillsModalState
  categories: BillCategory[]
  workspacePath: string | null
  dayStartHour: number
}>()

const emit = defineEmits<{
  close: []
  saved: []
  deleted: []
}>()

const form = reactive<BillsRecordForm>({
  date: '',
  type: 'expense',
  amount: '',
  category: '',
  note: '',
})

const errorMessage = ref('')
const isSaving = ref(false)

const initialForm = reactive<BillsRecordForm>({
  date: '',
  type: 'expense',
  amount: '',
  category: '',
  note: '',
})

function snapshotInitialForm() {
  initialForm.date = form.date
  initialForm.type = form.type
  initialForm.amount = form.amount
  initialForm.category = form.category
  initialForm.note = form.note
}

function formChanged(): boolean {
  return (
    form.date !== initialForm.date ||
    form.type !== initialForm.type ||
    form.amount !== initialForm.amount ||
    form.category !== initialForm.category ||
    form.note !== initialForm.note
  )
}

function requestClose() {
  if (formChanged()) {
    const confirmed = window.confirm('该账单有未保存的修改，确定放弃并关闭吗？')
    if (!confirmed) return
  }
  emit('close')
}

const typeTabs: Array<{ type: BillType; label: string }> = [
  { type: 'expense', label: BILL_TYPE_LABELS.expense },
  { type: 'income', label: BILL_TYPE_LABELS.income },
  { type: 'transfer', label: BILL_TYPE_LABELS.transfer },
]

const categoryOptions = computed(() =>
  props.categories.filter((c) => c.type === form.type),
)

watch(
  () => props.modalState.open,
  (open) => {
    if (!open) return
    const editing = props.modalState.editing
    if (editing) {
      const category = props.categories.find((c) => c.name === editing.category)
      form.date = editing.date
      form.type = category?.type ?? (editing.amountCents < 0 ? 'expense' : 'income')
      form.amount = (Math.abs(editing.amountCents) / 100).toFixed(2)
      form.category = editing.category
      form.note = editing.note
    } else {
      form.date = getJournalDateText(props.dayStartHour)
      form.type = 'expense'
      form.amount = ''
      form.category = ''
      form.note = ''
    }
    errorMessage.value = ''
    snapshotInitialForm()
  },
)

function switchType(type: BillType) {
  form.type = type
  form.category = ''
}

async function handleSubmit() {
  errorMessage.value = ''

  if (!form.date) {
    errorMessage.value = '请选择日期'
    return
  }

  let amountCents: number
  try {
    amountCents = toCentsFromInput(form.amount, form.type)
  } catch {
    errorMessage.value = '请输入有效的金额'
    return
  }

  if (!form.category) {
    errorMessage.value = '请选择分类'
    return
  }

  if (!props.workspacePath) {
    errorMessage.value = '请先选择工作区'
    return
  }

  isSaving.value = true
  try {
    if (props.modalState.editing) {
      await window.dairy.updateBill({
        workspacePath: props.workspacePath,
        id: props.modalState.editing.id,
        date: form.date,
        amountCents,
        category: form.category,
        note: form.note.trim(),
      })
    } else {
      await window.dairy.createBill({
        workspacePath: props.workspacePath,
        date: form.date,
        amountCents,
        category: form.category,
        note: form.note.trim(),
      })
    }
    emit('saved')
  } catch (error) {
    errorMessage.value = getReadableErrorMessage(error, '保存失败')
  } finally {
    isSaving.value = false
  }
}

async function handleDuplicate() {
  errorMessage.value = ''

  const confirmed = window.confirm('该账单将复制为今天的一笔新账单，确定继续吗？')
  if (!confirmed) return

  let amountCents: number
  try {
    amountCents = toCentsFromInput(form.amount, form.type)
  } catch {
    errorMessage.value = '请输入有效的金额'
    return
  }

  if (!form.category) {
    errorMessage.value = '请选择分类'
    return
  }

  if (!props.workspacePath) {
    errorMessage.value = '请先选择工作区'
    return
  }

  isSaving.value = true
  try {
    await window.dairy.createBill({
      workspacePath: props.workspacePath,
      date: getJournalDateText(props.dayStartHour),
      amountCents,
      category: form.category,
      note: form.note.trim(),
    })
    emit('saved')
  } catch (error) {
    errorMessage.value = getReadableErrorMessage(error, '复制失败')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div v-if="modalState.open" class="modal-overlay" @click.self="requestClose">
    <div class="modal-card" role="dialog" aria-modal="true" :aria-label="modalState.editing ? '编辑账单' : '记一笔'">
      <header class="modal-header">
        <h3 class="modal-title">{{ modalState.editing ? '编辑账单' : '记一笔' }}</h3>
        <button class="modal-close" type="button" aria-label="关闭" @click="requestClose">×</button>
      </header>

      <div class="modal-body">
        <div class="type-tabs">
          <button
            v-for="tab in typeTabs"
            :key="tab.type"
            class="type-tab"
            :class="{ 'type-tab--active': form.type === tab.type }"
            type="button"
            @click="switchType(tab.type)"
          >
            {{ tab.label }}
          </button>
        </div>

        <label class="form-row">
          <span class="form-label">日期</span>
          <input v-model="form.date" class="field-input" type="date" />
        </label>

        <label class="form-row">
          <span class="form-label">金额</span>
          <div class="amount-row">
            <input
              v-model="form.amount"
              class="field-input amount-input"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
            />
            <span class="amount-unit">元</span>
          </div>
        </label>

        <label class="form-row">
          <span class="form-label">分类</span>
          <BillsCategorySelect
            :categories="categoryOptions"
            v-model="form.category"
            placeholder="请选择分类"
          />
        </label>

        <label class="form-row">
          <span class="form-label">备注</span>
          <input v-model="form.note" class="field-input" type="text" maxlength="200" placeholder="选填" />
        </label>

        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
      </div>

      <footer class="modal-footer">
        <button
          v-if="modalState.editing"
          class="modal-button modal-button--danger"
          type="button"
          :disabled="isSaving"
          @click="emit('deleted')"
        >
          删除
        </button>
        <button
          v-if="modalState.editing"
          class="modal-button modal-button--ghost"
          type="button"
          :disabled="isSaving"
          @click="handleDuplicate"
        >
          复制到今天
        </button>
        <button v-else class="modal-button modal-button--ghost" type="button" @click="requestClose">取消</button>
        <button class="modal-button modal-button--primary" type="button" :disabled="isSaving" @click="handleSubmit">
          {{ isSaving ? '保存中...' : '保存' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped src="./BillsRecordModal.css"></style>

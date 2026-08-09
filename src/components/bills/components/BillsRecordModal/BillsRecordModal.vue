<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { ChevronDown } from 'lucide-vue-next'
import type { BillCategory, BillType } from '../../../../types/bills'
import { BILL_TYPE_LABELS } from '../../../../types/bills'
import { getReadableErrorMessage } from '../../../../utils/error'
import type { BillsModalState, BillsRecordForm } from '../../composables/useBillsPanel'
import { toCentsFromInput } from '../../composables/useBillsPanel'
import { iconForName } from '../../bills-icons'

const props = defineProps<{
  modalState: BillsModalState
  categories: BillCategory[]
  workspacePath: string | null
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
const categoryMenuOpen = ref(false)
const categorySelectRef = ref<HTMLElement | null>(null)
const categoryMenuRef = ref<HTMLElement | null>(null)
const menuPosition = ref({ left: 0, width: 0, triggerTop: 0, triggerBottom: 0, openUpward: false })

const MENU_MAX_HEIGHT = 224

const typeTabs: Array<{ type: BillType; label: string }> = [
  { type: 'expense', label: BILL_TYPE_LABELS.expense },
  { type: 'income', label: BILL_TYPE_LABELS.income },
  { type: 'transfer', label: BILL_TYPE_LABELS.transfer },
]

const categoryOptions = computed(() =>
  props.categories.filter((c) => c.type === form.type),
)

const selectedCategory = computed(() =>
  categoryOptions.value.find((c) => c.name === form.category) ?? null,
)

function toggleCategoryMenu() {
  if (categoryMenuOpen.value) {
    categoryMenuOpen.value = false
    return
  }
  updateMenuPosition()
  categoryMenuOpen.value = true
}

function updateMenuPosition() {
  if (!categorySelectRef.value) return
  const rect = categorySelectRef.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const spaceAbove = rect.top - 8
  menuPosition.value = {
    left: rect.left,
    width: rect.width,
    triggerTop: rect.top,
    triggerBottom: rect.bottom,
    openUpward: spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow,
  }
}

function menuStyle() {
  const { left, width, triggerTop, triggerBottom, openUpward } = menuPosition.value
  const maxHeight = openUpward
    ? Math.min(MENU_MAX_HEIGHT, Math.max(96, triggerTop - 20))
    : Math.min(MENU_MAX_HEIGHT, Math.max(96, window.innerHeight - triggerBottom - 12))
  return {
    position: 'fixed' as const,
    left: `${left}px`,
    width: `${width}px`,
    top: openUpward ? 'auto' : `${triggerBottom + 4}px`,
    bottom: openUpward ? `${window.innerHeight - triggerTop + 8}px` : 'auto',
    maxHeight: `${maxHeight}px`,
  }
}

function selectCategory(name: string) {
  form.category = name
  categoryMenuOpen.value = false
}

function handleDocumentClick(event: MouseEvent) {
  if (!categoryMenuOpen.value) return
  const target = event.target as Node
  const insideTrigger = categorySelectRef.value?.contains(target) ?? false
  const insideMenu = categoryMenuRef.value?.contains(target) ?? false
  if (!insideTrigger && !insideMenu) {
    categoryMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentClick)
  window.addEventListener('scroll', handleViewportChange, true)
  window.addEventListener('resize', handleViewportChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentClick)
  window.removeEventListener('scroll', handleViewportChange, true)
  window.removeEventListener('resize', handleViewportChange)
})

function handleViewportChange() {
  if (categoryMenuOpen.value) {
    updateMenuPosition()
  }
}

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
      form.date = dayjs().format('YYYY-MM-DD')
      form.type = 'expense'
      form.amount = ''
      form.category = ''
      form.note = ''
    }
    categoryMenuOpen.value = false
    errorMessage.value = ''
  },
)

function switchType(type: BillType) {
  form.type = type
  form.category = ''
  categoryMenuOpen.value = false
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
</script>

<template>
  <div v-if="modalState.open" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-card" role="dialog" aria-modal="true" :aria-label="modalState.editing ? '编辑账单' : '记一笔'">
      <header class="modal-header">
        <h3 class="modal-title">{{ modalState.editing ? '编辑账单' : '记一笔' }}</h3>
        <button class="modal-close" type="button" aria-label="关闭" @click="emit('close')">×</button>
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
          <div ref="categorySelectRef" class="category-select">
            <button
              type="button"
              class="category-select-trigger field-input"
              :class="{ 'category-select-trigger--open': categoryMenuOpen }"
              @click="toggleCategoryMenu"
            >
              <template v-if="selectedCategory">
                <span class="category-option-icon" :style="{ backgroundColor: selectedCategory.color }">
                  <component :is="iconForName(selectedCategory.icon)" class="category-option-svg" aria-hidden="true" />
                </span>
                <span class="category-option-name">{{ selectedCategory.name }}</span>
              </template>
              <span v-else class="category-select-placeholder">请选择分类</span>
              <ChevronDown class="category-select-arrow" aria-hidden="true" />
            </button>
            <Teleport to="body">
              <div
                v-if="categoryMenuOpen"
                ref="categoryMenuRef"
                class="category-menu"
                :style="menuStyle()"
              >
                <button
                  v-for="category in categoryOptions"
                  :key="`${category.type}:${category.name}`"
                  type="button"
                  class="category-menu-item"
                  :class="{ 'category-menu-item--selected': category.name === form.category }"
                  @click="selectCategory(category.name)"
                >
                  <span class="category-option-icon" :style="{ backgroundColor: category.color }">
                    <component :is="iconForName(category.icon)" class="category-option-svg" aria-hidden="true" />
                  </span>
                  <span class="category-option-name">{{ category.name }}</span>
                </button>
              </div>
            </Teleport>
          </div>
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
        <button class="modal-button modal-button--ghost" type="button" @click="emit('close')">取消</button>
        <button class="modal-button modal-button--primary" type="button" :disabled="isSaving" @click="handleSubmit">
          {{ isSaving ? '保存中...' : '保存' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped src="./BillsRecordModal.css"></style>

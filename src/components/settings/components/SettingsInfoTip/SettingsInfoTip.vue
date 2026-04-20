<script setup lang="ts">
import { CircleHelp } from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

defineProps<{
  text: string
  ariaLabel?: string
}>()

const GAP = 8
const VIEWPORT_PADDING = 12

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const buttonRef = ref<HTMLButtonElement | null>(null)
const popupRef = ref<HTMLElement | null>(null)
const popupStyle = ref<Record<string, string>>({
  top: '0px',
  left: '0px',
})

function openTip() {
  isOpen.value = true
}

function closeTip() {
  isOpen.value = false
}

function toggleTip() {
  isOpen.value = !isOpen.value
}

function updatePopupPosition() {
  if (!buttonRef.value || !popupRef.value) {
    return
  }

  const buttonRect = buttonRef.value.getBoundingClientRect()
  const popupRect = popupRef.value.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let left = buttonRect.left + buttonRect.width / 2 - popupRect.width / 2
  left = Math.max(VIEWPORT_PADDING, left)
  left = Math.min(viewportWidth - popupRect.width - VIEWPORT_PADDING, left)

  let top = buttonRect.bottom + GAP
  if (top + popupRect.height > viewportHeight - VIEWPORT_PADDING) {
    top = buttonRect.top - popupRect.height - GAP
  }

  top = Math.max(VIEWPORT_PADDING, top)

  popupStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
  }
}

function handleDocumentPointerDown(event: MouseEvent) {
  if (!rootRef.value) {
    return
  }

  const target = event.target
  if (target instanceof Node && !rootRef.value.contains(target)) {
    closeTip()
  }
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeTip()
  }
}

function handleWindowChange() {
  if (isOpen.value) {
    updatePopupPosition()
  }
}

watch(isOpen, async (value) => {
  if (!value) {
    return
  }

  await nextTick()
  updatePopupPosition()
})

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('resize', handleWindowChange)
  window.addEventListener('scroll', handleWindowChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('resize', handleWindowChange)
  window.removeEventListener('scroll', handleWindowChange, true)
})
</script>

<template>
  <span
    ref="rootRef"
    class="info-tip"
    @mouseenter="openTip"
    @mouseleave="closeTip"
  >
    <button
      ref="buttonRef"
      class="info-tip-button"
      type="button"
      :aria-label="ariaLabel ?? '查看说明'"
      :aria-expanded="isOpen"
      @click="toggleTip"
      @focus="openTip"
      @blur="closeTip"
    >
      <CircleHelp class="info-tip-icon" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <transition name="info-tip-fade">
        <span
          v-if="isOpen"
          ref="popupRef"
          class="info-tip-popup"
          :style="popupStyle"
          role="tooltip"
        >
          {{ text }}
        </span>
      </transition>
    </Teleport>
  </span>
</template>

<style scoped src="./SettingsInfoTip.css"></style>

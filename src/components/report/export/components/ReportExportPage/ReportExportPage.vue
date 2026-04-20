<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ReportExportPayload } from '../../../../../types/dairy'
import ReportExportDocument from '../ReportExportDocument/ReportExportDocument.vue'

const containerRef = ref<HTMLElement | null>(null)
const documentLayerRef = ref<HTMLElement | null>(null)
const payload = ref<ReportExportPayload | null>(null)
const isLoading = ref(true)
const loadError = ref('')
const measuredContentHeight = ref(0)

const exportStageStyle = computed(() => {
  if (!payload.value) {
    return {}
  }

  return {
    width: `${Math.ceil(payload.value.documentWidth * payload.value.imageScale)}px`,
    height:
      measuredContentHeight.value > 0
        ? `${Math.ceil(measuredContentHeight.value * payload.value.imageScale)}px`
        : 'auto',
  }
})

const exportLayerStyle = computed(() => {
  if (!payload.value) {
    return {}
  }

  return {
    width: `${payload.value.documentWidth}px`,
    transform: `scale(${payload.value.imageScale})`,
    transformOrigin: 'top left',
  }
})

function getSessionId() {
  const searchParams = new URLSearchParams(window.location.search)
  return searchParams.get('sessionId')?.trim() ?? ''
}

function waitFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

function setExportLayoutMode(enabled: boolean) {
  const method = enabled ? 'add' : 'remove'

  document.documentElement.classList[method]('report-export-mode')
  document.body.classList[method]('report-export-mode')
  document.getElementById('app')?.classList[method]('report-export-mode')
}

async function waitRenderStable() {
  await nextTick()
  await waitFrame()
  await waitFrame()

  if (document.fonts?.ready) {
    await document.fonts.ready
  }

  await waitFrame()
}

function getContentHeight() {
  const documentHeight = documentLayerRef.value?.scrollHeight ?? 0
  const containerHeight = containerRef.value?.scrollHeight ?? 0
  const rootHeight = document.documentElement.scrollHeight
  const bodyHeight = document.body.scrollHeight
  const appHeight = document.getElementById('app')?.scrollHeight ?? 0

  return Math.ceil(Math.max(documentHeight, containerHeight, rootHeight, bodyHeight, appHeight))
}

async function initExportPage() {
  const sessionId = getSessionId()

  if (!sessionId) {
    loadError.value = '导出会话参数缺失。'
    isLoading.value = false
    return
  }

  try {
    payload.value = await window.dairy.getReportExportPayload({ sessionId })
    isLoading.value = false
    await waitRenderStable()

    const contentHeight = getContentHeight()
    measuredContentHeight.value = contentHeight
    await waitRenderStable()
    await window.dairy.notifyReportExportReady({
      sessionId,
      contentHeight,
    })
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '导出页面准备失败。'
    isLoading.value = false
  }
}

onMounted(() => {
  setExportLayoutMode(true)
  void initExportPage()
})

onBeforeUnmount(() => {
  setExportLayoutMode(false)
})
</script>

<template>
  <section ref="containerRef" class="report-export-page">
    <div v-if="isLoading" class="export-state">
      <h1>正在准备图片...</h1>
      <p>请稍等，正在渲染导出内容。</p>
    </div>

    <div v-else-if="loadError" class="export-state export-state--error">
      <h1>导出准备失败</h1>
      <p>{{ loadError }}</p>
    </div>

    <div
      v-else-if="payload"
      class="report-export-stage"
      :style="exportStageStyle"
    >
      <div
        ref="documentLayerRef"
        class="report-export-layer"
        :style="exportLayerStyle"
      >
        <ReportExportDocument
          :report="payload.report"
          :sections="payload.sections"
          :document-width="payload.documentWidth"
        />
      </div>
    </div>
  </section>
</template>

<style scoped src="./ReportExportPage.css"></style>


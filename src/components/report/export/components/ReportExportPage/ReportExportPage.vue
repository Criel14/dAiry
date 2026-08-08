<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import type { ReportExportPayload } from '../../../../../types/report'
import { useReportExportTheme } from '../../composables/useReportExportTheme'
import ReportExportDocument from '../ReportExportDocument/ReportExportDocument.vue'

const containerRef = ref<HTMLElement | null>(null)
const payload = ref<ReportExportPayload | null>(null)
const isLoading = ref(true)
const loadError = ref('')

const MAX_MEASURE_ROUNDS = 12
const MEASURE_SETTLE_MS = 150
const HEIGHT_BUFFER_PX = 8

useReportExportTheme()

function getSessionId() {
  const searchParams = new URLSearchParams(window.location.search)
  return searchParams.get('sessionId')?.trim() ?? ''
}

function waitFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
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
  const containerHeight = containerRef.value?.scrollHeight ?? 0
  const rootHeight = document.documentElement.scrollHeight
  const bodyHeight = document.body.scrollHeight
  const appHeight = document.getElementById('app')?.scrollHeight ?? 0

  return Math.ceil(Math.max(containerHeight, rootHeight, bodyHeight, appHeight))
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

/**
 * 复测稳定循环：等待渲染稳定后测量，若高度持续变化（字体切换、
 * 热力图格子重算等后置渲染）则继续复测，直到连续两次一致或达到轮次上限；
 * 上报各轮最大值并附加少量安全余量，避免底部内容被截图裁切。
 */
async function waitForStableHeight() {
  let lastHeight = -1
  let stableRounds = 0
  let maxHeight = 0

  for (let round = 0; round < MAX_MEASURE_ROUNDS; round += 1) {
    await waitRenderStable()
    const currentHeight = getContentHeight()
    maxHeight = Math.max(maxHeight, currentHeight)

    if (currentHeight === lastHeight) {
      stableRounds += 1
      if (stableRounds >= 2) {
        break
      }
    } else {
      stableRounds = 0
      lastHeight = currentHeight
    }

    await delay(MEASURE_SETTLE_MS)
  }

  return maxHeight + HEIGHT_BUFFER_PX
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

    const contentHeight = await waitForStableHeight()
    await waitRenderStable()
    await window.dairy.notifyReportExportReady({
      sessionId,
      contentHeight,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '导出页面准备失败。'
    loadError.value = message
    isLoading.value = false

    try {
      await window.dairy.notifyReportExportError({ sessionId, message })
    } catch {
      // 主进程会话可能已失效，忽略二次上报
    }
  }
}

onMounted(() => {
  void initExportPage()
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

    <ReportExportDocument
      v-else-if="payload"
      :report="payload.report"
      :sections="payload.sections"
      :document-width="payload.documentWidth"
    />
  </section>
</template>

<style scoped src="./ReportExportPage.css"></style>

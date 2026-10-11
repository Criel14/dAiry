<script setup lang="ts">
import { computed } from 'vue'
import type { UpdateCheckState, UpdateCheckStatus } from '../../../types/update'

const props = defineProps<{
  appVersion: string
  updateCheckState: UpdateCheckState
  repositoryUrl: string
  feedbackEmail: string
}>()

const emit = defineEmits<{
  openRepository: []
  openFeedbackEmail: []
  openDebugPanel: []
  openReleases: []
}>()

const UPDATE_CHECK_STATUS_TEXT: Record<UpdateCheckStatus, string> = {
  checking: '正在检查更新，',
  'up-to-date': '当前已是最新版本，',
  'update-available': '存在可用的新版本，',
  failed: '检查更新失败，',
}

const updateCheckStatusText = computed(
  () => UPDATE_CHECK_STATUS_TEXT[props.updateCheckState.status],
)
</script>

<template>
  <div class="settings-section">

    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">版本</span>
      </div>

      <div class="about-version-card">
        <strong class="about-version-value">{{ appVersion }}</strong>
        <p class="panel-description">
          <strong class="about-update-status">{{ updateCheckStatusText }}</strong>请访问
          <button class="about-inline-link" type="button" @click="emit('openReleases')">github release</button>
          查看版本信息
        </p>
      </div>
    </section>

    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">开发者工具</span>
      </div>

      <div class="about-version-card">
        <p class="panel-description">内核提供的调试界面。</p>
        <div class="about-action-row">
          <button class="about-action-button" type="button" @click="emit('openDebugPanel')">
            打开开发者工具
          </button>
        </div>
      </div>
    </section>

    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">项目与反馈</span>
      </div>

      <div class="about-contact-list">
        <div class="about-contact-row">
          <span class="about-contact-label">仓库地址</span>
          <button class="about-link-button" type="button" @click="emit('openRepository')">
            {{ repositoryUrl }}
          </button>
        </div>

        <div class="about-contact-row">
          <span class="about-contact-label">反馈邮箱</span>
          <button class="about-link-button" type="button" @click="emit('openFeedbackEmail')">
            {{ feedbackEmail }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  appVersion: string
  repositoryUrl: string
  feedbackEmail: string
}>()

const emit = defineEmits<{
  openRepository: []
  openFeedbackEmail: []
  openDebugPanel: []
}>()
</script>

<template>
  <div class="settings-section">

    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">版本</span>
      </div>

      <div class="about-version-card">
        <strong class="about-version-value">{{ appVersion }}</strong>
        <p class="panel-description">不支持检查更新，访问代码仓库以查看更新信息。</p>
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

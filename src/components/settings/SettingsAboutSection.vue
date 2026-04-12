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
      <div class="about-basic">
        <h4 class="about-name">dAiry</h4>
        <p class="panel-description">一个本地优先的桌面日记工具。</p>
        <p class="panel-description">
          日记内容保存在你自己的工作区目录中，以 Markdown 作为主要存储格式。
        </p>
      </div>
    </section>

    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">版本</span>
      </div>

      <div class="about-version-card">
        <strong class="about-version-value">{{ appVersion }}</strong>
        <p class="panel-description">当前版本已完成日记写作与 AI 每日整理能力。</p>
      </div>
    </section>

    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">开发者工具</span>
      </div>

      <div class="about-version-card">
        <p class="panel-description">用于查看渲染进程的控制台日志、报错信息和页面状态。</p>
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

<script setup lang="ts">
defineProps<{
  workspacePath: string | null
}>()
</script>

<template>
  <section class="settings-panel">
    <section class="settings-card">
      <span class="panel-label">工作区目录</span>
      <strong class="panel-value">{{ workspacePath ?? '还没有选择目录' }}</strong>
      <p class="panel-description">这里后续会逐步放入主题、模型、保存偏好等设置项。</p>
    </section>

    <section class="settings-card">
      <span class="panel-label">当前阶段</span>
      <strong class="panel-value">设置页骨架已接入</strong>
      <p class="panel-description">目前先保留最基础的入口和页面结构，便于后续继续扩展。</p>
    </section>
  </section>
</template>

<style scoped>
.settings-panel {
  display: grid;
  gap: 1rem;
  align-content: start;
  min-height: 0;
  padding: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fffef9;
  overflow: hidden;
}

.settings-card {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.panel-label {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.panel-value {
  color: var(--color-text-main);
}

.panel-description {
  margin: 0;
  color: var(--color-text-subtle);
  line-height: 1.7;
}
</style>

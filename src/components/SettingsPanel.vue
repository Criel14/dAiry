<script setup lang="ts">
defineProps<{
  workspacePath: string | null
  journalHeatmapEnabled: boolean
  isSavingJournalHeatmap: boolean
  heatmapSaveMessage: string
}>()

defineEmits<{
  'update:journalHeatmapEnabled': [value: boolean]
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
      <span class="panel-label">日历显示</span>
      <div class="setting-row">
        <div class="setting-copy">
          <strong class="panel-value">字数热力图</strong>
          <p class="panel-description">开启后，月历会按当天日记字数显示深浅变化。</p>
        </div>

        <button
          class="switch-button"
          :class="{ 'switch-button--active': journalHeatmapEnabled }"
          type="button"
          :disabled="isSavingJournalHeatmap"
          :aria-pressed="journalHeatmapEnabled"
          :aria-label="journalHeatmapEnabled ? '关闭字数热力图' : '开启字数热力图'"
          @click="$emit('update:journalHeatmapEnabled', !journalHeatmapEnabled)"
        >
          <span class="switch-track" aria-hidden="true">
            <span class="switch-thumb" />
          </span>
        </button>
      </div>

      <p v-if="heatmapSaveMessage" class="setting-feedback">
        {{ heatmapSaveMessage }}
      </p>
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

.setting-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

.setting-copy {
  display: grid;
  gap: 0.35rem;
}

.switch-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 2rem;
  padding: 0;
  border: 0;
  background: transparent;
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}

.switch-button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.switch-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
}

.switch-track {
  position: relative;
  width: 2.8rem;
  height: 1.6rem;
  border-radius: 999px;
  background: #ddd2b9;
  box-shadow: inset 0 0 0 1px rgba(138, 129, 109, 0.14);
  transition:
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.switch-button--active .switch-track {
  background: #d7c68a;
  box-shadow: inset 0 0 0 1px rgba(120, 101, 52, 0.12);
}

.switch-thumb {
  position: absolute;
  top: 0.16rem;
  left: 0.16rem;
  width: 1.28rem;
  height: 1.28rem;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(61, 56, 45, 0.16);
  transition: transform 160ms ease;
}

.switch-button--active .switch-thumb {
  transform: translateX(1.2rem);
}

.setting-feedback {
  margin: 0;
  color: var(--color-text-soft);
  font-size: 0.88rem;
}

@media (max-width: 768px) {
  .setting-row {
    flex-direction: column;
    align-items: stretch;
  }

  .switch-button {
    justify-content: center;
  }
}
</style>

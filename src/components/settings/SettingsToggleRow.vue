<script setup lang="ts">
import SettingsInfoTip from './SettingsInfoTip.vue'

defineProps<{
  title: string
  description: string
  tipText?: string
  active: boolean
  disabled?: boolean
  buttonLabel: string
}>()

const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <div class="setting-row setting-row--compact">
    <div class="setting-copy">
      <div class="setting-title-row">
        <strong class="panel-value">{{ title }}</strong>
        <SettingsInfoTip v-if="tipText" :text="tipText" />
      </div>
      <p class="panel-description">{{ description }}</p>
    </div>

    <button
      class="switch-button"
      :class="{ 'switch-button--active': active }"
      type="button"
      :disabled="disabled"
      :aria-pressed="active"
      :aria-label="buttonLabel"
      @click="emit('toggle')"
    >
      <span class="switch-track" aria-hidden="true">
        <span class="switch-thumb" />
      </span>
    </button>
  </div>
</template>

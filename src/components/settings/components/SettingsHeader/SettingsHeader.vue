<script setup lang="ts">
defineEmits<{
  back: []
}>()
</script>

<template>
  <header class="editor-header">
    <div class="editor-heading">
      <p class="editor-kicker">Settings</p>
      <h2 class="editor-title">设置</h2>
    </div>

    <div class="editor-actions">
      <button class="ghost-button" type="button" @click="$emit('back')">
        返回日记
      </button>
    </div>
  </header>
</template>

<style scoped src="./SettingsHeader.css"></style>

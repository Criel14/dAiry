<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  workspacePath: string | null
}>()

defineEmits<{
  chooseWorkspace: []
}>()

const hasWorkspace = computed(() => Boolean(props.workspacePath))

async function handleOpenWorkspaceFolder() {
  if (!props.workspacePath) {
    return
  }

  try {
    await window.dairy.openWorkspaceFolder({ workspacePath: props.workspacePath })
  } catch (error) {
    window.alert(error instanceof Error ? error.message : '打开目录失败，请稍后重试。')
  }
}
</script>

<template>
  <div class="workspace-panel">
    <div class="workspace-panel-head">
      <h2 class="workspace-panel-title">工作区</h2>
    </div>

    <section class="workspace-card">
      <span class="workspace-label">当前目录</span>
      <strong
        class="workspace-path"
        :title="workspacePath ?? '暂未选择工作区'"
      >
        {{ workspacePath ?? '暂未选择工作区' }}
      </strong>
      <p class="workspace-description">
        {{
          workspacePath
            ? '日记文件和工作区相关配置都会围绕该目录组织。'
            : '选择一个目录作为日记根目录，写作与报告都基于它展开。'
        }}
      </p>

      <div class="workspace-actions">
        <button
          class="workspace-button workspace-button--primary"
          type="button"
          @click="$emit('chooseWorkspace')"
        >
          选择工作区
        </button>
        <button
          class="workspace-button"
          type="button"
          :disabled="!hasWorkspace"
          @click="handleOpenWorkspaceFolder"
        >
          打开文件夹
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped src="./WorkspacePanel.css"></style>

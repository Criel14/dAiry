<script setup lang="ts">
import { computed } from 'vue'
import SettingsInfoTip from '../components/SettingsInfoTip/SettingsInfoTip.vue'

const props = defineProps<{
  workspacePath: string | null
}>()

const hasWorkspace = computed(() => Boolean(props.workspacePath))
</script>

<template>
  <div class="settings-section">
    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">当前工作区</span>
        <SettingsInfoTip text="工作区是你选择的日记根目录，日记文件和工作区相关配置都会围绕它组织" />
      </div>

      <div class="workspace-summary">
        <div class="workspace-summary-copy">
          <strong class="panel-value">{{ workspacePath ?? '暂未选择工作区' }}</strong>
          <p class="panel-description">
            {{
              workspacePath
                ? '当前目录已接入日记读写流程。'
                : '先选择一个工作区目录，后续工作区级设置才能真正生效。'
            }}
          </p>
        </div>

        <span class="workspace-status" :class="{ 'workspace-status--ready': hasWorkspace }">
          {{ hasWorkspace ? '已连接' : '未连接' }}
        </span>
      </div>
    </section>
  </div>
</template>

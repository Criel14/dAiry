<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { McpRuntimeStatus } from '../../../types/mcp'
import SettingsInfoTip from '../components/SettingsInfoTip/SettingsInfoTip.vue'
import SettingsToggleRow from '../components/SettingsToggleRow/SettingsToggleRow.vue'

const props = defineProps<{
  mcpEnabled: boolean
  mcpPort: number
  mcpRuntimeStatus: McpRuntimeStatus
  isSavingMcp: boolean
  mcpSaveMessage: string
}>()

const emit = defineEmits<{
  saveMcpPreference: [value: { enabled: boolean; port: number }]
}>()

const portDraft = ref(String(props.mcpPort))
const portValidationMessage = ref('')

watch(
  () => props.mcpPort,
  (nextPort) => {
    portDraft.value = String(nextPort)
    portValidationMessage.value = ''
  },
)

const statusText = computed(() => {
  switch (props.mcpRuntimeStatus.status) {
    case 'running':
      return '运行中'
    case 'error':
      return '启动失败'
    default:
      return '已停止'
  }
})

const endpointAddress = computed(() => {
  const port = props.mcpRuntimeStatus.port ?? props.mcpPort
  return `http://127.0.0.1:${port}/mcp`
})

function handleToggle() {
  const port = Number(portDraft.value)
  emit('saveMcpPreference', {
    enabled: !props.mcpEnabled,
    port: Number.isInteger(port) ? port : props.mcpPort,
  })
}

function handlePortSave() {
  const port = Number(portDraft.value)

  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    portValidationMessage.value = '端口需为 1024-65535 的整数。'
    portDraft.value = String(props.mcpPort)
    return
  }

  portValidationMessage.value = ''

  if (port === props.mcpPort) {
    return
  }

  emit('saveMcpPreference', { enabled: props.mcpEnabled, port })
}
</script>

<template>
  <div class="settings-section">
    <section class="settings-card">
      <div class="panel-heading">
        <span class="panel-label">MCP 服务</span>
        <SettingsInfoTip text="MCP（Model Context Protocol）让外部 AI 工具可以读取你的日记记忆。" />
      </div>
      <p class="panel-description">
        开启后，dAiry 会在本地启动一个只读服务，供 OpenCode、Claude Code 等外部 AI 工具检索你的日记、画像与摘要。服务仅监听本机地址，不会暴露到局域网。
      </p>

      <SettingsToggleRow
        title="启用 MCP 服务"
        description="开启后外部 AI 工具可通过下方地址连接；关闭开关或退出应用后服务停止。"
        :active="mcpEnabled"
        :disabled="isSavingMcp"
        :button-label="mcpEnabled ? '停用 MCP 服务' : '启用 MCP 服务'"
        @toggle="handleToggle"
      />

      <div class="setting-row setting-row--compact">
        <div class="setting-copy">
          <div class="setting-title-row">
            <strong class="panel-value">监听端口</strong>
            <SettingsInfoTip text="修改端口后服务会自动重启。" />
          </div>
          <p class="panel-description">可选范围 1024-65535，默认 9123，失焦后自动保存。</p>
        </div>

        <input
          v-model="portDraft"
          class="field-input mcp-port-input"
          type="number"
          min="1024"
          max="65535"
          :disabled="isSavingMcp"
          aria-label="MCP 服务监听端口"
          @blur="handlePortSave"
          @keydown.enter="handlePortSave"
        />
      </div>

      <p v-if="portValidationMessage" class="setting-feedback">
        {{ portValidationMessage }}
      </p>

      <div class="setting-row setting-row--compact">
        <div class="setting-copy">
          <span class="panel-value">运行状态</span>
          <p v-if="mcpRuntimeStatus.status === 'error' && mcpRuntimeStatus.errorMessage" class="panel-description">
            {{ mcpRuntimeStatus.errorMessage }}
          </p>
        </div>

        <span class="mcp-status" :data-status="mcpRuntimeStatus.status">
          <span class="mcp-status-dot" aria-hidden="true" />
          {{ statusText }}
        </span>
      </div>

      <div class="setting-row setting-row--compact">
        <div class="setting-copy">
          <div class="setting-title-row">
            <strong class="panel-value">连接地址</strong>
            <SettingsInfoTip text="在外部 AI 工具的 MCP 配置中填入这个地址（Streamable HTTP 类型）。" />
          </div>
          <p class="panel-description">仅本机可访问，复制到外部工具的 MCP 配置中使用。</p>
        </div>

        <code class="mcp-endpoint">{{ endpointAddress }}</code>
      </div>

      <p v-if="mcpSaveMessage" class="setting-feedback">
        {{ mcpSaveMessage }}
      </p>
    </section>
  </div>
</template>

<style src="./SettingsMcpSection.css"></style>

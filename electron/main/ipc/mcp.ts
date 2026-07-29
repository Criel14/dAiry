import { ipcMain } from 'electron'
import type { McpPreferenceInput } from '../../../src/types/mcp'
import { setMcpPreference } from '../app-config'
import { getMcpRuntimeStatus, startMcpServer, stopMcpServer } from '../mcp'
import { IPC_CHANNELS } from '../constants'

export function registerMcpIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.setMcpPreference, async (_event, input: McpPreferenceInput) => {
    // 先持久化配置，再按最新配置启停服务，避免配置与运行态不一致
    const nextConfig = await setMcpPreference(input)

    if (nextConfig.mcp.enabled) {
      await startMcpServer(nextConfig.mcp.port)
    } else {
      await stopMcpServer()
    }

    return nextConfig
  })

  ipcMain.handle(IPC_CHANNELS.getMcpRuntimeStatus, () => {
    return getMcpRuntimeStatus()
  })
}

import { app } from 'electron'
import { readAppConfig } from './main/app-config'
import { registerIpcHandlers } from './main/ipc'
import { applyLaunchOnStartup } from './main/launch-on-startup'
import { startMcpServer, stopMcpServer } from './main/mcp'
import { configureDiaryReminder, disposeDiaryReminder } from './main/notification'
import {
  createMainWindow,
  getMainWindow,
  registerWindowLifecycleEvents,
  showMainWindow,
} from './main/window'
import './main/constants'

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  registerWindowLifecycleEvents()
  app.on('before-quit', disposeDiaryReminder)
  app.on('before-quit', () => {
    void stopMcpServer()
  })

  app.on('second-instance', () => {
    const existingWindow = getMainWindow()

    if (existingWindow && !existingWindow.isDestroyed()) {
      showMainWindow()
      return
    }

    void createMainWindow()
  })

  app.whenReady().then(async () => {
    registerIpcHandlers()
    const config = await readAppConfig()
    applyLaunchOnStartup(config.ui.launchOnStartup)
    configureDiaryReminder(config.ui.notification)
    if (config.mcp.enabled) {
      // MCP 启动失败只体现在运行状态上，不阻塞窗口创建
      void startMcpServer(config.mcp.port)
    }
    await createMainWindow()
  })
}

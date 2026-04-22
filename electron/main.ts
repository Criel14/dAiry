import { app } from 'electron'
import { readAppConfig } from './main/app-config'
import { registerIpcHandlers } from './main/ipc'
import { configureDiaryReminder, disposeDiaryReminder } from './main/notification'
import { createMainWindow, registerWindowLifecycleEvents } from './main/window'
import './main/constants'

registerWindowLifecycleEvents()
app.on('before-quit', disposeDiaryReminder)

app.whenReady().then(async () => {
  registerIpcHandlers()
  const config = await readAppConfig()
  configureDiaryReminder(config.ui.notification)
  await createMainWindow()
})

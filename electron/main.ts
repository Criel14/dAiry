import { app } from 'electron'
import { registerIpcHandlers } from './main/ipc'
import { createMainWindow, registerWindowLifecycleEvents } from './main/window'
import './main/constants'

registerWindowLifecycleEvents()

app.whenReady().then(() => {
  registerIpcHandlers()
  void createMainWindow()
})

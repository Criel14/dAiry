import { app } from 'electron'

function isLaunchOnStartupSupported() {
  return process.platform === 'win32' || process.platform === 'darwin'
}

function clearWindowsDevLoginItem() {
  app.setLoginItemSettings({
    openAtLogin: false,
    path: process.execPath,
    args: [],
  })
}

export function applyLaunchOnStartup(enabled: boolean) {
  if (!isLaunchOnStartupSupported()) {
    return
  }

  if (process.platform === 'win32' && !app.isPackaged) {
    // 开发环境下 process.execPath 指向 electron.exe。
    // 如果把它注册成开机启动，Windows 登录时会弹出 Electron 默认示例窗口。
    clearWindowsDevLoginItem()
    return
  }

  if (process.platform === 'darwin') {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
    })
    return
  }

  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: app.isPackaged ? ['--launch-at-startup'] : [],
  })
}

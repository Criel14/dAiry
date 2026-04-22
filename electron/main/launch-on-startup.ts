import { app } from 'electron'

function isLaunchOnStartupSupported() {
  return process.platform === 'win32' || process.platform === 'darwin'
}

export function applyLaunchOnStartup(enabled: boolean) {
  if (!isLaunchOnStartupSupported()) {
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

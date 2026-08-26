// 渲染层确认/提示对话框统一封装。
// 不要直接使用 window.confirm / window.alert：它们在 Electron 中打开的是
// Chromium 原生模态对话框，Windows 上关闭后会导致渲染层焦点失同步，
// 整个应用输入失效（electron/electron#31917，上游至今未修）。
// 主进程 dialog.showMessageBox 无此问题，这里统一走 IPC。

export async function confirmDialog(message: string, title = '确认'): Promise<boolean> {
  const response = await window.dairy.showMessageBox({
    type: 'question',
    title,
    message,
    buttons: ['确定', '取消'],
    defaultId: 1,
    cancelId: 1,
  })
  return response === 0
}

export async function showAlertMessage(message: string, title = '提示'): Promise<void> {
  await window.dairy.showMessageBox({
    type: 'info',
    title,
    message,
    buttons: ['确定'],
    defaultId: 0,
  })
}

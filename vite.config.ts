import { defineConfig } from 'vite'
import path from 'node:path'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import electronPath from 'electron'
import electron from 'vite-plugin-electron/simple'
import vue from '@vitejs/plugin-vue'

let electronProcess: ChildProcess | undefined
let exitHookRegistered = false
const appRoot = __dirname

function stopElectronProcess() {
  if (!electronProcess?.pid) {
    electronProcess = undefined
    return
  }

  const { pid } = electronProcess
  electronProcess.removeAllListeners()
  electronProcess = undefined

  if (process.platform === 'win32') {
    // 忽略 taskkill 的输出，避免进程已退出时在控制台出现乱码报错。
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }

  try {
    process.kill(pid)
  } catch {
    // 进程可能已经退出，这里静默忽略即可。
  }
}

function startElectronProcess() {
  stopElectronProcess()

  electronProcess = spawn(String(electronPath), [appRoot], {
    cwd: appRoot,
    stdio: 'inherit',
  })

  electronProcess.once('exit', () => {
    electronProcess = undefined
    process.exit()
  })

  if (!exitHookRegistered) {
    exitHookRegistered = true
    process.once('exit', stopElectronProcess)
  }
}

export default defineConfig({
  plugins: [
    vue(),
    electron({
      main: {
        entry: 'electron/main.ts',
        onstart() {
          startElectronProcess()
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
        onstart() {
          startElectronProcess()
        },
      },
      renderer: process.env.NODE_ENV === 'test'
        ? undefined
        : {},
    }),
  ],
})

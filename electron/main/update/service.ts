import { app } from 'electron'
import type { UpdateCheckState } from '../../../src/types/update'
import { IPC_CHANNELS } from '../constants'
import { getMainWindow } from '../window'
import { isRemoteVersionNewer, normalizeReleaseTag } from './version'

const LATEST_RELEASE_URL = 'https://api.github.com/repos/Criel14/dAiry/releases/latest'
const REQUEST_TIMEOUT_MS = 8000

let state: UpdateCheckState = {
  status: 'checking',
  latestVersion: null,
}

export function getUpdateCheckState(): UpdateCheckState {
  return state
}

function setUpdateCheckState(nextState: UpdateCheckState) {
  state = nextState

  const win = getMainWindow()
  if (!win || win.isDestroyed()) {
    return
  }

  win.webContents.send(IPC_CHANNELS.updateCheckStateChanged, nextState)
}

export async function startUpdateCheck() {
  try {
    const response = await fetch(LATEST_RELEASE_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `dAiry/${app.getVersion()}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      console.warn(`[update] 检查更新失败：GitHub 返回 ${response.status}`)
      setUpdateCheckState({ status: 'failed', latestVersion: null })
      return
    }

    const payload = (await response.json()) as { tag_name?: unknown }
    const latestVersion = normalizeReleaseTag(payload.tag_name)

    if (!latestVersion) {
      console.warn('[update] 检查更新失败：无法解析 Release 版本号')
      setUpdateCheckState({ status: 'failed', latestVersion: null })
      return
    }

    if (isRemoteVersionNewer(latestVersion, app.getVersion())) {
      setUpdateCheckState({ status: 'update-available', latestVersion })
      return
    }

    setUpdateCheckState({ status: 'up-to-date', latestVersion: null })
  } catch (error) {
    console.warn('[update] 检查更新失败：', error)
    setUpdateCheckState({ status: 'failed', latestVersion: null })
  }
}

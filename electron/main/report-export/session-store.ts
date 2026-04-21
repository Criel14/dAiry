import type { ReportExportPayload } from '../../../src/types/report'

export interface ExportSessionState {
  payload: ReportExportPayload
  readyPromise: Promise<number>
  resolveReady: (contentHeight: number) => void
  isReady: boolean
}

const exportSessions = new Map<string, ExportSessionState>()

export function createExportSession(payload: ReportExportPayload) {
  const sessionId = `report_export_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

  let resolveReady: (contentHeight: number) => void = () => {}
  const readyPromise = new Promise<number>((resolve) => {
    resolveReady = resolve
  })

  exportSessions.set(sessionId, {
    payload,
    readyPromise,
    resolveReady,
    isReady: false,
  })

  return sessionId
}

export function getExportSession(sessionId: string) {
  return exportSessions.get(sessionId) ?? null
}

export function removeExportSession(sessionId: string) {
  exportSessions.delete(sessionId)
}

export function markExportSessionReady(sessionId: string, contentHeight: number) {
  const session = getExportSession(sessionId)

  if (!session) {
    throw new Error('导出会话已失效，请重新开始导出。')
  }

  if (session.isReady) {
    return
  }

  session.isReady = true
  session.resolveReady(contentHeight)
}

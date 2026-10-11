export type UpdateCheckStatus = 'checking' | 'up-to-date' | 'update-available' | 'failed'

export interface UpdateCheckState {
  status: UpdateCheckStatus
  latestVersion: string | null
}

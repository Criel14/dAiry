export interface McpConfig {
  enabled: boolean
  port: number
}

export interface McpPreferenceInput {
  enabled: boolean
  port: number
}

export interface McpRuntimeStatus {
  status: 'stopped' | 'running' | 'error'
  port: number | null
  errorMessage: string | null
}

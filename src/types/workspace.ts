import type { AppConfig } from './app'

export interface WorkspaceSelectionResult {
  canceled: boolean
  workspacePath: string | null
  config: AppConfig
}

export interface OpenWorkspaceFolderInput {
  workspacePath: string
}

export interface WorkspaceStringListInput {
  workspacePath: string
  items: string[]
}

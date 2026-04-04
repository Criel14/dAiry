export interface AppConfig {
  lastOpenedWorkspace: string | null
  recentWorkspaces: string[]
  ui: {
    theme: 'system' | 'light' | 'dark'
  }
}

export interface AppBootstrap {
  config: AppConfig
}

export interface WorkspaceSelectionResult {
  canceled: boolean
  workspacePath: string | null
  config: AppConfig
}

export interface JournalEntryQuery {
  workspacePath: string
  date: string
}

export interface JournalEntryReadResult {
  status: 'ready' | 'missing'
  filePath: string
  content: string | null
}

export interface JournalEntryWriteResult {
  filePath: string
  savedAt: string
}

export interface DairyApi {
  getAppBootstrap: () => Promise<AppBootstrap>
  chooseWorkspace: () => Promise<WorkspaceSelectionResult>
  readJournalEntry: (input: JournalEntryQuery) => Promise<JournalEntryReadResult>
  createJournalEntry: (input: JournalEntryQuery) => Promise<JournalEntryReadResult>
  saveJournalEntry: (input: JournalEntryQuery & { content: string }) => Promise<JournalEntryWriteResult>
}

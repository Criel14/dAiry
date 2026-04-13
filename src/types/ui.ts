export type ViewState =
  | 'no-workspace'
  | 'loading'
  | 'ready'
  | 'today-empty'
  | 'history-empty'
  | 'future-empty'
  | 'error'

export type RightPanel = 'journal' | 'reports' | 'settings'

export type EditorMode = 'source' | 'preview'

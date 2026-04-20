export interface JournalEntryQuery {
  workspacePath: string
  date: string
}

export interface JournalEntryMetadata {
  weather: string
  location: string
  mood: number
  summary: string
  tags: string[]
}

export interface JournalFrontmatter extends JournalEntryMetadata {
  createdAt: string
  updatedAt: string
}

export interface JournalEntryReadResult {
  status: 'ready' | 'missing'
  filePath: string
  frontmatter: JournalFrontmatter | null
  body: string | null
}

export interface JournalEntryWriteResult {
  filePath: string
  savedAt: string
}

export interface JournalEntryBodySaveInput extends JournalEntryQuery {
  body: string
}

export interface JournalEntryMetadataSaveInput extends JournalEntryQuery {
  metadata: JournalEntryMetadata
}

export interface JournalMonthActivityQuery {
  workspacePath: string
  month: string
}

export interface JournalDayActivity {
  date: string
  hasEntry: boolean
  wordCount: number
}

export interface JournalMonthActivityResult {
  month: string
  days: JournalDayActivity[]
}

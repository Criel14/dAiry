export interface MemorySearchInput {
  workspacePath: string
  query: string
  years?: string[]
  limit?: number
}

export interface MemorySearchResult {
  query: string
  answer: string
  findings: string[]
  relatedDates: string[]
  displayedCount: number
  totalCount: number
  confidence: 'high' | 'medium' | 'low'
}

export interface MemoryEntryDocument {
  date: string
  summary: string
  body: string
  mood: number
  tags: string[]
}

export interface MemoryBatchReadResult {
  entries: MemoryEntryDocument[]
  skippedDates: string[]
}

export interface MemoryGrepMatch {
  date: string
  summary: string
  snippet: string
}

export interface MemoryMetaCandidate {
  date: string
  weather: string
  location: string
  mood: number
  summary: string
  tags: string[]
  wordCount: number
}

export interface MemoryUserProfile {
  year: string | null
  content: string
  supplement: string
}

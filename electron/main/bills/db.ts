import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { Bill } from '../../../src/types/bills'

export interface BillRow {
  id: number
  date: string
  amount_cents: number
  category: string
  note: string
  created_at: string
  updated_at: string
}

export function mapRowToBill(row: BillRow): Bill {
  return {
    id: row.id,
    date: row.date,
    amountCents: row.amount_cents,
    category: row.category,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const SCHEMA_VERSION = 1

export function openBillsDatabase(workspacePath: string): Database.Database {
  const billsDir = path.join(workspacePath, 'bills')
  fs.mkdirSync(billsDir, { recursive: true })

  const db = new Database(path.join(billsDir, 'bills.db'))
  try {
    db.pragma('journal_mode = WAL')
    migrate(db)
  } catch (error) {
    db.close()
    throw error
  }
  return db
}

function migrate(db: Database.Database) {
  const currentVersion = db.pragma('user_version', { simple: true }) as number

  if (currentVersion < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bills (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        date          TEXT    NOT NULL,
        amount_cents  INTEGER NOT NULL,
        category      TEXT    NOT NULL,
        note          TEXT    NOT NULL DEFAULT '',
        created_at    TEXT    NOT NULL,
        updated_at    TEXT    NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(date);
    `)
    db.pragma(`user_version = ${SCHEMA_VERSION}`)
  }
}

// 打开连接执行操作后立即关闭，避免 db/wal/shm 句柄长期占用导致文件同步工具（坚果云等）挂起
export function withBillsDatabase<T>(
  workspacePath: string,
  fn: (db: Database.Database) => T,
): T {
  const db = openBillsDatabase(workspacePath)
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

// 数据库文件不存在时返回 null（不创建空库），存在时打开执行并关闭
export function withExistingBillsDatabase<T>(
  workspacePath: string,
  fn: (db: Database.Database) => T,
): T | null {
  const dbPath = path.join(workspacePath, 'bills', 'bills.db')
  if (!fs.existsSync(dbPath)) {
    return null
  }
  return withBillsDatabase(workspacePath, fn)
}

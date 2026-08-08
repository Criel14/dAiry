import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildBillsWorkbook } from '../../electron/main/bills/export'
import type { Bill } from '../../src/types/bills'

function makeBill(date: string, amountCents: number, category: string, note = ''): Bill {
  return {
    id: 1,
    date,
    amountCents,
    category,
    note,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }
}

describe('buildBillsWorkbook', () => {
  it('creates one sheet per year with header row', async () => {
    const bills = [
      makeBill('2026-08-01', -2346, '餐饮', '黄焖鸡'),
      makeBill('2026-08-01', 12000, '工资'),
      makeBill('2025-12-31', -500, '交通'),
    ]
    const workbook = buildBillsWorkbook(bills)

    expect(workbook.worksheets.map((ws) => ws.name)).toEqual(['2025', '2026'])

    const sheet2026 = workbook.getWorksheet('2026')
    expect(sheet2026).toBeDefined()
    const header = sheet2026?.getRow(1)
    expect(header?.getCell(1).value).toBe('日期')
    expect(header?.getCell(2).value).toBe('金额')
    expect(header?.getCell(3).value).toBe('分类')
    expect(header?.getCell(4).value).toBe('备注')

    const row2 = sheet2026?.getRow(2)
    expect(row2?.getCell(1).value).toBe('2026-08-01')
    expect(row2?.getCell(2).value).toBe(-23.46)
    expect(row2?.getCell(3).value).toBe('餐饮')
    expect(row2?.getCell(4).value).toBe('黄焖鸡')
  })

  it('handles empty bills without creating sheets', async () => {
    const workbook = buildBillsWorkbook([])
    expect(workbook.worksheets.length).toBe(0)
  })

  it('sorts rows by date ascending', async () => {
    const bills = [
      makeBill('2026-08-02', -100, '餐饮'),
      makeBill('2026-08-01', -200, '餐饮'),
    ]
    const workbook = buildBillsWorkbook(bills)
    const sheet = workbook.getWorksheet('2026')
    expect(sheet?.getRow(2).getCell(1).value).toBe('2026-08-01')
    expect(sheet?.getRow(3).getCell(1).value).toBe('2026-08-02')
  })
})

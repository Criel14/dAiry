import path from 'node:path'
import { dialog } from 'electron'
import ExcelJS from 'exceljs'
import type { Bill, BillsExportResult } from '../../../src/types/bills'
import { getAllBills } from './service'

export function buildBillsWorkbook(bills: Bill[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  const byYear = new Map<number, Bill[]>()

  for (const bill of bills) {
    const year = Number.parseInt(bill.date.slice(0, 4), 10)
    if (Number.isNaN(year)) {
      continue
    }
    const list = byYear.get(year) ?? []
    list.push(bill)
    byYear.set(year, list)
  }

  const years = [...byYear.keys()].sort((a, b) => a - b)
  for (const year of years) {
    const sheet = workbook.addWorksheet(String(year))
    const header = sheet.addRow(['日期', '金额', '分类', '备注'])
    header.font = { bold: true }

    const records = byYear.get(year) ?? []
    records.sort((a, b) => a.date.localeCompare(b.date))
    for (const bill of records) {
      sheet.addRow([bill.date, bill.amountCents / 100, bill.category, bill.note])
    }

    sheet.columns = [
      { width: 14 },
      { width: 12 },
      { width: 14 },
      { width: 40 },
    ]
  }

  return workbook
}

export async function exportBillsExcel(workspacePath: string): Promise<BillsExportResult> {
  const bills = await getAllBills(workspacePath)
  const workbook = buildBillsWorkbook(bills)

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '导出记账 Excel',
    defaultPath: path.join(workspacePath, 'bills.xlsx'),
    filters: [{ name: 'Excel 工作簿', extensions: ['xlsx'] }],
  })

  if (canceled || !filePath) {
    return { path: null, canceled: true }
  }

  await workbook.xlsx.writeFile(filePath)
  return { path: filePath, canceled: false }
}

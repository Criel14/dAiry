import { ipcMain } from 'electron'
import type {
  BillsCategoryQuery,
  BillsCreateCategoryInput,
  BillsDeleteCategoryInput,
  BillsDeleteInput,
  BillsListMonthInput,
  BillsListYearInput,
  BillsRecordInput,
  BillsRenameCategoryInput,
  BillsUpdateInput,
} from '../../../src/types/bills'
import { IPC_CHANNELS } from '../constants'
import {
  createBill,
  createCategory,
  deleteBill,
  listBillCategories,
  listBillsByMonth,
  listBillsByYear,
  removeCategory,
  updateBill,
  updateCategory,
} from '../bills/service'

export function registerBillsIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.listBillsByMonth, (_event, input: BillsListMonthInput) =>
    listBillsByMonth(input),
  )
  ipcMain.handle(IPC_CHANNELS.listBillsByYear, (_event, input: BillsListYearInput) =>
    listBillsByYear(input),
  )
  ipcMain.handle(IPC_CHANNELS.createBill, (_event, input: BillsRecordInput) => createBill(input))
  ipcMain.handle(IPC_CHANNELS.updateBill, (_event, input: BillsUpdateInput) => updateBill(input))
  ipcMain.handle(IPC_CHANNELS.deleteBill, (_event, input: BillsDeleteInput) => deleteBill(input))
  ipcMain.handle(IPC_CHANNELS.getBillCategories, (_event, input: BillsCategoryQuery) =>
    listBillCategories(input.workspacePath),
  )
  ipcMain.handle(IPC_CHANNELS.createBillCategory, (_event, input: BillsCreateCategoryInput) =>
    createCategory(input),
  )
  ipcMain.handle(IPC_CHANNELS.renameBillCategory, (_event, input: BillsRenameCategoryInput) =>
    updateCategory(input),
  )
  ipcMain.handle(IPC_CHANNELS.deleteBillCategory, (_event, input: BillsDeleteCategoryInput) =>
    removeCategory(input),
  )
}

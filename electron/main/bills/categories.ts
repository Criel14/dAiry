import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  BUILTIN_CATEGORIES,
  FALLBACK_CATEGORY_NAME,
  type BillCategory,
  type BillType,
} from '../../../src/types/bills'
import { pickPaletteColor } from '../../../src/shared/bills-logic'

const CATEGORIES_FILE_NAME = 'bill-categories.json'
const CATEGORIES_VERSION = 1

interface CategoryFile {
  version: number
  categories: BillCategory[]
}

export function getBillCategoriesPath(workspacePath: string) {
  return path.join(workspacePath, '.dairy', CATEGORIES_FILE_NAME)
}

export async function getBillCategories(workspacePath: string): Promise<BillCategory[]> {
  try {
    const raw = await readFile(getBillCategoriesPath(workspacePath), 'utf-8')
    const parsed = JSON.parse(raw) as CategoryFile
    if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
      return parsed.categories
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[bills] 分类文件读取失败，将按内置分类处理：', error)
    }
  }

  return [...BUILTIN_CATEGORIES]
}

export async function saveBillCategories(workspacePath: string, categories: BillCategory[]) {
  const file: CategoryFile = { version: CATEGORIES_VERSION, categories }
  const dirPath = path.join(workspacePath, '.dairy')
  await mkdir(dirPath, { recursive: true })
  await writeFile(getBillCategoriesPath(workspacePath), JSON.stringify(file, null, 2), 'utf-8')
}

function assertCanRename(categories: BillCategory[], type: BillType, name: string) {
  const target = categories.find((c) => c.type === type && c.name === name)
  if (!target) {
    throw new Error(`分类「${name}」不存在。`)
  }
  if (target.builtin) {
    throw new Error('内置分类不可改名。')
  }
}

function assertCanDelete(categories: BillCategory[], type: BillType, name: string) {
  const target = categories.find((c) => c.type === type && c.name === name)
  if (!target) {
    throw new Error(`分类「${name}」不存在。`)
  }
  if (target.builtin || name === FALLBACK_CATEGORY_NAME) {
    throw new Error('内置分类不可删除。')
  }
}

export async function createBillCategory(
  workspacePath: string,
  type: BillType,
  name: string,
): Promise<BillCategory[]> {
  const normalizedName = name.trim()
  if (!normalizedName) {
    throw new Error('分类名不能为空。')
  }
  if (normalizedName.length > 12) {
    throw new Error('分类名不能超过 12 个字符。')
  }

  const categories = await getBillCategories(workspacePath)
  if (categories.some((c) => c.type === type && c.name === normalizedName)) {
    throw new Error(`分类「${normalizedName}」已存在。`)
  }

  const usedColors = new Set(categories.map((c) => c.color))
  const next: BillCategory[] = [
    ...categories,
    { type, name: normalizedName, color: pickPaletteColor(usedColors), icon: 'tag', builtin: false },
  ]
  await saveBillCategories(workspacePath, next)
  return next
}

export async function renameBillCategory(
  workspacePath: string,
  type: BillType,
  name: string,
  newName: string,
): Promise<BillCategory[]> {
  const normalizedName = newName.trim()
  if (!normalizedName) {
    throw new Error('分类名不能为空。')
  }
  if (normalizedName.length > 12) {
    throw new Error('分类名不能超过 12 个字符。')
  }

  const categories = await getBillCategories(workspacePath)
  assertCanRename(categories, type, name)
  if (categories.some((c) => c.type === type && c.name === normalizedName)) {
    throw new Error(`分类「${normalizedName}」已存在。`)
  }

  const next = categories.map((c) =>
    c.type === type && c.name === name ? { ...c, name: normalizedName } : c,
  )
  await saveBillCategories(workspacePath, next)
  return next
}

export async function deleteBillCategory(
  workspacePath: string,
  type: BillType,
  name: string,
): Promise<BillCategory[]> {
  const categories = await getBillCategories(workspacePath)
  assertCanDelete(categories, type, name)

  const next = categories.filter((c) => !(c.type === type && c.name === name))
  await saveBillCategories(workspacePath, next)
  return next
}

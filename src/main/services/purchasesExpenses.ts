// src/main/services/purchasesExpenses.ts — Purchases (record-keeping) + Expenses
// CRITICAL: recordPurchase NEVER touches bulk_stock, bulk_arrivals, or any cost column.
import { desc, gte, lte, and, eq } from 'drizzle-orm'
import { getDb } from '../db'
import { suppliers, purchaseEntries, expenses, users } from '../db/schema'
import type {
  SupplierRow, PurchaseEntryRow, ExpenseRow,
  RecordPurchaseRequest, RecordExpenseRequest
} from '../../shared/types'

export function createSupplier(req: { name: string; phone?: string }): number {
  if (!req.name.trim()) throw new Error('Supplier name is required')
  const [row] = getDb()
    .insert(suppliers)
    .values({ name: req.name.trim(), phone: req.phone?.trim() ?? null })
    .returning({ id: suppliers.id })
    .all()
  return row.id
}

export function listSuppliers(): SupplierRow[] {
  return getDb().select().from(suppliers).orderBy(suppliers.name).all()
    .map((r) => ({ id: r.id, name: r.name, phone: r.phone ?? null }))
}

/** Record-keeping only. Zero effect on BulkStock or any cost column. */
export function recordPurchase(req: RecordPurchaseRequest): void {
  if (!req.itemName.trim()) throw new Error('Item name is required')
  if (req.qty <= 0) throw new Error('Quantity must be positive')
  if (req.amountPaise < 0) throw new Error('Amount cannot be negative')
  // Only inserts into purchase_entries — no stock or cost writes (enforced by design)
  getDb()
    .insert(purchaseEntries)
    .values({
      supplierId: req.supplierId ?? null,
      date: req.date,
      itemName: req.itemName.trim(),
      qty: req.qty,
      amountPaise: req.amountPaise,
      notes: req.notes?.trim() ?? null
    })
    .run()
}

export function listPurchases(dateFrom?: string, dateTo?: string): PurchaseEntryRow[] {
  const db = getDb()
  let q = db.select().from(purchaseEntries).orderBy(desc(purchaseEntries.date))
  const rows = (dateFrom && dateTo)
    ? q.where(and(gte(purchaseEntries.date, dateFrom), lte(purchaseEntries.date, dateTo))).all()
    : dateFrom ? q.where(gte(purchaseEntries.date, dateFrom)).all()
    : dateTo ? q.where(lte(purchaseEntries.date, dateTo)).all()
    : q.all()
  return rows.map((r) => ({
    id: r.id, supplierId: r.supplierId ?? null, date: r.date,
    itemName: r.itemName, qty: r.qty, amountPaise: r.amountPaise, notes: r.notes ?? null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt)
  }))
}

export function recordExpense(req: RecordExpenseRequest): void {
  if (!req.category.trim()) throw new Error('Category is required')
  if (req.amountPaise < 0) throw new Error('Amount cannot be negative')
  getDb()
    .insert(expenses)
    .values({ date: req.date, category: req.category.trim(), amountPaise: req.amountPaise, notes: req.notes?.trim() ?? null })
    .run()
}

export function listExpenses(dateFrom?: string, dateTo?: string): ExpenseRow[] {
  const db = getDb()
  let q = db.select().from(expenses).orderBy(desc(expenses.date))
  const rows = (dateFrom && dateTo)
    ? q.where(and(gte(expenses.date, dateFrom), lte(expenses.date, dateTo))).all()
    : dateFrom ? q.where(gte(expenses.date, dateFrom)).all()
    : dateTo ? q.where(lte(expenses.date, dateTo)).all()
    : q.all()
  return rows.map((r) => ({
    id: r.id, date: r.date, category: r.category,
    amountPaise: r.amountPaise, notes: r.notes ?? null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt)
  }))
}
export function deleteExpense(expenseId: number, userId: number): void {
  const db = getDb()
  const user = db.select().from(users).where(eq(users.id, userId)).get()
  if (user?.role !== 'admin') throw new Error('Admin access required to delete expenses')
  db.delete(expenses).where(eq(expenses.id, expenseId)).run()
}

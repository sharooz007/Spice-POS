// src/main/services/customers.ts — Customers & Parties (main process only)
// rules.md #10: gstNo is stored/printed as text only — no tax math anywhere
import { eq, desc } from 'drizzle-orm'
import { getDb } from '../db'
import { customers, payments } from '../db/schema'
import type {
  CustomerRow, PaymentRow,
  CreateCustomerRequest, UpdateCustomerRequest
} from '../../shared/types'

export function createCustomer(req: CreateCustomerRequest): number {
  if (!req.name.trim()) throw new Error('Name is required')
  const [row] = getDb()
    .insert(customers)
    .values({
      type: req.type,
      name: req.name.trim(),
      businessName: req.businessName?.trim() ?? null,
      phone: req.phone?.trim() ?? null,
      address: req.address?.trim() ?? null,
      gstNo: req.gstNo?.trim() ?? null, // text only — no tax computation (rules.md #10)
      creditBalancePaise: 0
    })
    .returning({ id: customers.id })
    .all()
  return row.id
}

export function listCustomers(type?: 'retail' | 'wholesale'): CustomerRow[] {
  const db = getDb()
  const rows = type
    ? db.select().from(customers).where(eq(customers.type, type)).orderBy(customers.name).all()
    : db.select().from(customers).orderBy(customers.name).all()
  return rows.map(toCustomerRow)
}

export function getCustomer(id: number): CustomerRow | null {
  const row = getDb().select().from(customers).where(eq(customers.id, id)).get()
  return row ? toCustomerRow(row) : null
}

export function updateCustomer(req: UpdateCustomerRequest): void {
  const update: Partial<typeof customers.$inferInsert> = {}
  if (req.name !== undefined) update.name = req.name.trim()
  if (req.phone !== undefined) update.phone = req.phone.trim() || null
  if (req.address !== undefined) update.address = req.address.trim() || null
  if (req.gstNo !== undefined) update.gstNo = req.gstNo.trim() || null
  // credit_balance_paise intentionally excluded — only changes via sales/payments
  getDb().update(customers).set(update).where(eq(customers.id, req.id)).run()
}

/** Lightweight phone update — no admin restriction (phone is not sensitive). */
export function updateCustomerPhone(customerId: number, phone: string): void {
  const trimmed = phone.trim()
  if (!trimmed) return
  getDb().update(customers).set({ phone: trimmed }).where(eq(customers.id, customerId)).run()
}

export function listPayments(customerId: number): PaymentRow[] {
  return getDb()
    .select()
    .from(payments)
    .where(eq(payments.customerId, customerId))
    .orderBy(desc(payments.createdAt))
    .all()
    .map((r) => ({
      id: r.id,
      customerId: r.customerId,
      invoiceId: r.invoiceId ?? null,
      date: r.date,
      amountPaise: r.amountPaise,
      mode: r.mode,
      notes: r.notes ?? null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt)
    }))
}

function toCustomerRow(r: typeof customers.$inferSelect): CustomerRow {
  return {
    id: r.id,
    type: r.type as 'retail' | 'wholesale',
    name: r.name,
    businessName: r.businessName ?? null,
    phone: r.phone ?? null,
    address: r.address ?? null,
    gstNo: r.gstNo ?? null,
    creditBalancePaise: r.creditBalancePaise
  }
}

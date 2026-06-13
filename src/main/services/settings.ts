import { getDb } from '../db'
import { settings, pingLog, labelPrintLog, purchaseEntries, expenses, invoices, invoiceLines, invoiceDatetimeEditLog, syncQueue, syncLog, payments, bulkStock, bulkArrivals, bulkAdjustments, packingRuns, packingRunLines, retailPacketStock, retailAdjustments } from '../db/schema'
import { eq } from 'drizzle-orm'
import { users } from '../db/schema'
import { sql } from 'drizzle-orm'

export function getSetting(key: string): string | null {
  const db = getDb()
  const row = db.select().from(settings).where(eq(settings.key, key)).get()
  return row ? row.value : null
}

export function setSetting(key: string, value: string): void {
  const db = getDb()
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value }
    })
    .run()
}

export function getAllSettings(): Record<string, string> {
  const db = getDb()
  const rows = db.select().from(settings).all()
  const obj: Record<string, string> = {}
  for (const r of rows) obj[r.key] = r.value
  return obj
}

export function setAllSettings(newSettings: Record<string, string>): void {
  const db = getDb()
  db.transaction((tx) => {
    for (const [k, v] of Object.entries(newSettings)) {
      tx.insert(settings)
        .values({ key: k, value: String(v) })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: String(v) }
        })
        .run()
    }
  })
}

export function resetDemoData(userId: number): void {
  const db = getDb()
  const isDemo = getSetting('demo_seeded') === 'true'
  if (!isDemo) throw new Error('Cannot reset demo data: demo_seeded is not true.')

  const user = db.select().from(users).where(eq(users.id, userId)).get()
  if (user?.role !== 'admin') throw new Error('Admin access required to reset demo data.')

  db.transaction((tx) => {
    // Delete transactions
    tx.delete(payments).run()
    tx.delete(invoiceDatetimeEditLog).run()
    tx.delete(invoiceLines).run()
    tx.delete(invoices).run()
    tx.delete(expenses).run()
    tx.delete(purchaseEntries).run()
    tx.delete(labelPrintLog).run()
    tx.delete(pingLog).run()
    tx.delete(syncQueue).run()
    tx.delete(syncLog).run()
    
    // Inventory
    tx.delete(bulkAdjustments).run()
    tx.delete(bulkArrivals).run()
    tx.delete(bulkStock).run()
    tx.delete(packingRunLines).run()
    tx.delete(packingRuns).run()
    tx.delete(retailAdjustments).run()
    tx.delete(retailPacketStock).run()
    
    // Customers credit balance reset
    tx.run(sql`UPDATE customers SET credit_balance_paise = 0`)

    // Turn off demo_seeded flag
    tx.insert(settings).values({ key: 'demo_seeded', value: 'false' })
      .onConflictDoUpdate({ target: settings.key, set: { value: 'false' } }).run()
  })
}

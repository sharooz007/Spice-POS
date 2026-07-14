import { eq, desc } from 'drizzle-orm'
import { getDb } from '../db'
import { factoryItems, factoryTransactions } from '../db/schema'
import type { 
  FactoryItem, 
  FactoryTransaction, 
  CreateFactoryItemRequest, 
  CreateFactoryTransactionRequest,
  Result 
} from '../../shared/types'

export async function listItems(): Promise<Result<FactoryItem[]>> {
  try {
    const db = getDb()
    const rows = db.select().from(factoryItems).orderBy(desc(factoryItems.createdAt)).all()
    return { ok: true, data: rows as FactoryItem[] }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

export async function createItem(req: CreateFactoryItemRequest): Promise<Result<void>> {
  try {
    const db = getDb()
    db.insert(factoryItems).values({
      name: req.name,
      type: req.type
    }).run()
    return { ok: true, data: undefined }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

export async function listTransactions(itemId?: string): Promise<Result<FactoryTransaction[]>> {
  try {
    const db = getDb()
    let query = db.select().from(factoryTransactions)
    
    if (itemId) {
      query = query.where(eq(factoryTransactions.itemId, itemId)) as any
    }
    
    const rows = query.orderBy(desc(factoryTransactions.createdAt)).all()
    return { ok: true, data: rows as FactoryTransaction[] }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

export async function createTransaction(req: CreateFactoryTransactionRequest): Promise<Result<void>> {
  try {
    const db = getDb()
    db.insert(factoryTransactions).values({
      itemId: req.itemId,
      type: req.type,
      date: req.date,
      qtyKg: req.qtyKg,
      amountPaise: req.amountPaise,
      notes: req.notes || null
    }).run()
    return { ok: true, data: undefined }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

export async function deleteItem(id: string): Promise<Result<void>> {
  try {
    const db = getDb()
    db.transaction((tx) => {
      tx.delete(factoryTransactions).where(eq(factoryTransactions.itemId, id)).run()
      tx.delete(factoryItems).where(eq(factoryItems.id, id)).run()
    })
    return { ok: true, data: undefined }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

export async function deleteTransaction(id: string): Promise<Result<void>> {
  try {
    const db = getDb()
    db.delete(factoryTransactions).where(eq(factoryTransactions.id, id)).run()
    return { ok: true, data: undefined }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

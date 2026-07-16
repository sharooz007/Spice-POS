import { eq, desc } from 'drizzle-orm'
import { getDb } from '../db'
import { factoryItems, factoryTransactions } from '../db/schema'
import type { 
  FactoryItem, 
  FactoryTransaction, 
  CreateFactoryItemRequest, 
  CreateFactoryTransactionRequest,
  FactoryProductionRun,
  FactoryProductionRunIngredient,
  CreateFactoryProductionRunRequest,
  FactoryRawMaterialStock,
  Result 
} from '../../shared/types'
import { factoryProductionRuns, factoryProductionRunIngredients } from '../db/schema'

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

// ── Production Runs ──────────────────────────────────────────────────────────

export async function listProductionRuns(): Promise<Result<FactoryProductionRun[]>> {
  try {
    const db = getDb()
    const runs = db.select({
      id: factoryProductionRuns.id,
      finalProductId: factoryProductionRuns.finalProductId,
      finalProductName: factoryItems.name,
      date: factoryProductionRuns.date,
      qtyProducedKg: factoryProductionRuns.qtyProducedKg,
      notes: factoryProductionRuns.notes,
      createdAt: factoryProductionRuns.createdAt
    })
    .from(factoryProductionRuns)
    .innerJoin(factoryItems, eq(factoryProductionRuns.finalProductId, factoryItems.id))
    .orderBy(desc(factoryProductionRuns.createdAt))
    .all()

    const runIds = runs.map(r => r.id)
    let ingredientsMap: Record<string, FactoryProductionRunIngredient[]> = {}
    
    if (runIds.length > 0) {
      const ingredients = db.select({
        id: factoryProductionRunIngredients.id,
        runId: factoryProductionRunIngredients.runId,
        rawMaterialId: factoryProductionRunIngredients.rawMaterialId,
        rawMaterialName: factoryItems.name,
        qtyUsedKg: factoryProductionRunIngredients.qtyUsedKg
      })
      .from(factoryProductionRunIngredients)
      .innerJoin(factoryItems, eq(factoryProductionRunIngredients.rawMaterialId, factoryItems.id))
      .all()

      for (const ing of ingredients) {
        if (!ingredientsMap[ing.runId]) ingredientsMap[ing.runId] = []
        ingredientsMap[ing.runId].push(ing)
      }
    }

    const result = runs.map(r => ({
      ...r,
      ingredients: ingredientsMap[r.id] || []
    }))

    return { ok: true, data: result as FactoryProductionRun[] }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

export async function createProductionRun(req: CreateFactoryProductionRunRequest): Promise<Result<void>> {
  try {
    const db = getDb()
    db.transaction((tx) => {
      const { insertId } = tx.insert(factoryProductionRuns).values({
        finalProductId: req.finalProductId,
        date: req.date,
        qtyProducedKg: req.qtyProducedKg,
        notes: req.notes || null
      }).returning({ insertId: factoryProductionRuns.id }).get()

      for (const ing of req.ingredients) {
        tx.insert(factoryProductionRunIngredients).values({
          runId: insertId,
          rawMaterialId: ing.rawMaterialId,
          qtyUsedKg: ing.qtyUsedKg
        }).run()
      }
    })
    return { ok: true, data: undefined }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

export async function deleteProductionRun(id: string): Promise<Result<void>> {
  try {
    const db = getDb()
    db.transaction((tx) => {
      tx.delete(factoryProductionRunIngredients).where(eq(factoryProductionRunIngredients.runId, id)).run()
      tx.delete(factoryProductionRuns).where(eq(factoryProductionRuns.id, id)).run()
    })
    return { ok: true, data: undefined }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

export async function getRawMaterialStock(): Promise<Result<FactoryRawMaterialStock[]>> {
  try {
    const db = getDb()
    
    // Get all raw materials
    const rawMaterials = db.select().from(factoryItems).where(eq(factoryItems.type, 'raw_material')).all()
    
    // Get all purchases (which increase stock)
    const purchases = db.select({
      itemId: factoryTransactions.itemId,
      qtyKg: factoryTransactions.qtyKg
    })
    .from(factoryTransactions)
    .where(eq(factoryTransactions.type, 'purchase'))
    .all()

    // Get all consumption (which decrease stock)
    const consumption = db.select({
      rawMaterialId: factoryProductionRunIngredients.rawMaterialId,
      qtyUsedKg: factoryProductionRunIngredients.qtyUsedKg
    })
    .from(factoryProductionRunIngredients)
    .all()

    // Calculate
    const stockMap: Record<string, FactoryRawMaterialStock> = {}
    
    for (const rm of rawMaterials) {
      stockMap[rm.id] = {
        itemId: rm.id,
        itemName: rm.name,
        purchasedKg: 0,
        consumedKg: 0,
        currentStockKg: 0
      }
    }

    for (const p of purchases) {
      if (stockMap[p.itemId]) {
        stockMap[p.itemId].purchasedKg += p.qtyKg
        stockMap[p.itemId].currentStockKg += p.qtyKg
      }
    }

    for (const c of consumption) {
      if (stockMap[c.rawMaterialId]) {
        stockMap[c.rawMaterialId].consumedKg += c.qtyUsedKg
        stockMap[c.rawMaterialId].currentStockKg -= c.qtyUsedKg
      }
    }

    const result = Object.values(stockMap).sort((a, b) => a.itemName.localeCompare(b.itemName))
    return { ok: true, data: result }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

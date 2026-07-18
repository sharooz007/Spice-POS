// src/main/services/products.ts — Product Master business logic (main process only)
import { eq, inArray } from 'drizzle-orm'
import { getDb } from '../db'
import {
  categories,
  products,
  productVariants,
  bulkStock,
  retailPacketStock,
  bulkArrivals,
  packingRuns,
  invoiceLines,
  priceMenuEntries
} from '../db/schema'
import type {
  Category,
  Product,
  CreateCategoryRequest,
  CreateProductRequest,
  CreateVariantRequest,
  UpdateProductRequest,
  UpdateVariantRequest
} from '../../shared/types'

export function createCategory(req: CreateCategoryRequest): Category {
  if (!req.name.trim()) throw new Error('Category name is required')
  const db = getDb()
  const [row] = db.insert(categories).values({ name: req.name.trim() }).returning().all()
  return { id: row.id, name: row.name }
}

export function createProduct(req: CreateProductRequest): string {
  if (!req.name.trim()) throw new Error('Product name is required')
  if (req.wholesaleRatePerKgPaise < 0) throw new Error('Wholesale rate cannot be negative')
  const db = getDb()
  return db.transaction((tx) => {
    const [p] = tx
      .insert(products)
      .values({
        name: req.name.trim(),
        categoryId: req.categoryId,
        bulkLowStockGrams: req.bulkLowStockGrams,
        wholesaleRatePerKgPaise: req.wholesaleRatePerKgPaise,
        enabled: req.enabled,
        unitType: req.unitType ?? 'weight'
      })
      .returning({ id: products.id })
      .all()
    // initialise bulk stock row
    tx.insert(bulkStock).values({ productId: p.id, qtyGrams: 0 }).run()
    return p.id
  })
}

export function createVariant(req: CreateVariantRequest): string {
  if (!req.label.trim()) throw new Error('Variant label is required')
  if (!req.barcode.trim()) throw new Error('Barcode is required')
  if (req.weightGrams <= 0) throw new Error('Weight must be positive')
  const db = getDb()
  return db.transaction((tx) => {
    const [v] = tx
      .insert(productVariants)
      .values({
        productId: req.productId,
        label: req.label.trim(),
        weightGrams: req.weightGrams,
        barcode: req.barcode.trim(),
        enabled: req.enabled,
        retailLowStockPcs: req.retailLowStockPcs
      })
      .returning({ id: productVariants.id })
      .all()
    tx.insert(retailPacketStock).values({ variantId: v.id, qtyPcs: 0 }).run()
    return v.id
  })
}

export function listProducts(): Product[] {
  const db = getDb()
  const prods = db
    .select({
      id: products.id,
      name: products.name,
      categoryId: products.categoryId,
      categoryName: categories.name,
      enabled: products.enabled,
      bulkLowStockGrams: products.bulkLowStockGrams,
      wholesaleRatePerKgPaise: products.wholesaleRatePerKgPaise,
      unitType: products.unitType
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .all()

  const vars = db.select().from(productVariants).all()

  return prods.map((p) => ({
    ...p,
    unitType: (p.unitType ?? 'weight') as 'weight' | 'volume',
    variants: vars
      .filter((v) => v.productId === p.id)
      .map((v) => ({
        id: v.id,
        productId: v.productId,
        label: v.label,
        weightGrams: v.weightGrams,
        barcode: v.barcode,
        enabled: v.enabled ?? true,
        retailLowStockPcs: v.retailLowStockPcs
      }))
  }))
}

export function updateProduct(req: UpdateProductRequest, userId: string): void {
  if (Object.keys(req).length <= 1) return // only id provided
  const db = getDb()
  const update: Partial<typeof products.$inferInsert> = {}
  if (req.name !== undefined) update.name = req.name.trim()
  if (req.categoryId !== undefined) update.categoryId = req.categoryId
  if (req.bulkLowStockGrams !== undefined) update.bulkLowStockGrams = req.bulkLowStockGrams
  if (req.wholesaleRatePerKgPaise !== undefined)
    update.wholesaleRatePerKgPaise = req.wholesaleRatePerKgPaise
  if (req.unitType !== undefined) update.unitType = req.unitType
  // audit stamp lives on the product row indirectly; no separate log table for product edits in Phase 2
  // userId recorded for future audit log (Phase 11+)
  void userId
  db.update(products).set(update).where(eq(products.id, req.id)).run()
}

export function updateVariant(req: UpdateVariantRequest, userId: string): void {
  if (Object.keys(req).length <= 1) return
  void userId
  const db = getDb()
  const update: Partial<typeof productVariants.$inferInsert> = {}
  if (req.label !== undefined) update.label = req.label.trim()
  if (req.weightGrams !== undefined) update.weightGrams = req.weightGrams
  if (req.barcode !== undefined) update.barcode = req.barcode.trim()
  if (req.retailLowStockPcs !== undefined) update.retailLowStockPcs = req.retailLowStockPcs
  db.update(productVariants).set(update).where(eq(productVariants.id, req.id)).run()
}

export function toggleProductEnabled(id: string, userId: string): void {
  void userId
  const db = getDb()
  const p = db.select({ enabled: products.enabled }).from(products).where(eq(products.id, id)).get()
  if (!p) throw new Error('Product not found')
  db.update(products).set({ enabled: !p.enabled }).where(eq(products.id, id)).run()
}

export function toggleVariantEnabled(id: string, userId: string): void {
  void userId
  const db = getDb()
  const v = db
    .select({ enabled: productVariants.enabled })
    .from(productVariants)
    .where(eq(productVariants.id, id))
    .get()
  if (!v) throw new Error('Variant not found')
  db.update(productVariants).set({ enabled: !v.enabled }).where(eq(productVariants.id, id)).run()
}

export function deleteProduct(productId: string, _userId: string): void {
  const db = getDb()
  db.transaction((tx) => {
    // Safety check: refuse if any history exists
    const hasArrival = tx.select({ id: bulkArrivals.id }).from(bulkArrivals)
      .where(eq(bulkArrivals.productId, productId)).limit(1).get()
    if (hasArrival) throw new Error('Cannot delete — this product has stock or sales history. Disable it instead.')

    const hasPackingRun = tx.select({ id: packingRuns.id }).from(packingRuns)
      .where(eq(packingRuns.productId, productId)).limit(1).get()
    if (hasPackingRun) throw new Error('Cannot delete — this product has stock or sales history. Disable it instead.')

    const hasInvoiceLine = tx.select({ id: invoiceLines.id }).from(invoiceLines)
      .where(eq(invoiceLines.productId, productId)).limit(1).get()
    if (hasInvoiceLine) throw new Error('Cannot delete — this product has stock or sales history. Disable it instead.')

    // Get variant ids for cascade cleanup
    const variantIds = tx.select({ id: productVariants.id }).from(productVariants)
      .where(eq(productVariants.productId, productId)).all().map((v) => v.id)

    if (variantIds.length > 0) {
      tx.delete(priceMenuEntries).where(inArray(priceMenuEntries.variantId, variantIds)).run()
      tx.delete(retailPacketStock).where(inArray(retailPacketStock.variantId, variantIds)).run()
      tx.delete(productVariants).where(eq(productVariants.productId, productId)).run()
    }

    tx.delete(bulkStock).where(eq(bulkStock.productId, productId)).run()
    tx.delete(products).where(eq(products.id, productId)).run()
  })
}

export function listCategories(): Category[] {
  return getDb().select().from(categories).all()
}

export function generateBarcode(productName: string, _weightGrams: number): string {
  const prefix = (productName.trim().charAt(0) || 'X').toUpperCase()
  const db = getDb()
  const existing = db.select({ barcode: productVariants.barcode }).from(productVariants).all().map((r) => r.barcode)

  while (true) {
    const random4 = Math.floor(1000 + Math.random() * 9000)
    const candidate = `${prefix}${random4}`
    if (!existing.includes(candidate)) {
      return candidate
    }
  }
}

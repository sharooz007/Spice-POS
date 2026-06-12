// src/main/db/seed.ts — dev seed data per data_model.md
// Runs on startup only if the products table is empty.
// PINs are hashed with scrypt (Node crypto, no extra deps).

import { scryptSync, randomBytes } from 'crypto'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(pin, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function seedIfEmpty(db: BetterSQLite3Database<typeof schema>): void {
  const existing = db.select({ id: schema.products.id }).from(schema.products).limit(1).get()
  if (existing) return // already seeded

  db.transaction((tx) => {
    // ── Categories ────────────────────────────────────────────────────────────
    const catRows = tx
      .insert(schema.categories)
      .values({ name: 'Spices & Masalas' })
      .returning({ id: schema.categories.id })
      .all()
    const catId = catRows[0].id

    // ── Products ──────────────────────────────────────────────────────────────
    const productRows = tx
      .insert(schema.products)
      .values([
        {
          name: 'Chilli Powder',
          categoryId: catId,
          enabled: true,
          bulkLowStockGrams: 2000,
          wholesaleRatePerKgPaise: 18000,
          unitType: 'weight'
        },
        {
          name: 'Turmeric Powder',
          categoryId: catId,
          enabled: true,
          bulkLowStockGrams: 2000,
          wholesaleRatePerKgPaise: 16000,
          unitType: 'weight'
        },
        {
          name: 'Chicken Masala',
          categoryId: catId,
          enabled: true,
          bulkLowStockGrams: 1000,
          wholesaleRatePerKgPaise: 22000,
          unitType: 'weight'
        }
      ])
      .returning({ id: schema.products.id, name: schema.products.name })
      .all()

    const chilliId = productRows.find((p) => p.name === 'Chilli Powder')!.id
    const turmericId = productRows.find((p) => p.name === 'Turmeric Powder')!.id
    const masalaId = productRows.find((p) => p.name === 'Chicken Masala')!.id

    // ── Bulk Stock (empty on seed) ─────────────────────────────────────────
    tx.insert(schema.bulkStock).values([
      { productId: chilliId, qtyGrams: 0 },
      { productId: turmericId, qtyGrams: 0 },
      { productId: masalaId, qtyGrams: 0 }
    ]).run()

    // ── Variants: Chilli Powder ───────────────────────────────────────────────
    const chilliVariants = tx
      .insert(schema.productVariants)
      .values([
        { productId: chilliId, label: '100g', weightGrams: 100, barcode: 'CHI100G001', enabled: true, retailLowStockPcs: 10 },
        { productId: chilliId, label: '250g', weightGrams: 250, barcode: 'CHI250G001', enabled: true, retailLowStockPcs: 10 },
        { productId: chilliId, label: '500g', weightGrams: 500, barcode: 'CHI500G001', enabled: true, retailLowStockPcs: 5 },
        { productId: chilliId, label: '1 kg', weightGrams: 1000, barcode: 'CHI1KG0001', enabled: true, retailLowStockPcs: 5 }
      ])
      .returning({ id: schema.productVariants.id })
      .all()

    // ── Variants: Turmeric Powder ─────────────────────────────────────────────
    const turmericVariants = tx
      .insert(schema.productVariants)
      .values([
        { productId: turmericId, label: '100g', weightGrams: 100, barcode: 'TUR100G001', enabled: true, retailLowStockPcs: 10 },
        { productId: turmericId, label: '250g', weightGrams: 250, barcode: 'TUR250G001', enabled: true, retailLowStockPcs: 10 },
        { productId: turmericId, label: '500g', weightGrams: 500, barcode: 'TUR500G001', enabled: true, retailLowStockPcs: 5 },
        { productId: turmericId, label: '1 kg', weightGrams: 1000, barcode: 'TUR1KG0001', enabled: true, retailLowStockPcs: 5 }
      ])
      .returning({ id: schema.productVariants.id })
      .all()

    // ── Variants: Chicken Masala ──────────────────────────────────────────────
    const masalaVariants = tx
      .insert(schema.productVariants)
      .values([
        { productId: masalaId, label: '100g', weightGrams: 100, barcode: 'MAS100G001', enabled: true, retailLowStockPcs: 10 },
        { productId: masalaId, label: '250g', weightGrams: 250, barcode: 'MAS250G001', enabled: true, retailLowStockPcs: 10 },
        { productId: masalaId, label: '500g', weightGrams: 500, barcode: 'MAS500G001', enabled: true, retailLowStockPcs: 5 }
      ])
      .returning({ id: schema.productVariants.id })
      .all()

    // ── Retail Packet Stock (empty on seed) ───────────────────────────────────
    const allVariants = [...chilliVariants, ...turmericVariants, ...masalaVariants]
    tx.insert(schema.retailPacketStock)
      .values(allVariants.map((v) => ({ variantId: v.id, qtyPcs: 0 })))
      .run()

    // ── Price Menu Entries (placeholder prices — owner sets real prices before go-live) ──
    const today = new Date().toISOString().slice(0, 10)

    const chilliPrices = [
      { retail: 3500, wholesale: 3000 },
      { retail: 8000, wholesale: 7000 },
      { retail: 15000, wholesale: 13000 },
      { retail: 28000, wholesale: 25000 }
    ]
    for (let i = 0; i < chilliVariants.length; i++) {
      tx.insert(schema.priceMenuEntries).values({
        variantId: chilliVariants[i].id,
        retailPricePaise: chilliPrices[i].retail,
        wholesalePricePaise: chilliPrices[i].wholesale,
        effectiveDate: today
      }).run()
    }

    const turmericPrices = [
      { retail: 2500, wholesale: 2000 },
      { retail: 6000, wholesale: 5000 },
      { retail: 11000, wholesale: 9500 },
      { retail: 20000, wholesale: 18000 }
    ]
    for (let i = 0; i < turmericVariants.length; i++) {
      tx.insert(schema.priceMenuEntries).values({
        variantId: turmericVariants[i].id,
        retailPricePaise: turmericPrices[i].retail,
        wholesalePricePaise: turmericPrices[i].wholesale,
        effectiveDate: today
      }).run()
    }

    const masalaPrices = [
      { retail: 4500, wholesale: 4000 },
      { retail: 10000, wholesale: 9000 },
      { retail: 18000, wholesale: 16000 }
    ]
    for (let i = 0; i < masalaVariants.length; i++) {
      tx.insert(schema.priceMenuEntries).values({
        variantId: masalaVariants[i].id,
        retailPricePaise: masalaPrices[i].retail,
        wholesalePricePaise: masalaPrices[i].wholesale,
        effectiveDate: today
      }).run()
    }

    // ── Users (PIN hashed with scrypt) ────────────────────────────────────────
    tx.insert(schema.users).values([
      { name: 'admin', role: 'admin', pinHash: hashPin('1234') },
      { name: 'staff', role: 'staff', pinHash: hashPin('5678') }
    ]).run()
  })
}

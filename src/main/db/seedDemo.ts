import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from './schema'
import { blendCost } from '../../shared/costing'
import { businessDate } from '../../shared/businessDate'

// ── PRNG ───────────────────────────────────────────────────────────────────
let seedVal = 12345
function random(): number {
  seedVal = (seedVal * 9301 + 49297) % 233280
  return seedVal / 233280
}
function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min
}
function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)]
}
function randomString(len: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: len }).map(() => pick(chars.split(''))).join('')
}

// ── Catalog Data ────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Whole Spices', 'Ground Spices', 'Masala Blends', 'Seeds',
  'Herbs & Leaves', 'Oils', 'Rice & Grains', 'Dry Fruits'
]

const PRODUCTS_DEF = [
  { name: 'Cumin Seeds (Jeera)', cat: 'Whole Spices', baseRate: 350 },
  { name: 'Coriander Seeds', cat: 'Whole Spices', baseRate: 150 },
  { name: 'Black Pepper', cat: 'Whole Spices', baseRate: 650 },
  { name: 'Cloves', cat: 'Whole Spices', baseRate: 1200 },
  { name: 'Cardamom Green', cat: 'Whole Spices', baseRate: 2500 },
  { name: 'Cardamom Black', cat: 'Whole Spices', baseRate: 1400 },
  { name: 'Cinnamon Sticks', cat: 'Whole Spices', baseRate: 400 },
  { name: 'Star Anise', cat: 'Whole Spices', baseRate: 850 },
  { name: 'Nutmeg', cat: 'Whole Spices', baseRate: 900 },
  { name: 'Mace (Javitri)', cat: 'Whole Spices', baseRate: 1800 },

  { name: 'Turmeric Powder', cat: 'Ground Spices', baseRate: 180 },
  { name: 'Chilli Powder (Spicy)', cat: 'Ground Spices', baseRate: 250 },
  { name: 'Kashmiri Chilli Powder', cat: 'Ground Spices', baseRate: 380 },
  { name: 'Coriander Powder', cat: 'Ground Spices', baseRate: 170 },
  { name: 'Cumin Powder', cat: 'Ground Spices', baseRate: 400 },
  { name: 'Black Pepper Powder', cat: 'Ground Spices', baseRate: 700 },

  { name: 'Garam Masala', cat: 'Masala Blends', baseRate: 450 },
  { name: 'Chicken Masala', cat: 'Masala Blends', baseRate: 480 },
  { name: 'Meat Masala', cat: 'Masala Blends', baseRate: 500 },
  { name: 'Chana Masala', cat: 'Masala Blends', baseRate: 350 },
  { name: 'Pav Bhaji Masala', cat: 'Masala Blends', baseRate: 380 },
  { name: 'Chat Masala', cat: 'Masala Blends', baseRate: 320 },
  { name: 'Sambhar Masala', cat: 'Masala Blends', baseRate: 340 },
  { name: 'Biryani Masala', cat: 'Masala Blends', baseRate: 550 },

  { name: 'Mustard Seeds', cat: 'Seeds', baseRate: 120 },
  { name: 'Fennel Seeds (Saunf)', cat: 'Seeds', baseRate: 220 },
  { name: 'Fenugreek Seeds (Methi)', cat: 'Seeds', baseRate: 140 },
  { name: 'Sesame Seeds White', cat: 'Seeds', baseRate: 280 },
  { name: 'Sesame Seeds Black', cat: 'Seeds', baseRate: 300 },
  { name: 'Poppy Seeds (Khus Khus)', cat: 'Seeds', baseRate: 1100 },
  { name: 'Carom Seeds (Ajwain)', cat: 'Seeds', baseRate: 350 },

  { name: 'Bay Leaves', cat: 'Herbs & Leaves', baseRate: 200 },
  { name: 'Kasuri Methi', cat: 'Herbs & Leaves', baseRate: 350 },
  { name: 'Curry Leaves (Dry)', cat: 'Herbs & Leaves', baseRate: 150 },
  { name: 'Mint Leaves (Dry)', cat: 'Herbs & Leaves', baseRate: 250 },

  { name: 'Coconut Oil', cat: 'Oils', baseRate: 250 },
  { name: 'Mustard Oil', cat: 'Oils', baseRate: 180 },
  { name: 'Sunflower Oil', cat: 'Oils', baseRate: 140 },
  { name: 'Groundnut Oil', cat: 'Oils', baseRate: 220 },
  { name: 'Sesame Oil', cat: 'Oils', baseRate: 320 },

  { name: 'Basmati Rice Premium', cat: 'Rice & Grains', baseRate: 120 },
  { name: 'Sona Masoori Rice', cat: 'Rice & Grains', baseRate: 65 },
  { name: 'Ponni Rice', cat: 'Rice & Grains', baseRate: 55 },
  { name: 'Wheat Whole', cat: 'Rice & Grains', baseRate: 40 },
  { name: 'Ragi (Finger Millet)', cat: 'Rice & Grains', baseRate: 50 },

  { name: 'Cashews Whole', cat: 'Dry Fruits', baseRate: 850 },
  { name: 'Almonds Premium', cat: 'Dry Fruits', baseRate: 750 },
  { name: 'Raisins Green', cat: 'Dry Fruits', baseRate: 350 },
  { name: 'Pistachios Salted', cat: 'Dry Fruits', baseRate: 1100 },
  { name: 'Walnuts Shell', cat: 'Dry Fruits', baseRate: 600 },
  { name: 'Dates Premium', cat: 'Dry Fruits', baseRate: 400 },
]

// ── Customer Names ──────────────────────────────────────────────────────────
const FIRST_NAMES = ['Aarav', 'Vihaan', 'Aditya', 'Sai', 'Arjun', 'Ananya', 'Diya', 'Kavya', 'Sanya', 'Neha', 'Rahul', 'Rohan', 'Amit', 'Priya', 'Sneha', 'Vikram', 'Raj', 'Sanjay', 'Meera', 'Kiran']
const LAST_NAMES = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Reddy', 'Rao', 'Nair', 'Das', 'Joshi', 'Menon', 'Verma', 'Chopra', 'Iyer', 'Pillai']

function generatePhone(): string {
  return '9' + Array.from({ length: 9 }).map(() => randomInt(0, 9)).join('')
}

export async function seedDemoData(db: BetterSQLite3Database<typeof schema>): Promise<void> {
  const isSeeded = await db.query.settings.findFirst({ where: (s, { eq }) => eq(s.key, 'demo_seeded') })
  if (isSeeded?.value === 'true') return

  console.log('Seeding realistic demo data (2025-06-13 to 2026-06-13)...')
  const startTime = Date.now()

  // Find admin user to attribute actions
  const adminUser = await db.query.users.findFirst()
  const userId = adminUser ? adminUser.id : 1

  await db.transaction(async (tx) => {
    // 1. Categories
    const catIdMap = new Map<string, number>()
    for (const cName of CATEGORIES) {
      const res = await tx.insert(schema.categories).values({ name: cName }).returning({ id: schema.categories.id })
      catIdMap.set(cName, res[0].id)
    }

    // 2. Products & Variants & Prices
    const allVariants: { id: number, productId: number, weightGrams: number, initialPrice: number }[] = []
    const allProducts: { id: number, name: string, unitType: string, wholesaleRate: number }[] = []

    for (const pdef of PRODUCTS_DEF) {
      const unitType = pdef.cat === 'Oils' ? 'volume' : 'weight'
      const pres = await tx.insert(schema.products).values({
        name: pdef.name,
        categoryId: catIdMap.get(pdef.cat)!,
        wholesaleRatePerKgPaise: pdef.baseRate * 100,
        bulkLowStockGrams: randomInt(2000, 10000),
        unitType
      }).returning({ id: schema.products.id })
      const productId = pres[0].id
      allProducts.push({ id: productId, name: pdef.name, unitType, wholesaleRate: pdef.baseRate * 100 })

      // Init Bulk Stock
      await tx.insert(schema.bulkStock).values({ productId, qtyGrams: 0, avgCostPerKg: null })

      // Variants
      const weights = unitType === 'volume' ? [200, 500, 1000] : [100, 250, 500, 1000]
      for (const w of weights) {
        const label = w >= 1000 ? `${w / 1000}${unitType === 'volume' ? 'L' : 'kg'}` : `${w}${unitType === 'volume' ? 'ml' : 'g'}`
        const vres = await tx.insert(schema.productVariants).values({
          productId,
          label,
          weightGrams: w,
          barcode: `${randomString(4)}${productId}${w}`,
          retailLowStockPcs: randomInt(5, 20)
        }).returning({ id: schema.productVariants.id })
        
        const vId = vres[0].id
        await tx.insert(schema.retailPacketStock).values({ variantId: vId, qtyPcs: 0, avgCostPerPc: null })

        // Initial Price (Retail is ~40% markup on wholesale pro-rata)
        const proRataCost = pdef.baseRate * (w / 1000)
        const retailPrice = Math.round(proRataCost * 1.4) * 100
        const wholesalePrice = Math.round(proRataCost * 1.1) * 100

        await tx.insert(schema.priceMenuEntries).values({
          variantId: vId,
          retailPricePaise: retailPrice,
          wholesalePricePaise: wholesalePrice,
          effectiveDate: '2025-06-13'
        })

        allVariants.push({ id: vId, productId, weightGrams: w, initialPrice: retailPrice })
      }
    }

    // 3. Customers & Parties
    const retailCustomerIds: number[] = []
    for (let i = 0; i < 500; i++) {
      const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
      const res = await tx.insert(schema.customers).values({
        type: 'retail', name, phone: generatePhone()
      }).returning({ id: schema.customers.id })
      retailCustomerIds.push(res[0].id)
    }

    const wholesaleParties: number[] = []
    for (let i = 0; i < 50; i++) {
      const name = `${pick(LAST_NAMES)} Traders`
      const res = await tx.insert(schema.customers).values({
        type: 'wholesale', name, businessName: name, phone: generatePhone(), gstNo: `29${randomString(10)}1Z5`
      }).returning({ id: schema.customers.id })
      wholesaleParties.push(res[0].id)
    }

    const suppliers: number[] = []
    for (let i = 0; i < 15; i++) {
      const name = `${pick(FIRST_NAMES)} Agri Suppliers`
      const res = await tx.insert(schema.suppliers).values({ name, phone: generatePhone() }).returning({ id: schema.suppliers.id })
      suppliers.push(res[0].id)
    }

    console.log('Catalog and Customers created. Starting 365-day loop...')

    // Tracking state for the loop
    const bulkInv = new Map<number, { qty: number, avgCost: number | null }>()
    for (const p of allProducts) bulkInv.set(p.id, { qty: 0, avgCost: null })
    const packetInv = new Map<number, { qty: number, avgCost: number | null }>()
    for (const v of allVariants) packetInv.set(v.id, { qty: 0, avgCost: null })
    const custCredit = new Map<number, number>()
    for (const w of wholesaleParties) custCredit.set(w, 0)

    let invoiceCounter = 1000

    // 365 days loop
    const startDate = new Date('2025-06-13T09:00:00Z')
    
    for (let day = 0; day <= 365; day++) {
      const currentDate = new Date(startDate.getTime() + day * 86400000)
      const dateStr = currentDate.toISOString().slice(0, 10)
      const bDate = businessDate(currentDate)

      // A0. Weekly price fluctuations (every 7 days)
      if (day > 0 && day % 7 === 0) {
        for (const v of allVariants) {
          // 50% chance for this product variant to fluctuate this week
          if (randomInt(1, 100) > 50) {
            const currentRetail = v.initialPrice
            const changePercent = randomInt(2, 8) / 100
            const sign = randomInt(0, 1) === 0 ? 1 : -1
            const newPrice = Math.round(currentRetail * (1 + (changePercent * sign)))
            const oldPrice = currentRetail

            await tx.insert(schema.priceHistory).values({
              targetType: 'variant_retail',
              targetId: v.id,
              oldPricePaise: oldPrice,
              newPricePaise: newPrice,
              changedAt: currentDate,
              userId
            })
            await tx.update(schema.priceMenuEntries)
              .set({ retailPricePaise: newPrice, effectiveDate: dateStr })
              .where(eq(schema.priceMenuEntries.variantId, v.id))
            
            // update initialPrice so future weeks base on this
            v.initialPrice = newPrice
          }
        }
      }

      // A. Bulk Arrivals (approx 150 per year total => ~0.4 per day)
      if (randomInt(1, 10) <= 4) {
        const prod = pick(allProducts)
        const isCosted = randomInt(1, 100) > 15
        const qtyGrams = randomInt(100, 2000) * 1000 // 100kg to 2000kg
        
        // Cost fluctuates ±10% around wholesale rate
        const costPerKg = isCosted ? Math.round(prod.wholesaleRate * (1 + (randomInt(-10, 10) / 100))) : null
        
        await tx.insert(schema.bulkArrivals).values({
          productId: prod.id,
          date: dateStr,
          qtyGrams,
          costPerKgPaise: costPerKg,
          totalAmountPaise: costPerKg ? Math.round((qtyGrams/1000) * costPerKg) : null,
          createdAt: currentDate
        })

        const state = bulkInv.get(prod.id)!
        const newAvg = (isCosted && costPerKg !== null) 
          ? blendCost(state.qty / 1000, state.avgCost, qtyGrams / 1000, costPerKg / 100) 
          : state.avgCost
        
        state.qty += qtyGrams
        state.avgCost = newAvg
      }

      // B. Packing Runs (approx 4 per day)
      for (let i = 0; i < 4; i++) {
        const prod = pick(allProducts)
        const state = bulkInv.get(prod.id)!
        if (state.qty > 50000) { // At least 50kg to pack
          const vars = allVariants.filter(v => v.productId === prod.id)
          const targetVar = pick(vars)
          const packPcs = randomInt(50, 200)
          const usedGrams = packPcs * targetVar.weightGrams
          
          if (state.qty >= usedGrams) {
            const runRes = await tx.insert(schema.packingRuns).values({
              date: dateStr, productId: prod.id, bulkUsedGrams: usedGrams, userId, createdAt: currentDate
            }).returning({ id: schema.packingRuns.id })
            
            const pCost = state.avgCost !== null ? (state.avgCost * (targetVar.weightGrams / 1000)) : null
            
            await tx.insert(schema.packingRunLines).values({
              packingRunId: runRes[0].id,
              variantId: targetVar.id,
              packetsCount: packPcs,
              unitCostAtPack: pCost
            })

            state.qty -= usedGrams
            const pState = packetInv.get(targetVar.id)!
            pState.avgCost = pCost !== null ? blendCost(pState.qty, pState.avgCost, packPcs, pCost) : pState.avgCost
            pState.qty += packPcs
          }
        }
      }

      // C. Expenses (2-5 per day)
      const numExp = randomInt(2, 5)
      for (let i = 0; i < numExp; i++) {
        const cat = pick(['Rent', 'Utilities', 'Salary', 'Packaging', 'Transport', 'Maintenance', 'Other'])
        await tx.insert(schema.expenses).values({
          date: dateStr, category: cat, amountPaise: randomInt(100, 5000) * 100, createdAt: currentDate
        })
      }

      // D. Retail Invoices (5-15 per day)
      const numRet = randomInt(5, 15)
      for (let i = 0; i < numRet; i++) {
        const lineCount = randomInt(1, 6)
        let subtotal = 0
        const linesToInsert: any[] = []
        
        for (let l = 0; l < lineCount; l++) {
          const v = pick(allVariants)
          const qty = randomInt(1, 4)
          // We assume price hasn't fluctuated for simplicity in the loop (to keep it fast), just use initial
          const unitPrice = v.initialPrice 
          const lTotal = unitPrice * qty
          subtotal += lTotal
          const pState = packetInv.get(v.id)!
          pState.qty -= qty // allow negative for demo
          
          linesToInsert.push({
            itemType: 'packet', variantId: v.id, productId: v.productId,
            qty, unit: 'pcs', unitPricePaise: unitPrice, lineTotalPaise: lTotal,
            unitCostSnapshot: pState.avgCost,
            lineProfitPaise: pState.avgCost ? lTotal - Math.round(pState.avgCost * qty * 100) : null
          })
        }

        const discount = randomInt(0, 10) === 0 ? randomInt(10, 50) * 100 : 0
        const total = Math.max(0, subtotal - discount)
        const pModeRand = randomInt(1, 100)
        let pMode = 'cash'
        let pSplit: string | null = null
        if (pModeRand > 50 && pModeRand <= 75) pMode = 'upi'
        else if (pModeRand > 75 && pModeRand <= 90) pMode = 'card'
        else if (pModeRand > 90) {
          pMode = 'split'
          pSplit = JSON.stringify([{ mode: 'cash', amount: Math.round(total / 2) }, { mode: 'upi', amount: total - Math.round(total / 2) }])
        }

        const isCust = randomInt(1, 100) <= 40
        const cId = isCust ? pick(retailCustomerIds) : null

        invoiceCounter++
        const invRes = await tx.insert(schema.invoices).values({
          invoiceNo: `R-${dateStr.replace(/-/g, '')}-${invoiceCounter}`,
          createdAt: currentDate, invoiceDatetime: currentDate, businessDate: bDate,
          type: 'retail', customerId: cId, subtotalPaise: subtotal, discountPaise: discount,
          totalPaise: total, paymentMode: pMode, amountPaidPaise: total, balanceDuePaise: 0,
          userId, paymentSplit: pSplit
        }).returning({ id: schema.invoices.id })

        for (const line of linesToInsert) {
          line.invoiceId = invRes[0].id
        }
        await tx.insert(schema.invoiceLines).values(linesToInsert)
      }

      // E. Wholesale Invoices (1-3 per day)
      const numWh = randomInt(1, 3)
      for (let i = 0; i < numWh; i++) {
        const lineCount = randomInt(1, 5)
        let subtotal = 0
        const linesToInsert: any[] = []
        
        for (let l = 0; l < lineCount; l++) {
          const isBulk = randomInt(0, 1) === 0
          if (isBulk) {
            const p = pick(allProducts)
            const qtyGrams = randomInt(2, 20) * 1000
            const unitPrice = p.wholesaleRate
            const lTotal = Math.round((qtyGrams/1000) * unitPrice)
            subtotal += lTotal
            const bState = bulkInv.get(p.id)!
            bState.qty -= qtyGrams
            
            linesToInsert.push({
              itemType: 'loose_bulk', productId: p.id, qty: qtyGrams, unit: 'grams',
              unitPricePaise: unitPrice, lineTotalPaise: lTotal, unitCostSnapshot: bState.avgCost,
              lineProfitPaise: bState.avgCost ? lTotal - Math.round((qtyGrams/1000) * bState.avgCost * 100) : null
            })
          } else {
            const v = pick(allVariants)
            const qty = randomInt(10, 50)
            const unitPrice = Math.round(v.initialPrice * 0.8) // Wholesale is cheaper
            const lTotal = unitPrice * qty
            subtotal += lTotal
            const pState = packetInv.get(v.id)!
            pState.qty -= qty
            
            linesToInsert.push({
              itemType: 'packet', variantId: v.id, productId: v.productId, qty, unit: 'pcs',
              unitPricePaise: unitPrice, lineTotalPaise: lTotal, unitCostSnapshot: pState.avgCost,
              lineProfitPaise: pState.avgCost ? lTotal - Math.round(pState.avgCost * qty * 100) : null
            })
          }
        }

        const total = subtotal
        const wCustId = pick(wholesaleParties)
        
        const pModeRand = randomInt(1, 100)
        let pMode = 'cash'
        let paid = total
        let due = 0
        if (pModeRand > 35 && pModeRand <= 55) pMode = 'upi'
        else if (pModeRand > 55 && pModeRand <= 80) { pMode = 'credit'; paid = 0; due = total }
        else if (pModeRand > 80 && pModeRand <= 90) { pMode = 'partial'; paid = Math.round(total / 2); due = total - paid }
        else { pMode = 'split' } // simplified for demo, treat split as fully paid here

        invoiceCounter++
        const invRes = await tx.insert(schema.invoices).values({
          invoiceNo: `W-${dateStr.replace(/-/g, '')}-${invoiceCounter}`,
          createdAt: currentDate, invoiceDatetime: currentDate, businessDate: bDate,
          type: 'wholesale', customerId: wCustId, subtotalPaise: subtotal, discountPaise: 0,
          totalPaise: total, paymentMode: pMode, amountPaidPaise: paid, balanceDuePaise: due,
          userId
        }).returning({ id: schema.invoices.id })

        for (const line of linesToInsert) {
          line.invoiceId = invRes[0].id
        }
        await tx.insert(schema.invoiceLines).values(linesToInsert)

        if (due > 0) {
          const curr = custCredit.get(wCustId)!
          custCredit.set(wCustId, curr + due)
          // Randomly they might pay off some credit today
          if (randomInt(1, 10) > 7 && curr > 0) {
            const payAmt = Math.min(curr, randomInt(1000, 5000) * 100)
            await tx.insert(schema.payments).values({
              customerId: wCustId, date: dateStr, amountPaise: payAmt, mode: 'upi', createdAt: currentDate
            })
            custCredit.set(wCustId, custCredit.get(wCustId)! - payAmt)
          }
        }
      }
    }

    // Write final states to stock tables and customers
    console.log('Writing final states...')
    for (const [pId, st] of bulkInv.entries()) {
      await tx.update(schema.bulkStock).set({ qtyGrams: st.qty, avgCostPerKg: st.avgCost }).where(eq(schema.bulkStock.productId, pId))
    }
    for (const [vId, st] of packetInv.entries()) {
      await tx.update(schema.retailPacketStock).set({ qtyPcs: st.qty, avgCostPerPc: st.avgCost }).where(eq(schema.retailPacketStock.variantId, vId))
    }
    for (const [cId, bal] of custCredit.entries()) {
      if (bal > 0) {
        await tx.update(schema.customers).set({ creditBalancePaise: bal }).where(eq(schema.customers.id, cId))
      }
    }

    // Finalize seed
    await tx.insert(schema.settings).values({ key: 'demo_seeded', value: 'true' })
    console.log(`Demo data seeded successfully in ${Date.now() - startTime}ms!`)
  })
}

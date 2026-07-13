// src/main/db/schema.ts — full schema per data_model.md
// Storage rules: money=INTEGER paise, weight=INTEGER grams, pieces=INTEGER
// The ONLY floats: avg_cost_per_kg, avg_cost_per_pc, unit_cost_snapshot (REAL, nullable)

import { sqliteTable, integer, text, real, uniqueIndex } from 'drizzle-orm/sqlite-core'
import * as crypto from 'crypto'

// ── Categories ───────────────────────────────────────────────────────────────

export const categories = sqliteTable('categories', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  name: text('name').notNull()
})

// ── Products ─────────────────────────────────────────────────────────────────

export const products = sqliteTable('products', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  name: text('name').notNull(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  bulkLowStockGrams: integer('bulk_low_stock_grams').notNull().default(1000),
  wholesaleRatePerKgPaise: integer('wholesale_rate_per_kg_paise').notNull().default(0),
  unitType: text('unit_type').notNull().default('weight') // 'weight' (g/kg) | 'volume' (ml/L)
})

// ── Product Variants ──────────────────────────────────────────────────────────

export const productVariants = sqliteTable('product_variants', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  label: text('label').notNull(),
  weightGrams: integer('weight_grams').notNull(),
  barcode: text('barcode').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  retailLowStockPcs: integer('retail_low_stock_pcs').notNull().default(5)
}, (t) => [uniqueIndex('product_variants_barcode_idx').on(t.barcode)])

// ── Bulk Stock (current snapshot per product) ─────────────────────────────────

export const bulkStock = sqliteTable('bulk_stock', {
  productId: text('product_id').primaryKey().references(() => products.id),
  qtyGrams: integer('qty_grams').notNull().default(0),
  avgCostPerKg: real('avg_cost_per_kg') // REAL rupees, nullable
})

// ── Bulk Arrivals ─────────────────────────────────────────────────────────────

export const bulkArrivals = sqliteTable('bulk_arrivals', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  date: text('date').notNull(), // 'YYYY-MM-DD'
  qtyGrams: integer('qty_grams').notNull(),
  costPerKgPaise: integer('cost_per_kg_paise'), // nullable — blank cost allowed
  totalAmountPaise: integer('total_amount_paise'), // nullable
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

// ── Bulk Adjustments ─────────────────────────────────────────────────────────

export const bulkAdjustments = sqliteTable('bulk_adjustments', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  productId: text('product_id').notNull().references(() => products.id),
  date: text('date').notNull(),
  qtyChangeGrams: integer('qty_change_grams').notNull(), // signed
  reason: text('reason').notNull(),
  notes: text('notes'),
  userId: text('user_id').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

// ── Packing Runs ──────────────────────────────────────────────────────────────

export const packingRuns = sqliteTable('packing_runs', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  date: text('date').notNull(),
  productId: text('product_id').notNull().references(() => products.id),
  bulkUsedGrams: integer('bulk_used_grams').notNull(),
  userId: text('user_id').notNull().references(() => users.id),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

export const packingRunLines = sqliteTable('packing_run_lines', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  packingRunId: text('packing_run_id').notNull().references(() => packingRuns.id),
  variantId: text('variant_id').notNull().references(() => productVariants.id),
  packetsCount: integer('packets_count').notNull(),
  unitCostAtPack: real('unit_cost_at_pack') // REAL rupees, nullable
})

// ── Retail Packet Stock ───────────────────────────────────────────────────────

export const retailPacketStock = sqliteTable('retail_packet_stock', {
  variantId: text('variant_id').primaryKey().references(() => productVariants.id),
  qtyPcs: integer('qty_pcs').notNull().default(0),
  avgCostPerPc: real('avg_cost_per_pc') // REAL rupees, nullable
})

// ── Retail Adjustments ────────────────────────────────────────────────────────

export const retailAdjustments = sqliteTable('retail_adjustments', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  variantId: text('variant_id').notNull().references(() => productVariants.id),
  date: text('date').notNull(),
  qtyChangePcs: integer('qty_change_pcs').notNull(), // signed
  reason: text('reason').notNull(), // manual/damage/wastage
  notes: text('notes'),
  userId: text('user_id').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

// ── Price Menu ────────────────────────────────────────────────────────────────

export const priceMenuEntries = sqliteTable('price_menu_entries', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  variantId: text('variant_id').notNull().references(() => productVariants.id),
  retailPricePaise: integer('retail_price_paise').notNull(),
  wholesalePricePaise: integer('wholesale_price_paise').notNull(),
  effectiveDate: text('effective_date').notNull() // 'YYYY-MM-DD'
})

export const priceHistory = sqliteTable('price_history', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  targetType: text('target_type').notNull(), // variant_retail|variant_wholesale|product_loose
  targetId: text('target_id').notNull(),
  oldPricePaise: integer('old_price_paise').notNull(),
  newPricePaise: integer('new_price_paise').notNull(),
  changedAt: integer('changed_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  userId: text('user_id').notNull().references(() => users.id)
})

// ── Customers / Parties ───────────────────────────────────────────────────────

export const customers = sqliteTable('customers', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  type: text('type').notNull(), // retail|wholesale
  name: text('name').notNull(),
  businessName: text('business_name'),
  phone: text('phone'),
  address: text('address'),
  gstNo: text('gst_no'), // text only, no tax math
  creditBalancePaise: integer('credit_balance_paise').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

// ── Invoices ──────────────────────────────────────────────────────────────────

export const invoices = sqliteTable('invoices', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  invoiceNo: text('invoice_no').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()), // IMMUTABLE
  invoiceDatetime: integer('invoice_datetime', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  businessDate: text('business_date').notNull(), // 'YYYY-MM-DD', snapshotted
  type: text('type').notNull(), // retail|wholesale
  customerId: text('customer_id').references(() => customers.id),
  subtotalPaise: integer('subtotal_paise').notNull(),
  discountPaise: integer('discount_paise').notNull().default(0),
  totalPaise: integer('total_paise').notNull(),
  paymentMode: text('payment_mode').notNull(), // cash|upi|card|split|credit|partial
  amountPaidPaise: integer('amount_paid_paise').notNull(),
  balanceDuePaise: integer('balance_due_paise').notNull().default(0),
  status: text('status').notNull().default('active'), // active|void
  userId: text('user_id').notNull().references(() => users.id),
  paymentSplit: text('payment_split') // nullable JSON: [{mode,amount},...] for split payments
})

export const invoiceLines = sqliteTable('invoice_lines', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  itemType: text('item_type').notNull(), // packet|loose_bulk
  variantId: text('variant_id').references(() => productVariants.id),
  productId: text('product_id').references(() => products.id),
  qty: integer('qty').notNull(), // pcs or grams depending on item_type
  unit: text('unit').notNull(), // pcs|grams
  unitPricePaise: integer('unit_price_paise').notNull(),
  lineTotalPaise: integer('line_total_paise').notNull(),
  unitCostSnapshot: real('unit_cost_snapshot'), // REAL rupees, nullable
  lineProfitPaise: integer('line_profit_paise') // INTEGER paise, nullable
})

export const invoiceDatetimeEditLog = sqliteTable('invoice_datetime_edit_log', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  oldDatetime: integer('old_datetime', { mode: 'timestamp' }).notNull(),
  newDatetime: integer('new_datetime', { mode: 'timestamp' }).notNull(),
  editedBy: text('edited_by').notNull().references(() => users.id),
  editedAt: integer('edited_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

// ── Payments ──────────────────────────────────────────────────────────────────

export const payments = sqliteTable('payments', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  invoiceId: text('invoice_id').references(() => invoices.id),
  date: text('date').notNull(),
  amountPaise: integer('amount_paise').notNull(),
  mode: text('mode').notNull(),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

// ── Suppliers & Purchases ─────────────────────────────────────────────────────

export const suppliers = sqliteTable('suppliers', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  name: text('name').notNull(),
  phone: text('phone')
})

export const purchaseEntries = sqliteTable('purchase_entries', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  supplierId: text('supplier_id').references(() => suppliers.id),
  date: text('date').notNull(),
  itemName: text('item_name').notNull(),
  qty: integer('qty').notNull(),
  amountPaise: integer('amount_paise').notNull(),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

// ── Expenses ──────────────────────────────────────────────────────────────────

export const expenses = sqliteTable('expenses', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  date: text('date').notNull(),
  category: text('category').notNull(),
  amountPaise: integer('amount_paise').notNull(),
  paymentMode: text('payment_mode').notNull().default('cash'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

// ── Label Print Log ───────────────────────────────────────────────────────────

export const labelPrintLog = sqliteTable('label_print_log', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  date: text('date').notNull(),
  variantId: text('variant_id').notNull().references(() => productVariants.id),
  qty: integer('qty').notNull(),
  pricePrintedPaise: integer('price_printed_paise').notNull(),
  type: text('type').notNull(), // after_pack|reprice|reprint
  userId: text('user_id').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

// ── Users ─────────────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(), // admin|staff
  pinHash: text('pin_hash').notNull()
})

// ── Settings ──────────────────────────────────────────────────────────────────

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
})

// ── Backup Log ────────────────────────────────────────────────────────────────

export const backupLog = sqliteTable('backup_log', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  date: integer('date', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  type: text('type').notNull(), // manual|auto|pre-restore
  filePath: text('file_path').notNull()
})

// ── Sync Queue & Log ──────────────────────────────────────────────────────────

export const syncQueue = sqliteTable('sync_queue', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  tableName: text('table_name').notNull(),
  recordId: text('record_id').notNull(),
  operation: text('operation').notNull(), // upsert|delete
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  status: text('status').notNull().default('pending') // pending|failed
})

export const syncLog = sqliteTable('sync_log', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  syncedAt: integer('synced_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  recordsPushed: integer('records_pushed').notNull(),
  recordsFailed: integer('records_failed').notNull()
})

// ── Phase 0 ping_log (kept for migration continuity) ─────────────────────────

export const pingLog = sqliteTable('ping_log', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  value: text('value').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

// ── Factory ───────────────────────────────────────────────────────────────────

export const factoryItems = sqliteTable('factory_items', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'raw_material' | 'final_product'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

export const factoryTransactions = sqliteTable('factory_transactions', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  itemId: text('item_id').notNull().references(() => factoryItems.id),
  type: text('type').notNull(), // 'purchase' | 'sale'
  date: text('date').notNull(),
  qtyKg: real('qty_kg').notNull(),
  amountPaise: integer('amount_paise').notNull(),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
})

// shared/types.ts — IPC contract types shared by main, preload, and renderer.
// Only plain serializable objects — no Node/Electron imports.

// ── Ping (Phase 0 smoke test) ─────────────────────────────────────────────────

export interface PingRequest {
  value: string
}

export interface PingResponse {
  stored: string
  echo: string
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  username: string
  pin: string
}

/** Safe user object — no pin_hash, no raw PIN */
export interface AuthUser {
  id: string
  name: string
  role: 'admin' | 'staff'
}

export type LoginResponse =
  | { ok: true; user: AuthUser }
  | { ok: false; error: string }

// ── Generic result wrapper ─────────────────────────────────────────────────────

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

// ── Products ──────────────────────────────────────────────────────────────────

export interface Category {
  id: string
  name: string
}

export interface ProductVariant {
  id: string
  productId: string
  label: string
  weightGrams: number
  barcode: string
  enabled: boolean
  retailLowStockPcs: number
}

export interface Product {
  id: string
  name: string
  categoryId: string
  categoryName: string
  enabled: boolean
  bulkLowStockGrams: number
  wholesaleRatePerKgPaise: number
  unitType: 'weight' | 'volume'
  variants: ProductVariant[]
}

export interface CreateCategoryRequest {
  name: string
}

export interface CreateProductRequest {
  name: string
  categoryId: string
  bulkLowStockGrams: number
  wholesaleRatePerKgPaise: number
  enabled: boolean
  unitType?: 'weight' | 'volume'
}

export interface CreateVariantRequest {
  productId: string
  label: string
  weightGrams: number
  barcode: string
  retailLowStockPcs: number
  enabled: boolean
}

export interface UpdateProductRequest {
  id: string
  name?: string
  categoryId?: string
  bulkLowStockGrams?: number
  wholesaleRatePerKgPaise?: number
  unitType?: 'weight' | 'volume'
}

export interface UpdateVariantRequest {
  id: string
  label?: string
  weightGrams?: number
  barcode?: string
  retailLowStockPcs?: number
}

// ── Pricing ───────────────────────────────────────────────────────────────────

export interface PriceMenuEntry {
  id: string
  variantId: string
  retailPricePaise: number
  wholesalePricePaise: number
  effectiveDate: string
}

export interface PriceHistoryRow {
  id: string
  targetType: string
  targetId: string
  oldPricePaise: number
  newPricePaise: number
  changedAt: number // unix ms
  userId: string
}

export interface SetVariantPriceRequest {
  variantId: string
  retailPricePaise: number
  wholesalePricePaise: number
  effectiveDate: string
  userId: string
}

export interface SetProductLooseRateRequest {
  productId: string
  wholesaleRatePerKgPaise: number
  userId: string
}

export interface GetCurrentPriceRequest {
  variantId: string
  date?: string // 'YYYY-MM-DD', defaults to today
}

// ── Bulk Inventory ────────────────────────────────────────────────────────────

export interface BulkStockRow {
  productId: string
  qtyGrams: number
  avgCostPerKg: number | null // REAL rupees, nullable — never shown to staff
}

export interface BulkArrivalRow {
  id: string
  productId: string
  date: string
  qtyGrams: number
  costPerKgPaise: number | null // nullable
  notes: string | null
  createdAt: number // unix ms
}

export interface BulkAdjustmentRow {
  id: string
  productId: string
  date: string
  qtyChangeGrams: number // signed
  reason: string
  notes: string | null
  userId: string
  createdAt: number
}

export interface RecordBulkArrivalRequest {
  productId: string
  qtyGrams: number
  date: string
  costPerKgPaise?: number | null // Admin only — handler enforces this
  notes?: string
  userId: string
}

export interface RecordBulkAdjustmentRequest {
  productId: string
  qtyChangeGrams: number // signed
  reason: string
  notes?: string
  userId: string
}

// ── Packing ───────────────────────────────────────────────────────────────────

export interface PackingLine {
  variantId: string
  packetsCount: number
}

export interface ValidatePackingRunRequest {
  productId: string
  lines: PackingLine[]
}

export type ValidatePackingRunResult =
  | { ok: true; totalGrams: number; bulkAvailableGrams: number }
  | { ok: false; error: string }

export interface CommitPackingRunRequest {
  productId: string
  lines: PackingLine[]
  notes?: string
  userId: string
}

export interface PackingRunLineRow {
  id: string
  variantId: string
  packetsCount: number
  unitCostAtPack: number | null // REAL rupees
}

export interface PackingRunRow {
  id: string
  date: string
  productId: string
  bulkUsedGrams: number
  userId: string
  notes: string | null
  createdAt: number
  lines: PackingRunLineRow[]
}

// ── Retail Packet Inventory ───────────────────────────────────────────────────

export interface RetailStockRow {
  variantId: string
  qtyPcs: number
  avgCostPerPc: number | null // REAL rupees, nullable — Admin only
}

export interface RetailMovementRow {
  date: string
  type: 'packing' | 'adjustment' | 'sale'
  qtyChange: number // positive = in, negative = out
  reference: string // e.g. "Run #3", "Adj #7", "Invoice #INV-001"
}

export interface RecordRetailAdjustmentRequest {
  variantId: string
  qtyChangePcs: number // signed
  reason: 'manual' | 'damage' | 'wastage'
  notes?: string
  userId: string
}

// ── Labels ────────────────────────────────────────────────────────────────────

export interface PrintLabelsRequest {
  variantId: string
  qty: number
  type: 'after_pack' | 'reprice' | 'reprint'
  userId: string
  dateStr?: string
  customProductName?: string
}

export interface LabelPrintLogRow {
  id: string
  date: string
  variantId: string
  qty: number
  pricePrintedPaise: number
  type: string
  userId: string
  createdAt: number
}

// ── Billing ───────────────────────────────────────────────────────────────────

export interface BillLine {
  variantId: string
  qtyPcs: number
  unitPricePaise: number // from Price Menu, re-verified server-side
}

export interface CreateRetailSaleRequest {
  lines: BillLine[]
  discountPaise: number
  paymentMode: 'cash' | 'upi' | 'card' | 'split' | 'credit'
  amountPaidPaise: number
  customerName?: string
  customerPhone?: string
  customerId?: string
  userId: string
  paymentSplit?: Array<{ mode: string; amount: number }>
}

export interface SavedInvoiceLine {
  id: string
  variantId: string
  label: string
  productName: string
  qtyPcs: number
  unitPricePaise: number
  lineTotalPaise: number
  lineProfitPaise: number | null
}

export interface SavedInvoice {
  id: string
  invoiceNo: string
  businessDate: string
  invoiceDatetime: number // unix ms
  subtotalPaise: number
  discountPaise: number
  totalPaise: number
  paymentMode: string
  amountPaidPaise: number
  balanceDuePaise: number
  customerId: string | null
  lines: SavedInvoiceLine[]
}

export interface BarcodeResult {
  variantId: string
  productId: string
  label: string
  productName: string
  weightGrams: number
  currentRetailPricePaise: number
}

// ── Wholesale Billing ─────────────────────────────────────────────────────────

export interface WholesaleLine {
  itemType: 'packet' | 'loose_bulk'
  variantId?: string   // required for packet
  productId?: string   // required for loose_bulk
  qty: number          // pcs for packet, grams for loose_bulk
  unit: 'pcs' | 'grams'
  unitPricePaise: number // wholesale price; editable for loose
}

export interface CreateWholesaleSaleRequest {
  lines: WholesaleLine[]
  discountPaise: number
  paymentMode: 'cash' | 'upi' | 'card' | 'split' | 'credit' | 'partial'
  amountPaidPaise: number
  partyId?: string
  partyName?: string
  partyPhone?: string
  userId: string
  paymentSplit?: Array<{ mode: string; amount: number }>
}

export interface UpdateInvoiceDetailsRequest {
  invoiceId: string
  userId: string
  newDatetime?: number       // unix ms — triggers edit log
  amountPaidPaise?: number
  customerId?: string | null  // null = unlink
  customerName?: string
  customerPhone?: string
}

export interface RecordPartyPaymentRequest {
  customerId: string
  amountPaise: number
  mode: string
  date?: string
  notes?: string
  userId: string
}

// ── Customers & Parties ───────────────────────────────────────────────────────

export interface CustomerRow {
  id: string
  type: 'retail' | 'wholesale'
  name: string
  businessName: string | null
  phone: string | null
  address: string | null
  gstNo: string | null // text only — no tax math (rules.md #10)
  creditBalancePaise: number
}

export interface PaymentRow {
  id: string
  customerId: string
  invoiceId: string | null
  date: string
  amountPaise: number
  mode: string
  notes: string | null
  createdAt: number
}

export interface CreateCustomerRequest {
  type: 'retail' | 'wholesale'
  name: string
  businessName?: string
  phone?: string
  address?: string
  gstNo?: string
  userId: string
}

export interface UpdateCustomerRequest {
  id: string
  name?: string
  phone?: string
  address?: string
  gstNo?: string
  userId: string
}

// ── Purchases & Expenses ──────────────────────────────────────────────────────

export interface SupplierRow {
  id: string
  name: string
  phone: string | null
}

export interface PurchaseEntryRow {
  id: string
  supplierId: string | null
  date: string
  itemName: string
  qty: number
  amountPaise: number
  notes: string | null
  createdAt: number
}

export interface ExpenseRow {
  id: string
  date: string
  category: string
  amountPaise: number
  paymentMode: string
  notes: string | null
  createdAt: number
}

export interface RecordPurchaseRequest {
  supplierId?: string
  itemName: string
  qty: number
  amountPaise: number
  date: string
  notes?: string
  userId: string
}

export interface RecordExpenseRequest {
  date: string
  category: string
  amountPaise: number
  paymentMode: 'cash' | 'upi' | 'card'
  notes?: string
  userId: string
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface DateRange {
  dateFrom: string // YYYY-MM-DD
  dateTo: string
}

export interface DailySalesRow {
  businessDate: string
  retailTotalPaise: number
  wholesaleTotalPaise: number
  combinedTotalPaise: number
  invoiceCount: number
}

export interface SalesByProductRow {
  productId: string
  productName: string
  qtyGrams: number    // loose sales
  qtyPcs: number      // packet sales
  revenuePaise: number
}

export interface SalesByVariantRow {
  variantId: string
  label: string
  productName: string
  qtyPcs: number
  revenuePaise: number
}

export interface InventoryReportRow {
  type: 'bulk' | 'packet'
  productId?: string
  variantId?: string
  name: string
  qty: number       // grams or pcs
  avgCost: number | null // REAL rupees — Admin only
  unitType: 'weight' | 'volume'
}

export interface LowStockRow {
  type: 'bulk' | 'packet'
  name: string
  qtyAvailable: number
  threshold: number
  unitType: 'weight' | 'volume'
}

export interface PackingReportRun {
  id: string
  date: string
  productName: string
  bulkUsedGrams: number
  unitType: 'weight' | 'volume'
  lines: Array<{ label: string; packetsCount: number }>
}

export interface ProfitReportRow {
  businessDate: string
  totalProfitPaise: number   // sum of known-cost lines only
  nullCostLineCount: number  // lines excluded from total
}

export interface DuesRow {
  customerId: string
  name: string
  businessName: string | null
  creditBalancePaise: number
  type: string
}

export interface ExpensesSummaryRow {
  date: string
  category: string
  amountPaise: number
}

export interface RepaymentReportRow {
  id: string
  customerId: string
  customerName: string
  date: string
  amountPaise: number
  mode: string
  notes: string | null
}

export interface PaymentBreakdownRow {
  cash: number
  upi: number
  card: number
  credit: number  // total_paise of credit invoices (not yet collected)
  creditRepaid: number // Cash/UPI/Card collected for PAST dues today
  repaidCash: number
  repaidUpi: number
  repaidCard: number
  cashCount: number
  upiCount: number
  cardCount: number
  creditCount: number
  total: number   // sum of amount_paid_paise from today + creditRepaid
}

// ── Invoice History ───────────────────────────────────────────────────────────

export interface InvoiceLineRow {
  id: string
  itemType: string
  variantId: string | null
  productId: string | null
  qty: number
  unit: string
  unitPricePaise: number
  lineTotalPaise: number
  lineProfitPaise: number | null
  variantLabel: string | null
  productName: string | null
}

export interface InvoiceRow {
  id: string
  invoiceNo: string
  createdAt: number
  invoiceDatetime: number
  businessDate: string
  type: string
  customerId: string | null
  customerName: string | null
  subtotalPaise: number
  discountPaise: number
  totalPaise: number
  paymentMode: string
  amountPaidPaise: number
  balanceDuePaise: number
  status: string
  paymentSplit: Array<{ mode: string; amount: number }> | null
  lines: InvoiceLineRow[]
}

export interface SearchInvoicesRequest {
  invoiceNo?: string
  customerId?: string
  dateFrom?: string   // filters by business_date
  dateTo?: string
  type?: 'retail' | 'wholesale'
  page?: number
  limit?: number
}

export interface SearchInvoicesResponse {
  invoices: InvoiceRow[]
  total: number
  page: number
  totalPages: number
}

export interface EditInvoiceDateTimeRequest {
  invoiceId: string
  newDatetime: number // unix ms
  userId: string
}

export interface EditLogRow {
  id: string
  invoiceId: string
  oldDatetime: number
  newDatetime: number
  editedBy: string
  editedAt: number
}

// ── Billing item lists (tile grid convenience) ────────────────────────────────

export interface RetailItemRow {
  variantId: string
  productName: string
  label: string
  weightGrams: number
  barcode: string
  retailPricePaise: number
  qtyPcs: number
}

export interface WholesaleItemRow {
  variantId: string
  productName: string
  label: string
  weightGrams: number
  barcode: string
  wholesalePricePaise: number
  qtyPcs: number
}

export interface LooseItemRow {
  productId: string
  productName: string
  wholesaleRatePerKgPaise: number
  qtyGrams: number
}

// ── Factory ───────────────────────────────────────────────────────────────────

export interface FactoryItem {
  id: string
  name: string
  type: 'raw_material' | 'final_product' | 'expense'
  createdAt: Date
}

export interface FactoryTransaction {
  id: string
  itemId: string
  type: 'purchase' | 'sale'
  date: string
  qtyKg: number
  amountPaise: number
  notes: string | null
  createdAt: Date
}

export interface CreateFactoryItemRequest {
  name: string
  type: 'raw_material' | 'final_product' | 'expense'
}

export interface CreateFactoryTransactionRequest {
  itemId: string
  type: 'purchase' | 'sale'
  date: string
  qtyKg: number
  amountPaise: number
  notes?: string
}

export interface FactoryProductionRunIngredient {
  id: string
  rawMaterialId: string
  rawMaterialName?: string
  qtyUsedKg: number
}

export interface FactoryProductionRun {
  id: string
  finalProductId: string
  finalProductName?: string
  date: string
  qtyProducedKg: number
  notes: string | null
  createdAt: Date
  ingredients?: FactoryProductionRunIngredient[]
}

export interface CreateFactoryProductionRunRequest {
  finalProductId: string
  date: string
  qtyProducedKg: number
  notes?: string
  ingredients: { rawMaterialId: string; qtyUsedKg: number }[]
}

export interface FactoryRawMaterialStock {
  itemId: string
  itemName: string
  purchasedKg: number
  consumedKg: number
  currentStockKg: number
}

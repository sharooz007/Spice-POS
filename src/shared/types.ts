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
  id: number
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
  id: number
  name: string
}

export interface ProductVariant {
  id: number
  productId: number
  label: string
  weightGrams: number
  barcode: string
  enabled: boolean
  retailLowStockPcs: number
}

export interface Product {
  id: number
  name: string
  categoryId: number
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
  categoryId: number
  bulkLowStockGrams: number
  wholesaleRatePerKgPaise: number
  enabled: boolean
  unitType?: 'weight' | 'volume'
}

export interface CreateVariantRequest {
  productId: number
  label: string
  weightGrams: number
  barcode: string
  retailLowStockPcs: number
  enabled: boolean
}

export interface UpdateProductRequest {
  id: number
  name?: string
  categoryId?: number
  bulkLowStockGrams?: number
  wholesaleRatePerKgPaise?: number
  unitType?: 'weight' | 'volume'
}

export interface UpdateVariantRequest {
  id: number
  label?: string
  weightGrams?: number
  barcode?: string
  retailLowStockPcs?: number
}

// ── Pricing ───────────────────────────────────────────────────────────────────

export interface PriceMenuEntry {
  id: number
  variantId: number
  retailPricePaise: number
  wholesalePricePaise: number
  effectiveDate: string
}

export interface PriceHistoryRow {
  id: number
  targetType: string
  targetId: number
  oldPricePaise: number
  newPricePaise: number
  changedAt: number // unix ms
  userId: number
}

export interface SetVariantPriceRequest {
  variantId: number
  retailPricePaise: number
  wholesalePricePaise: number
  effectiveDate: string
  userId: number
}

export interface SetProductLooseRateRequest {
  productId: number
  wholesaleRatePerKgPaise: number
  userId: number
}

export interface GetCurrentPriceRequest {
  variantId: number
  date?: string // 'YYYY-MM-DD', defaults to today
}

// ── Bulk Inventory ────────────────────────────────────────────────────────────

export interface BulkStockRow {
  productId: number
  qtyGrams: number
  avgCostPerKg: number | null // REAL rupees, nullable — never shown to staff
}

export interface BulkArrivalRow {
  id: number
  productId: number
  date: string
  qtyGrams: number
  costPerKgPaise: number | null // nullable
  notes: string | null
  createdAt: number // unix ms
}

export interface BulkAdjustmentRow {
  id: number
  productId: number
  date: string
  qtyChangeGrams: number // signed
  reason: string
  notes: string | null
  userId: number
  createdAt: number
}

export interface RecordBulkArrivalRequest {
  productId: number
  qtyGrams: number
  date: string
  costPerKgPaise?: number | null // Admin only — handler enforces this
  notes?: string
  userId: number
}

export interface RecordBulkAdjustmentRequest {
  productId: number
  qtyChangeGrams: number // signed
  reason: string
  notes?: string
  userId: number
}

// ── Packing ───────────────────────────────────────────────────────────────────

export interface PackingLine {
  variantId: number
  packetsCount: number
}

export interface ValidatePackingRunRequest {
  productId: number
  lines: PackingLine[]
}

export type ValidatePackingRunResult =
  | { ok: true; totalGrams: number; bulkAvailableGrams: number }
  | { ok: false; error: string }

export interface CommitPackingRunRequest {
  productId: number
  lines: PackingLine[]
  notes?: string
  userId: number
}

export interface PackingRunLineRow {
  id: number
  variantId: number
  packetsCount: number
  unitCostAtPack: number | null // REAL rupees
}

export interface PackingRunRow {
  id: number
  date: string
  productId: number
  bulkUsedGrams: number
  userId: number
  notes: string | null
  createdAt: number
  lines: PackingRunLineRow[]
}

// ── Retail Packet Inventory ───────────────────────────────────────────────────

export interface RetailStockRow {
  variantId: number
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
  variantId: number
  qtyChangePcs: number // signed
  reason: 'manual' | 'damage' | 'wastage'
  notes?: string
  userId: number
}

// ── Labels ────────────────────────────────────────────────────────────────────

export interface PrintLabelsRequest {
  variantId: number
  qty: number
  type: 'after_pack' | 'reprice' | 'reprint'
  userId: number
}

export interface LabelPrintLogRow {
  id: number
  date: string
  variantId: number
  qty: number
  pricePrintedPaise: number
  type: string
  userId: number
  createdAt: number
}

// ── Billing ───────────────────────────────────────────────────────────────────

export interface BillLine {
  variantId: number
  qtyPcs: number
  unitPricePaise: number // from Price Menu, re-verified server-side
}

export interface CreateRetailSaleRequest {
  lines: BillLine[]
  discountPaise: number
  paymentMode: 'cash' | 'upi' | 'card' | 'split'
  amountPaidPaise: number
  customerName?: string
  customerPhone?: string
  customerId?: number
  userId: number
  paymentSplit?: Array<{ mode: string; amount: number }>
}

export interface SavedInvoiceLine {
  id: number
  variantId: number
  label: string
  productName: string
  qtyPcs: number
  unitPricePaise: number
  lineTotalPaise: number
  lineProfitPaise: number | null
}

export interface SavedInvoice {
  id: number
  invoiceNo: string
  businessDate: string
  invoiceDatetime: number // unix ms
  subtotalPaise: number
  discountPaise: number
  totalPaise: number
  paymentMode: string
  amountPaidPaise: number
  balanceDuePaise: number
  customerId: number | null
  lines: SavedInvoiceLine[]
}

export interface BarcodeResult {
  variantId: number
  productId: number
  label: string
  productName: string
  weightGrams: number
  currentRetailPricePaise: number
}

// ── Wholesale Billing ─────────────────────────────────────────────────────────

export interface WholesaleLine {
  itemType: 'packet' | 'loose_bulk'
  variantId?: number   // required for packet
  productId?: number   // required for loose_bulk
  qty: number          // pcs for packet, grams for loose_bulk
  unit: 'pcs' | 'grams'
  unitPricePaise: number // wholesale price; editable for loose
}

export interface CreateWholesaleSaleRequest {
  lines: WholesaleLine[]
  discountPaise: number
  paymentMode: 'cash' | 'upi' | 'card' | 'split' | 'credit' | 'partial'
  amountPaidPaise: number
  partyId?: number
  partyName?: string
  partyPhone?: string
  userId: number
  paymentSplit?: Array<{ mode: string; amount: number }>
}

export interface UpdateInvoiceDetailsRequest {
  invoiceId: number
  userId: number
  newDatetime?: number       // unix ms — triggers edit log
  amountPaidPaise?: number
  customerId?: number | null  // null = unlink
  customerName?: string
  customerPhone?: string
}

export interface RecordPartyPaymentRequest {
  customerId: number
  amountPaise: number
  mode: string
  date?: string
  notes?: string
  userId: number
}

// ── Customers & Parties ───────────────────────────────────────────────────────

export interface CustomerRow {
  id: number
  type: 'retail' | 'wholesale'
  name: string
  businessName: string | null
  phone: string | null
  address: string | null
  gstNo: string | null // text only — no tax math (rules.md #10)
  creditBalancePaise: number
}

export interface PaymentRow {
  id: number
  customerId: number
  invoiceId: number | null
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
  userId: number
}

export interface UpdateCustomerRequest {
  id: number
  name?: string
  phone?: string
  address?: string
  gstNo?: string
  userId: number
}

// ── Purchases & Expenses ──────────────────────────────────────────────────────

export interface SupplierRow {
  id: number
  name: string
  phone: string | null
}

export interface PurchaseEntryRow {
  id: number
  supplierId: number | null
  date: string
  itemName: string
  qty: number
  amountPaise: number
  notes: string | null
  createdAt: number
}

export interface ExpenseRow {
  id: number
  date: string
  category: string
  amountPaise: number
  notes: string | null
  createdAt: number
}

export interface RecordPurchaseRequest {
  supplierId?: number
  itemName: string
  qty: number
  amountPaise: number
  date: string
  notes?: string
  userId: number
}

export interface RecordExpenseRequest {
  date: string
  category: string
  amountPaise: number
  notes?: string
  userId: number
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
  productId: number
  productName: string
  qtyGrams: number    // loose sales
  qtyPcs: number      // packet sales
  revenuePaise: number
}

export interface SalesByVariantRow {
  variantId: number
  label: string
  productName: string
  qtyPcs: number
  revenuePaise: number
}

export interface InventoryReportRow {
  type: 'bulk' | 'packet'
  productId?: number
  variantId?: number
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
  id: number
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
  customerId: number
  name: string
  businessName: string | null
  creditBalancePaise: number
}

export interface ExpensesSummaryRow {
  date: string
  category: string
  amountPaise: number
}

export interface RepaymentReportRow {
  id: number
  customerId: number
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
  cashCount: number
  upiCount: number
  cardCount: number
  creditCount: number
  total: number   // sum of amount_paid_paise from today + creditRepaid
}

// ── Invoice History ───────────────────────────────────────────────────────────

export interface InvoiceLineRow {
  id: number
  itemType: string
  variantId: number | null
  productId: number | null
  qty: number
  unit: string
  unitPricePaise: number
  lineTotalPaise: number
  lineProfitPaise: number | null
  variantLabel: string | null
  productName: string | null
}

export interface InvoiceRow {
  id: number
  invoiceNo: string
  createdAt: number
  invoiceDatetime: number
  businessDate: string
  type: string
  customerId: number | null
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
  customerId?: number
  dateFrom?: string   // filters by business_date
  dateTo?: string
  type?: 'retail' | 'wholesale'
}

export interface EditInvoiceDateTimeRequest {
  invoiceId: number
  newDatetime: number // unix ms
  userId: number
}

export interface EditLogRow {
  id: number
  invoiceId: number
  oldDatetime: number
  newDatetime: number
  editedBy: number
  editedAt: number
}

// ── Billing item lists (tile grid convenience) ────────────────────────────────

export interface RetailItemRow {
  variantId: number
  productName: string
  label: string
  weightGrams: number
  barcode: string
  retailPricePaise: number
  qtyPcs: number
}

export interface WholesaleItemRow {
  variantId: number
  productName: string
  label: string
  weightGrams: number
  barcode: string
  wholesalePricePaise: number
  qtyPcs: number
}

export interface LooseItemRow {
  productId: number
  productName: string
  wholesaleRatePerKgPaise: number
  qtyGrams: number
}

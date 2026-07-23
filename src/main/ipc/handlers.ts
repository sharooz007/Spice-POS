// @ts-nocheck
// src/main/ipc/handlers.ts — all ipcMain handlers (thin wrappers around services)
import { ipcMain, BrowserWindow, dialog } from 'electron'
import { scryptSync, timingSafeEqual, randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import { desc } from 'drizzle-orm'
import { getDb } from '../db'
import { pingLog, users } from '../db/schema'
import * as productsSvc from '../services/products'
import * as pricingSvc from '../services/pricing'
import * as bulkSvc from '../services/bulkInventory'
import * as packingSvc from '../services/packing'
import * as retailSvc from '../services/retailInventory'
import * as labelsSvc from '../services/labels'
import * as billingSvc from '../services/billing'
import * as customersSvc from '../services/customers'
import * as purchasesSvc from '../services/purchasesExpenses'
import * as reportsSvc from '../services/reports'
import * as usersSvc from '../services/users'
import * as invoiceHistorySvc from '../services/invoiceHistory'
import * as backupSvc from '../services/backup'
import * as settingsSvc from '../services/settings'
import * as factorySvc from '../services/factory'
import * as syncSvc from '../services/sync'
import { printReceipt } from '../printing/print'
import type {
  PingRequest,
  PingResponse,
  LoginRequest,
  LoginResponse,
  Result,
  Category,
  Product,
  CreateCategoryRequest,
  CreateProductRequest,
  CreateVariantRequest,
  UpdateProductRequest,
  UpdateVariantRequest,
  PriceMenuEntry,
  PriceHistoryRow,
  SetVariantPriceRequest,
  SetProductLooseRateRequest,
  GetCurrentPriceRequest,
  BulkStockRow,
  BulkArrivalRow,
  BulkAdjustmentRow,
  RecordBulkArrivalRequest,
  RecordBulkAdjustmentRequest,
  ValidatePackingRunRequest,
  ValidatePackingRunResult,
  CommitPackingRunRequest,
  PackingRunRow,
  RetailStockRow,
  RetailMovementRow,
  RecordRetailAdjustmentRequest,
  PrintLabelsRequest,
  LabelPrintLogRow,
  CreateRetailSaleRequest,
  SavedInvoice,
  BarcodeResult,
  CreateWholesaleSaleRequest,
  RecordPartyPaymentRequest,
  CustomerRow, PaymentRow, CreateCustomerRequest, UpdateCustomerRequest,
  SupplierRow, PurchaseEntryRow, ExpenseRow, RecordPurchaseRequest, RecordExpenseRequest,
  DateRange, DailySalesRow, SalesByProductRow, SalesByVariantRow,
  InventoryReportRow, LowStockRow, PackingReportRun, ProfitReportRow, DuesRow, ExpensesSummaryRow,
  PaymentBreakdownRow,
  RepaymentReportRow,
  InvoiceRow, SearchInvoicesRequest, SearchInvoicesResponse, EditInvoiceDateTimeRequest, EditLogRow,
  UpdateInvoiceDetailsRequest,
  RetailItemRow, WholesaleItemRow, LooseItemRow
} from '../../shared/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function verifyPin(pin: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    const candidate = scryptSync(pin, salt, 64)
    return timingSafeEqual(candidate, Buffer.from(hash, 'hex'))
  } catch {
    return false
  }
}

function requireAdmin(userId: string): void {
  const db = getDb()
  const user = db.select({ role: users.role }).from(users).where(eq(users.id, userId)).get()
  if (!user || user.role !== 'admin') throw new Error('Admin access required')
}

function wrap<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── register ──────────────────────────────────────────────────────────────────

export function registerHandlers(): void {
  // ── ping ────────────────────────────────────────────────────────────────────
  ipcMain.handle('ping', (_e, req: PingRequest): PingResponse => {
    const db = getDb()
    db.insert(pingLog).values({ value: req.value }).run()
    const row = db.select().from(pingLog).orderBy(desc(pingLog.id)).limit(1).get()
    return { stored: row?.value ?? '', echo: req.value }
  })

  // ── auth.login ──────────────────────────────────────────────────────────────
  ipcMain.handle('auth.login', (_e, req: LoginRequest): LoginResponse => {
    if (!req.username || !req.pin) return { ok: false, error: 'Invalid credentials' }
    const db = getDb()
    const user = db.select().from(users).where(eq(users.name, req.username)).get()
    if (!user || !verifyPin(req.pin, user.pinHash)) return { ok: false, error: 'Invalid credentials' }
    return { ok: true, user: { id: user.id, name: user.name, role: user.role as 'admin' | 'staff' } }
  })

  // ── users ───────────────────────────────────────────────────────────────────
  ipcMain.handle('users.list', (): Result<any[]> => {
    const db = getDb()
    return wrap(() => db.select({ id: users.id, name: users.name, role: users.role }).from(users).all())
  })
  ipcMain.handle('users.create', (_e, req: { name: string; role: string; pin: string }): Result<string> => {
    const db = getDb()
    return wrap(() => {
      const salt = randomBytes(16).toString('hex')
      const hash = scryptSync(req.pin, salt, 64).toString('hex')
      const pinHash = `${salt}:${hash}`
      const res = db.insert(users).values({ name: req.name, role: req.role, pinHash }).run()
      return res.lastInsertRowid
    })
  })
  ipcMain.handle('users.updatePin', (_e, req: { id: string; pin: string }): Result<void> => {
    const db = getDb()
    return wrap(() => {
      const salt = randomBytes(16).toString('hex')
      const hash = scryptSync(req.pin, salt, 64).toString('hex')
      const pinHash = `${salt}:${hash}`
      db.update(users).set({ pinHash }).where(eq(users.id, req.id)).run()
    })
  })
  ipcMain.handle('users.delete', (_e, req: { id: string; userId: string }): Result<void> => {
    const db = getDb()
    return wrap(() => {
      requireAdmin(req.userId)
      db.delete(users).where(eq(users.id, req.id)).run()
    })
  })

  // ── products.listCategories ─────────────────────────────────────────────────
  ipcMain.handle('products.listCategories', (): Result<Category[]> =>
    wrap(() => productsSvc.listCategories())
  )

  // ── products.generateBarcode ────────────────────────────────────────────────
  ipcMain.handle('products.generateBarcode', (_e, req: { productName: string; weightGrams: number }): Result<string> =>
    wrap(() => productsSvc.generateBarcode(req.productName, req.weightGrams))
  )

  // ── products.createCategory (admin) ────────────────────────────────────────
  ipcMain.handle(
    'products.createCategory',
    (_e, req: CreateCategoryRequest & { userId: string }): Result<Category> =>
      wrap(() => {
        requireAdmin(req.userId)
        return productsSvc.createCategory(req)
      })
  )

  // ── products.listProducts ───────────────────────────────────────────────────
  ipcMain.handle('products.listProducts', (): Result<Product[]> =>
    wrap(() => productsSvc.listProducts())
  )

  // ── products.createProduct (admin) ─────────────────────────────────────────
  ipcMain.handle(
    'products.createProduct',
    (_e, req: CreateProductRequest & { userId: string }): Result<string> =>
      wrap(() => {
        requireAdmin(req.userId)
        return productsSvc.createProduct(req)
      })
  )

  // ── products.createVariant (admin) ─────────────────────────────────────────
  ipcMain.handle(
    'products.createVariant',
    (_e, req: CreateVariantRequest & { userId: string }): Result<string> =>
      wrap(() => {
        requireAdmin(req.userId)
        return productsSvc.createVariant(req)
      })
  )

  // ── products.updateProduct (admin) ─────────────────────────────────────────
  ipcMain.handle(
    'products.updateProduct',
    (_e, req: UpdateProductRequest & { userId: string }): Result<void> =>
      wrap(() => {
        requireAdmin(req.userId)
        productsSvc.updateProduct(req, req.userId)
      })
  )

  // ── products.updateVariant (admin) ─────────────────────────────────────────
  ipcMain.handle(
    'products.updateVariant',
    (_e, req: UpdateVariantRequest & { userId: string }): Result<void> =>
      wrap(() => {
        requireAdmin(req.userId)
        productsSvc.updateVariant(req, req.userId)
      })
  )

  // ── products.toggleProductEnabled (admin) ──────────────────────────────────
  ipcMain.handle(
    'products.toggleProductEnabled',
    (_e, req: { id: string; userId: string }): Result<void> =>
      wrap(() => {
        requireAdmin(req.userId)
        productsSvc.toggleProductEnabled(req.id, req.userId)
      })
  )

  // ── products.toggleVariantEnabled (admin) ──────────────────────────────────
  ipcMain.handle(
    'products.toggleVariantEnabled',
    (_e, req: { id: string; userId: string }): Result<void> =>
      wrap(() => {
        requireAdmin(req.userId)
        productsSvc.toggleVariantEnabled(req.id, req.userId)
      })
  )

  // ── products.deleteProduct (admin) ──────────────────────────────────────────
  ipcMain.handle(
    'products.deleteProduct',
    (_e, req: { productId: string; userId: string }): Result<void> =>
      wrap(() => {
        requireAdmin(req.userId)
        productsSvc.deleteProduct(req.productId, req.userId)
      })
  )

  // ── pricing.getCurrentPrice ─────────────────────────────────────────────────
  ipcMain.handle(
    'pricing.getCurrentPrice',
    (_e, req: GetCurrentPriceRequest): Result<PriceMenuEntry | null> =>
      wrap(() => pricingSvc.getCurrentPrice(req))
  )

  // ── pricing.listAllEntries ──────────────────────────────────────────────────
  ipcMain.handle('pricing.listAllEntries', (): Result<PriceMenuEntry[]> =>
    wrap(() => pricingSvc.listAllPriceMenuEntries())
  )

  // ── pricing.setVariantPrice (admin) ────────────────────────────────────────
  ipcMain.handle(
    'pricing.setVariantPrice',
    (_e, req: SetVariantPriceRequest): Result<void> =>
      wrap(() => {
        requireAdmin(req.userId)
        pricingSvc.setVariantPrice(req)
      })
  )

  // ── pricing.setProductLooseRate (admin) ────────────────────────────────────
  ipcMain.handle(
    'pricing.setProductLooseRate',
    (_e, req: SetProductLooseRateRequest): Result<void> =>
      wrap(() => {
        requireAdmin(req.userId)
        pricingSvc.setProductLooseRate(req)
      })
  )

  // ── pricing.listPriceHistory ────────────────────────────────────────────────
  ipcMain.handle(
    'pricing.listPriceHistory',
    (_e, req: { variantId: string }): Result<PriceHistoryRow[]> =>
      wrap(() => pricingSvc.listPriceHistory(req.variantId))
  )

  // ── bulkInventory.getBulkStock ──────────────────────────────────────────────
  ipcMain.handle(
    'bulkInventory.getBulkStock',
    (_e, req: { productId: string }): Result<BulkStockRow | null> =>
      wrap(() => bulkSvc.getBulkStock(req.productId))
  )

  // ── bulkInventory.listAllBulkStock ──────────────────────────────────────────
  ipcMain.handle(
    'bulkInventory.listAllBulkStock',
    (): Result<BulkStockRow[]> => wrap(() => bulkSvc.listAllBulkStock())
  )

  // ── bulkInventory.recordArrival (staff can record qty+date; only admin sends cost) ──
  ipcMain.handle(
    'bulkInventory.recordArrival',
    (_e, req: RecordBulkArrivalRequest): Result<void> =>
      wrap(() => {
        // Role check for cost: strip cost from non-admin payloads in the main process
        const db = getDb()
        const user = db.select({ role: users.role }).from(users).where(eq(users.id, req.userId)).get()
        const sanitised: RecordBulkArrivalRequest = {
          ...req,
          costPerKgPaise: user?.role === 'admin' ? (req.costPerKgPaise ?? null) : null
        }
        bulkSvc.recordBulkArrival(sanitised)
      })
  )

  // ── bulkInventory.recordAdjustment (admin only) ─────────────────────────────
  ipcMain.handle(
    'bulkInventory.recordAdjustment',
    (_e, req: RecordBulkAdjustmentRequest): Result<void> =>
      wrap(() => {
        requireAdmin(req.userId)
        bulkSvc.recordBulkAdjustment(req)
      })
  )

  // ── bulkInventory.listArrivals ──────────────────────────────────────────────
  ipcMain.handle(
    'bulkInventory.listArrivals',
    (_e, req: { productId: string }): Result<BulkArrivalRow[]> =>
      wrap(() => bulkSvc.listBulkArrivals(req.productId))
  )

  // ── bulkInventory.listAdjustments ──────────────────────────────────────────
  ipcMain.handle(
    'bulkInventory.listAdjustments',
    (_e, req: { productId: string }): Result<BulkAdjustmentRow[]> =>
      wrap(() => bulkSvc.listBulkAdjustments(req.productId))
  )

  // ── bulkInventory.deleteArrival (admin only) ────────────────────────────────
  ipcMain.handle(
    'bulkInventory.deleteArrival',
    (_e, req: { arrivalId: number; userId: string }): Result<void> =>
      wrap(() => {
        requireAdmin(req.userId)
        bulkSvc.deleteArrival(req.arrivalId, req.userId)
      })
  )

  // ── packing.validate ────────────────────────────────────────────────────────
  ipcMain.handle(
    'packing.validate',
    (_e, req: ValidatePackingRunRequest): ValidatePackingRunResult =>
      packingSvc.validatePackingRun(req)
  )

  // ── packing.commit ──────────────────────────────────────────────────────────
  ipcMain.handle(
    'packing.commit',
    (_e, req: CommitPackingRunRequest): Result<string> =>
      wrap(() => packingSvc.commitPackingRun(req))
  )

  // ── packing.listRuns ────────────────────────────────────────────────────────
  ipcMain.handle(
    'packing.listRuns',
    (_e, req?: { productId?: number }): Result<PackingRunRow[]> =>
      wrap(() => packingSvc.listPackingRuns(req?.productId))
  )

  // ── packing.delete ──────────────────────────────────────────────────────────
  ipcMain.handle(
    'packing.delete',
    (_e, req: { runId: string; userId: string }): Result<void> =>
      wrap(() => {
        requireAdmin(req.userId)
        packingSvc.deletePackingRun(req.runId)
      })
  )

  // ── retailInventory.getStock ────────────────────────────────────────────────
  ipcMain.handle(
    'retailInventory.getStock',
    (_e, req?: { variantId?: number }): Result<RetailStockRow[]> =>
      wrap(() => retailSvc.getRetailStock(req?.variantId))
  )

  // ── retailInventory.recordAdjustment (admin only) ──────────────────────────
  ipcMain.handle(
    'retailInventory.recordAdjustment',
    (_e, req: RecordRetailAdjustmentRequest): Result<void> =>
      wrap(() => {
        requireAdmin(req.userId)
        retailSvc.recordRetailAdjustment(req)
      })
  )

  // ── retailInventory.addOutsideStock ──────────────────────────────────────────
  ipcMain.handle(
    'retailInventory.addOutsideStock',
    (_e, req: { variantId: string; qtyPcs: number; costPerPcPaise: number; userId: string; notes?: string }): Result<void> =>
      wrap(() => {
        requireAdmin(req.userId)
        retailSvc.addOutsideRetailStock(req)
      })
  )

  // ── retailInventory.listMovements ───────────────────────────────────────────
  ipcMain.handle(
    'retailInventory.listMovements',
    (_e, req: { variantId: string }): Result<RetailMovementRow[]> =>
      wrap(() => retailSvc.listRetailMovements(req.variantId))
  )

  // ── labels.printLabels ──────────────────────────────────────────────────────
  ipcMain.handle(
    'labels.printLabels',
    async (_e, req: PrintLabelsRequest): Promise<Result<void>> => {
      try {
        await labelsSvc.printLabels(req)
        return { ok: true, data: undefined }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }
  )

  // ── labels.listPrintLog ─────────────────────────────────────────────────────
  ipcMain.handle(
    'labels.listPrintLog',
    (_e, req?: { variantId?: number }): Result<LabelPrintLogRow[]> =>
      wrap(() => labelsSvc.listPrintLog(req?.variantId))
  )

  // ── billing.lookupBarcode ───────────────────────────────────────────────────
  ipcMain.handle(
    'billing.lookupBarcode',
    (_e, req: { barcode: string }): Result<BarcodeResult | null> =>
      wrap(() => billingSvc.lookupVariantByBarcode(req.barcode))
  )

  // ── billing.listRetailItems ─────────────────────────────────────────────────
  ipcMain.handle('billing.listRetailItems', (): Result<RetailItemRow[]> =>
    wrap(() => billingSvc.listRetailItems()))

  // ── billing.listWholesaleItems ──────────────────────────────────────────────
  ipcMain.handle('billing.listWholesaleItems', (): Result<{ packets: WholesaleItemRow[]; loose: LooseItemRow[] }> =>
    wrap(() => billingSvc.listWholesaleItems()))

  // ── billing.createRetailSale ────────────────────────────────────────────────
  ipcMain.handle(
    'billing.createRetailSale',
    (_e, req: CreateRetailSaleRequest): Result<SavedInvoice> =>
      wrap(() => billingSvc.createRetailSale(req))
  )

  // ── billing.createWholesaleSale ─────────────────────────────────────────────
  ipcMain.handle(
    'billing.createWholesaleSale',
    (_e, req: CreateWholesaleSaleRequest): Result<SavedInvoice> =>
      wrap(() => billingSvc.createWholesaleSale(req))
  )

  // ── billing.recordPartyPayment ──────────────────────────────────────────────
  ipcMain.handle(
    'billing.recordPartyPayment',
    (_e, req: RecordPartyPaymentRequest): Result<void> =>
      wrap(() => billingSvc.recordPartyPayment(req))
  )

  // ── print.receipt ───────────────────────────────────────────────────────────
  ipcMain.handle('print.receipt', (_e, req: { invoiceId: string }): Promise<Result<void>> =>
    printReceipt(req.invoiceId).then(() => ({ ok: true as const, data: undefined })).catch(e => ({ ok: false, error: e.message })))

  ipcMain.handle('print.listPrinters', async () => {
    try {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) return { ok: true, data: [] }
      const printers = await win.webContents.getPrintersAsync()
      return { ok: true, data: printers }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  // ── customers ───────────────────────────────────────────────────────────────
  ipcMain.handle('customers.list', (_e, req?: { type?: 'retail' | 'wholesale' }): Result<CustomerRow[]> =>
    wrap(() => customersSvc.listCustomers(req?.type)))
  ipcMain.handle('customers.get', (_e, req: { id: string }): Result<CustomerRow | null> =>
    wrap(() => customersSvc.getCustomer(req.id)))
  ipcMain.handle('customers.create', (_e, req: CreateCustomerRequest): Result<string> =>
    wrap(() => customersSvc.createCustomer(req)))
  ipcMain.handle('customers.update', (_e, req: UpdateCustomerRequest): Result<void> =>
    wrap(() => customersSvc.updateCustomer(req)))
  ipcMain.handle('customers.listPayments', (_e, req: { customerId: string }): Result<PaymentRow[]> =>
    wrap(() => customersSvc.listPayments(req.customerId)))
  ipcMain.handle('customers.deletePayment', (_e, id: string): Result<void> =>
    wrap(() => customersSvc.deletePayment(id)))
  ipcMain.handle('customers.updatePhone', (_e, req: { customerId: string; phone: string }): Result<void> =>
    wrap(() => customersSvc.updateCustomerPhone(req.customerId, req.phone)))

  // ── purchases ───────────────────────────────────────────────────────────────
  ipcMain.handle('purchases.listSuppliers', (): Result<SupplierRow[]> =>
    wrap(() => purchasesSvc.listSuppliers()))
  ipcMain.handle('purchases.createSupplier', (_e, req: { name: string; phone?: string }): Result<string> =>
    wrap(() => purchasesSvc.createSupplier(req)))
  ipcMain.handle('purchases.record', (_e, req: RecordPurchaseRequest): Result<void> =>
    wrap(() => purchasesSvc.recordPurchase(req)))
  ipcMain.handle('purchases.list', (_e, req?: { dateFrom?: string; dateTo?: string }): Result<PurchaseEntryRow[]> =>
    wrap(() => purchasesSvc.listPurchases(req?.dateFrom, req?.dateTo)))

  // ── expenses ────────────────────────────────────────────────────────────────
  ipcMain.handle('expenses.record', (_e, req: RecordExpenseRequest): Result<void> =>
    wrap(() => purchasesSvc.recordExpense(req)))
  ipcMain.handle('expenses.list', (_e, req?: { dateFrom?: string; dateTo?: string }): Result<ExpenseRow[]> =>
    wrap(() => purchasesSvc.listExpenses(req?.dateFrom, req?.dateTo)))
  ipcMain.handle('expenses.delete', (_e, req: { expenseId: number; userId: string }): Result<void> =>
    wrap(() => purchasesSvc.deleteExpense(req.expenseId, req.userId)))

  // ── reports ─────────────────────────────────────────────────────────────────
  ipcMain.handle('reports.dailySales', (_e, req: DateRange): Result<DailySalesRow[]> =>
    wrap(() => reportsSvc.dailySalesReport(req)))
  ipcMain.handle('reports.salesByProduct', (_e, req: DateRange): Result<SalesByProductRow[]> =>
    wrap(() => reportsSvc.salesByProduct(req)))
  ipcMain.handle('reports.salesByVariant', (_e, req: DateRange): Result<SalesByVariantRow[]> =>
    wrap(() => reportsSvc.salesByVariant(req)))
  ipcMain.handle('reports.inventory', (): Result<InventoryReportRow[]> =>
    wrap(() => reportsSvc.inventoryReport()))
  ipcMain.handle('reports.lowStock', (): Result<LowStockRow[]> =>
    wrap(() => reportsSvc.lowStockReport()))
  ipcMain.handle('reports.packing', (_e, req: DateRange): Result<PackingReportRun[]> =>
    wrap(() => reportsSvc.packingReport(req)))
  ipcMain.handle('reports.profit', (_e, req: DateRange): Result<ProfitReportRow[]> =>
    wrap(() => reportsSvc.profitReport(req)))
  ipcMain.handle('reports.dues', (): Result<DuesRow[]> =>
    wrap(() => reportsSvc.duesReport()))
  ipcMain.handle('reports.expenses', (_e, req: DateRange): Result<ExpensesSummaryRow[]> =>
    wrap(() => reportsSvc.expensesReport(req)))
  ipcMain.handle('reports.paymentBreakdown', (_e, req: DateRange): Result<PaymentBreakdownRow> =>
    wrap(() => reportsSvc.paymentBreakdown(req)))
  ipcMain.handle('reports.repayments', (_e, req: DateRange): Result<RepaymentReportRow[]> =>
    wrap(() => reportsSvc.repaymentsReport(req)))

  // ── invoiceHistory ──────────────────────────────────────────────────────────
  ipcMain.handle('invoiceHistory.search', (_e, req: SearchInvoicesRequest): Result<SearchInvoicesResponse> =>
    wrap(() => invoiceHistorySvc.searchInvoices(req)))

  ipcMain.handle('invoiceHistory.getInvoice', (_e, req: { invoiceId: string }): Result<InvoiceRow | null> =>
    wrap(() => invoiceHistorySvc.getInvoice(req.invoiceId)))

  ipcMain.handle('invoiceHistory.void', (_e, req: { invoiceId: string; userId: string }): Result<void> =>
    wrap(() => invoiceHistorySvc.voidInvoice(req.invoiceId, req.userId)))

  ipcMain.handle('invoiceHistory.unvoid', (_e, req: { invoiceId: string; userId: string }): Result<void> =>
    wrap(() => invoiceHistorySvc.unvoidInvoice(req.invoiceId, req.userId)))

  ipcMain.handle('invoiceHistory.delete', (_e, req: { invoiceId: string; userId: string }): Result<void> =>
    wrap(() => invoiceHistorySvc.deleteInvoice(req.invoiceId, req.userId)))

  ipcMain.handle('invoiceHistory.editDateTime', (_e, req: EditInvoiceDateTimeRequest): Result<InvoiceRow> =>
    wrap(() => invoiceHistorySvc.editInvoiceDateTime(req)))

  ipcMain.handle('invoiceHistory.getEditLog', (_e, req: { invoiceId: string }): Result<EditLogRow[]> =>
    wrap(() => invoiceHistorySvc.getEditLog(req.invoiceId)))

  ipcMain.handle('invoiceHistory.updateDetails', (_e, req: UpdateInvoiceDetailsRequest): Result<InvoiceRow> =>
    wrap(() => invoiceHistorySvc.updateInvoiceDetails(req)))

  // ── backup & settings ───────────────────────────────────────────────────────
  ipcMain.handle('backup.create', async (_e, type: 'manual'|'auto'|'pre-restore') => {
    try {
      const path = await backupSvc.createBackup(type)
      return { ok: true, data: path }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })
  ipcMain.handle('backup.restore', async (_e, filePath: string) => {
    try {
      await backupSvc.restoreBackup(filePath)
      return { ok: true, data: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })
  ipcMain.handle('backup.list', async () => {
    try {
      const list = await backupSvc.listBackups()
      return { ok: true, data: list }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })
  ipcMain.handle('backup.selectFolder', async () => {
    try {
      const win = BrowserWindow.getAllWindows()[0]
      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        properties: ['openDirectory']
      })
      if (canceled || filePaths.length === 0) return { ok: false, error: 'Canceled' }
      return { ok: true, data: filePaths[0] }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('settings.get', (_e, key: string) => wrap(() => settingsSvc.getSetting(key)))
  ipcMain.handle('settings.getAll', () => wrap(() => settingsSvc.getAllSettings()))
  ipcMain.handle('settings.set', (_e, req: { key: string, value: string }) => wrap(() => settingsSvc.setSetting(req.key, req.value)))
  ipcMain.handle('settings.setAll', (_e, req: Record<string, string>): Result<void> =>
    wrap(() => settingsSvc.setAllSettings(req)))


  ipcMain.handle('settings.clearAllData', async (_e, userId: string): Promise<Result<void>> => {
    try {
      await settingsSvc.clearAllData(userId)
      return { ok: true, data: undefined }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })

  // ── Factory ─────────────────────────────────────────────────────────────────
  ipcMain.handle('factory.listItems', () => factorySvc.listItems())
  ipcMain.handle('factory.createItem', (_e, req: any) => factorySvc.createItem(req))
  ipcMain.handle('factory.deleteItem', (_e, id: string) => factorySvc.deleteItem(id))
  ipcMain.handle('factory.listTransactions', (_e, itemId?: string) => factorySvc.listTransactions(itemId))
  ipcMain.handle('factory.createTransaction', (_e, req: any) => factorySvc.createTransaction(req))
  ipcMain.handle('factory.deleteTransaction', (_e, id: string) => factorySvc.deleteTransaction(id))
  
  // Factory Production Runs & Stock
  ipcMain.handle('factory.listProductionRuns', () => factorySvc.listProductionRuns())
  ipcMain.handle('factory.createProductionRun', (_e, req: any) => factorySvc.createProductionRun(req))
  ipcMain.handle('factory.deleteProductionRun', (_e, id: string) => factorySvc.deleteProductionRun(id))
  ipcMain.handle('factory.getRawMaterialStock', () => factorySvc.getRawMaterialStock())

  // ── Sync ────────────────────────────────────────────────────────────────────
  ipcMain.handle('sync.run', (): Promise<{ ok: boolean; message: string }> => syncSvc.syncWithSupabase())
  ipcMain.handle('sync.forcePush', (): Promise<{ ok: boolean; message: string }> => syncSvc.forcePush())
  ipcMain.handle('sync.forcePull', (): Promise<{ ok: boolean; message: string }> => syncSvc.forcePull())
  ipcMain.handle('sync.checkRemoteState', () => syncSvc.checkRemoteState())
  ipcMain.handle('sync.getLastSyncTime', async () => {
    const time = await syncSvc.getLastSyncTime()
    return { ok: true, data: time }
  })
}

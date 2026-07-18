import { contextBridge, ipcRenderer } from 'electron'
import type {
  PingRequest, PingResponse, LoginRequest, LoginResponse,
  Result, Category, Product,
  CreateCategoryRequest, CreateProductRequest, CreateVariantRequest,
  UpdateProductRequest, UpdateVariantRequest,
  PriceMenuEntry, PriceHistoryRow, SetVariantPriceRequest, SetProductLooseRateRequest, GetCurrentPriceRequest,
  BulkStockRow, BulkArrivalRow, BulkAdjustmentRow, RecordBulkArrivalRequest, RecordBulkAdjustmentRequest,
  ValidatePackingRunRequest, ValidatePackingRunResult, CommitPackingRunRequest, PackingRunRow,
  RetailStockRow, RetailMovementRow, RecordRetailAdjustmentRequest,
  PrintLabelsRequest, LabelPrintLogRow,
  CreateRetailSaleRequest, SavedInvoice, BarcodeResult,
  CreateWholesaleSaleRequest, RecordPartyPaymentRequest,
  RetailItemRow, WholesaleItemRow, LooseItemRow,
  CustomerRow, PaymentRow, CreateCustomerRequest, UpdateCustomerRequest,
  SupplierRow, PurchaseEntryRow, ExpenseRow, RecordPurchaseRequest, RecordExpenseRequest,
  DateRange, DailySalesRow, SalesByProductRow, SalesByVariantRow,
  InventoryReportRow, LowStockRow, PackingReportRun, ProfitReportRow, DuesRow, ExpensesSummaryRow,
  PaymentBreakdownRow, RepaymentReportRow,
  InvoiceRow, SearchInvoicesRequest, SearchInvoicesResponse, EditInvoiceDateTimeRequest, EditLogRow,
  UpdateInvoiceDetailsRequest
} from '../shared/types'

const api = {
  ping: (req: PingRequest): Promise<PingResponse> => ipcRenderer.invoke('ping', req),
  auth: { login: (req: LoginRequest): Promise<LoginResponse> => ipcRenderer.invoke('auth.login', req) },
  products: {
    listCategories: (): Promise<Result<Category[]>> => ipcRenderer.invoke('products.listCategories'),
    generateBarcode: (req: { productName: string; weightGrams: number }): Promise<Result<string>> => ipcRenderer.invoke('products.generateBarcode', req),
    createCategory: (req: CreateCategoryRequest & { userId: string }): Promise<Result<Category>> => ipcRenderer.invoke('products.createCategory', req),
    listProducts: (): Promise<Result<Product[]>> => ipcRenderer.invoke('products.listProducts'),
    createProduct: (req: CreateProductRequest & { userId: string }): Promise<Result<number>> => ipcRenderer.invoke('products.createProduct', req),
    createVariant: (req: CreateVariantRequest & { userId: string }): Promise<Result<number>> => ipcRenderer.invoke('products.createVariant', req),
    updateProduct: (req: UpdateProductRequest & { userId: string }): Promise<Result<void>> => ipcRenderer.invoke('products.updateProduct', req),
    updateVariant: (req: UpdateVariantRequest & { userId: string }): Promise<Result<void>> => ipcRenderer.invoke('products.updateVariant', req),
    toggleProductEnabled: (req: { id: string; userId: string }): Promise<Result<void>> => ipcRenderer.invoke('products.toggleProductEnabled', req),
    toggleVariantEnabled: (req: { id: string; userId: string }): Promise<Result<void>> => ipcRenderer.invoke('products.toggleVariantEnabled', req),
    deleteProduct: (req: { productId: string; userId: string }): Promise<Result<void>> => ipcRenderer.invoke('products.deleteProduct', req)
  },
  pricing: {
    getCurrentPrice: (req: GetCurrentPriceRequest): Promise<Result<PriceMenuEntry | null>> => ipcRenderer.invoke('pricing.getCurrentPrice', req),
    listAllEntries: (): Promise<Result<PriceMenuEntry[]>> => ipcRenderer.invoke('pricing.listAllEntries'),
    setVariantPrice: (req: SetVariantPriceRequest): Promise<Result<void>> => ipcRenderer.invoke('pricing.setVariantPrice', req),
    setProductLooseRate: (req: SetProductLooseRateRequest): Promise<Result<void>> => ipcRenderer.invoke('pricing.setProductLooseRate', req),
    listPriceHistory: (req: { variantId: string }): Promise<Result<PriceHistoryRow[]>> => ipcRenderer.invoke('pricing.listPriceHistory', req)
  },
  bulkInventory: {
    getBulkStock: (req: { productId: string }): Promise<Result<BulkStockRow | null>> => ipcRenderer.invoke('bulkInventory.getBulkStock', req),
    listAllBulkStock: (): Promise<Result<BulkStockRow[]>> => ipcRenderer.invoke('bulkInventory.listAllBulkStock'),
    recordArrival: (req: RecordBulkArrivalRequest): Promise<Result<void>> => ipcRenderer.invoke('bulkInventory.recordArrival', req),
    recordAdjustment: (req: RecordBulkAdjustmentRequest): Promise<Result<void>> => ipcRenderer.invoke('bulkInventory.recordAdjustment', req),
    listArrivals: (req: { productId: string }): Promise<Result<BulkArrivalRow[]>> => ipcRenderer.invoke('bulkInventory.listArrivals', req),
    listAdjustments: (req: { productId: string }): Promise<Result<BulkAdjustmentRow[]>> => ipcRenderer.invoke('bulkInventory.listAdjustments', req),
    deleteArrival: (req: { arrivalId: number; userId: string }): Promise<Result<void>> => ipcRenderer.invoke('bulkInventory.deleteArrival', req)
  },
  packing: {
    validate: (req: ValidatePackingRunRequest): Promise<ValidatePackingRunResult> => ipcRenderer.invoke('packing.validate', req),
    commit: (req: CommitPackingRunRequest): Promise<Result<string>> => ipcRenderer.invoke('packing.commit', req),
    listRuns: (req?: { productId?: number }): Promise<Result<PackingRunRow[]>> => ipcRenderer.invoke('packing.listRuns', req),
    delete: (req: { runId: string; userId: string }): Promise<Result<void>> => ipcRenderer.invoke('packing.delete', req)
  },
  retailInventory: {
    getStock: (req?: { variantId?: number }): Promise<Result<RetailStockRow[]>> => ipcRenderer.invoke('retailInventory.getStock', req),
    recordAdjustment: (req: RecordRetailAdjustmentRequest): Promise<Result<void>> => ipcRenderer.invoke('retailInventory.recordAdjustment', req),
    listMovements: (req: { variantId: string }): Promise<Result<RetailMovementRow[]>> => ipcRenderer.invoke('retailInventory.listMovements', req)
  },
  labels: {
    printLabels: (req: PrintLabelsRequest): Promise<Result<void>> => ipcRenderer.invoke('labels.printLabels', req),
    listPrintLog: (req?: { variantId?: number }): Promise<Result<LabelPrintLogRow[]>> => ipcRenderer.invoke('labels.listPrintLog', req)
  },
  billing: {
    lookupBarcode: (req: { barcode: string }): Promise<Result<BarcodeResult | null>> => ipcRenderer.invoke('billing.lookupBarcode', req),
    createRetailSale: (req: CreateRetailSaleRequest): Promise<Result<SavedInvoice>> => ipcRenderer.invoke('billing.createRetailSale', req),
    createWholesaleSale: (req: CreateWholesaleSaleRequest): Promise<Result<SavedInvoice>> => ipcRenderer.invoke('billing.createWholesaleSale', req),
    recordPartyPayment: (req: RecordPartyPaymentRequest): Promise<Result<void>> => ipcRenderer.invoke('billing.recordPartyPayment', req),
    listRetailItems: (): Promise<Result<RetailItemRow[]>> => ipcRenderer.invoke('billing.listRetailItems'),
    listWholesaleItems: (): Promise<Result<{ packets: WholesaleItemRow[]; loose: LooseItemRow[] }>> => ipcRenderer.invoke('billing.listWholesaleItems')
  },
  print: {
    receipt: (req: { invoiceId: string }): Promise<Result<void>> => ipcRenderer.invoke('print.receipt', req),
    listPrinters: (): Promise<Result<any[]>> => ipcRenderer.invoke('print.listPrinters')
  },
  customers: {
    list: (req?: { type?: 'retail' | 'wholesale' }): Promise<Result<CustomerRow[]>> => ipcRenderer.invoke('customers.list', req),
    get: (req: { id: string }): Promise<Result<CustomerRow | null>> => ipcRenderer.invoke('customers.get', req),
    create: (req: CreateCustomerRequest): Promise<Result<number>> => ipcRenderer.invoke('customers.create', req),
    update: (req: UpdateCustomerRequest): Promise<Result<void>> => ipcRenderer.invoke('customers.update', req),
    listPayments: (req: { customerId: string }): Promise<Result<PaymentRow[]>> => ipcRenderer.invoke('customers.listPayments', req),
    deletePayment: (id: string): Promise<Result<void>> => ipcRenderer.invoke('customers.deletePayment', id),
    updateCustomerPhone: (customerId: string, phone: string): Promise<Result<void>> => ipcRenderer.invoke('customers.updatePhone', { customerId, phone })
  },
  purchases: {
    listSuppliers: (): Promise<Result<SupplierRow[]>> => ipcRenderer.invoke('purchases.listSuppliers'),
    createSupplier: (req: { name: string; phone?: string }): Promise<Result<number>> => ipcRenderer.invoke('purchases.createSupplier', req),
    record: (req: RecordPurchaseRequest): Promise<Result<void>> => ipcRenderer.invoke('purchases.record', req),
    list: (req?: { dateFrom?: string; dateTo?: string }): Promise<Result<PurchaseEntryRow[]>> => ipcRenderer.invoke('purchases.list', req)
  },
  expenses: {
    record: (req: RecordExpenseRequest): Promise<Result<void>> => ipcRenderer.invoke('expenses.record', req),
    list: (req?: { dateFrom?: string; dateTo?: string }): Promise<Result<ExpenseRow[]>> => ipcRenderer.invoke('expenses.list', req),
    delete: (req: { expenseId: number; userId: string }): Promise<Result<void>> => ipcRenderer.invoke('expenses.delete', req)
  },
  reports: {
    dailySales: (req: DateRange): Promise<Result<DailySalesRow[]>> => ipcRenderer.invoke('reports.dailySales', req),
    salesByProduct: (req: DateRange): Promise<Result<SalesByProductRow[]>> => ipcRenderer.invoke('reports.salesByProduct', req),
    salesByVariant: (req: DateRange): Promise<Result<SalesByVariantRow[]>> => ipcRenderer.invoke('reports.salesByVariant', req),
    inventory: (): Promise<Result<InventoryReportRow[]>> => ipcRenderer.invoke('reports.inventory'),
    lowStock: (): Promise<Result<LowStockRow[]>> => ipcRenderer.invoke('reports.lowStock'),
    packing: (req: DateRange): Promise<Result<PackingReportRun[]>> => ipcRenderer.invoke('reports.packing', req),
    profit: (req: DateRange): Promise<Result<ProfitReportRow[]>> => ipcRenderer.invoke('reports.profit', req),
    dues: (): Promise<Result<DuesRow[]>> => ipcRenderer.invoke('reports.dues'),
    expenses: (req: DateRange): Promise<Result<ExpensesSummaryRow[]>> => ipcRenderer.invoke('reports.expenses', req),
    paymentBreakdown: (req: DateRange): Promise<Result<PaymentBreakdownRow>> => ipcRenderer.invoke('reports.paymentBreakdown', req),
    repayments: (req: DateRange): Promise<Result<RepaymentReportRow[]>> => ipcRenderer.invoke('reports.repayments', req)
  },
  invoiceHistory: {
    search: (req: SearchInvoicesRequest): Promise<Result<SearchInvoicesResponse>> => ipcRenderer.invoke('invoiceHistory.search', req),
    getInvoice: (req: { invoiceId: string }): Promise<Result<InvoiceRow | null>> => ipcRenderer.invoke('invoiceHistory.getInvoice', req),
    void: (req: { invoiceId: string; userId: string }): Promise<Result<void>> => ipcRenderer.invoke('invoiceHistory.void', req),
    unvoid: (req: { invoiceId: string; userId: string }): Promise<Result<void>> => ipcRenderer.invoke('invoiceHistory.unvoid', req),
    delete: (req: { invoiceId: string; userId: string }): Promise<Result<void>> => ipcRenderer.invoke('invoiceHistory.delete', req),
    editDateTime: (req: EditInvoiceDateTimeRequest): Promise<Result<InvoiceRow>> => ipcRenderer.invoke('invoiceHistory.editDateTime', req),
    getEditLog: (req: { invoiceId: string }): Promise<Result<EditLogRow[]>> => ipcRenderer.invoke('invoiceHistory.getEditLog', req),
    updateDetails: (req: UpdateInvoiceDetailsRequest): Promise<Result<InvoiceRow>> => ipcRenderer.invoke('invoiceHistory.updateDetails', req)
  },
  backup: {
    create: (type: 'manual'|'auto'|'pre-restore'): Promise<Result<string>> => ipcRenderer.invoke('backup.create', type),
    restore: (filePath: string): Promise<Result<boolean>> => ipcRenderer.invoke('backup.restore', filePath),
    list: (): Promise<Result<Array<{ fileName: string, filePath: string, sizeBytes: number, createdAt: number }>>> => ipcRenderer.invoke('backup.list'),
    selectFolder: (): Promise<Result<string>> => ipcRenderer.invoke('backup.selectFolder')
  },
  settings: {
    get: (key: string): Promise<Result<string | null>> => ipcRenderer.invoke('settings.get', key),
    getAll: (): Promise<Result<Record<string, string>>> => ipcRenderer.invoke('settings.getAll'),
    set: (req: { key: string, value: string }): Promise<Result<void>> => ipcRenderer.invoke('settings.set', req),
    setAll: (req: Record<string, string>): Promise<Result<void>> => ipcRenderer.invoke('settings.setAll', req),

    clearAllData: (userId: string): Promise<Result<void>> => ipcRenderer.invoke('settings.clearAllData', userId)
  },
  users: {
    list: (): Promise<Result<Array<{ id: string; name: string; role: string }>>> => ipcRenderer.invoke('users.list'),
    create: (req: { name: string; role: string; pin: string }): Promise<Result<number>> => ipcRenderer.invoke('users.create', req),
    updatePin: (req: { id: string; pin: string }): Promise<Result<void>> => ipcRenderer.invoke('users.updatePin', req),
    delete: (req: { id: string; userId: string }): Promise<Result<void>> => ipcRenderer.invoke('users.delete', req)
  },
  sync: {
    run: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('sync.run'),
    forcePush: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('sync.forcePush'),
    forcePull: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('sync.forcePull'),
    checkRemoteState: (): Promise<{ ok: boolean, data?: { outOfSync: boolean, lastRemoteSync?: number, lastLocalSync?: number }, message?: string }> => ipcRenderer.invoke('sync.checkRemoteState'),
    getLastSyncTime: (): Promise<{ ok: boolean, data: number | null }> => ipcRenderer.invoke('sync.getLastSyncTime')
  },
  factory: {
    listItems: (): Promise<Result<any[]>> => ipcRenderer.invoke('factory.listItems'),
    createItem: (req: any): Promise<Result<void>> => ipcRenderer.invoke('factory.createItem', req),
    deleteItem: (id: string): Promise<Result<void>> => ipcRenderer.invoke('factory.deleteItem', id),
    listTransactions: (itemId?: string): Promise<Result<any[]>> => ipcRenderer.invoke('factory.listTransactions', itemId),
    createTransaction: (req: any): Promise<Result<void>> => ipcRenderer.invoke('factory.createTransaction', req),
    deleteTransaction: (id: string): Promise<Result<void>> => ipcRenderer.invoke('factory.deleteTransaction', id),
    listProductionRuns: (): Promise<Result<any[]>> => ipcRenderer.invoke('factory.listProductionRuns'),
    createProductionRun: (req: any): Promise<Result<void>> => ipcRenderer.invoke('factory.createProductionRun', req),
    deleteProductionRun: (id: string): Promise<Result<void>> => ipcRenderer.invoke('factory.deleteProductionRun', id),
    getRawMaterialStock: (): Promise<Result<any[]>> => ipcRenderer.invoke('factory.getRawMaterialStock')
  }
}

if (process.contextIsolated) {
  try { contextBridge.exposeInMainWorld('api', api) } catch (e) { console.error(e) }
} else {
  // @ts-ignore
  window.api = api
}

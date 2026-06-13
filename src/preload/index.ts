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
  PaymentBreakdownRow,
  InvoiceRow, SearchInvoicesRequest, EditInvoiceDateTimeRequest, EditLogRow,
  UpdateInvoiceDetailsRequest
} from '../shared/types'

const api = {
  ping: (req: PingRequest): Promise<PingResponse> => ipcRenderer.invoke('ping', req),
  auth: { login: (req: LoginRequest): Promise<LoginResponse> => ipcRenderer.invoke('auth.login', req) },
  products: {
    listCategories: (): Promise<Result<Category[]>> => ipcRenderer.invoke('products.listCategories'),
    generateBarcode: (req: { productName: string; weightGrams: number }): Promise<Result<string>> => ipcRenderer.invoke('products.generateBarcode', req),
    createCategory: (req: CreateCategoryRequest & { userId: number }): Promise<Result<Category>> => ipcRenderer.invoke('products.createCategory', req),
    listProducts: (): Promise<Result<Product[]>> => ipcRenderer.invoke('products.listProducts'),
    createProduct: (req: CreateProductRequest & { userId: number }): Promise<Result<number>> => ipcRenderer.invoke('products.createProduct', req),
    createVariant: (req: CreateVariantRequest & { userId: number }): Promise<Result<number>> => ipcRenderer.invoke('products.createVariant', req),
    updateProduct: (req: UpdateProductRequest & { userId: number }): Promise<Result<void>> => ipcRenderer.invoke('products.updateProduct', req),
    updateVariant: (req: UpdateVariantRequest & { userId: number }): Promise<Result<void>> => ipcRenderer.invoke('products.updateVariant', req),
    toggleProductEnabled: (req: { id: number; userId: number }): Promise<Result<void>> => ipcRenderer.invoke('products.toggleProductEnabled', req),
    toggleVariantEnabled: (req: { id: number; userId: number }): Promise<Result<void>> => ipcRenderer.invoke('products.toggleVariantEnabled', req),
    deleteProduct: (req: { productId: number; userId: number }): Promise<Result<void>> => ipcRenderer.invoke('products.deleteProduct', req)
  },
  pricing: {
    getCurrentPrice: (req: GetCurrentPriceRequest): Promise<Result<PriceMenuEntry | null>> => ipcRenderer.invoke('pricing.getCurrentPrice', req),
    listAllEntries: (): Promise<Result<PriceMenuEntry[]>> => ipcRenderer.invoke('pricing.listAllEntries'),
    setVariantPrice: (req: SetVariantPriceRequest): Promise<Result<void>> => ipcRenderer.invoke('pricing.setVariantPrice', req),
    setProductLooseRate: (req: SetProductLooseRateRequest): Promise<Result<void>> => ipcRenderer.invoke('pricing.setProductLooseRate', req),
    listPriceHistory: (req: { variantId: number }): Promise<Result<PriceHistoryRow[]>> => ipcRenderer.invoke('pricing.listPriceHistory', req)
  },
  bulkInventory: {
    getBulkStock: (req: { productId: number }): Promise<Result<BulkStockRow | null>> => ipcRenderer.invoke('bulkInventory.getBulkStock', req),
    listAllBulkStock: (): Promise<Result<BulkStockRow[]>> => ipcRenderer.invoke('bulkInventory.listAllBulkStock'),
    recordArrival: (req: RecordBulkArrivalRequest): Promise<Result<void>> => ipcRenderer.invoke('bulkInventory.recordArrival', req),
    recordAdjustment: (req: RecordBulkAdjustmentRequest): Promise<Result<void>> => ipcRenderer.invoke('bulkInventory.recordAdjustment', req),
    listArrivals: (req: { productId: number }): Promise<Result<BulkArrivalRow[]>> => ipcRenderer.invoke('bulkInventory.listArrivals', req),
    listAdjustments: (req: { productId: number }): Promise<Result<BulkAdjustmentRow[]>> => ipcRenderer.invoke('bulkInventory.listAdjustments', req),
    deleteArrival: (req: { arrivalId: number; userId: number }): Promise<Result<void>> => ipcRenderer.invoke('bulkInventory.deleteArrival', req)
  },
  packing: {
    validate: (req: ValidatePackingRunRequest): Promise<ValidatePackingRunResult> => ipcRenderer.invoke('packing.validate', req),
    commit: (req: CommitPackingRunRequest): Promise<Result<number>> => ipcRenderer.invoke('packing.commit', req),
    listRuns: (req?: { productId?: number }): Promise<Result<PackingRunRow[]>> => ipcRenderer.invoke('packing.listRuns', req)
  },
  retailInventory: {
    getStock: (req?: { variantId?: number }): Promise<Result<RetailStockRow[]>> => ipcRenderer.invoke('retailInventory.getStock', req),
    recordAdjustment: (req: RecordRetailAdjustmentRequest): Promise<Result<void>> => ipcRenderer.invoke('retailInventory.recordAdjustment', req),
    listMovements: (req: { variantId: number }): Promise<Result<RetailMovementRow[]>> => ipcRenderer.invoke('retailInventory.listMovements', req)
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
  print: { receipt: (req: { invoiceId: number }): Promise<Result<void>> => ipcRenderer.invoke('print.receipt', req) },
  customers: {
    list: (req?: { type?: 'retail' | 'wholesale' }): Promise<Result<CustomerRow[]>> => ipcRenderer.invoke('customers.list', req),
    get: (req: { id: number }): Promise<Result<CustomerRow | null>> => ipcRenderer.invoke('customers.get', req),
    create: (req: CreateCustomerRequest): Promise<Result<number>> => ipcRenderer.invoke('customers.create', req),
    update: (req: UpdateCustomerRequest): Promise<Result<void>> => ipcRenderer.invoke('customers.update', req),
    listPayments: (req: { customerId: number }): Promise<Result<PaymentRow[]>> => ipcRenderer.invoke('customers.listPayments', req),
    updateCustomerPhone: (customerId: number, phone: string): Promise<Result<void>> => ipcRenderer.invoke('customers.updatePhone', { customerId, phone })
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
    delete: (req: { expenseId: number; userId: number }): Promise<Result<void>> => ipcRenderer.invoke('expenses.delete', req)
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
    paymentBreakdown: (req: DateRange): Promise<Result<PaymentBreakdownRow>> => ipcRenderer.invoke('reports.paymentBreakdown', req)
  },
  invoiceHistory: {
    search: (req: SearchInvoicesRequest): Promise<Result<InvoiceRow[]>> => ipcRenderer.invoke('invoiceHistory.search', req),
    getInvoice: (req: { invoiceId: number }): Promise<Result<InvoiceRow | null>> => ipcRenderer.invoke('invoiceHistory.getInvoice', req),
    void: (req: { invoiceId: number; userId: number }): Promise<Result<void>> => ipcRenderer.invoke('invoiceHistory.void', req),
    unvoid: (req: { invoiceId: number; userId: number }): Promise<Result<void>> => ipcRenderer.invoke('invoiceHistory.unvoid', req),
    delete: (req: { invoiceId: number; userId: number }): Promise<Result<void>> => ipcRenderer.invoke('invoiceHistory.delete', req),
    editDateTime: (req: EditInvoiceDateTimeRequest): Promise<Result<InvoiceRow>> => ipcRenderer.invoke('invoiceHistory.editDateTime', req),
    getEditLog: (req: { invoiceId: number }): Promise<Result<EditLogRow[]>> => ipcRenderer.invoke('invoiceHistory.getEditLog', req),
    updateDetails: (req: UpdateInvoiceDetailsRequest): Promise<Result<InvoiceRow>> => ipcRenderer.invoke('invoiceHistory.updateDetails', req)
  }
}

if (process.contextIsolated) {
  try { contextBridge.exposeInMainWorld('api', api) } catch (e) { console.error(e) }
} else {
  // @ts-ignore
  window.api = api
}

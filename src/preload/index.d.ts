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
  InvoiceRow, SearchInvoicesRequest, EditInvoiceDateTimeRequest, EditLogRow,
  UpdateInvoiceDetailsRequest
} from '../shared/types'

declare global {
  interface Window {
    api: {
      ping: (req: PingRequest) => Promise<PingResponse>
      auth: { login: (req: LoginRequest) => Promise<LoginResponse> }
      products: {
        listCategories: () => Promise<Result<Category[]>>
        generateBarcode: (req: { productName: string; weightGrams: number }) => Promise<Result<string>>
        createCategory: (req: CreateCategoryRequest & { userId: string }) => Promise<Result<Category>>
        listProducts: () => Promise<Result<Product[]>>
        createProduct: (req: CreateProductRequest & { userId: string }) => Promise<Result<number>>
        createVariant: (req: CreateVariantRequest & { userId: string }) => Promise<Result<number>>
        updateProduct: (req: UpdateProductRequest & { userId: string }) => Promise<Result<void>>
        updateVariant: (req: UpdateVariantRequest & { userId: string }) => Promise<Result<void>>
        toggleProductEnabled: (req: { id: string; userId: string }) => Promise<Result<void>>
        toggleVariantEnabled: (req: { id: string; userId: string }) => Promise<Result<void>>
        deleteProduct: (req: { productId: string; userId: string }) => Promise<Result<void>>
      }
      pricing: {
        getCurrentPrice: (req: GetCurrentPriceRequest) => Promise<Result<PriceMenuEntry | null>>
        listAllEntries: () => Promise<Result<PriceMenuEntry[]>>
        setVariantPrice: (req: SetVariantPriceRequest) => Promise<Result<void>>
        setProductLooseRate: (req: SetProductLooseRateRequest) => Promise<Result<void>>
        listPriceHistory: (req: { variantId: string }) => Promise<Result<PriceHistoryRow[]>>
      }
      bulkInventory: {
        getBulkStock: (req: { productId: string }) => Promise<Result<BulkStockRow | null>>
        listAllBulkStock: () => Promise<Result<BulkStockRow[]>>
        recordArrival: (req: RecordBulkArrivalRequest) => Promise<Result<void>>
        recordAdjustment: (req: RecordBulkAdjustmentRequest) => Promise<Result<void>>
        listArrivals: (req: { productId: string }) => Promise<Result<BulkArrivalRow[]>>
        listAdjustments: (req: { productId: string }) => Promise<Result<BulkAdjustmentRow[]>>
        deleteArrival: (req: { arrivalId: number; userId: string }) => Promise<Result<void>>
      }
      packing: {
        validate: (req: ValidatePackingRunRequest) => Promise<ValidatePackingRunResult>
        commit: (req: CommitPackingRunRequest) => Promise<Result<number>>
        listRuns: (req?: { productId?: number }) => Promise<Result<PackingRunRow[]>>
      }
      retailInventory: {
        getStock: (req?: { variantId?: number }) => Promise<Result<RetailStockRow[]>>
        recordAdjustment: (req: RecordRetailAdjustmentRequest) => Promise<Result<void>>
        listMovements: (req: { variantId: string }) => Promise<Result<RetailMovementRow[]>>
      }
      labels: {
        printLabels: (req: PrintLabelsRequest) => Promise<Result<void>>
        listPrintLog: (req?: { variantId?: number }) => Promise<Result<LabelPrintLogRow[]>>
      }
      billing: {
        lookupBarcode: (req: { barcode: string }) => Promise<Result<BarcodeResult | null>>
        createRetailSale: (req: CreateRetailSaleRequest) => Promise<Result<SavedInvoice>>
        createWholesaleSale: (req: CreateWholesaleSaleRequest) => Promise<Result<SavedInvoice>>
        recordPartyPayment: (req: RecordPartyPaymentRequest) => Promise<Result<void>>
        listRetailItems: () => Promise<Result<RetailItemRow[]>>
        listWholesaleItems: () => Promise<Result<{ packets: WholesaleItemRow[]; loose: LooseItemRow[] }>>
      }
      print: { 
        receipt: (req: { invoiceId: string }) => Promise<Result<void>>
        listPrinters: () => Promise<Result<any[]>>
      }
      customers: {
        list: (req?: { type?: 'retail' | 'wholesale' }) => Promise<Result<CustomerRow[]>>
        get: (req: { id: string }) => Promise<Result<CustomerRow | null>>
        create: (req: CreateCustomerRequest) => Promise<Result<number>>
        update: (req: UpdateCustomerRequest) => Promise<Result<void>>
        listPayments: (req: { customerId: string }) => Promise<Result<PaymentRow[]>>
        updateCustomerPhone: (customerId: string, phone: string) => Promise<Result<void>>
      }
      purchases: {
        listSuppliers: () => Promise<Result<SupplierRow[]>>
        createSupplier: (req: { name: string; phone?: string }) => Promise<Result<number>>
        record: (req: RecordPurchaseRequest) => Promise<Result<void>>
        list: (req?: { dateFrom?: string; dateTo?: string }) => Promise<Result<PurchaseEntryRow[]>>
      }
      expenses: {
        record: (req: RecordExpenseRequest) => Promise<Result<void>>
        list: (req?: { dateFrom?: string; dateTo?: string }) => Promise<Result<ExpenseRow[]>>
        delete: (req: { expenseId: number; userId: string }) => Promise<Result<void>>
      }
      reports: {
        dailySales: (req: DateRange) => Promise<Result<DailySalesRow[]>>
        salesByProduct: (req: DateRange) => Promise<Result<SalesByProductRow[]>>
        salesByVariant: (req: DateRange) => Promise<Result<SalesByVariantRow[]>>
        inventory: () => Promise<Result<InventoryReportRow[]>>
        lowStock: () => Promise<Result<LowStockRow[]>>
        packing: (req: DateRange) => Promise<Result<PackingReportRun[]>>
        profit: (req: DateRange) => Promise<Result<ProfitReportRow[]>>
        dues: () => Promise<Result<DuesRow[]>>
        expenses: (req: DateRange) => Promise<Result<ExpensesSummaryRow[]>>
        paymentBreakdown: (req: DateRange) => Promise<Result<PaymentBreakdownRow>>
        repayments: (req: DateRange) => Promise<Result<RepaymentReportRow[]>>
      }
      invoiceHistory: {
        search: (req: SearchInvoicesRequest) => Promise<Result<InvoiceRow[]>>
        getInvoice: (req: { invoiceId: string }) => Promise<Result<InvoiceRow | null>>
        void: (req: { invoiceId: string; userId: string }) => Promise<Result<void>>
        unvoid: (req: { invoiceId: string; userId: string }) => Promise<Result<void>>
        delete: (req: { invoiceId: string; userId: string }) => Promise<Result<void>>
        editDateTime: (req: EditInvoiceDateTimeRequest) => Promise<Result<InvoiceRow>>
        getEditLog: (req: { invoiceId: string }) => Promise<Result<EditLogRow[]>>
        updateDetails: (req: UpdateInvoiceDetailsRequest) => Promise<Result<InvoiceRow>>
      }
      backup: {
        create: (type: 'manual'|'auto'|'pre-restore') => Promise<Result<string>>
        restore: (filePath: string) => Promise<Result<boolean>>
        list: () => Promise<Result<Array<{ fileName: string, filePath: string, sizeBytes: number, createdAt: number }>>>
        selectFolder: () => Promise<Result<string>>
      }
      settings: {
        get: (key: string) => Promise<Result<string | null>>
        getAll: () => Promise<Result<Record<string, string>>>
        set: (req: { key: string, value: string }) => Promise<Result<void>>
        setAll: (req: Record<string, string>) => Promise<Result<void>>
        clearAllData: (userId: string) => Promise<Result<void>>
      }
      users: {
        list: () => Promise<Result<Array<{ id: string; name: string; role: string }>>>
        create: (req: { name: string; role: string; pin: string }) => Promise<Result<number>>
        updatePin: (req: { id: string; pin: string }) => Promise<Result<void>>
        delete: (req: { id: string; userId: string }) => Promise<Result<void>>
      }
      sync: {
        run: () => Promise<{ ok: boolean; message: string }>
        forcePush: () => Promise<{ ok: boolean; message: string }>
        checkRemoteState: () => Promise<{ ok: boolean, data?: { outOfSync: boolean, lastRemoteSync?: number, lastLocalSync?: number }, message?: string }>
        getLastSyncTime: () => Promise<{ ok: boolean, data: number | null }>
      }
    }
  }
}

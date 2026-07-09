// src/main/services/labels.ts — Label printing (main process only)
// CRITICAL: This service NEVER touches RetailPacketStock, BulkStock, or any cost column.
// Reprice / reprint / after_pack all do the same thing: print + log. No stock changes.
import { BrowserWindow } from 'electron'
import { join } from 'path'
import { eq, desc } from 'drizzle-orm'
import { getDb } from '../db'
import { labelPrintLog, settings, productVariants, products } from '../db/schema'
import { getCurrentPrice } from './pricing'
import type { PrintLabelsRequest, LabelPrintLogRow } from '../../shared/types'

function getSetting(key: string, fallback: string): string {
  const row = getDb().select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get()
  return row?.value ?? fallback
}

function generateHtml(productName: string, variantLabel: string, barcode: string, pricePaise: number, qty: number, dateStr: string): string {
  const priceStr = `₹${(pricePaise / 100).toFixed(2)}`
  const singleLabel = `<div style="width:1.5in;height:1in;box-sizing:border-box;padding:4px;text-align:center;page-break-after:always;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:sans-serif;overflow:hidden;">
      <div style="font-size:11px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;">${productName}</div>
      <div style="font-size:10px;">${variantLabel}</div>
      <svg class="bc"></svg>
      <div style="font-size:13px;font-weight:bold;margin-top:4px;display:flex;justify-content:space-between;width:80%;align-items:center;">
        <span>${priceStr}</span>
        <span style="font-size:8px;font-weight:normal;color:#333;">${dateStr}</span>
      </div>
    </div>`
  // Use a CDN-hosted JsBarcode that runs in the hidden BrowserWindow
  const jsBarcodePath = 'file://' + join(__dirname, '../printing/templates/JsBarcode.all.min.js')
  return `<!DOCTYPE html><html><body style="margin:0">
    ${Array(qty).fill(singleLabel).join('')}
    <script src="${jsBarcodePath}"></script>
    <script>
      document.querySelectorAll('.bc').forEach(function(el) {
        JsBarcode(el, '${barcode}', {format:'CODE128',height:35,fontSize:9,margin:2});
      });
    </script>
  </body></html>`
}

export async function printLabels(req: PrintLabelsRequest): Promise<void> {
  if (req.qty <= 0) throw new Error('Quantity must be positive')

  const db = getDb()

  // Fetch current price from Price Menu — NEVER consults cost (rules.md #1)
  const priceEntry = getCurrentPrice({ variantId: req.variantId })
  if (!priceEntry) throw new Error('No Price Menu entry found for this variant. Set a price first.')
  const pricePaise = priceEntry.retailPricePaise

  // Fetch variant + product name for label
  const varInfo = db
    .select({
      barcode: productVariants.barcode,
      label: productVariants.label,
      productName: products.name
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(productVariants.id, req.variantId))
    .get()
  
  if (!varInfo) throw new Error('Variant not found')

  const dateToPrint = req.dateStr || new Date().toISOString().slice(0, 10)
  
  const html = generateHtml(varInfo.productName, varInfo.label, varInfo.barcode, pricePaise, req.qty, dateToPrint)
  const deviceName = getSetting('label_printer_device', '')
  const pageSize = getSetting('label_printer_page_size', 'A4')

  // Print via a hidden BrowserWindow (architecture.md — printing pattern)
  await new Promise<void>((resolve, reject) => {
    const win = new BrowserWindow({ show: false, webPreferences: { javascript: true, sandbox: false } })
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    win.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        win.webContents.print(
          { silent: true, deviceName: deviceName || undefined,
            pageSize: pageSize as 'A0'|'A1'|'A2'|'A3'|'A4'|'A5'|'A6'|'Legal'|'Letter'|'Tabloid' },
          (success, errorType) => {
            win.destroy()
            if (success) resolve()
            else reject(new Error(`Print failed: ${errorType ?? 'unknown'}`))
          }
        )
      }, 400) // allow JsBarcode script to render
    })
    win.webContents.on('did-fail-load', () => { win.destroy(); reject(new Error('Label HTML failed to load')) })
  })

  // ── ONLY write to LabelPrintLog — no other table touched ──────────────────
  const today = new Date().toISOString().slice(0, 10)
  db.insert(labelPrintLog)
    .values({ date: today, variantId: req.variantId, qty: req.qty,
              pricePrintedPaise: pricePaise, type: req.type, userId: req.userId })
    .run()
}

export function listPrintLog(variantId?: number): LabelPrintLogRow[] {
  const db = getDb()
  const rows = variantId
    ? db.select().from(labelPrintLog).where(eq(labelPrintLog.variantId, variantId))
        .orderBy(desc(labelPrintLog.createdAt)).limit(50).all()
    : db.select().from(labelPrintLog).orderBy(desc(labelPrintLog.createdAt)).limit(50).all()

  return rows.map((r) => ({
    id: r.id, date: r.date, variantId: r.variantId, qty: r.qty,
    pricePrintedPaise: r.pricePrintedPaise, type: r.type, userId: r.userId,
    createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt)
  }))
}

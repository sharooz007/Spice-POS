// @ts-nocheck
// src/main/services/labels.ts — Label printing (main process only)
// CRITICAL: This service NEVER touches RetailPacketStock, BulkStock, or any cost column.
// Reprice / reprint / after_pack all do the same thing: print + log. No stock changes.
import { BrowserWindow } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
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
  
  const singleLabel = `
    <div style="width:40mm; height:35mm; box-sizing:border-box; padding:2mm; display:flex; flex-direction:column; justify-content:center; align-items:center; overflow:hidden; flex-shrink:0;">
      <div style="font-size:11px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;">${productName}</div>
      <div style="font-size:10px;">${variantLabel}</div>
      <svg class="bc"></svg>
      <div style="font-size:11px; font-weight:bold; margin-top:2px; display:flex; justify-content:space-between; width:100%; align-items:center;">
        <span>${priceStr}</span>
        <span style="font-size:8px; font-weight:normal; color:#000;">${dateStr}</span>
      </div>
    </div>`

  const emptyLabel = `<div style="width:40mm; height:35mm; flex-shrink:0;"></div>`
  const gap = `<div style="width:3mm; height:35mm; flex-shrink:0;"></div>`

  let rowsHtml = ''
  for (let i = 0; i < qty; i += 2) {
    const hasRight = (i + 1 < qty)
    rowsHtml += `
      <div style="width:83mm; height:35mm; display:flex; flex-direction:row; box-sizing:border-box; overflow:hidden; page-break-after:always;">
        ${singleLabel}
        ${gap}
        ${hasRight ? singleLabel : emptyLabel}
      </div>
    `
  }

  // Inject JsBarcode directly to avoid local file:// origin restrictions in data: URIs
  // Note: electron-vite bundles into out/main/index.js, so __dirname is out/main.
  const jsBarcodeCode = readFileSync(join(__dirname, 'printing/templates/JsBarcode.all.min.js'), 'utf-8')
  
  return `<!DOCTYPE html><html>
  <head>
    <style>
      @page { size: 83mm 35mm; margin: 0; }
      body { margin: 0; padding: 0; font-family: sans-serif; width: 83mm; background: #fff; color: #000; }
    </style>
  </head>
  <body>
    ${rowsHtml}
    <script>${jsBarcodeCode}</script>
    <script>
      document.querySelectorAll('.bc').forEach(function(el) {
        JsBarcode(el, '${barcode}', {format:'CODE128',height:30,width:1.2,fontSize:9,margin:0});
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
            pageSize: { width: 83000, height: 35000 },
            margins: { marginType: 'none' } },
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

export function listPrintLog(variantId?: string): LabelPrintLogRow[] {
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

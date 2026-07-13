// src/main/printing/print.ts — receipt printing via webContents.print()
import { BrowserWindow } from 'electron'
import { readFileSync } from 'fs'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { invoices, invoiceLines, productVariants, products, settings } from '../db/schema'

function getSetting(key: string, fallback: string): string {
  const row = getDb().select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get()
  return row?.value ?? fallback
}

function fmt(paise: number): string {
  return '₹' + (paise / 100).toFixed(2)
}

export async function printReceipt(invoiceId: string): Promise<void> {
  const db = getDb()

  const inv = db.select().from(invoices).where(eq(invoices.id, invoiceId)).get()
  if (!inv) throw new Error(`Invoice ${invoiceId} not found`)

  const lines = db
    .select({
      qty: invoiceLines.qty,
      unitPricePaise: invoiceLines.unitPricePaise,
      lineTotalPaise: invoiceLines.lineTotalPaise,
      label: productVariants.label,
      productName: products.name
    })
    .from(invoiceLines)
    .leftJoin(productVariants, eq(invoiceLines.variantId, productVariants.id))
    .leftJoin(products, eq(productVariants.productId, products.id))
    .where(eq(invoiceLines.invoiceId, invoiceId))
    .all()

  const shopName = getSetting('shop_name', 'Spice Shop')
  const shopAddress = getSetting('shop_address', '')
  const shopPhone = getSetting('shop_phone', '')
  const deviceName = getSetting('receipt_printer_device', '')
  const pageSize = getSetting('receipt_printer_page_size', 'A4')

  // Read template and fill placeholders via inline script
  const templatePath = join(__dirname, 'templates', 'receipt.html')
  let html: string
  try {
    html = readFileSync(templatePath, 'utf-8')
  } catch {
    // fallback: load from source (dev mode)
    html = readFileSync(
      join(__dirname, '../../src/main/printing/templates/receipt.html'),
      'utf-8'
    )
  }

  const invDate = inv.invoiceDatetime instanceof Date
    ? inv.invoiceDatetime.toLocaleString()
    : new Date(Number(inv.invoiceDatetime)).toLocaleString()

  const linesHtml = lines
    .map(
      (l) =>
        `<tr><td>${l.productName ?? ''} ${l.label ?? ''}</td>
         <td class="right">${l.qty}</td>
         <td class="right">${fmt(l.unitPricePaise)}</td>
         <td class="right">${fmt(l.lineTotalPaise)}</td></tr>`
    )
    .join('')

  const fillScript = `<script>
    document.getElementById('shop-name').textContent = ${JSON.stringify(shopName)};
    document.getElementById('shop-address').textContent = ${JSON.stringify(shopAddress)};
    document.getElementById('shop-phone').textContent = ${JSON.stringify(shopPhone)};
    document.getElementById('invoice-no').textContent = ${JSON.stringify(inv.invoiceNo)};
    document.getElementById('invoice-date').textContent = ${JSON.stringify(invDate)};
    document.getElementById('lines').innerHTML = ${JSON.stringify(linesHtml)};
    document.getElementById('subtotal').textContent = ${JSON.stringify(fmt(inv.subtotalPaise))};
    document.getElementById('total').textContent = ${JSON.stringify(fmt(inv.totalPaise))};
    document.getElementById('payment-mode').textContent = ${JSON.stringify(inv.paymentMode)};
    document.getElementById('amount-paid').textContent = ${JSON.stringify(fmt(inv.amountPaidPaise))};
    if (${inv.discountPaise} > 0) {
      document.getElementById('discount-row').style.display = '';
      document.getElementById('discount').textContent = ${JSON.stringify(fmt(inv.discountPaise))};
    }
  </script>`

  const fullHtml = html.replace('</body>', fillScript + '</body>')

  await new Promise<void>((resolve, reject) => {
    const win = new BrowserWindow({ show: false, webPreferences: { javascript: true, sandbox: false } })
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml))
    win.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        win.webContents.print(
          { silent: true, deviceName: deviceName || undefined,
            pageSize: pageSize as 'A4'|'A5'|'Letter' },
          (success, errType) => {
            win.destroy()
            if (success) resolve()
            else reject(new Error(`Print failed: ${errType ?? 'unknown'}`))
          }
        )
      }, 200)
    })
    win.webContents.on('did-fail-load', () => { win.destroy(); reject(new Error('Receipt load failed')) })
  })
}

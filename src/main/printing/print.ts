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
  const receiptFooter = getSetting('receipt_footer', 'Thank you! Visit again.')
  const deviceName = getSetting('receipt_printer', '')
  const receiptSize = getSetting('receipt_size', '80mm')

  // Read template and fill placeholders via inline script
  const templatePath = join(__dirname, 'printing', 'templates', 'receipt.html')
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

  const dateObj = inv.invoiceDatetime instanceof Date
    ? inv.invoiceDatetime
    : new Date(Number(inv.invoiceDatetime))
  
  const invDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-')
  const invTime = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  const linesHtml = lines
    .map(
      (l) =>
        `<div class="flex-row">
           <div class="col-item">${l.productName ?? ''} ${l.label ?? ''}</div>
           <div class="col-qty">${l.qty}</div>
           <div class="col-rate">${fmt(l.unitPricePaise)}</div>
           <div class="col-amt">${fmt(l.lineTotalPaise)}</div>
         </div>`
    )
    .join('')

  const fillScript = `<script>
    document.getElementById('shop-name').textContent = ${JSON.stringify(shopName)};
    document.getElementById('shop-address').textContent = ${JSON.stringify(shopAddress)};
    document.getElementById('shop-phone').textContent = ${shopPhone ? JSON.stringify('Ph: ' + shopPhone) : '""'};
    document.getElementById('invoice-no').textContent = ${JSON.stringify(inv.invoiceNo)};
    document.getElementById('invoice-date').textContent = ${JSON.stringify(invDate)};
    document.getElementById('invoice-time').textContent = ${JSON.stringify(invTime)};
    document.getElementById('lines').innerHTML = ${JSON.stringify(linesHtml)};
    document.getElementById('subtotal').textContent = ${JSON.stringify(fmt(inv.subtotalPaise))};
    document.getElementById('total').textContent = ${JSON.stringify(fmt(inv.totalPaise))};
    document.getElementById('payment-mode').textContent = ${JSON.stringify(inv.paymentMode)};
    document.getElementById('amount-paid').textContent = ${JSON.stringify(fmt(inv.amountPaidPaise))};
    document.getElementById('receipt-footer').textContent = ${JSON.stringify(receiptFooter)};
    if (${inv.discountPaise} > 0) {
      document.getElementById('discount-row').style.display = '';
      document.getElementById('discount').textContent = ${JSON.stringify(fmt(inv.discountPaise))};
    }
    const rSize = ${JSON.stringify(receiptSize)};
    const rSizeNum = parseFloat(rSize) || 80;
    document.body.style.width = rSizeNum + 'mm';
    document.body.style.fontSize = rSizeNum < 65 ? '10px' : rSizeNum < 75 ? '11px' : '12px';
    document.getElementById('shop-name').style.fontSize = rSizeNum < 65 ? '1.2em' : rSizeNum < 75 ? '1.3em' : '1.4em';
  </script>`

  const fullHtml = html.replace('</body>', fillScript + '</body>')

  await new Promise<void>((resolve, reject) => {
    const win = new BrowserWindow({ show: false, webPreferences: { javascript: true, sandbox: false } })
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml))
    win.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        win.webContents.print(
          { 
            silent: true, 
            deviceName: deviceName || undefined,
            margins: { marginType: 'none' }
          },
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

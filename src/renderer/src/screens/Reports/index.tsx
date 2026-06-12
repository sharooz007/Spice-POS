import { useState, useEffect, type ReactElement } from 'react'
import { useAppStore } from '../../store/appStore'
import { paiseToCurrency, gramsToKg, formatQuantity } from '@shared/money'
import type {
  DateRange, DailySalesRow, SalesByProductRow, SalesByVariantRow,
  InventoryReportRow, LowStockRow, PackingReportRun, ProfitReportRow, DuesRow
} from '@shared/types'

type ReportTab = 'daily' | 'byProduct' | 'byVariant' | 'inventory' | 'lowStock' | 'packing' | 'profit' | 'dues'

function today(): string { return new Date().toISOString().slice(0, 10) }
function monthStart(): string { return new Date().toISOString().slice(0, 7) + '-01' }

function DateRangeInput({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }): ReactElement {
  return (
    <div className="flex gap-2 items-center mb-3">
      <label className="text-xs text-gray-500">From</label>
      <input type="date" value={range.dateFrom} onChange={(e) => onChange({ ...range, dateFrom: e.target.value })}
        className="border border-gray-300 rounded px-2 py-1 text-sm" />
      <label className="text-xs text-gray-500">To</label>
      <input type="date" value={range.dateTo} onChange={(e) => onChange({ ...range, dateTo: e.target.value })}
        className="border border-gray-300 rounded px-2 py-1 text-sm" />
    </div>
  )
}

function ByVariantGrouped({ groups }: { groups: Array<{ productName: string; rows: SalesByVariantRow[] }> }): ReactElement {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  function toggle(name: string): void {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }
  if (groups.length === 0) return <p className="text-sm text-gray-400">No sales.</p>
  return (
    <table className="w-full text-sm border rounded-lg overflow-hidden bg-white">
      <thead><tr className="text-left text-xs text-gray-500 uppercase bg-gray-50 border-b">
        <th className="px-4 py-2">Product / Variant</th>
        <th className="px-4 py-2 text-right">Qty (pcs)</th>
        <th className="px-4 py-2 text-right">Revenue</th>
      </tr></thead>
      <tbody>
        {groups.map((g) => {
          const totalQty = g.rows.reduce((s, r) => s + r.qtyPcs, 0)
          const totalRev = g.rows.reduce((s, r) => s + r.revenuePaise, 0)
          const open = expanded.has(g.productName)
          return (
            <>
              <tr key={g.productName} className="border-b bg-gray-50 cursor-pointer hover:bg-gray-100"
                onClick={() => toggle(g.productName)}>
                <td className="px-4 py-2 font-semibold text-gray-800 flex items-center gap-2">
                  <span className="text-gray-400 text-xs">{open ? '▼' : '▶'}</span>
                  {g.productName}
                  <span className="text-xs font-normal text-gray-500">({g.rows.length} variant{g.rows.length !== 1 ? 's' : ''})</span>
                </td>
                <td className="px-4 py-2 text-right font-semibold">{totalQty}</td>
                <td className="px-4 py-2 text-right font-mono font-semibold">{paiseToCurrency(totalRev)}</td>
              </tr>
              {open && g.rows.map((r) => (
                <tr key={r.variantId} className="border-b last:border-0">
                  <td className="px-4 py-2 pl-10 text-gray-600">{r.label}</td>
                  <td className="px-4 py-2 text-right text-gray-700">{r.qtyPcs}</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-700">{paiseToCurrency(r.revenuePaise)}</td>
                </tr>
              ))}
            </>
          )
        })}
      </tbody>
    </table>
  )
}

export default function ReportsScreen(): ReactElement {
  const { user } = useAppStore()
  const isAdmin = user?.role === 'admin'
  const [tab, setTab] = useState<ReportTab>('daily')
  const [range, setRange] = useState<DateRange>({ dateFrom: monthStart(), dateTo: today() })

  const [dailyRows, setDailyRows] = useState<DailySalesRow[]>([])
  const [byProduct, setByProduct] = useState<SalesByProductRow[]>([])
  const [byVariant, setByVariant] = useState<SalesByVariantRow[]>([])
  const [inventory, setInventory] = useState<InventoryReportRow[]>([])
  const [lowStock, setLowStock] = useState<LowStockRow[]>([])
  const [packingRuns, setPackingRuns] = useState<PackingReportRun[]>([])
  const [profitRows, setProfitRows] = useState<ProfitReportRow[]>([])
  const [dues, setDues] = useState<DuesRow[]>([])
  const [error, setError] = useState('')

  async function load(): Promise<void> {
    setError('')
    if (tab === 'daily') {
      const r = await window.api.reports.dailySales(range)
      if (r.ok) setDailyRows(r.data); else setError(r.error)
    } else if (tab === 'byProduct') {
      const r = await window.api.reports.salesByProduct(range)
      if (r.ok) setByProduct(r.data); else setError(r.error)
    } else if (tab === 'byVariant') {
      const r = await window.api.reports.salesByVariant(range)
      if (r.ok) setByVariant(r.data); else setError(r.error)
    } else if (tab === 'inventory') {
      const r = await window.api.reports.inventory()
      if (r.ok) setInventory(r.data); else setError(r.error)
    } else if (tab === 'lowStock') {
      const r = await window.api.reports.lowStock()
      if (r.ok) setLowStock(r.data); else setError(r.error)
    } else if (tab === 'packing') {
      const r = await window.api.reports.packing(range)
      if (r.ok) setPackingRuns(r.data); else setError(r.error)
    } else if (tab === 'profit' && isAdmin) {
      const r = await window.api.reports.profit(range)
      if (r.ok) setProfitRows(r.data); else setError(r.error)
    } else if (tab === 'dues') {
      const r = await window.api.reports.dues()
      if (r.ok) setDues(r.data); else setError(r.error)
    }
  }

  useEffect(() => { load() }, [tab, range])

  const tabs: Array<{ key: ReportTab; label: string; adminOnly?: boolean }> = ([
    { key: 'daily' as ReportTab, label: 'Daily Sales' },
    { key: 'byProduct' as ReportTab, label: 'By Product' },
    { key: 'byVariant' as ReportTab, label: 'By Variant' },
    { key: 'inventory' as ReportTab, label: 'Inventory' },
    { key: 'lowStock' as ReportTab, label: 'Low Stock' },
    { key: 'packing' as ReportTab, label: 'Packing' },
    { key: 'profit' as ReportTab, label: 'Profit', adminOnly: true },
    { key: 'dues' as ReportTab, label: 'Dues' }
  ] as Array<{ key: ReportTab; label: string; adminOnly?: boolean }>).filter((t) => !t.adminOnly || isAdmin)

  const needsRange = ['daily', 'byProduct', 'byVariant', 'packing', 'profit'].includes(tab)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-800 mb-4">Reports</h1>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 mb-4">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded text-sm font-medium cursor-pointer transition-colors ${tab === t.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {needsRange && <DateRangeInput range={range} onChange={setRange} />}
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {/* ── Daily Sales ── */}
      {tab === 'daily' && (
        <table className="w-full text-sm border rounded-lg overflow-hidden bg-white">
          <thead><tr className="text-left text-xs text-gray-500 uppercase bg-gray-50 border-b">
            <th className="px-4 py-2">Business Date</th>
            <th className="px-4 py-2 text-right">Retail</th>
            <th className="px-4 py-2 text-right">Wholesale</th>
            <th className="px-4 py-2 text-right">Total</th>
            <th className="px-4 py-2 text-right">Invoices</th>
          </tr></thead>
          <tbody>
            {dailyRows.map((r) => (
              <tr key={r.businessDate} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{r.businessDate}</td>
                <td className="px-4 py-2 text-right font-mono">{paiseToCurrency(r.retailTotalPaise)}</td>
                <td className="px-4 py-2 text-right font-mono">{paiseToCurrency(r.wholesaleTotalPaise)}</td>
                <td className="px-4 py-2 text-right font-mono font-bold">{paiseToCurrency(r.combinedTotalPaise)}</td>
                <td className="px-4 py-2 text-right">{r.invoiceCount}</td>
              </tr>
            ))}
            {dailyRows.length === 0 && <tr><td colSpan={5} className="px-4 py-3 text-gray-400 text-sm">No sales in range.</td></tr>}
          </tbody>
        </table>
      )}

      {/* ── By Product ── */}
      {tab === 'byProduct' && (
        <table className="w-full text-sm border rounded-lg overflow-hidden bg-white">
          <thead><tr className="text-left text-xs text-gray-500 uppercase bg-gray-50 border-b">
            <th className="px-4 py-2">Product</th>
            <th className="px-4 py-2 text-right">Packets (pcs)</th>
            <th className="px-4 py-2 text-right">Loose (kg)</th>
            <th className="px-4 py-2 text-right">Revenue</th>
          </tr></thead>
          <tbody>
            {byProduct.map((r) => (
              <tr key={r.productId} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{r.productName}</td>
                <td className="px-4 py-2 text-right">{r.qtyPcs}</td>
                <td className="px-4 py-2 text-right">{r.qtyGrams > 0 ? gramsToKg(r.qtyGrams).toFixed(3) : '—'}</td>
                <td className="px-4 py-2 text-right font-mono">{paiseToCurrency(r.revenuePaise)}</td>
              </tr>
            ))}
            {byProduct.length === 0 && <tr><td colSpan={4} className="px-4 py-3 text-gray-400 text-sm">No sales.</td></tr>}
          </tbody>
        </table>
      )}

      {/* ── By Variant ── */}
      {tab === 'byVariant' && (() => {
        // Group rows by product
        const grouped: Array<{ productName: string; rows: SalesByVariantRow[] }> = []
        for (const r of byVariant) {
          const existing = grouped.find((g) => g.productName === r.productName)
          if (existing) existing.rows.push(r)
          else grouped.push({ productName: r.productName, rows: [r] })
        }
        return <ByVariantGrouped groups={grouped} />
      })()}

      {/* ── Inventory ── */}
      {tab === 'inventory' && (
        <table className="w-full text-sm border rounded-lg overflow-hidden bg-white">
          <thead><tr className="text-left text-xs text-gray-500 uppercase bg-gray-50 border-b">
            <th className="px-4 py-2">Item</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2 text-right">Qty</th>
            {/* Avg cost column — Admin only */}
            {isAdmin && <th className="px-4 py-2 text-right">Avg cost</th>}
          </tr></thead>
          <tbody>
            {inventory.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${r.type === 'bulk' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{r.type}</span>
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {r.type === 'bulk' ? formatQuantity(r.qty, r.unitType) : `${r.qty} pcs`}
                </td>
                {isAdmin && (
                  <td className="px-4 py-2 text-right font-mono text-xs text-gray-500">
                    {r.avgCost != null ? paiseToCurrency(Math.round(r.avgCost * 100)) + (r.type === 'bulk' ? (r.unitType === 'volume' ? '/L' : '/kg') : '/pc') : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Low Stock ── */}
      {tab === 'lowStock' && (
        <div className="flex flex-col gap-2">
          {lowStock.length === 0 && <p className="text-sm text-green-700 bg-green-50 rounded px-3 py-2">All stock levels are above thresholds. ✓</p>}
          {lowStock.map((r, i) => (
            <div key={i} className="flex items-center justify-between border border-red-200 bg-red-50 rounded-lg px-4 py-2">
              <div>
                <span className={`text-xs px-1.5 py-0.5 rounded-full mr-2 ${r.type === 'bulk' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{r.type}</span>
                <span className="font-medium text-sm text-gray-800">{r.name}</span>
              </div>
              <div className="text-sm text-right">
                <span className="text-red-600 font-semibold">
                  {r.type === 'bulk' ? formatQuantity(r.qtyAvailable, r.unitType) : `${r.qtyAvailable} pcs`}
                </span>
                <span className="text-gray-400 ml-1 text-xs">
                  (threshold: {r.type === 'bulk' ? formatQuantity(r.threshold, r.unitType) : `${r.threshold} pcs`})
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Packing ── */}
      {tab === 'packing' && (
        <div className="flex flex-col gap-3">
          {packingRuns.length === 0 && <p className="text-sm text-gray-400">No packing runs in range.</p>}
          {packingRuns.map((r) => (
            <div key={r.id} className="border rounded-lg bg-white p-3">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{r.productName} — {r.date}</span>
                <span className="font-mono text-gray-600">{formatQuantity(r.bulkUsedGrams, r.unitType)} used</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {r.lines.map((l, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {l.packetsCount}×{l.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Profit (Admin only) ── */}
      {tab === 'profit' && isAdmin && (
        <div className="flex flex-col gap-3">
          {profitRows.length === 0 && <p className="text-sm text-gray-400">No sales in range.</p>}
          {profitRows.map((r) => (
            <div key={r.businessDate} className="border rounded-lg bg-white p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-gray-800">{r.businessDate}</div>
                  <div className="text-lg font-bold text-green-700 mt-1">
                    {paiseToCurrency(r.totalProfitPaise)}
                  </div>
                </div>
                {/* Partial coverage warning — mandatory if null lines exist (rules.md #2) */}
                {r.nullCostLineCount > 0 && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 max-w-xs text-right">
                    Profit figures cover only items with recorded cost.
                    <strong className="ml-1">{r.nullCostLineCount} line{r.nullCostLineCount !== 1 ? 's' : ''} with unknown cost excluded from total.</strong>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Dues ── */}
      {tab === 'dues' && (
        <table className="w-full text-sm border rounded-lg overflow-hidden bg-white">
          <thead><tr className="text-left text-xs text-gray-500 uppercase bg-gray-50 border-b">
            <th className="px-4 py-2">Party</th>
            <th className="px-4 py-2">Business</th>
            <th className="px-4 py-2 text-right">Outstanding</th>
          </tr></thead>
          <tbody>
            {dues.map((r) => (
              <tr key={r.customerId} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className="px-4 py-2 text-gray-500">{r.businessName ?? '—'}</td>
                <td className="px-4 py-2 text-right font-mono font-bold text-red-600">{paiseToCurrency(r.creditBalancePaise)}</td>
              </tr>
            ))}
            {dues.length === 0 && <tr><td colSpan={3} className="px-4 py-3 text-gray-400 text-sm">No outstanding dues.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  )
}

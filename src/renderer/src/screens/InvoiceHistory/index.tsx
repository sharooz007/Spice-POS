// @ts-nocheck
import { useState, type ReactElement } from 'react'
import { paiseToCurrency } from '@shared/money'
import InvoiceDetailPanel from '../../components/InvoiceDetailPanel'
import type { InvoiceRow, SearchInvoicesRequest } from '@shared/types'

export default function InvoiceHistoryScreen(): ReactElement {
  const [invoiceNo, setInvoiceNo] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [typeFilter, setTypeFilter] = useState<'retail' | 'wholesale' | ''>('')
  const [results, setResults] = useState<InvoiceRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const limit = 50

  async function search(targetPage = 1): Promise<void> {
    const req: SearchInvoicesRequest = { page: targetPage, limit }
    if (invoiceNo.trim()) req.invoiceNo = invoiceNo.trim()
    if (dateFrom) req.dateFrom = dateFrom
    if (dateTo) req.dateTo = dateTo
    if (typeFilter) req.type = typeFilter
    const res = await window.api.invoiceHistory.search(req)
    if (res.ok) { 
      setResults(res.data.invoices)
      setTotalPages(res.data.totalPages)
      setTotalRecords(res.data.total)
      setPage(res.data.page)
      setError('') 
    }
    else setError(res.error)
  }

  // After a mutation (void/edit) refresh the row in the list
  async function handleUpdated(deleted?: boolean): Promise<void> {
    if (!selectedId) return
    if (deleted) {
      setResults((prev) => prev.filter((r) => r.id !== selectedId))
      setSelectedId(null)
      return
    }
    const res = await window.api.invoiceHistory.getInvoice({ invoiceId: selectedId })
    if (res.ok && res.data) {
      setResults((prev) => prev.map((r) => r.id === selectedId ? res.data! : r))
    }
  }

  return (
    <div className="page">
      <h1 className="text-xl font-bold text-gray-800 mb-4">Invoice History</h1>

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Invoice No.</label>
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-36"
            onKeyDown={(e) => e.key === 'Enter' && search(1)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">From (business date)</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm">
            <option value="">All</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
          </select>
        </div>
        <button onClick={() => search(1)}
          className="btn btn-primary">
          Search
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <div className="flex gap-4">
        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          <div className="flex-1 overflow-auto">
          {results.length === 0
            ? <p className="text-sm text-gray-400">No results. Search to find invoices.</p>
            : (
              <table className="w-full text-sm border rounded-lg overflow-hidden bg-white">
                <thead><tr className="text-left text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
                  <th className="px-3 py-2">Invoice No.</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Business Date</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Status</th>
                </tr></thead>
                <tbody>
                  {results.map((inv) => (
                    <tr key={inv.id} onClick={() => setSelectedId(inv.id)}
                      className={`border-b last:border-0 cursor-pointer hover:bg-gray-50 ${selectedId === inv.id ? 'bg-indigo-50' : ''} ${inv.status === 'void' ? 'bg-red-50/40' : ''}`}>
                      <td className="px-3 py-2 font-mono text-xs">
                        <span>{inv.invoiceNo}</span>
                        {inv.status === 'void' && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold tracking-wide">
                            VOID
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${inv.type === 'retail' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                          {inv.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">{inv.businessDate}</td>
                      <td className={`px-3 py-2 text-right font-mono ${inv.status === 'void' ? 'line-through text-red-500' : ''}`}>
                        {paiseToCurrency(inv.totalPaise)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${inv.status === 'void' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {inv.status === 'void' ? 'VOID' : inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        {results.length > 0 && (
          <div className="flex justify-between items-center py-2 text-sm text-gray-500 bg-white border rounded-lg px-4 mt-2">
            <div>
              Showing page {page} of {totalPages} ({totalRecords} total invoices)
            </div>
            <div className="flex gap-2">
              <button 
                disabled={page <= 1}
                onClick={() => search(page - 1)}
                className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <button 
                disabled={page >= totalPages}
                onClick={() => search(page + 1)}
                className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
        </div>

        {selectedId && (
          <div className="w-80 flex-shrink-0 border rounded-lg bg-white p-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
            <InvoiceDetailPanel invoiceId={selectedId} onUpdated={handleUpdated} />
          </div>
        )}
      </div>
    </div>
  )
}

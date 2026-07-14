import { useState, useEffect } from 'react'
import { paiseToCurrency } from '@shared/money'

type Tab = 'raw_material' | 'final_product' | 'expense'
type DatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'

function todayStr(): string { return new Date().toISOString().slice(0, 10) }
function monthStartStr(): string { return new Date().toISOString().slice(0, 7) + '-01' }
function yesterdayStr(): string {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10)
}
function weekStartStr(): string {
  const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().slice(0, 10)
}

export default function FactoryScreen() {
  const [tab, setTab] = useState<Tab>('raw_material')
  const [items, setItems] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  
  const [selectedItemId, setSelectedItemId] = useState<string | 'all'>('all')
  
  // Date filter state
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [customStart, setCustomStart] = useState(todayStr())
  const [customEnd, setCustomEnd] = useState(todayStr())
  
  // Create item form
  const [showAdd, setShowAdd] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  
  // Transaction form
  const [qty, setQty] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  
  async function loadItems() {
    const res = await (window as any).api.factory.listItems()
    if (res.ok) setItems(res.data)
  }

  async function loadTransactions() {
    const res = await (window as any).api.factory.listTransactions()
    if (res.ok) setTransactions(res.data)
  }

  useEffect(() => {
    loadItems()
    loadTransactions()
  }, [])

  useEffect(() => {
    setSelectedItemId('all')
  }, [tab])

  let startDate = ''
  let endDate = ''
  if (datePreset === 'today') { startDate = endDate = todayStr() }
  else if (datePreset === 'yesterday') { startDate = endDate = yesterdayStr() }
  else if (datePreset === 'week') { startDate = weekStartStr(); endDate = todayStr() }
  else if (datePreset === 'month') { startDate = monthStartStr(); endDate = todayStr() }
  else if (datePreset === 'custom') { startDate = customStart; endDate = customEnd }

  let filteredTransactions = transactions
  if (startDate) {
    filteredTransactions = filteredTransactions.filter(t => t.date >= startDate && t.date <= endDate)
  }

  const filteredItems = items.filter(i => i.type === tab)
  const selectedItem = items.find(i => i.id === selectedItemId)
  
  const itemIdsInTab = new Set(filteredItems.map(i => i.id))
  
  const itemTransactions = selectedItemId === 'all' 
    ? filteredTransactions.filter(t => itemIdsInTab.has(t.itemId))
    : filteredTransactions.filter(t => t.itemId === selectedItemId)
    
  // Aggregates for the current view (all or specific item)
  const rawPurchasesTotal = filteredTransactions.filter(t => items.find(i => i.id === t.itemId)?.type === 'raw_material').reduce((acc, t) => acc + t.amountPaise, 0)
  const finalSalesTotal = filteredTransactions.filter(t => items.find(i => i.id === t.itemId)?.type === 'final_product').reduce((acc, t) => acc + t.amountPaise, 0)
  const expensesTotal = filteredTransactions.filter(t => items.find(i => i.id === t.itemId)?.type === 'expense').reduce((acc, t) => acc + t.amountPaise, 0)

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItemName.trim()) return
    const res = await (window as any).api.factory.createItem({
      name: newItemName.trim(),
      type: tab
    })
    if (res.ok) {
      setNewItemName('')
      setShowAdd(false)
      loadItems()
    }
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedItemId || !amount) return
    if (tab !== 'expense' && !qty) return
    
    const qtyNum = tab === 'expense' ? 1 : parseFloat(qty)
    const amountNum = Math.round(parseFloat(amount) * 100)
    
    if (isNaN(qtyNum) || isNaN(amountNum)) return

    const res = await (window as any).api.factory.createTransaction({
      itemId: selectedItemId,
      type: tab === 'final_product' ? 'sale' : 'purchase',
      date: new Date().toISOString().slice(0, 10),
      qtyKg: qtyNum,
      amountPaise: amountNum,
      notes
    })

    if (res.ok) {
      setQty('')
      setAmount('')
      setNotes('')
      loadTransactions()
    }
  }

  async function handleDeleteItem(id: string, name: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (confirm(`Are you sure you want to delete "${name}" and all its history?`)) {
      const res = await (window as any).api.factory.deleteItem(id)
      if (res.ok) {
        if (selectedItemId === id) setSelectedItemId('all')
        loadItems()
        loadTransactions()
      } else {
        alert('Failed to delete item: ' + res.error)
      }
    }
  }

  async function handleDeleteTransaction(id: string) {
    if (confirm('Are you sure you want to delete this record?')) {
      const res = await (window as any).api.factory.deleteTransaction(id)
      if (res.ok) {
        loadTransactions()
      } else {
        alert('Failed to delete record: ' + res.error)
      }
    }
  }

  function handleExportExcel() {
    if (itemTransactions.length === 0) {
      alert("No data available to export.")
      return
    }

    let rows: string[][] = []
    
    // Header
    if (selectedItemId === 'all') {
      rows.push(tab === 'expense' ? ['Date', 'Item', 'Amount', 'Notes'] : ['Date', 'Item', 'Quantity (KG)', 'Amount', 'Notes'])
    } else {
      rows.push(tab === 'expense' ? ['Date', 'Amount', 'Notes'] : ['Date', 'Quantity (KG)', 'Amount', 'Notes'])
    }

    // Rows
    for (const t of itemTransactions) {
      const row: string[] = []
      row.push(t.date)
      if (selectedItemId === 'all') {
        row.push(filteredItems.find(i => i.id === t.itemId)?.name || 'Unknown')
      }
      if (tab !== 'expense') {
        row.push(t.qtyKg.toFixed(2))
      }
      row.push((t.amountPaise / 100).toFixed(2))
      row.push(t.notes || '')
      rows.push(row)
    }

    const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `factory_${tab}_history.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', padding: '1.25rem', overflow: 'hidden', background: 'var(--bg-base)' }}>
      
      {/* Header & Totals */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--ink-1)', margin: 0 }}>Factory</h1>
          <p style={{ color: 'var(--ink-3)', margin: '0.25rem 0 0 0' }}>Independent raw material & final product records</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          
          {/* Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <select 
              value={datePreset} 
              onChange={e => setDatePreset(e.target.value as DatePreset)}
              className="input" 
              style={{ width: '140px', padding: '0.5rem' }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
            {datePreset === 'custom' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input" style={{ padding: '0.5rem' }} />
                <span style={{ color: 'var(--ink-3)' }}>to</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input" style={{ padding: '0.5rem' }} />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', minWidth: '160px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Total Raw Purchases</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--red)' }}>{paiseToCurrency(rawPurchasesTotal)}</span>
            </div>
            <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', minWidth: '160px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Total Final Sales</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--green)' }}>{paiseToCurrency(finalSalesTotal)}</span>
            </div>
            <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', minWidth: '160px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Total Expenses</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--red)' }}>{paiseToCurrency(expensesTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flex: 1, overflow: 'hidden' }}>
        
        {/* Left pane: Item list */}
        <div className="card" style={{ width: '280px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setTab('raw_material')}
              style={{ flex: 1, padding: '0.75rem', borderBottom: tab === 'raw_material' ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', fontWeight: 600, color: tab === 'raw_material' ? 'var(--accent)' : 'var(--ink-3)' }}
            >
              Raw Materials
            </button>
            <button
              onClick={() => setTab('final_product')}
              style={{ flex: 1, padding: '0.75rem', borderBottom: tab === 'final_product' ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', fontWeight: 600, color: tab === 'final_product' ? 'var(--accent)' : 'var(--ink-3)' }}
            >
              Final Products
            </button>
            <button
              onClick={() => setTab('expense')}
              style={{ flex: 1, padding: '0.75rem', borderBottom: tab === 'expense' ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', fontWeight: 600, color: tab === 'expense' ? 'var(--accent)' : 'var(--ink-3)' }}
            >
              Expenses
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {/* "All Items" Selector */}
            <div 
              onClick={() => setSelectedItemId('all')}
              style={{ 
                padding: '0.75rem', 
                borderRadius: '0.25rem',
                cursor: 'pointer',
                marginBottom: '0.5rem',
                fontWeight: selectedItemId === 'all' ? 600 : 400,
                background: selectedItemId === 'all' ? 'var(--accent-soft)' : 'transparent',
                borderLeft: selectedItemId === 'all' ? '3px solid var(--accent)' : '3px solid transparent'
              }}
            >
              All {tab === 'raw_material' ? 'Raw Materials' : tab === 'final_product' ? 'Final Products' : 'Expenses'}
            </div>
            
            <div style={{ borderBottom: '1px solid var(--border)', margin: '0.5rem 0' }}></div>
            
            {filteredItems.map(item => (
              <div 
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                style={{ 
                  padding: '0.75rem', 
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  marginBottom: '0.25rem',
                  background: selectedItemId === item.id ? 'var(--accent-soft)' : 'transparent',
                  borderLeft: selectedItemId === item.id ? '3px solid var(--accent)' : '3px solid transparent',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span>{item.name}</span>
                <button 
                  onClick={(e) => handleDeleteItem(item.id, item.name, e)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: '0.25rem' }}
                  title="Delete item and history"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" width={14} height={14}><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm3.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd"/></svg>
                </button>
              </div>
            ))}
            
            {showAdd ? (
              <form onSubmit={handleAddItem} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <input 
                  autoFocus
                  placeholder="Name..." 
                  value={newItemName} 
                  onChange={e => setNewItemName(e.target.value)} 
                  className="input" 
                  style={{ flex: 1 }} 
                />
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>X</button>
              </form>
            ) : (
              <button onClick={() => setShowAdd(true)} className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem' }}>
                + Add {tab === 'raw_material' ? 'Raw Material' : tab === 'final_product' ? 'Final Product' : 'Expense'}
              </button>
            )}
          </div>
        </div>

        {/* Right pane: Form & History */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
          
          {/* Form (Only visible when a specific item is selected) */}
          {selectedItem && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontWeight: 600 }}>
                Record {tab === 'final_product' ? 'Sale' : 'Purchase / Entry'} for {selectedItem.name}
              </h3>
              <form onSubmit={handleAddTransaction} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                {tab !== 'expense' && (
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--ink-2)' }}>Quantity (KG)</label>
                    <input type="number" step="0.01" required value={qty} onChange={e => setQty(e.target.value)} className="input" style={{ width: '100%' }} />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--ink-2)' }}>Total Amount (₹)</label>
                  <input type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="input" style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--ink-2)' }}>Notes</label>
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="input" style={{ width: '100%' }} placeholder="Optional..." />
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.5rem' }}>Save</button>
              </form>
            </div>
          )}

          {/* History */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600 }}>
                History {selectedItem ? `— ${selectedItem.name}` : `— All ${tab === 'raw_material' ? 'Raw Materials' : tab === 'final_product' ? 'Final Products' : 'Expenses'}`}
              </div>
              <button 
                onClick={handleExportExcel}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width={14} height={14}><path fillRule="evenodd" d="M10 3a1 1 0 0 1 1 1v7.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L9 11.586V4a1 1 0 0 1 1-1ZM4 16a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z" clipRule="evenodd"/></svg>
                Export Excel
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-fill)', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 500, color: 'var(--ink-2)' }}>Date</th>
                    {selectedItemId === 'all' && (
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 500, color: 'var(--ink-2)' }}>Item</th>
                    )}
                    {tab !== 'expense' && (
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 500, color: 'var(--ink-2)' }}>Quantity (KG)</th>
                    )}
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 500, color: 'var(--ink-2)' }}>Amount</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 500, color: 'var(--ink-2)' }}>Notes</th>
                    <th style={{ padding: '0.75rem 1rem', width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {itemTransactions.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>{t.date}</td>
                      {selectedItemId === 'all' && (
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>
                          {filteredItems.find(i => i.id === t.itemId)?.name || 'Unknown'}
                        </td>
                      )}
                      {tab !== 'expense' && (
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{t.qtyKg.toFixed(2)} kg</td>
                      )}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: tab === 'final_product' ? 'var(--green)' : 'var(--red)' }}>
                        {paiseToCurrency(t.amountPaise)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--ink-3)' }}>{t.notes || '-'}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleDeleteTransaction(t.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: '0.25rem' }}
                          title="Delete record"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" width={14} height={14}><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm3.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {itemTransactions.length === 0 && (
                    <tr><td colSpan={selectedItemId === 'all' ? 6 : 5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-3)' }}>No records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

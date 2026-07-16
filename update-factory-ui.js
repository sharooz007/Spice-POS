const fs = require('fs')

let content = fs.readFileSync('src/renderer/src/screens/Factory/index.tsx', 'utf-8')

// 1. Tab definition
content = content.replace(
  "type Tab = 'raw_material' | 'final_product' | 'expense'",
  "type Tab = 'raw_material' | 'final_product' | 'expense' | 'production_run'"
)

// 2. Add state
const stateBlock = `  const [items, setItems] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])`

const newStateBlock = `  const [items, setItems] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [productionRuns, setProductionRuns] = useState<any[]>([])
  const [rawMaterialStock, setRawMaterialStock] = useState<any[]>([])
  
  // Form state for production runs
  const [runFinalProductId, setRunFinalProductId] = useState('')
  const [runQtyProduced, setRunQtyProduced] = useState('')
  const [runNotes, setRunNotes] = useState('')
  const [runIngredients, setRunIngredients] = useState<{ rawMaterialId: string; qtyUsedKg: string }[]>([])`

content = content.replace(stateBlock, newStateBlock)

// 3. load methods
const loadMethods = `  async function loadItems() {
    const res = await (window as any).api.factory.listItems()
    if (res.ok) setItems(res.data)
  }

  async function loadTransactions() {
    const res = await (window as any).api.factory.listTransactions()
    if (res.ok) setTransactions(res.data)
  }`

const newLoadMethods = `  async function loadItems() {
    const res = await (window as any).api.factory.listItems()
    if (res.ok) setItems(res.data)
  }

  async function loadTransactions() {
    const res = await (window as any).api.factory.listTransactions()
    if (res.ok) setTransactions(res.data)
  }
  
  async function loadProductionRuns() {
    const res = await (window as any).api.factory.listProductionRuns()
    if (res.ok) setProductionRuns(res.data)
  }
  
  async function loadStock() {
    const res = await (window as any).api.factory.getRawMaterialStock()
    if (res.ok) setRawMaterialStock(res.data)
  }`

content = content.replace(loadMethods, newLoadMethods)

// 4. useEffect
const useEff = `  useEffect(() => {
    loadItems()
    loadTransactions()
  }, [])`

const newUseEff = `  useEffect(() => {
    loadItems()
    loadTransactions()
    loadProductionRuns()
    loadStock()
  }, [])`

content = content.replace(useEff, newUseEff)

// 5. handleAddProductionRun & Add Ingredient
const handleDelItem = `  async function handleDeleteItem(id: string, name: string, e: React.MouseEvent) {`

const prodRunFunctions = `  async function handleAddProductionRun(e: React.FormEvent) {
    e.preventDefault()
    if (!runFinalProductId || !runQtyProduced) return
    const qtyNum = parseFloat(runQtyProduced)
    if (isNaN(qtyNum)) return

    const ingredients = runIngredients.filter(i => i.rawMaterialId && i.qtyUsedKg).map(i => ({
      rawMaterialId: i.rawMaterialId,
      qtyUsedKg: parseFloat(i.qtyUsedKg)
    }))

    const res = await (window as any).api.factory.createProductionRun({
      finalProductId: runFinalProductId,
      date: new Date().toISOString().slice(0, 10),
      qtyProducedKg: qtyNum,
      notes: runNotes,
      ingredients
    })

    if (res.ok) {
      setRunFinalProductId('')
      setRunQtyProduced('')
      setRunNotes('')
      setRunIngredients([])
      loadProductionRuns()
      loadStock()
    } else {
      alert('Failed to save production run: ' + res.error)
    }
  }

  async function handleDeleteProductionRun(id: string) {
    if (confirm('Are you sure you want to delete this production run?')) {
      const res = await (window as any).api.factory.deleteProductionRun(id)
      if (res.ok) {
        loadProductionRuns()
        loadStock()
      } else {
        alert('Failed to delete run: ' + res.error)
      }
    }
  }

  async function handleDeleteItem(id: string, name: string, e: React.MouseEvent) {`

content = content.replace(handleDelItem, prodRunFunctions)


// 6. Tabs UI
const tabsUI = `<button
              onClick={() => setTab('expense')}
              style={{ flex: 1, padding: '0.75rem', borderBottom: tab === 'expense' ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', fontWeight: 600, color: tab === 'expense' ? 'var(--accent)' : 'var(--ink-3)' }}
            >
              Expenses
            </button>
          </div>`

const newTabsUI = `<button
              onClick={() => setTab('expense')}
              style={{ flex: 1, padding: '0.75rem', borderBottom: tab === 'expense' ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', fontWeight: 600, color: tab === 'expense' ? 'var(--accent)' : 'var(--ink-3)' }}
            >
              Expenses
            </button>
            <button
              onClick={() => setTab('production_run')}
              style={{ flex: 1, padding: '0.75rem', borderBottom: tab === 'production_run' ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', fontWeight: 600, color: tab === 'production_run' ? 'var(--accent)' : 'var(--ink-3)', whiteSpace: 'nowrap' }}
            >
              Production Runs
            </button>
          </div>`
content = content.replace(tabsUI, newTabsUI)

// 7. Render logic for left pane list
const allSelector = `All {tab === 'raw_material' ? 'Raw Materials' : tab === 'final_product' ? 'Final Products' : 'Expenses'}
            </div>`
const newAllSelector = `All {tab === 'raw_material' ? 'Raw Materials' : tab === 'final_product' ? 'Final Products' : tab === 'production_run' ? 'Production Runs' : 'Expenses'}
            </div>`
content = content.replace(allSelector, newAllSelector)


const deleteBtn = `<button 
                          onClick={(e) => handleDeleteItem(item.id, item.name, e)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '0.25rem' }}
                          title="Delete Item"
                        >`
const itemDisplay = `<div style={{ fontWeight: 500, color: 'var(--ink-1)' }}>{item.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
                      {tab === 'raw_material' ? 'Purchases' : tab === 'final_product' ? 'Sales' : 'Records'}: {filteredTransactions.filter(t => t.itemId === item.id).length}
                    </span>`
                    
const newItemDisplay = `<div style={{ fontWeight: 500, color: 'var(--ink-1)' }}>{item.name}</div>
                  {tab === 'raw_material' && (
                    <div style={{ fontSize: '0.75rem', color: rawMaterialStock.find(s => s.itemId === item.id)?.currentStockKg > 0 ? 'var(--green)' : 'var(--ink-3)', marginTop: '0.25rem' }}>
                      Stock: {(rawMaterialStock.find(s => s.itemId === item.id)?.currentStockKg || 0).toFixed(2)} kg
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
                      {tab === 'raw_material' ? 'Purchases' : tab === 'final_product' ? 'Sales' : 'Records'}: {filteredTransactions.filter(t => t.itemId === item.id).length}
                    </span>`
                    
content = content.replace(itemDisplay, newItemDisplay)

// 8. Add logic for Production runs Right pane
const formAndHistory = `          {/* Form (Only visible when a specific item is selected) */}
          {selectedItem && (`
          
const newFormAndHistory = `          {/* Form (Only visible when a specific item is selected) */}
          {tab === 'production_run' && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontWeight: 600 }}>Record Production Run</h3>
              <form onSubmit={handleAddProductionRun} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--ink-2)' }}>Final Product</label>
                    <select required value={runFinalProductId} onChange={e => setRunFinalProductId(e.target.value)} className="input" style={{ width: '100%' }}>
                      <option value="" disabled>Select Product...</option>
                      {items.filter(i => i.type === 'final_product').map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--ink-2)' }}>Quantity Produced (KG)</label>
                    <input type="number" step="0.01" required value={runQtyProduced} onChange={e => setRunQtyProduced(e.target.value)} className="input" style={{ width: '100%' }} />
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.5rem', color: 'var(--ink-2)' }}>Raw Materials Used</label>
                  {runIngredients.map((ing, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <select 
                        required
                        value={ing.rawMaterialId} 
                        onChange={e => {
                          const newIng = [...runIngredients]
                          newIng[idx].rawMaterialId = e.target.value
                          setRunIngredients(newIng)
                        }} 
                        className="input" 
                        style={{ flex: 2 }}
                      >
                        <option value="" disabled>Select Material...</option>
                        {items.filter(i => i.type === 'raw_material').map(i => (
                          <option key={i.id} value={i.id}>{i.name} (Stock: {(rawMaterialStock.find(s => s.itemId === i.id)?.currentStockKg || 0).toFixed(2)}kg)</option>
                        ))}
                      </select>
                      <input 
                        type="number" 
                        step="0.01"
                        required 
                        placeholder="Qty Used (KG)"
                        value={ing.qtyUsedKg} 
                        onChange={e => {
                          const newIng = [...runIngredients]
                          newIng[idx].qtyUsedKg = e.target.value
                          setRunIngredients(newIng)
                        }} 
                        className="input" 
                        style={{ flex: 1 }} 
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={() => setRunIngredients(runIngredients.filter((_, i) => i !== idx))}
                      >X</button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => setRunIngredients([...runIngredients, { rawMaterialId: '', qtyUsedKg: '' }])}>
                    + Add Ingredient
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginTop: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--ink-2)' }}>Notes</label>
                    <input type="text" value={runNotes} onChange={e => setRunNotes(e.target.value)} className="input" style={{ width: '100%' }} placeholder="Optional..." />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1.5rem' }}>Save Run</button>
                </div>
              </form>
            </div>
          )}
          
          {selectedItem && tab !== 'production_run' && (`
          
content = content.replace(formAndHistory, newFormAndHistory)

const historyTable = `<div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>`
              
const newHistoryTable = `<div style={{ flex: 1, overflowY: 'auto' }}>
              {tab === 'production_run' ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-fill)', borderBottom: '1px solid var(--border)' }}>
                    <tr>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 500, color: 'var(--ink-2)' }}>Date</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 500, color: 'var(--ink-2)' }}>Product Made</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 500, color: 'var(--ink-2)' }}>Qty Produced</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 500, color: 'var(--ink-2)' }}>Ingredients Consumed</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 500, color: 'var(--ink-2)' }}>Notes</th>
                      <th style={{ padding: '0.75rem 1rem', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionRuns.filter(r => (startDate ? r.date >= startDate && r.date <= endDate : true)).map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                        <td style={{ padding: '0.75rem 1rem' }}>{r.date}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{r.finalProductName}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--green)' }}>{r.qtyProducedKg.toFixed(2)} kg</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {r.ingredients.map(ing => (
                            <div key={ing.id} style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
                              • {ing.rawMaterialName}: {ing.qtyUsedKg.toFixed(2)} kg
                            </div>
                          ))}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--ink-3)' }}>{r.notes || '-'}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleDeleteProductionRun(r.id)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', padding: '0.25rem' }}
                            title="Delete record"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" width={14} height={14}><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm3.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd"/></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {productionRuns.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-3)' }}>No production runs recorded yet.</td></tr>
                    )}
                  </tbody>
                </table>
              ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>`
content = content.replace(historyTable, newHistoryTable)

// close the ternary at the bottom of the table
const tableEnd = `              </table>
            </div>`
const newTableEnd = `              </table>
              )}
            </div>`
content = content.replace(tableEnd, newTableEnd)

fs.writeFileSync('src/renderer/src/screens/Factory/index.tsx', content)

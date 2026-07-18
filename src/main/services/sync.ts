// @ts-nocheck
import { openDatabase } from '../db'
import * as crypto from 'crypto'

const workerUrl = import.meta.env.VITE_SYNC_WORKER_URL || process.env.VITE_SYNC_WORKER_URL
const apiKey = import.meta.env.VITE_SYNC_API_KEY || process.env.VITE_SYNC_API_KEY

const TABLES_TO_SYNC = [
  'users', 'settings',
  'categories', 'products', 'product_variants', 
  'price_menu_entries', 'suppliers', 
  'customers', 'bulk_arrivals', 'bulk_adjustments', 
  'packing_runs', 'packing_run_lines', 'retail_adjustments', 
  'price_history', 'invoices', 'invoice_lines', 
  'invoice_datetime_edit_log', 'payments', 'purchase_entries', 
  'expenses', 'label_print_log',
  'factory_items', 'factory_transactions'
]

async function callWorker(endpoint: string, body: any) {
  if (!workerUrl || !apiKey) {
    throw new Error('Sync Worker URL or API Key is missing in .env')
  }
  const url = `${workerUrl.replace(/\/$/, '')}${endpoint}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    let err
    try { err = await res.json() } catch { err = { error: res.statusText } }
    throw new Error(`Worker Error: ${err.error || res.statusText}`)
  }
  return res.json()
}

async function callWorkerGet(endpoint: string) {
  if (!workerUrl || !apiKey) {
    throw new Error('Sync Worker URL or API Key is missing in .env')
  }
  const url = `${workerUrl.replace(/\/$/, '')}${endpoint}`
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })
  if (!res.ok) {
    let err
    try { err = await res.json() } catch { err = { error: res.statusText } }
    throw new Error(`Worker Error: ${err.error || res.statusText}`)
  }
  return res.json()
}

export async function syncWithSupabase(): Promise<{ ok: boolean, message: string }> {
  const db = openDatabase()
  // @ts-ignore
  const sqlite = db.session?.client // The raw better-sqlite3 Database instance

  if (!sqlite) {
    return { ok: false, message: 'Could not access underlying SQLite database' }
  }

  try {
    // 1. PUSH (Local -> Cloud)
    for (const table of TABLES_TO_SYNC) {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all()
      if (rows.length > 0) {
        await callWorker('/push', { table, rows })
      }
    }

    // 2. PULL (Cloud -> Local)
    for (const table of TABLES_TO_SYNC) {
      const { data } = await callWorker('/pull', { table })

      if (data && data.length > 0) {
        const cols = Object.keys(data[0])
        const placeholders = cols.map(() => '?').join(', ')
        const statement = sqlite.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
        
        const insertMany = sqlite.transaction((rowsToInsert: any[]) => {
          for (const row of rowsToInsert) {
            statement.run(cols.map(c => row[c]))
          }
        })
        
        insertMany(data)
      }
    }

    // 3. RECALCULATE STOCK
    sqlite.exec(`
      DELETE FROM bulk_stock;
      INSERT INTO bulk_stock (product_id, qty_grams, avg_cost_per_kg)
      SELECT
        product_id,
        SUM(qty) as qty_grams,
        0 as avg_cost_per_kg
      FROM (
        SELECT product_id, qty_grams as qty FROM bulk_arrivals
        UNION ALL
        SELECT product_id, qty_change_grams as qty FROM bulk_adjustments
        UNION ALL
        SELECT product_id, -bulk_used_grams as qty FROM packing_runs
        UNION ALL
        SELECT product_id, -qty as qty FROM invoice_lines WHERE item_type = 'loose_bulk'
      )
      GROUP BY product_id;
    `)

    sqlite.exec(`
      DELETE FROM retail_packet_stock;
      INSERT INTO retail_packet_stock (variant_id, qty_pcs, avg_cost_per_pc)
      SELECT
        variant_id,
        SUM(qty) as qty_pcs,
        0 as avg_cost_per_pc
      FROM (
        SELECT variant_id, packets_count as qty FROM packing_run_lines
        UNION ALL
        SELECT variant_id, qty_change_pcs as qty FROM retail_adjustments
        UNION ALL
        SELECT variant_id, -qty as qty FROM invoice_lines WHERE item_type = 'packet'
      )
      GROUP BY variant_id;
    `)

    // Log the sync success
    const nowTimestamp = Date.now()
    sqlite.prepare('INSERT INTO sync_log (id, synced_at, records_pushed, records_failed) VALUES (?, ?, ?, ?)').run(crypto.randomUUID(), nowTimestamp, 0, 0)
    
    // Update global ping tracker
    await callWorker('/update-state', { time: nowTimestamp })

    return { ok: true, message: 'Sync complete!' }
  } catch (err: any) {
    console.error('Sync failed:', err)
    return { ok: false, message: err.message || 'Unknown sync error' }
  }
}

export async function getLastSyncTime(): Promise<number | null> {
  const db = openDatabase()
  // @ts-ignore
  const sqlite = db.session?.client
  const row = sqlite.prepare('SELECT synced_at FROM sync_log ORDER BY synced_at DESC LIMIT 1').get() as { synced_at: number } | undefined
  return row ? row.synced_at : null
}

export async function checkRemoteState(): Promise<{ ok: boolean, data?: { outOfSync: boolean, lastRemoteSync?: number, lastLocalSync?: number }, message?: string }> {
  try {
    const lastLocalSync = await getLastSyncTime()
    if (!lastLocalSync) {
      return { ok: true, data: { outOfSync: false, lastLocalSync: 0 } }
    }

    const res = await callWorkerGet('/state')

    if (res && res.last_sync_time) {
      const remoteTime = res.last_sync_time
      return {
        ok: true,
        data: {
          outOfSync: remoteTime > lastLocalSync + 5000, // 5 seconds buffer
          lastRemoteSync: remoteTime,
          lastLocalSync
        }
      }
    }

    return { ok: true, data: { outOfSync: false, lastLocalSync } }
  } catch (err: any) {
    console.error('Error checking remote state:', err)
    return { ok: false, message: err.message || 'Failed to check remote state' }
  }
}

export async function forcePush(): Promise<{ ok: boolean; message: string }> {
  const db = openDatabase()
  // @ts-ignore
  const sqlite = db.session?.client // The raw better-sqlite3 Database instance

  if (!sqlite) {
    return { ok: false, message: 'Could not access underlying SQLite database' }
  }

  try {
    // 1. DELETE (Cloud deletions of things not existing locally)
    const reversedTables = [...TABLES_TO_SYNC].reverse()
    
    for (const table of reversedTables) {
      const pk = table === 'settings' ? 'key' : 'id'
      const localRows = sqlite.prepare(`SELECT ${pk} FROM ${table}`).all()
      const localIds = new Set(localRows.map((r: any) => r[pk]))

      const { data: cloudRows } = await callWorker('/pull', { table, select: [pk] })

      if (cloudRows && cloudRows.length > 0) {
        const idsToDelete = cloudRows.map((r: any) => r[pk]).filter((id: any) => !localIds.has(id))
        
        if (idsToDelete.length > 0) {
          console.log(`ForcePush: Deleting ${idsToDelete.length} rows from ${table}`)
          for (let i = 0; i < idsToDelete.length; i += 200) {
            const chunk = idsToDelete.slice(i, i + 200)
            await callWorker('/delete', { table, ids: chunk, pk })
          }
        }
      }
    }

    // 2. PUSH (Local -> Cloud)
    for (const table of TABLES_TO_SYNC) {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all()
      if (rows.length > 0) {
        await callWorker('/push', { table, rows })
      }
    }

    // 3. Mark last synced
    sqlite.prepare(`
      INSERT INTO settings (key, value) VALUES ('last_sync_time', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(Date.now().toString())

    return { ok: true, message: 'Force push complete.' }
  } catch (err: any) {
    console.error('ForcePush crashed:', err)
    return { ok: false, message: `Unexpected error: ${err.message}` }
  }
}

export async function forcePull(): Promise<{ ok: boolean; message: string }> {
  const db = openDatabase()
  // @ts-ignore
  const sqlite = db.session?.client

  if (!sqlite) return { ok: false, message: 'Could not access SQLite' }

  try {
    // 1. DELETE local rows that don't exist in the cloud
    const reversedTables = [...TABLES_TO_SYNC].reverse()
    
    for (const table of reversedTables) {
      const pk = table === 'settings' ? 'key' : 'id'
      
      const { data: cloudRows } = await callWorker('/pull', { table, select: [pk] })

      const cloudIds = new Set((cloudRows || []).map((r: any) => r[pk]))
      const localRows = sqlite.prepare(`SELECT ${pk} FROM ${table}`).all()
      
      const idsToDelete = localRows.map((r: any) => r[pk]).filter((id: string) => !cloudIds.has(id))
      
      if (idsToDelete.length > 0) {
        console.log(`ForcePull: Deleting ${idsToDelete.length} rows from local ${table}`)
        const delStmt = sqlite.prepare(`DELETE FROM ${table} WHERE ${pk} = ?`)
        sqlite.transaction((ids: string[]) => {
          for (const id of ids) {
            delStmt.run(id)
          }
        })(idsToDelete)
      }
    }

    // 2. PULL and UPSERT all cloud rows locally
    for (const table of TABLES_TO_SYNC) {
      const { data } = await callWorker('/pull', { table })

      if (data && data.length > 0) {
        const cols = Object.keys(data[0])
        const placeholders = cols.map(() => '?').join(', ')
        const statement = sqlite.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
        
        sqlite.transaction((rowsToInsert: any[]) => {
          for (const row of rowsToInsert) {
            statement.run(cols.map(c => row[c]))
          }
        })(data)
      }
    }

    // 3. RECALCULATE STOCK
    sqlite.exec(`
      DELETE FROM bulk_stock;
      INSERT INTO bulk_stock (product_id, qty_grams, avg_cost_per_kg)
      SELECT
        product_id,
        SUM(qty) as qty_grams,
        0 as avg_cost_per_kg
      FROM (
        SELECT product_id, qty_grams as qty FROM bulk_arrivals
        UNION ALL
        SELECT product_id, qty_change_grams as qty FROM bulk_adjustments
        UNION ALL
        SELECT product_id, -bulk_used_grams as qty FROM packing_runs
        UNION ALL
        SELECT product_id, -qty as qty FROM invoice_lines WHERE item_type = 'loose_bulk'
      )
      GROUP BY product_id;
    `)

    sqlite.exec(`
      DELETE FROM retail_packet_stock;
      INSERT INTO retail_packet_stock (variant_id, qty_pcs, avg_cost_per_pc)
      SELECT
        variant_id,
        SUM(qty) as qty_pcs,
        0 as avg_cost_per_pc
      FROM (
        SELECT variant_id, packets_count as qty FROM packing_run_lines
        UNION ALL
        SELECT variant_id, qty_change_pcs as qty FROM retail_adjustments
        UNION ALL
        SELECT variant_id, -qty as qty FROM invoice_lines WHERE item_type = 'packet'
      )
      GROUP BY variant_id;
    `)

    sqlite.prepare(`
      INSERT INTO settings (key, value) VALUES ('last_sync_time', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(Date.now().toString())

    return { ok: true, message: 'Force pull complete.' }
  } catch (err: any) {
    console.error('ForcePull crashed:', err)
    return { ok: false, message: `Unexpected error: ${err.message}` }
  }
}

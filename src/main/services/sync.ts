// @ts-nocheck
import { createClient } from '@supabase/supabase-js'
import { openDatabase } from '../db'
import * as crypto from 'crypto'

// Initialize Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

let supabase: ReturnType<typeof createClient> | null = null
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey)
}

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

// Supabase returns timestamps as ISO strings. SQLite stores them as integers (ms since epoch)
// Supabase also returns booleans, which SQLite must store as 1 or 0
function parseDateStringsToEpoch(row: any): any {
  const converted = { ...row }
  for (const [key, value] of Object.entries(converted)) {
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      // It's a timestamp string. Supabase often returns timestamps without the 'Z' (UTC marker),
      // which causes JS to parse it as Local Time, shifting it incorrectly.
      let dateStr = value
      if (!dateStr.endsWith('Z') && !dateStr.match(/[+-]\d{2}:?\d{2}$/)) {
        dateStr += 'Z'
      }
      // Drizzle SQLite mode: 'timestamp' expects SECONDS, not milliseconds!
      converted[key] = Math.floor(new Date(dateStr).getTime() / 1000)
    } else if (typeof value === 'boolean') {
      // SQLite only supports integers for booleans (1/0)
      converted[key] = value ? 1 : 0
    }
  }
  return converted
}

export async function syncWithSupabase(): Promise<{ ok: boolean, message: string }> {
  if (!supabase) {
    return { ok: false, message: 'Supabase URL or Key is missing in .env' }
  }

  const db = openDatabase()
  // @ts-ignore
  const sqlite = db.session?.client // The raw better-sqlite3 Database instance

  if (!sqlite) {
    return { ok: false, message: 'Could not access underlying SQLite database' }
  }

  try {
    // 1. PUSH (Local -> Cloud)
    for (const table of TABLES_TO_SYNC) {
      // Get all local rows
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all()
      if (rows.length > 0) {
        // Convert any integer timestamps to ISO strings for Supabase? 
        // Actually, Supabase's JS client will accept numbers if they match Unix timestamps, 
        // or we might need to manually map them. Let's just push them directly first.
        // Wait, Supabase requires ISO strings for TIMESTAMP WITH TIME ZONE.
        const mappedRows = rows.map((r: any) => {
          const out = { ...r }
          for (const [k, v] of Object.entries(out)) {
            // Strictly check for known timestamp columns
            const dateColumns = ['created_at', 'changed_at', 'invoice_datetime', 'old_datetime', 'new_datetime', 'edited_at', 'synced_at', 'date']
            if (dateColumns.includes(k) && typeof v === 'number') {
              // Drizzle timestamp mode sometimes stores as seconds (10 digits) or ms (13 digits)
              const ms = v < 10000000000 ? v * 1000 : v
              out[k] = new Date(ms).toISOString()
            }
          }
          return out
        })

        const { error } = await supabase.from(table).upsert(mappedRows)
        if (error) {
          console.error(`Push error on ${table}:`, error)
          return { ok: false, message: `Failed to push ${table}: ${error.message}` }
        }
      }
    }

    // 2. PULL (Cloud -> Local)
    for (const table of TABLES_TO_SYNC) {
      const { data, error } = await supabase.from(table).select('*')
      if (error) {
        console.error(`Pull error on ${table}:`, error)
        return { ok: false, message: `Failed to pull ${table}: ${error.message}` }
      }

      if (data && data.length > 0) {
        const cols = Object.keys(data[0])
        const placeholders = cols.map(() => '?').join(', ')
        // Convert camelCase to snake_case if necessary? Drizzle uses snake_case in DB, 
        // Supabase schema generated uses snake_case! Wait, Drizzle SQLite tables have snake_case column names.
        // So SQLite returns snake_case, and Supabase uses snake_case. They match perfectly.
        const statement = sqlite.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
        
        const insertMany = sqlite.transaction((rowsToInsert: any[]) => {
          for (const row of rowsToInsert) {
            const mapped = parseDateStringsToEpoch(row)
            statement.run(cols.map(c => mapped[c]))
          }
        })
        
        insertMany(data)
      }
    }

    // 3. RECALCULATE STOCK
    // Because we use UUIDs and event-sourcing, we don't sync absolute stock levels.
    // Instead, we recalculate them completely from the ledger of events locally.
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
    await supabase.from('global_sync_state').upsert({ id: 'singleton', last_sync_time: new Date().toISOString() })

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

    const { data, error } = await supabase.from('global_sync_state').select('last_sync_time').eq('id', 'singleton').single()
    if (error) {
      // If table doesn't exist yet or no row, it's fine, ignore
      return { ok: true, data: { outOfSync: false, lastLocalSync } }
    }

    if (data && data.last_sync_time) {
      const remoteTime = new Date(data.last_sync_time).getTime()
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

  if (!supabase) {
    return { ok: false, message: 'Supabase client not initialized (check .env)' }
  }

  try {
    // 1. DELETE (Cloud deletions of things not existing locally)
    // We do this in reverse order to respect foreign key constraints
    const reversedTables = [...TABLES_TO_SYNC].reverse()
    
    for (const table of reversedTables) {
      const pk = table === 'settings' ? 'key' : 'id'
      const localRows = sqlite.prepare(`SELECT ${pk} FROM ${table}`).all()
      const localIds = new Set(localRows.map((r: any) => r[pk]))

      const { data: cloudRows, error: pullErr } = await supabase.from(table).select(pk)
      if (pullErr) {
        console.error(`ForcePush pull error on ${table}:`, pullErr)
        return { ok: false, message: `Failed to fetch cloud IDs for ${table}: ${pullErr.message}` }
      }

      if (cloudRows && cloudRows.length > 0) {
        const idsToDelete = cloudRows.map(r => r[pk]).filter(id => !localIds.has(id))
        
        if (idsToDelete.length > 0) {
          console.log(`ForcePush: Deleting ${idsToDelete.length} rows from ${table}`)
          // Supabase 'in' filter has limits, we chunk it
          for (let i = 0; i < idsToDelete.length; i += 200) {
            const chunk = idsToDelete.slice(i, i + 200)
            const { error: delErr } = await supabase.from(table).delete().in(pk, chunk)
            if (delErr) {
              console.error(`ForcePush delete error on ${table}:`, delErr)
              return { ok: false, message: `Failed to delete from ${table}: ${delErr.message}` }
            }
          }
        }
      }
    }

    // 2. PUSH (Local -> Cloud)
    for (const table of TABLES_TO_SYNC) {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all()
      if (rows.length > 0) {
        const mappedRows = rows.map((r: any) => {
          const out = { ...r }
          for (const [k, v] of Object.entries(out)) {
            const dateColumns = ['created_at', 'changed_at', 'invoice_datetime', 'old_datetime', 'new_datetime', 'edited_at', 'synced_at', 'date']
            if (dateColumns.includes(k) && typeof v === 'number') {
              const ms = v < 10000000000 ? v * 1000 : v
              out[k] = new Date(ms).toISOString()
            }
          }
          return out
        })

        const { error } = await supabase.from(table).upsert(mappedRows)
        if (error) {
          console.error(`ForcePush upsert error on ${table}:`, error)
          return { ok: false, message: `Failed to push ${table}: ${error.message}` }
        }
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
  if (!supabase) return { ok: false, message: 'Supabase client not initialized' }

  try {
    // 1. DELETE local rows that don't exist in the cloud
    // We do this in reverse order to respect local SQLite foreign key constraints
    const reversedTables = [...TABLES_TO_SYNC].reverse()
    
    for (const table of reversedTables) {
      const pk = table === 'settings' ? 'key' : 'id'
      
      const { data: cloudRows, error: pullErr } = await supabase.from(table).select(pk)
      if (pullErr) throw pullErr

      const cloudIds = new Set((cloudRows || []).map(r => r[pk]))
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
      const { data, error } = await supabase.from(table).select('*')
      if (error) throw error

      if (data && data.length > 0) {
        const cols = Object.keys(data[0])
        const placeholders = cols.map(() => '?').join(', ')
        const statement = sqlite.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)
        
        sqlite.transaction((rowsToInsert: any[]) => {
          for (const row of rowsToInsert) {
            const mapped = parseDateStringsToEpoch(row)
            statement.run(cols.map(c => mapped[c]))
          }
        })(data)
      }
    }

    // 3. RECALCULATE STOCK
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

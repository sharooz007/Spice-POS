import { createClient } from '@supabase/supabase-js'
import { openDatabase } from '../db'

// Initialize Supabase Client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

let supabase: ReturnType<typeof createClient> | null = null
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey)
}

const TABLES_TO_SYNC = [
  'categories', 'products', 'product_variants', 'bulk_stock', 
  'retail_packet_stock', 'price_menu_entries', 'suppliers', 
  'customers', 'bulk_arrivals', 'bulk_adjustments', 
  'packing_runs', 'packing_run_lines', 'retail_adjustments', 
  'price_history', 'invoices', 'invoice_lines', 
  'invoice_datetime_edit_log', 'payments', 'purchase_entries', 
  'expenses', 'label_print_log', 'users', 'settings'
]

// Supabase returns timestamps as ISO strings. SQLite stores them as integers (ms since epoch)
// Supabase also returns booleans, which SQLite must store as 1 or 0
function parseDateStringsToEpoch(row: any): any {
  const converted = { ...row }
  for (const [key, value] of Object.entries(converted)) {
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      // It's a timestamp string
      converted[key] = new Date(value).getTime()
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

    // Log the sync success
    sqlite.prepare('INSERT INTO sync_log (synced_at, records_pushed, records_failed) VALUES (?, ?, ?)').run(Date.now(), 0, 0)
    
    return { ok: true, message: 'Sync complete!' }
  } catch (err: any) {
    console.error('Sync failed:', err)
    return { ok: false, message: err.message || 'Unknown sync error' }
  }
}

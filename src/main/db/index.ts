import { join } from 'path'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import { seedIfEmpty } from './seed'
import { seedDemoData } from './seedDemo'

type DB = ReturnType<typeof drizzle<typeof schema>>

let _db: DB | null = null

export function openDatabase(): DB {
  if (_db) return _db

  const dbPath = join(app.getPath('userData'), 'spice_pos.db')
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')

  _db = drizzle(sqlite, { schema })

  migrate(_db, { migrationsFolder: join(__dirname, 'migrations') })
  seedIfEmpty(_db)
  
  // Try to run demo seed; it will return early if demo_seeded is 'true'
  // using async IIFE so we don't block DB open strictly, or we can await if we make openDB async
  // Wait, openDatabase is synchronous currently. 
  // We can just execute it in the background or use better-sqlite3 sync methods. 
  // Wait! seedDemoData is an async function because drizzle uses Promises for DB calls.
  // We can just call it and log errors.
  seedDemoData(_db).catch(console.error)

  return _db
}

export function getDb(): DB {
  if (!_db) throw new Error('DB not initialized — call openDatabase() first')
  return _db
}

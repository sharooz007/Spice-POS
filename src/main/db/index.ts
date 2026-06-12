import { join } from 'path'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import { seedIfEmpty } from './seed'

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

  return _db
}

export function getDb(): DB {
  if (!_db) throw new Error('DB not initialized — call openDatabase() first')
  return _db
}

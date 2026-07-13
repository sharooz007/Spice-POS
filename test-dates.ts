import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

const testTable = sqliteTable('test', {
  id: integer('id').primaryKey(),
  dt: integer('dt', { mode: 'timestamp' })
})

const sqlite = new Database(':memory:')
sqlite.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, dt INTEGER)')
const db = drizzle(sqlite)

// Insert a string (like Supabase would give) via raw SQLite
sqlite.prepare('INSERT INTO test (id, dt) VALUES (?, ?)').run(1, '2026-07-09T09:30:33.123Z')

// Try to read it via Drizzle
const res = db.select().from(testTable).all()
console.log('Drizzle Read:', res[0].dt, typeof res[0].dt, res[0].dt instanceof Date)

// Try to write via Drizzle (from Local to Supabase, what does it output?)
sqlite.exec('DELETE FROM test')
db.insert(testTable).values({ id: 2, dt: new Date('2026-07-09T09:30:33.123Z') }).run()
const raw = sqlite.prepare('SELECT dt FROM test WHERE id = 2').get()
console.log('Drizzle Write to SQLite:', raw)

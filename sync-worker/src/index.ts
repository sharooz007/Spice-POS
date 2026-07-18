import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
  API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Simple API Key middleware
app.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || authHeader !== `Bearer ${c.env.API_KEY}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

app.get('/state', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT last_sync_time FROM global_sync_state WHERE id = ?').bind('singleton').all()
  if (results && results.length > 0) {
    return c.json({ last_sync_time: results[0].last_sync_time })
  }
  return c.json({ last_sync_time: null })
})

app.post('/pull', async (c) => {
  const body = await c.req.json()
  const { table, select } = body // select is optional array of columns, e.g. ["id"]
  
  if (!table) return c.json({ error: 'Missing table' }, 400)

  // Basic validation to prevent SQL injection on table name
  if (!/^[a-zA-Z0-9_]+$/.test(table)) return c.json({ error: 'Invalid table name' }, 400)

  const cols = select && Array.isArray(select) ? select.join(', ') : '*'
  try {
    const { results } = await c.env.DB.prepare(`SELECT ${cols} FROM ${table}`).all()
    return c.json({ data: results })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/push', async (c) => {
  const body = await c.req.json()
  const { table, rows } = body

  if (!table || !rows || !Array.isArray(rows)) return c.json({ error: 'Invalid body' }, 400)
  if (!/^[a-zA-Z0-9_]+$/.test(table)) return c.json({ error: 'Invalid table name' }, 400)
  if (rows.length === 0) return c.json({ success: true, count: 0 })

  const cols = Object.keys(rows[0])
  const placeholders = cols.map(() => '?').join(', ')
  const query = `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`

  try {
    const stmt = c.env.DB.prepare(query)
    const batch = rows.map((row) => {
      // D1 binds values in the order of the placeholders
      const values = cols.map((col) => row[col])
      return stmt.bind(...values)
    })

    await c.env.DB.batch(batch)
    return c.json({ success: true, count: rows.length })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/delete', async (c) => {
  const body = await c.req.json()
  const { table, ids, pk = 'id' } = body

  if (!table || !ids || !Array.isArray(ids)) return c.json({ error: 'Invalid body' }, 400)
  if (!/^[a-zA-Z0-9_]+$/.test(table)) return c.json({ error: 'Invalid table name' }, 400)
  if (ids.length === 0) return c.json({ success: true, count: 0 })

  try {
    const stmt = c.env.DB.prepare(`DELETE FROM ${table} WHERE ${pk} = ?`)
    const batch = ids.map((id) => stmt.bind(id))
    
    await c.env.DB.batch(batch)
    return c.json({ success: true, count: ids.length })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/update-state', async (c) => {
  const body = await c.req.json()
  const { time } = body
  if (!time) return c.json({ error: 'Missing time' }, 400)
  
  try {
    await c.env.DB.prepare('INSERT OR REPLACE INTO global_sync_state (id, last_sync_time) VALUES (?, ?)').bind('singleton', time).run()
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default app

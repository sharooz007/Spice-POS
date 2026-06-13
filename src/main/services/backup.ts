import { copyFile, readdir, unlink, stat, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { app } from 'electron'
import { getDb, restartDb } from '../db'
import { backupLog } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getSetting } from './settings'

// Format: spice_pos_2026-06-13_1430.db
function generateFilename(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `spice_pos_${yyyy}-${mm}-${dd}_${hh}${min}.db`
}

export async function createBackup(type: 'manual' | 'auto' | 'pre-restore'): Promise<string> {
  const defaultDir = path.join(app.getPath('documents'), 'SpicePOS_Backups')
  const primaryFolder = getSetting('backup_primary_folder') || defaultDir

  if (!existsSync(primaryFolder)) {
    await mkdir(primaryFolder, { recursive: true })
  }

  const filename = generateFilename()
  const dbPath = path.join(app.getPath('userData'), 'spice_pos.db')
  const destPath = path.join(primaryFolder, filename)

  // Copy to primary
  await copyFile(dbPath, destPath)

  // Insert log
  getDb().insert(backupLog).values({ type, filePath: destPath }).run()

  // Copy to secondary if configured
  const secondaryFolder = getSetting('backup_secondary_folder')
  if (secondaryFolder && existsSync(secondaryFolder)) {
    try {
      await copyFile(dbPath, path.join(secondaryFolder, filename))
    } catch (err) {
      console.error('Failed to copy backup to secondary folder:', err)
    }
  }

  // Prune primary folder (keep last 14)
  try {
    const files = await readdir(primaryFolder)
    const dbFiles = files.filter(f => f.startsWith('spice_pos_') && f.endsWith('.db'))
    if (dbFiles.length > 14) {
      dbFiles.sort((a, b) => b.localeCompare(a)) // descending
      const toDelete = dbFiles.slice(14)
      for (const file of toDelete) {
        await unlink(path.join(primaryFolder, file)).catch(console.error)
      }
    }
  } catch (err) {
    console.error('Failed to prune backups:', err)
  }

  return destPath
}

export async function restoreBackup(filePath: string): Promise<boolean> {
  if (!existsSync(filePath)) throw new Error('Backup file not found')
  
  // Pre-restore backup
  await createBackup('pre-restore')
  
  // Replace live DB
  const dbPath = path.join(app.getPath('userData'), 'spice_pos.db')
  const db = getDb()
  // Close the DB connection so file can be overwritten
  // Assuming getDb() returns better-sqlite3 instance wrapper
  const client = (db as any).session?.client
  if (client) client.close()
  
  await copyFile(filePath, dbPath)
  
  // Restart DB and run migrations
  await restartDb()
  return true
}

export async function listBackups(): Promise<Array<{ fileName: string, filePath: string, sizeBytes: number, createdAt: number }>> {
  const defaultDir = path.join(app.getPath('documents'), 'SpicePOS_Backups')
  const primaryFolder = getSetting('backup_primary_folder') || defaultDir

  if (!existsSync(primaryFolder)) return []

  const files = await readdir(primaryFolder)
  const dbFiles = files.filter(f => f.startsWith('spice_pos_') && f.endsWith('.db'))
  
  const results: Array<{ fileName: string, filePath: string, sizeBytes: number, createdAt: number }> = []
  for (const f of dbFiles) {
    const fullPath = path.join(primaryFolder, f)
    try {
      const s = await stat(fullPath)
      results.push({
        fileName: f,
        filePath: fullPath,
        sizeBytes: s.size,
        createdAt: s.mtimeMs
      })
    } catch { /* skip */ }
  }
  
  results.sort((a, b) => b.createdAt - a.createdAt)
  return results
}

// Auto Backup Scheduler
let autoBackupTimer: NodeJS.Timeout | null = null

export function initAutoBackupScheduler(): void {
  if (autoBackupTimer) clearInterval(autoBackupTimer)
  
  autoBackupTimer = setInterval(async () => {
    const isAutoBackupEnabled = getSetting('backup_auto_enabled') === 'true'
    if (!isAutoBackupEnabled) return

    const now = new Date()
    // Trigger at 05:00
    if (now.getHours() === 5 && now.getMinutes() === 0) {
      // Check if we already backed up today
      const db = getDb()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime()
      
      const exists = db.select().from(backupLog)
        .where(eq(backupLog.type, 'auto'))
        .all()
        .find(r => r.date.getTime() > todayStart)
        
      if (!exists) {
        try {
          await createBackup('auto')
        } catch (err) {
          console.error('Auto backup failed:', err)
        }
      }
    }
  }, 60 * 1000) // Check every minute
}

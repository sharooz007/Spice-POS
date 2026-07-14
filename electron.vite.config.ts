import { resolve, join, relative, dirname } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync, mkdirSync, readdirSync } from 'fs'
import type { Plugin } from 'vite'

// Rollup plugin: copies src/main/db/migrations → out/main/migrations after build.
function copyMigrationsPlugin(): Plugin {
  return {
    name: 'copy-migrations',
    closeBundle() {
      const src = resolve('src/main/db/migrations')
      const dest = resolve('out/main/migrations')
      mkdirSync(dest, { recursive: true })
      try {
        for (const entry of readdirSync(src, { withFileTypes: true, recursive: true })) {
          if (entry.isFile()) {
            const entryPath = entry.parentPath || (entry as any).path
            const fullPath = join(entryPath, entry.name)
            const rel = relative(src, fullPath)
            const destFile = join(dest, rel)
            mkdirSync(dirname(destFile), { recursive: true })
            copyFileSync(fullPath, destFile)
          }
        }
      } catch (e) {
        console.error('Migration copy failed:', e)
      }
      
      const tplSrc = resolve('src/main/printing/templates')
      const tplDest = resolve('out/main/printing/templates')
      mkdirSync(tplDest, { recursive: true })
      try {
        for (const entry of readdirSync(tplSrc, { withFileTypes: true, recursive: true })) {
          if (entry.isFile()) {
            const entryPath = entry.parentPath || (entry as any).path
            const fullPath = join(entryPath, entry.name)
            const rel = relative(tplSrc, fullPath)
            const destFile = join(tplDest, rel)
            mkdirSync(dirname(destFile), { recursive: true })
            copyFileSync(fullPath, destFile)
          }
        }
      } catch (e) {
        console.error('Template copy failed:', e)
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyMigrationsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})

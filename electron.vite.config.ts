import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import type { Plugin } from 'vite'

// Rollup plugin: copies src/main/db/migrations → out/main/migrations after build.
function copyMigrationsPlugin(): Plugin {
  return {
    name: 'copy-migrations',
    closeBundle() {
      const src = resolve('src/main/db/migrations')
      const dest = resolve('out/main/migrations')
      mkdirSync(dest, { recursive: true })
      for (const entry of readdirSync(src, { withFileTypes: true, recursive: true })) {
        if (entry.isFile()) {
          const rel = entry.parentPath
            ? join(entry.parentPath, entry.name).replace(src + '/', '')
            : entry.name
          const destFile = join(dest, rel)
          mkdirSync(join(dest, entry.parentPath ? entry.parentPath.replace(src, '') : ''), {
            recursive: true
          })
          copyFileSync(join(entry.parentPath ?? src, entry.name), destFile)
        }
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

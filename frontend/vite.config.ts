/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import { manifest, registerType } from './src/pwa.config.ts'

// https://vite.dev/config/
export default defineConfig({
  // The repo lives under /mnt/c (WSL's view of the Windows filesystem),
  // where Vite's default node_modules/.vite cache has shown flaky mtime/
  // locking behaviour that hangs worker startup. Caching on the native
  // Linux filesystem avoids that cross-filesystem flakiness entirely.
  cacheDir: '/tmp/lbike-frontend-vite-cache',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({ registerType, manifest }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true,
    // 'forks'/'threads' spawn OS-level child processes, which have shown
    // ~50% flaky startup timeouts under WSL2 on this machine. 'vmThreads'
    // isolates test files with VM contexts inside a single process
    // instead, avoiding that spawn entirely.
    pool: 'vmThreads',
    deps: {
      optimizer: {
        client: { enabled: false },
      },
    },
  },
})

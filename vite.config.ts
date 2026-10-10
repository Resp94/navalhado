import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // /api é do Worker do app (worker/index.ts). Em desenvolvimento, rode `npm run dev:worker` ao lado do `npm run dev`.
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    testTimeout: 15000,
    // A partir do Node 25 o Web Storage do Node é global e, sem --localstorage-file, `localStorage` vale undefined
    // e esconde o do jsdom. Desligado nos workers, os testes usam o localStorage do jsdom em qualquer versão do Node.
    execArgv: ['--no-experimental-webstorage'],
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**'],
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ESM Vite config (use .mjs for Node to treat it as ESM)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
})

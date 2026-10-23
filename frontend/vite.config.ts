import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/data/snapshot.json')) return 'official-snapshot'
          if (id.includes('/recharts/')) return 'charts'
          if (/\/(react-dom|react|scheduler)\//.test(id)) return 'react-vendor'
          if (id.includes('/node_modules/')) return 'vendor'
        },
      },
    },
  },
})

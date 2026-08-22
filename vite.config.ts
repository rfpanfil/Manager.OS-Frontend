import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  server: {
    port: 3000,
    host: true, 
    // 🔥 A MÁGICA DO HOT-RELOAD NO WINDOWS/DOCKER
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      // 🔥 ADICIONE ESTE BLOCO PARA AS IMAGENS FUNCIONAREM NO TÚNEL
      '/attachments': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    },
  },
})
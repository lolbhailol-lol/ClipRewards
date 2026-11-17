import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // One .env at the repo root for both the API and the web app (VITE_* vars are exposed here).
  envDir: '..',
  server: {
    port: 5173,
    // Instagram needs an https redirect URL, so local testing goes through a tunnel.
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.app', '.trycloudflare.com'],
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})

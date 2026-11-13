import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base 由环境变量控制：默认 '/'（根路径部署），子路径部署（如 /hotel/）时 VITE_BASE=/hotel/ npm run build
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})

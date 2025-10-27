import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: ['es2017', 'chrome64', 'safari12', 'firefox68'], // 2020年頃の古いスマホ対応
    cssTarget: 'chrome61', // 古いブラウザのCSS互換性
  },
})

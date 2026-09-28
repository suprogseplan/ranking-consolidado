import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Publicação institucional: https://suprogseplan.github.io/ranking-consolidado/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/ranking-consolidado/' : '/',
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      srcDir: 'src/sw',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@components': resolve(__dirname, 'src/components'),
      '@pages':      resolve(__dirname, 'src/pages'),
      '@routes':     resolve(__dirname, 'src/routes'),
      '@entity':     resolve(__dirname, 'src/entity'),
      '@service':    resolve(__dirname, 'src/service'),
      '@hooks':      resolve(__dirname, 'src/hooks'),
      '@utils':      resolve(__dirname, 'src/utils'),
      '@db':         resolve(__dirname, 'src/db'),
      '@store':      resolve(__dirname, 'src/store'),
      '@sw':         resolve(__dirname, 'src/sw'),
      '@constants':  resolve(__dirname, 'src/constants'),
      '@prompts':    resolve(__dirname, 'src/prompts'),
    },
  },
})

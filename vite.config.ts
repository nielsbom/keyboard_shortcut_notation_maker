import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/keyboard_shortcut_notation_maker/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
      },
    },
  },
})

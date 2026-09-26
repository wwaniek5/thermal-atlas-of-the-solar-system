import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Agent sessions may leave full checkouts of the repo here.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})

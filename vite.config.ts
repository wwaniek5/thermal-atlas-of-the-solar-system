import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'
import { prerender } from './scripts/prerender.ts'

/**
 * Cloudflare Web Analytics (cookieless visitor stats), in production builds
 * only so local development isn't counted. The token is public. The site was
 * set up in the Cloudflare dashboard, see CLAUDE.md "Analytics".
 */
function analytics(): Plugin {
  const beacon =
    '<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" ' +
    'data-cf-beacon=\'{"token": "97a89b0510454eb182c1f25f97299a21"}\'></script>'
  return {
    name: 'analytics',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('</body>', `  ${beacon}\n  </body>`),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), analytics(), prerender()],
  test: {
    // Agent sessions may leave full checkouts of the repo here.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})

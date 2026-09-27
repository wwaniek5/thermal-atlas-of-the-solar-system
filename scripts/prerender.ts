/**
 * Static HTML for search engines and link previews, written after the build.
 *
 * The app renders in the browser, so every page used to be the same empty
 * index.html. This writes one page per body with data (dist/<id>.html, served
 * at /<id> by the CloudFront function in infra/site) and a home page, each
 * with its own title, description, canonical address and readable content:
 * the menu as links, a heading and the About text. The app replaces that
 * content when it starts. Also writes sitemap.xml and robots.txt.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { BODIES, type Body } from '../src/bodies.ts'
import { AUTHOR, HOME_DESCRIPTION, pageDescription, pageTitle, REPO_URL, SITE_NAME, SITE_URL } from '../src/seo.ts'

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const withData = BODIES.filter((b) => b.source)

/** The body menu as plain links, planets with their moons nested, like BodyMenu. */
function menu(selected: string | null): string {
  const item = (b: Body) =>
    b.source
      ? `<a href="/${b.id}"${b.id === selected ? ' aria-current="page"' : ''}>${esc(b.name)}</a>`
      : `<span class="unavailable">${esc(b.name)}</span>`
  const planets = BODIES.filter((b) => !b.parent).map((p) => {
    const moons = BODIES.filter((b) => b.parent === p.id)
    const nested = moons.length
      ? `<ul class="moons">${moons.map((m) => `<li class="moon">${item(m)}</li>`).join('')}</ul>`
      : ''
    return `<li${moons.length ? ' class="has-moons"' : ''}>${item(p)}${nested}</li>`
  })
  return `<nav class="body-menu" aria-label="Planets and moons"><ul>${planets.join('')}</ul></nav>`
}

/** Matches SiteFooter. */
const footer = `<footer class="site-footer">Made by ${esc(AUTHOR)} · <a href="${REPO_URL}">Source on GitHub</a> · MIT License</footer>`

function bodyContent(body: Body): string {
  const about = body.about
    ? `<section class="about"><h2>About ${esc(body.name)}</h2>${body.about.map((p) => `<p>${esc(p)}</p>`).join('')}</section>`
    : ''
  return `<div class="layout">${menu(body.id)}<main><header><p class="eyebrow">${esc(SITE_NAME)}</p><h1>${esc(body.name)}</h1><p class="subtitle">${esc(body.quantity ?? '')}</p></header><p>${esc(pageDescription(body))}</p>${about}${footer}</main></div>`
}

function homeContent(): string {
  return `<div class="layout">${menu(null)}<main><header><h1>${esc(SITE_NAME)}</h1><p class="subtitle">${esc(HOME_DESCRIPTION)}</p></header>${footer}</main></div>`
}

/** index.html with this page's title, description, address and content. */
function page(template: string, title: string, description: string, path: string, content: string): string {
  const url = `${SITE_URL}${path}`
  const replaced = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*"/, `$1${esc(description)}"`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*"/, `$1${esc(title)}"`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, `$1${esc(description)}"`)
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*"/, `$1${url}"`)
    .replace('</head>', `  <link rel="canonical" href="${url}" />\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${content}</div>`)
  // If index.html's tags change shape, fail the build rather than ship pages without them.
  const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const tag = (attr: string, value: string) => new RegExp(`${attr}\\s+content="${literal(esc(value))}"`)
  const expected: [string, RegExp][] = [
    ['title', new RegExp(`<title>${literal(esc(title))}</title>`)],
    ['description', tag('name="description"', description)],
    ['og:title', tag('property="og:title"', title)],
    ['og:description', tag('property="og:description"', description)],
    ['og:url', tag('property="og:url"', url)],
    ['canonical', new RegExp(`<link rel="canonical" href="${literal(url)}" />`)],
    ['content', /<div id="root"><div class="layout">/],
  ]
  for (const [name, pattern] of expected) {
    if (!pattern.test(replaced)) throw new Error(`prerender: ${path} is missing its ${name}`)
  }
  return replaced
}

export function prerender(): Plugin {
  let outDir = 'dist'
  return {
    name: 'prerender',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const template = readFileSync(join(outDir, 'index.html'), 'utf8')
      for (const body of withData) {
        const html = page(template, pageTitle(body), pageDescription(body), `/${body.id}`, bodyContent(body))
        writeFileSync(join(outDir, `${body.id}.html`), html)
      }
      writeFileSync(join(outDir, 'index.html'), page(template, SITE_NAME, HOME_DESCRIPTION, '/', homeContent()))

      const urls = ['/', ...withData.map((b) => `/${b.id}`)]
      writeFileSync(
        join(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
          .map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`)
          .join('\n')}\n</urlset>\n`,
      )
      writeFileSync(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`)
    },
  }
}

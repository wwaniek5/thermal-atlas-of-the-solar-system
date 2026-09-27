import type { Body } from './bodies'

/**
 * Names and descriptions for search engines, link previews and browser tabs.
 * The app sets the tab title; the build (prerender in vite.config.ts) writes
 * the same titles and descriptions into a static HTML page per body.
 */
export const SITE_NAME = 'Thermal Atlas of the Solar System'
export const SITE_URL = 'https://isotherms.org'
export const AUTHOR = 'Wojciech Waniek'
export const REPO_URL = 'https://github.com/wwaniek5/ww-isotherms'
export const HOME_DESCRIPTION =
  'Temperature maps of the planets and the Moon, with isotherms that move through the seasons.'

/** A body page's title: what people search for first, then the site. */
export function pageTitle(body: Body): string {
  return `${body.name} temperature map · Thermal Atlas`
}

/** A body page's description for search results (about 160 characters at most). */
export function pageDescription(body: Body): string {
  return body.description ?? HOME_DESCRIPTION
}

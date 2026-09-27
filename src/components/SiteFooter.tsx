import { AUTHOR, REPO_URL } from '../seo'

/** One quiet line at the very bottom of every page: who made it, the code, the license. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      Made by {AUTHOR} · <a href={REPO_URL}>Source on GitHub</a> · MIT License
    </footer>
  )
}

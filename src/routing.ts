import { useEffect, useRef, useState } from 'react'
import { BODIES, DEFAULT_BODY } from './bodies'

/** Each body with data has its own page: /earth, /mars, ... */
export function pathFor(bodyId: string): string {
  return `${import.meta.env.BASE_URL}${bodyId}`
}

/** The body a path names, or null if it names none that has data. */
export function bodyFromPath(pathname: string): string | null {
  const id = pathname.slice(import.meta.env.BASE_URL.length).replace(/\/+$/, '').toLowerCase()
  return BODIES.some((b) => b.id === id && b.source) ? id : null
}

/**
 * The body in the URL, and whether this is the home page (/), which shows the
 * default body but keeps its own address, so a shared link is to the site.
 * Unknown paths are replaced with /. `onChange` gets the new body whenever it
 * changes, by navigating or by the browser's back/forward buttons.
 */
export function useBodyRoute(
  onChange: (bodyId: string) => void,
): [bodyId: string, navigate: (bodyId: string) => void, home: boolean] {
  const [bodyId, setBodyId] = useState(() => bodyFromPath(location.pathname) ?? DEFAULT_BODY)
  const [home, setHome] = useState(() => bodyFromPath(location.pathname) === null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    const root = import.meta.env.BASE_URL
    if (bodyFromPath(location.pathname) === null && location.pathname !== root) history.replaceState(null, '', root)
    const onPopState = () => {
      const named = bodyFromPath(location.pathname)
      const id = named ?? DEFAULT_BODY
      setBodyId(id)
      setHome(named === null)
      onChangeRef.current(id)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
    // Only on mount: later changes go through navigate or popstate.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const navigate = (id: string) => {
    if (id === bodyId && !home) return
    history.pushState(null, '', pathFor(id))
    setHome(false)
    if (id === bodyId) return // from home to the same body's own page: nothing else changes
    setBodyId(id)
    onChangeRef.current(id)
  }
  return [bodyId, navigate, home]
}

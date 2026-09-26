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
 * The body in the URL. Other paths, including /, are replaced with the
 * default body's path. `onChange` gets the new body whenever it changes, by
 * navigating or by the browser's back/forward buttons.
 */
export function useBodyRoute(onChange: (bodyId: string) => void): [string, (bodyId: string) => void] {
  const [bodyId, setBodyId] = useState(() => bodyFromPath(location.pathname) ?? DEFAULT_BODY)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (location.pathname !== pathFor(bodyId)) history.replaceState(null, '', pathFor(bodyId))
    const onPopState = () => {
      const id = bodyFromPath(location.pathname) ?? DEFAULT_BODY
      setBodyId(id)
      onChangeRef.current(id)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
    // Only on mount: later changes go through navigate or popstate.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const navigate = (id: string) => {
    if (id === bodyId) return
    history.pushState(null, '', pathFor(id))
    setBodyId(id)
    onChangeRef.current(id)
  }
  return [bodyId, navigate]
}

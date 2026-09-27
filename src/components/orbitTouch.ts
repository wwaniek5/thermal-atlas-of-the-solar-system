import { useEffect, type PointerEvent, type RefObject } from 'react'

/** The draggable planet or moon; it has a larger invisible hit area for fingers. */
const HANDLE = '.orbit-handle'

const onHandle = (target: EventTarget | null) => target instanceof Element && target.closest(HANDLE) !== null

/**
 * Whether a pointer-down should start moving the planet. With a mouse or pen,
 * anywhere on the diagram does. With a finger, only the planet itself: a swipe
 * elsewhere scrolls the page, since on a phone the diagram fills the width.
 */
export function startsDrag(e: PointerEvent): boolean {
  return e.pointerType !== 'touch' || onHandle(e.target)
}

/**
 * Lets touches on the diagram scroll the page, except those that start on the
 * planet. The SVG allows vertical panning (CSS touch-action: pan-y); a touch
 * on the planet cancels it here. This needs a non-passive listener, which
 * React's onTouchStart is not.
 */
export function useScrollUnlessOnHandle(svgRef: RefObject<SVGSVGElement | null>): void {
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onTouchStart = (e: TouchEvent) => {
      if (onHandle(e.target)) e.preventDefault()
    }
    svg.addEventListener('touchstart', onTouchStart, { passive: false })
    return () => svg.removeEventListener('touchstart', onTouchStart)
  }, [svgRef])
}

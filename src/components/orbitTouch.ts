import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'

/** The draggable planet or moon; it has a larger invisible hit area for fingers. */
const HANDLE = '.orbit-handle'

/** A finger must move this far (CSS px) before a touch counts as a drag rather than a tap. */
const SLOP = 8

const onHandle = (target: EventTarget | null) => target instanceof Element && target.closest(HANDLE) !== null

/** Where a touch that didn't start on the planet began; it isn't a drag yet. */
interface Pending {
  id: number
  x: number
  y: number
}

/**
 * Pointer handling for an orbit diagram, where moving the pointer moves the
 * planet (`moveTo` gets the pointer's client coordinates).
 *
 * With a mouse or pen, pressing anywhere moves the planet there and dragging
 * follows. On a phone the diagram fills the width, so it must also let the
 * page scroll:
 * - a drag starting on the planet moves it, in any direction;
 * - elsewhere, a tap moves the planet there, and a sideways drag moves it;
 * - a vertical swipe that doesn't start on the planet scrolls the page (the
 *   SVG has CSS touch-action: pan-y, so the browser takes those swipes).
 *
 * `used` turns true once the planet has been moved by hand, to hide the hint.
 */
export function useOrbitPointer(svgRef: RefObject<SVGSVGElement | null>, moveTo: (x: number, y: number) => void) {
  const dragging = useRef<number | null>(null)
  const pending = useRef<Pending | null>(null)
  const [used, setUsed] = useState(false)

  // Touches on the planet must not scroll the page. That needs a non-passive
  // listener, which React's onTouchStart is not.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onTouchStart = (e: TouchEvent) => {
      if (onHandle(e.target)) e.preventDefault()
    }
    svg.addEventListener('touchstart', onTouchStart, { passive: false })
    return () => svg.removeEventListener('touchstart', onTouchStart)
  }, [svgRef])

  const startDrag = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = e.pointerId
    pending.current = null
    setUsed(true)
    moveTo(e.clientX, e.clientY)
  }

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== 'touch' || onHandle(e.target)) startDrag(e)
    else pending.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging.current === e.pointerId) {
      moveTo(e.clientX, e.clientY)
      return
    }
    const p = pending.current
    if (!p || p.id !== e.pointerId) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (Math.hypot(dx, dy) < SLOP) return
    // Mostly vertical: leave it to the page to scroll.
    if (Math.abs(dy) > Math.abs(dx)) pending.current = null
    else startDrag(e)
  }

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    // A touch that ended without moving much is a tap: move the planet there.
    if (pending.current?.id === e.pointerId) {
      setUsed(true)
      moveTo(e.clientX, e.clientY)
    }
    pending.current = null
    dragging.current = null
  }

  // The browser took the touch over to scroll the page.
  const onPointerCancel = () => {
    pending.current = null
    dragging.current = null
  }

  return { handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }, used }
}

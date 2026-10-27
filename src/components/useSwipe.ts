// React-Hook: Wischgesten auf einem Element (nur Touch – am Computer gibt es die Pfeile).
// Während des Wischens folgt die aktuelle Ansicht (Element mit data-view-current) dem Finger;
// beim Loslassen wechselt sie (onSwipe) oder federt zurück.

import { useEffect, useRef, type RefObject } from 'react'
import { lockAxis, swipeDirection, type SwipeDir } from '../lib/swipe'

/** Gleiche Kurve wie die Animationen in index.css (--ease-out-smooth) */
const SNAP_BACK = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)'

/** Kann das Element (oder ein Eltern-Element bis `root`) waagrecht scrollen? Dann gehört die Geste dem Scrollen. */
function scrollsHorizontally(target: EventTarget | null, root: HTMLElement): boolean {
  for (let el = target as HTMLElement | null; el && el !== root; el = el.parentElement) {
    const style = getComputedStyle(el)
    if (/(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1) return true
  }
  return false
}

function snapBack(layer: HTMLElement) {
  layer.style.transition = SNAP_BACK
  layer.style.transform = ''
  layer.addEventListener('transitionend', () => (layer.style.transition = ''), { once: true })
}

/**
 * onSwipe(dir, offsetX): dir = 1 nächster / -1 vorheriger Zeitraum,
 * offsetX = wie weit die Ansicht beim Loslassen verschoben war (dort setzt die Animation an).
 */
export function useSwipe(
  ref: RefObject<HTMLElement | null>,
  onSwipe: (dir: Exclude<SwipeDir, 0>, offsetX: number) => void,
  enabled: boolean,
) {
  // Immer die neueste Funktion verwenden, ohne die Listener neu anzuhängen
  const handler = useRef(onSwipe)
  handler.current = onSwipe

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    let g: {
      x: number
      y: number
      lastX: number
      lastT: number
      velocity: number // px/ms, geglättet
      axis: 'x' | 'y' | null
      layer: HTMLElement
    } | null = null

    const cancel = () => {
      if (g?.axis === 'x') snapBack(g.layer)
      g = null
    }

    const onStart = (e: TouchEvent) => {
      cancel()
      if (e.touches.length !== 1) return // zwei Finger = Zoomen
      const layer = el.querySelector<HTMLElement>('[data-view-current]')
      if (!layer || scrollsHorizontally(e.target, el)) return
      const t = e.touches[0]
      g = { x: t.clientX, y: t.clientY, lastX: t.clientX, lastT: performance.now(), velocity: 0, axis: null, layer }
    }

    const onMove = (e: TouchEvent) => {
      if (!g) return
      const t = e.touches[0]
      const dx = t.clientX - g.x
      if (g.axis === null) {
        g.axis = lockAxis(dx, t.clientY - g.y)
        if (g.axis === null) return
        // Senkrecht – oder der Browser scrollt schon (dann lässt sich die Geste nicht mehr übernehmen)
        if (g.axis === 'y' || !e.cancelable) return void (g = null)
        g.layer.style.transition = 'none'
        g.layer.getAnimations().forEach((a) => a.finish()) // laufendes Hereingleiten sofort beenden
      }
      if (e.cancelable) e.preventDefault() // nicht gleichzeitig senkrecht scrollen

      const now = performance.now()
      const dt = now - g.lastT
      if (dt > 0) g.velocity = 0.3 * g.velocity + 0.7 * ((t.clientX - g.lastX) / dt)
      g.lastX = t.clientX
      g.lastT = now
      g.layer.style.transform = `translate3d(${dx}px, 0, 0)`
    }

    const onEnd = (e: TouchEvent) => {
      if (!g || g.axis !== 'x') return void (g = null)
      const dx = e.changedTouches[0].clientX - g.x
      // Finger stand vor dem Loslassen still → kein Schnipp
      const velocity = performance.now() - g.lastT > 80 ? 0 : g.velocity
      const dir = swipeDirection(dx, velocity, el.clientWidth)
      const layer = g.layer
      g = null
      // Bei einem Wechsel bleibt die Verschiebung stehen – die Wechsel-Animation übernimmt von dort.
      if (dir !== 0) handler.current(dir, dx)
      else snapBack(layer)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', cancel, { passive: true })
    return () => {
      cancel()
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', cancel)
    }
  }, [ref, enabled])
}

// React-Hook: erkennt Wischgesten auf einem Element (nur Touch – am Computer gibt es die Pfeile).

import { useEffect, useRef, type RefObject } from 'react'
import { swipeDirection, type SwipeDir } from '../lib/swipe'

/** Kann das Element (oder ein Eltern-Element bis `root`) waagrecht scrollen? Dann gehört die Geste dem Scrollen. */
function scrollsHorizontally(target: EventTarget | null, root: HTMLElement): boolean {
  for (let el = target as HTMLElement | null; el && el !== root; el = el.parentElement) {
    const style = getComputedStyle(el)
    if (/(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1) return true
  }
  return false
}

export function useSwipe(ref: RefObject<HTMLElement | null>, onSwipe: (dir: Exclude<SwipeDir, 0>) => void, enabled: boolean) {
  // Immer die neueste Funktion verwenden, ohne die Listener neu anzuhängen
  const handler = useRef(onSwipe)
  handler.current = onSwipe

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    let start: { x: number; y: number; t: number; ignore: boolean } | null = null

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return void (start = null) // zwei Finger = Zoomen
      const t = e.touches[0]
      start = { x: t.clientX, y: t.clientY, t: Date.now(), ignore: scrollsHorizontally(e.target, el) }
    }
    const onEnd = (e: TouchEvent) => {
      if (!start || start.ignore) return
      const t = e.changedTouches[0]
      const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y, Date.now() - start.t)
      start = null
      if (dir !== 0) handler.current(dir)
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [ref, enabled])
}

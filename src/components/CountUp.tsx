// Zahl, die beim Erscheinen von 0 hochzählt (z. B. "3 Tage bis …", Notenschnitt).
// Bei "Bewegung reduzieren" steht sofort der Endwert da.

import { useEffect, useRef, useState } from 'react'

const DURATION_MS = 900

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Schneller Start, sanftes Auslaufen */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4)

export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  delay = 0,
}: {
  value: number
  /** Zwischenwert → Text. Standard: ganze Zahl. Für den Schnitt z. B. (n) => n.toFixed(2) */
  format?: (n: number) => string
  /** Verzögerung in ms (passend zum versetzten Einblenden der Kacheln) */
  delay?: number
}) {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0))
  // Startwert der laufenden Animation: beim ersten Mal 0, danach der zuletzt gezeigte Wert
  const from = useRef(0)

  useEffect(() => {
    if (reducedMotion()) {
      setShown(value)
      return
    }
    const start = from.current
    let frame = 0
    let t0 = 0
    const tick = (now: number) => {
      if (!t0) t0 = now + delay
      const t = Math.min(1, Math.max(0, (now - t0) / DURATION_MS))
      const current = start + (value - start) * easeOut(t)
      from.current = current
      setShown(current)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, delay])

  // Für Screenreader zählt nur der Endwert
  return (
    <>
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  )
}

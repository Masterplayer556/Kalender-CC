// Gemeinsame Uhr für alles, was von der aktuellen Uhrzeit abhängt (rote Linie, „vorbei – abhaken?“,
// Begrüssung, Tageswechsel). Sie tickt jede volle Minute, aber nur solange die App sichtbar ist;
// beim Zurückkehren in die App sofort. Eine Komponente zeichnet sich nur neu, wenn sich ihr
// ausgewählter Wert ändert (z. B. nur die Stunde oder nur das Datum).

import { useCallback, useSyncExternalStore } from 'react'

const MINUTE = 60_000
const minuteNow = () => Math.floor(Date.now() / MINUTE) * MINUTE

let now = minuteNow()
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function tick() {
  const next = minuteNow()
  if (next === now) return
  now = next
  for (const l of listeners) l()
}

function schedule() {
  clearTimeout(timer)
  timer = undefined
  if (listeners.size === 0 || document.visibilityState === 'hidden') return // pausiert
  tick()
  timer = setTimeout(schedule, MINUTE - (Date.now() % MINUTE) + 50) // kurz nach der nächsten vollen Minute
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', schedule)
    schedule()
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      document.removeEventListener('visibilitychange', schedule)
      schedule() // stoppt den Timer
    }
  }
}

/** Aktuelle Zeit (auf die Minute genau) – bzw. ein daraus abgeleiteter Wert (Zahl oder Text). */
export function useClock<T extends string | number = number>(select?: (ms: number) => T): T {
  const getSnapshot = useCallback(() => (select ? select(now) : now) as T, [select])
  return useSyncExternalStore(subscribe, getSnapshot)
}

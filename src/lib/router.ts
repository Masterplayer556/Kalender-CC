// Mini-Router über den "#"-Teil der Adresse, z. B. ".../kalender-tracker/#/woche/2026-10-20".
// GitHub Pages bekommt den Teil nach "#" nie zu sehen – deshalb klappt Neuladen auf jeder Seite.

import { useCallback, useEffect, useRef, useState } from 'react'
import { addDays, addMonths, isDateKey, todayKey, type DateKey } from './dates'

export type ViewName = 'heute' | 'monat' | 'woche' | 'tag' | 'liste' | 'heatmap' | 'noten' | 'mehr'

const VIEWS: ViewName[] = ['heute', 'monat', 'woche', 'tag', 'liste', 'heatmap', 'noten', 'mehr']

/** Ansichten im Bereich "Kalender" (Umschalter oben) */
export type CalendarView = 'monat' | 'woche' | 'tag' | 'liste' | 'heatmap'
export const CALENDAR_VIEWS: CalendarView[] = ['monat', 'woche', 'tag', 'liste', 'heatmap']

/** Ansichten mit einem Zeitraum, der sich vor/zurück blättern (und wischen) lässt */
export const hasPeriod = (v: ViewName) => v === 'monat' || v === 'woche' || v === 'tag' || v === 'heatmap'
export const isCalendarView = (v: ViewName): v is CalendarView => (CALENDAR_VIEWS as ViewName[]).includes(v)

/** Die vier Bereiche der Navigation */
export type Section = 'heute' | 'kalender' | 'noten' | 'mehr'
export const sectionOf = (v: ViewName): Section => (isCalendarView(v) ? 'kalender' : v)

export interface Route {
  view: ViewName
  date: DateKey // für Monat/Woche/Tag: der angezeigte Zeitraum
}

export function parseHash(hash: string, today: DateKey, fallbackView: ViewName): Route {
  let [view, date] = hash.replace(/^#\/?/, '').split('/')
  if (view === 'faecher') view = 'mehr' // alte Adresse
  return {
    view: VIEWS.includes(view as ViewName) ? (view as ViewName) : fallbackView,
    date: isDateKey(date) ? date : today,
  }
}

export function toHash(route: Route): string {
  return hasPeriod(route.view)
    ? `#/${route.view}/${route.date}`
    : `#/${route.view}`
}

/** Einen Schritt vor/zurück: ein Monat, eine Woche oder ein Tag */
export function stepDate(route: Route, direction: 1 | -1): DateKey {
  if (route.view === 'monat' || route.view === 'heatmap') return addMonths(route.date, direction)
  if (route.view === 'woche') return addDays(route.date, 7 * direction)
  return addDays(route.date, direction)
}

/** Zuletzt benutzte Kalender-Ansicht (für den Tab "Kalender"); gespeichert als Einstellung "calendarView" */
export const lastCalendarView = (saved: unknown): CalendarView =>
  (CALENDAR_VIEWS as unknown[]).includes(saved) ? (saved as CalendarView) : 'monat'

/**
 * Tageswechsel: Stand die Ansicht auf "heute" (alter Tag), springt sie auf den neuen Tag.
 * Hat man selbst einen anderen Tag gewählt, bleibt er stehen. null = nichts ändern.
 */
export function rollToday(route: Route, prevToday: DateKey, today: DateKey): Route | null {
  if (prevToday === today || route.date !== prevToday) return null
  return { ...route, date: today }
}

/** React-Hook: aktuelle Route + Funktion zum Wechseln */
export function useRoute(): [Route, (next: Partial<Route>) => void] {
  // Ohne Adresse startet die App in der Heute-Übersicht
  const read = () => parseHash(window.location.hash, todayKey(), 'heute')
  const [route, setRoute] = useState<Route>(read)

  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  // Nach Mitternacht (App offen gelassen oder aus dem Hintergrund geholt) "heute" neu bestimmen –
  // sonst öffnen Kalender und Heute-Ansicht weiter den Vortag.
  const routeRef = useRef(route)
  useEffect(() => {
    routeRef.current = route
  }, [route])
  useEffect(() => {
    let lastToday = todayKey()
    const check = () => {
      const today = todayKey()
      const next = rollToday(routeRef.current, lastToday, today)
      lastToday = today
      if (!next) return
      // Adresse ersetzen statt neuen Verlaufseintrag anlegen ("Zurück" soll nicht auf gestern führen)
      window.history.replaceState(window.history.state, '', toHash(next))
      routeRef.current = next
      setRoute(next)
    }
    const timer = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
    }
  }, [])

  const navigate = useCallback(
    (next: Partial<Route>) => {
      const target = { ...route, ...next }
      window.location.hash = toHash(target)
    },
    [route],
  )

  return [route, navigate]
}

// Mini-Router über den "#"-Teil der Adresse, z. B. ".../kalender-tracker/#/woche/2026-10-20".
// GitHub Pages bekommt den Teil nach "#" nie zu sehen – deshalb klappt Neuladen auf jeder Seite.

import { useCallback, useEffect, useState } from 'react'
import { addDays, addMonths, isDateKey, todayKey, type DateKey } from './dates'
import { loadPref, savePref } from './cache'

export type ViewName = 'monat' | 'woche' | 'tag' | 'liste' | 'noten' | 'faecher'

const VIEWS: ViewName[] = ['monat', 'woche', 'tag', 'liste', 'noten', 'faecher']

export interface Route {
  view: ViewName
  date: DateKey // für Monat/Woche/Tag: der angezeigte Zeitraum
}

export function parseHash(hash: string, today: DateKey, fallbackView: ViewName): Route {
  const [view, date] = hash.replace(/^#\/?/, '').split('/')
  return {
    view: VIEWS.includes(view as ViewName) ? (view as ViewName) : fallbackView,
    date: isDateKey(date) ? date : today,
  }
}

export function toHash(route: Route): string {
  return route.view === 'liste' || route.view === 'noten' || route.view === 'faecher'
    ? `#/${route.view}`
    : `#/${route.view}/${route.date}`
}

/** Einen Schritt vor/zurück: ein Monat, eine Woche oder ein Tag */
export function stepDate(route: Route, direction: 1 | -1): DateKey {
  if (route.view === 'monat') return addMonths(route.date, direction)
  if (route.view === 'woche') return addDays(route.date, 7 * direction)
  return addDays(route.date, direction)
}

/** React-Hook: aktuelle Route + Funktion zum Wechseln */
export function useRoute(): [Route, (next: Partial<Route>) => void] {
  const read = () => parseHash(window.location.hash, todayKey(), loadPref<ViewName>('view', 'monat'))
  const [route, setRoute] = useState<Route>(read)

  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback(
    (next: Partial<Route>) => {
      const target = { ...route, ...next }
      if (target.view !== 'faecher') savePref('view', target.view) // letzte Ansicht merken
      window.location.hash = toHash(target)
    },
    [route],
  )

  return [route, navigate]
}

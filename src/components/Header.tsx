// Seitenkopf: kleine Zeile (Eyebrow) + grosser Titel, rechts Suche und Filter.
// Im Bereich "Kalender" zusätzlich der Umschalter Monat / Woche / Tag / Liste und Vor/Zurück/Heute.

import { useState } from 'react'
import { useAuth } from '../data/AuthProvider'
import { formatWeekRange, formatWeekday, isoWeek, parseDateKey, todayKey } from '../lib/dates'
import { semesterOf } from '../lib/grades'
import { hasPeriod, isCalendarView, type CalendarView, type Route } from '../lib/router'
import { Icon } from './Icon'
import { useMediaQuery } from './useMediaQuery'

const CAL_BUTTONS: { view: CalendarView; label: string; short?: string }[] = [
  { view: 'monat', label: 'Monat' },
  { view: 'woche', label: 'Woche' },
  { view: 'tag', label: 'Tag' },
  { view: 'liste', label: 'Liste' },
  { view: 'heatmap', label: 'Heatmap', short: 'Heat' },
]

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Gute Nacht'
  if (h < 11) return 'Guten Morgen'
  if (h < 17) return 'Guten Tag'
  return 'Guten Abend'
}

const monthName = (key: string) => parseDateKey(key).toLocaleDateString('de-CH', { month: 'long' })
const longDay = (key: string) => parseDateKey(key).toLocaleDateString('de-CH', { day: 'numeric', month: 'long' })

/** Eyebrow und Titel je nach Ansicht */
function heading(route: Route, email: string, compact: boolean): { eyebrow: string; title: string } {
  const d = route.date
  switch (route.view) {
    case 'heute': {
      const today = todayKey()
      const date = `${formatWeekday(today, 'long')}, ${longDay(today)}`
      return { eyebrow: compact ? date : `${greeting()} · ${date}`, title: 'Heute' }
    }
    case 'monat':
      return { eyebrow: d.slice(0, 4), title: monthName(d) }
    case 'heatmap':
      return { eyebrow: `${d.slice(0, 4)} · Belastung pro Tag`, title: monthName(d) }
    case 'woche':
      return { eyebrow: formatWeekRange(d), title: `Woche ${isoWeek(d)}` }
    case 'tag':
      return { eyebrow: `${monthName(d)} ${d.slice(0, 4)}`, title: `${formatWeekday(d, compact ? 'short' : 'long')}, ${Number(d.slice(8))}.` }
    case 'liste':
      return { eyebrow: 'Kalender', title: 'Als Nächstes' }
    case 'noten':
      return { eyebrow: semesterOf(todayKey()).label, title: 'Noten' }
    case 'mehr':
      return { eyebrow: email, title: 'Mehr' }
  }
}

export function Header({
  route,
  navigate,
  search,
  onSearch,
  filtersOpen,
  filterActive,
  onToggleFilters,
  onStep,
  onToday,
}: {
  route: Route
  navigate: (next: Partial<Route>) => void
  search: string
  onSearch: (q: string) => void
  filtersOpen: boolean
  filterActive: boolean
  onToggleFilters: () => void
  onStep: (direction: 1 | -1) => void // vor/zurück (mit Animation, siehe App)
  onToday: () => void
}) {
  const { session } = useAuth()
  const isCalendar = isCalendarView(route.view)
  const showsDates = hasPeriod(route.view)
  // iPhone (schmal): Pfeile weg (dort wird gewischt), Suche hinter einer Lupe
  const compact = useMediaQuery('(max-width: 639px)')
  const [searchOpen, setSearchOpen] = useState(false)
  const showSearchField = !compact || searchOpen || search !== ''
  const { eyebrow, title } = search ? { eyebrow: 'Titel und Notizen', title: 'Suche' } : heading(route, session?.user.email ?? '', compact)
  const canFilter = isCalendar || route.view === 'heute' || !!search

  const searchField = (
    <div className={`relative ${compact ? 'flex-1' : ''}`}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 muted">
        <Icon name="search" className="h-4 w-4" />
      </span>
      <input
        type="search"
        className={`input pl-9 ${compact ? '' : 'w-44! lg:w-60!'}`}
        placeholder="Suchen …"
        value={search}
        autoFocus={compact}
        aria-label="Einträge durchsuchen"
        onChange={(e) => onSearch(e.target.value)}
      />
    </div>
  )

  if (compact && showSearchField) {
    return (
      <header className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          {searchField}
          <button
            className="ink-accent shrink-0 px-1 font-semibold"
            onClick={() => {
              onSearch('')
              setSearchOpen(false)
            }}
          >
            Abbrechen
          </button>
        </div>
      </header>
    )
  }

  const filterButton = canFilter && (
    <button
      className={`btn-icon btn-surface relative shrink-0 ${filtersOpen ? 'ring-2 ring-blue-500/40' : ''}`}
      aria-label="Filter"
      aria-pressed={filtersOpen}
      title="Filter"
      onClick={onToggleFilters}
    >
      <Icon name="filter" />
      {filterActive && <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-(--accent) ring-2 ring-(--surface)" />}
    </button>
  )

  return (
    <header className="px-4 pt-3 pb-3 md:px-6 md:pt-6">
      <div className="flex items-end gap-2">
        {/* key: neuer Titel → kurz einblenden */}
        <div key={title} className="title-in min-w-0 flex-1">
          <div className="eyebrow truncate">{eyebrow}</div>
          <h1 className={`display dot mt-1 truncate ${isCalendar ? 'text-[32px] md:text-[40px]' : 'text-[38px] md:text-[48px]'}`}>
            {title}
          </h1>
        </div>
        {compact ? (
          <button className="btn-icon btn-surface shrink-0" aria-label="Suchen" title="Suchen" onClick={() => setSearchOpen(true)}>
            <Icon name="search" />
          </button>
        ) : (
          searchField
        )}
        {filterButton}
      </div>

      {isCalendar && !search && (
        <div className="mt-3 flex flex-wrap items-center gap-2 md:mt-4">
          <nav className={`segment ${compact ? 'grid flex-1 grid-cols-5' : ''}`} aria-label="Ansicht">
            {CAL_BUTTONS.map((b) => (
              <button key={b.view} className={compact ? 'px-0.5! text-[13px]!' : undefined} aria-pressed={route.view === b.view} onClick={() => navigate({ view: b.view })}>
                {compact ? (b.short ?? b.label) : b.label}
              </button>
            ))}
          </nav>
          {showsDates && (
            <div className="ml-auto flex items-center gap-1">
              {!compact && (
                <button className="btn-icon btn-surface" aria-label="Zurück" onClick={() => onStep(-1)}>
                  <Icon name="left" />
                </button>
              )}
              <button className="btn-surface ink-accent" onClick={onToday}>
                Heute
              </button>
              {!compact && (
                <button className="btn-icon btn-surface" aria-label="Weiter" onClick={() => onStep(1)}>
                  <Icon name="right" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  )
}

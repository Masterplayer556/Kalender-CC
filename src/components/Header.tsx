import { useState } from 'react'
import { formatDate, formatLongDate, formatMonthYear, formatWeekRange, formatWeekday, isoWeek } from '../lib/dates'
import type { Route, ViewName } from '../lib/router'
import { Icon } from './Icon'
import { useMediaQuery } from './useMediaQuery'

const VIEW_BUTTONS: { view: ViewName; label: string }[] = [
  { view: 'monat', label: 'Monat' },
  { view: 'woche', label: 'Woche' },
  { view: 'tag', label: 'Tag' },
  { view: 'liste', label: 'Liste' },
  { view: 'noten', label: 'Noten' },
]

/** Titel über dem Kalender, abhängig von der Ansicht. compact = iPhone: kurz, damit nichts abgeschnitten wird. */
function periodLabel(route: Route, compact: boolean): string {
  if (compact && route.view === 'woche') return `KW ${isoWeek(route.date)}`
  if (compact && route.view === 'tag') return `${formatWeekday(route.date)}, ${formatDate(route.date)}`
  switch (route.view) {
    case 'monat': return formatMonthYear(route.date)
    case 'woche': return `KW ${isoWeek(route.date)} · ${formatWeekRange(route.date)}`
    case 'tag': return formatLongDate(route.date)
    case 'liste': return 'Als Nächstes'
    case 'noten': return 'Noten'
    case 'faecher': return 'Fächer, Ferien & Konto'
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
  const isCalendar = route.view === 'monat' || route.view === 'woche' || route.view === 'tag'
  // iPhone (schmal): Pfeile weg (dort wird gewischt), Suche hinter einer Lupe, Titel bekommt den Platz
  const compact = useMediaQuery('(max-width: 639px)')
  const [searchOpen, setSearchOpen] = useState(false)
  const showSearchField = !compact || searchOpen || search !== ''
  const title = search ? 'Suche' : periodLabel(route, compact)
  // Unter dem Titel auf dem iPhone: Datumsbereich der Woche
  const subtitle = compact && !search && route.view === 'woche' ? formatWeekRange(route.date) : null

  const searchField = (
    <div className={`relative ${compact ? 'flex-1' : ''}`}>
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">
        <Icon name="search" className="h-4 w-4" />
      </span>
      <input
        type="search"
        className={`input pl-9 ${compact ? '' : 'w-40! sm:w-56!'}`}
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
      <header className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {searchField}
          <button
            className="shrink-0 px-1 font-medium text-blue-600 dark:text-blue-400"
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

  return (
    <header className="space-y-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
      <div className="flex items-center gap-1 sm:gap-2">
        {isCalendar && !search && !compact && (
          <div className="flex items-center gap-1">
            <button className="btn-icon" aria-label="Zurück" onClick={() => onStep(-1)}>
              <Icon name="left" />
            </button>
            <button className="btn-secondary" onClick={onToday}>
              Heute
            </button>
            <button className="btn-icon" aria-label="Weiter" onClick={() => onStep(1)}>
              <Icon name="right" />
            </button>
          </div>
        )}
        {/* key: neuer Titel → kurz einblenden */}
        <div key={title} className="title-in min-w-0 flex-1">
          <h1 className="truncate text-lg leading-tight font-semibold sm:text-xl">{title}</h1>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>

        {compact ? (
          <>
            {isCalendar && (
              <button className="btn-secondary min-h-9 shrink-0 px-3 text-sm" onClick={onToday}>
                Heute
              </button>
            )}
            <button className="btn-icon shrink-0" aria-label="Suchen" title="Suchen" onClick={() => setSearchOpen(true)}>
              <Icon name="search" />
            </button>
          </>
        ) : (
          searchField
        )}
        <button
          className={`btn-icon relative shrink-0 ${filtersOpen ? 'bg-slate-200 dark:bg-slate-700' : ''}`}
          aria-label="Filter"
          aria-pressed={filtersOpen}
          title="Filter"
          onClick={onToggleFilters}
        >
          <Icon name="filter" />
          {filterActive && <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-blue-600" />}
        </button>
        <button
          className="btn-icon shrink-0"
          aria-label="Fächer, Ferien & Konto"
          title="Fächer, Ferien & Konto"
          onClick={() => navigate({ view: 'faecher' })}
        >
          <Icon name="tag" />
        </button>
      </div>

      <nav className={`segment ${compact ? 'flex w-full' : ''}`} aria-label="Ansicht">
        {VIEW_BUTTONS.map((b) => (
          <button
            key={b.view}
            className={compact ? 'flex-1 px-1!' : undefined}
            aria-pressed={!search && route.view === b.view}
            onClick={() => {
              onSearch('')
              navigate({ view: b.view })
            }}
          >
            {b.label}
          </button>
        ))}
      </nav>
    </header>
  )
}

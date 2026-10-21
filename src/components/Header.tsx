import { addDays, addMonths, formatLongDate, formatMonthYear, formatWeekRange, todayKey } from '../lib/dates'
import type { Route, ViewName } from '../lib/router'
import { Icon } from './Icon'

const VIEW_BUTTONS: { view: ViewName; label: string }[] = [
  { view: 'monat', label: 'Monat' },
  { view: 'woche', label: 'Woche' },
  { view: 'tag', label: 'Tag' },
  { view: 'liste', label: 'Liste' },
  { view: 'noten', label: 'Noten' },
]

/** Titel über dem Kalender, abhängig von der Ansicht */
function periodLabel(route: Route): string {
  switch (route.view) {
    case 'monat': return formatMonthYear(route.date)
    case 'woche': return formatWeekRange(route.date)
    case 'tag': return formatLongDate(route.date)
    case 'liste': return 'Als Nächstes'
    case 'noten': return 'Noten'
    case 'faecher': return 'Fächer & Konto'
  }
}

/** Einen Schritt vor/zurück: ein Monat, eine Woche oder ein Tag */
function step(route: Route, direction: 1 | -1): string {
  if (route.view === 'monat') return addMonths(route.date, direction)
  if (route.view === 'woche') return addDays(route.date, 7 * direction)
  return addDays(route.date, direction)
}

export function Header({
  route,
  navigate,
  search,
  onSearch,
  filtersOpen,
  filterActive,
  onToggleFilters,
}: {
  route: Route
  navigate: (next: Partial<Route>) => void
  search: string
  onSearch: (q: string) => void
  filtersOpen: boolean
  filterActive: boolean
  onToggleFilters: () => void
}) {
  const isCalendar = route.view === 'monat' || route.view === 'woche' || route.view === 'tag'

  return (
    <header className="space-y-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        {isCalendar && !search && (
          <div className="flex items-center gap-1">
            <button className="btn-icon" aria-label="Zurück" onClick={() => navigate({ date: step(route, -1) })}>
              <Icon name="left" />
            </button>
            <button className="btn-secondary" onClick={() => navigate({ date: todayKey() })}>
              Heute
            </button>
            <button className="btn-icon" aria-label="Weiter" onClick={() => navigate({ date: step(route, 1) })}>
              <Icon name="right" />
            </button>
          </div>
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold sm:text-xl">
          {search ? 'Suche' : periodLabel(route)}
        </h1>

        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">
            <Icon name="search" className="h-4 w-4" />
          </span>
          <input
            type="search"
            className="input w-40! pl-9 sm:w-56!"
            placeholder="Suchen …"
            value={search}
            aria-label="Einträge durchsuchen"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <button
          className={`btn-icon relative ${filtersOpen ? 'bg-slate-200 dark:bg-slate-700' : ''}`}
          aria-label="Filter"
          aria-pressed={filtersOpen}
          title="Filter"
          onClick={onToggleFilters}
        >
          <Icon name="filter" />
          {filterActive && <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-blue-600" />}
        </button>
        <button
          className="btn-icon"
          aria-label="Fächer & Konto"
          title="Fächer & Konto"
          onClick={() => navigate({ view: 'faecher' })}
        >
          <Icon name="tag" />
        </button>
      </div>

      <nav className="segment" aria-label="Ansicht">
        {VIEW_BUTTONS.map((b) => (
          <button
            key={b.view}
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

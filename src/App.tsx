// Oberste Ebene der App:
//   App → (Einrichtung fehlt?) → AuthProvider → (angemeldet?) → DataProvider → ToastProvider → Shell (Ansichten)

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AuthProvider, useAuth } from './data/AuthProvider'
import { DataProvider, useData } from './data/DataProvider'
import { supabaseConfigured } from './lib/supabase'
import { stepDate, useRoute, type Route } from './lib/router'
import { todayKey, weekDays } from './lib/dates'
import { loadPref, savePref } from './lib/cache'
import { EMPTY_FILTERS, isFilterActive, matchesFilters, type Filters } from './lib/filters'
import { Header } from './components/Header'
import { FilterBar } from './components/FilterBar'
import { StatusBanner } from './components/StatusBanner'
import { EntryEditor, type EditorRequest } from './components/EntryEditor'
import { Icon } from './components/Icon'
import { StudyBlockMenu } from './components/StudyBlockMenu'
import { GradeEditor, type GradeRequest } from './components/GradeEditor'
import { PeriodEditor, type PeriodRequest } from './components/PeriodEditor'
import { GradesView } from './views/GradesView'
import { ToastProvider } from './components/Toast'
import { TodayPanel } from './components/TodayPanel'
import { useMediaQuery } from './components/useMediaQuery'
import { useSwipe } from './components/useSwipe'
import { MonthView } from './views/MonthView'
import { TimeGrid } from './views/TimeGrid'
import { UpcomingView } from './views/UpcomingView'
import { SearchView } from './views/SearchView'
import { SubjectsView } from './views/SubjectsView'
import { LoginView } from './views/LoginView'
import { SetupMissingView } from './views/SetupMissingView'

export default function App() {
  if (!supabaseConfigured) return <SetupMissingView />
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}

function AuthGate() {
  const { session, loading } = useAuth()
  if (loading) return <div className="app-root items-center justify-center text-slate-500">Lädt …</div>
  if (!session) return <LoginView />
  return (
    // key: Bei Benutzerwechsel alles frisch aufbauen
    <DataProvider key={session.user.id} userId={session.user.id}>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </DataProvider>
  )
}

function Shell() {
  const { entries, blocks, loading, online } = useData()
  const [route, navigate] = useRoute()
  const [search, setSearch] = useState('')
  const [filters, setFiltersState] = useState<Filters>(() => loadPref('filters', EMPTY_FILTERS))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [editor, setEditor] = useState<EditorRequest | null>(null)
  const [blockMenu, setBlockMenu] = useState<string | null>(null) // id des angetippten Lernblocks
  const [gradeEditor, setGradeEditor] = useState<GradeRequest | null>(null)
  const [periodEditor, setPeriodEditor] = useState<PeriodRequest | null>(null)
  const onGradesTab = route.view === 'noten' && !search.trim()
  const isCalendar = !search.trim() && (route.view === 'monat' || route.view === 'woche' || route.view === 'tag')
  // iPad im Querformat / Computer: "Heute" als Seitenleiste neben dem Kalender
  const wide = useMediaQuery('(min-width: 1100px)')
  // iPhone (Hochformat): kompakte Monats- und Wochenansicht
  const compact = useMediaQuery('(max-width: 639px)')

  // Animation beim Wechsel: vorwärts gleitet von rechts herein, rückwärts von links, sonst Einblenden.
  // Beim Vor/Zurück bleibt die alte Ansicht kurz stehen (`leaving`) und gleitet zur anderen Seite hinaus.
  const [animation, setAnimation] = useState<'view-next' | 'view-prev' | 'view-fade'>('view-fade')
  const [leaving, setLeaving] = useState<{ key: string; route: Route; dir: 1 | -1; offset: number } | null>(null)
  const viewKey = `${search ? 'suche' : route.view}-${route.date}`

  const changeView = (next: Partial<Route>) => {
    setAnimation('view-fade')
    setLeaving(null)
    navigate(next)
  }
  /** offset: wie weit die Ansicht beim Wischen schon verschoben war (0 bei den Pfeilen) */
  const slideTo = (date: string, direction: 1 | -1, offset = 0) => {
    setAnimation(direction === 1 ? 'view-next' : 'view-prev')
    setLeaving({ key: viewKey, route, dir: direction, offset })
    navigate({ date })
  }
  const goStep = (direction: 1 | -1, offset = 0) => slideTo(stepDate(route, direction), direction, offset)
  const goToday = () => {
    const today = todayKey()
    if (today === route.date) return
    slideTo(today, today > route.date ? 1 : -1)
  }

  // Sicherheitsnetz: falls animationend nie kommt (z. B. "Bewegung reduzieren"), die alte Ansicht trotzdem entfernen
  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => setLeaving(null), 600)
    return () => clearTimeout(timer)
  }, [leaving])

  // Wischen im Kalender = vor/zurück
  const mainRef = useRef<HTMLElement>(null)
  useSwipe(mainRef, goStep, isCalendar)

  const setFilters = (f: Filters) => {
    setFiltersState(f)
    savePref('filters', f)
  }

  // Filter einmal hier anwenden; alle Ansichten bekommen die gefilterten Listen.
  const { visibleEntries, visibleBlocks } = useMemo(() => {
    const visibleEntries = entries.filter((e) => matchesFilters(e, filters))
    const ids = new Set(visibleEntries.map((e) => e.id))
    return { visibleEntries, visibleBlocks: blocks.filter((b) => ids.has(b.entry_id)) }
  }, [entries, blocks, filters])

  const openEntry = (entryId: string) => setEditor({ entryId })
  const openDay = (date: string) => changeView({ view: 'tag', date })
  const createAt = (date: string, time?: string) => online && setEditor({ date, time })

  function renderView(route: Route) {
    if (search.trim()) return <SearchView query={search} entries={visibleEntries} onOpenEntry={openEntry} />
    switch (route.view) {
      case 'monat':
        return (
          <MonthView
            date={route.date}
            entries={visibleEntries}
            blocks={visibleBlocks}
            onOpenDay={openDay}
            onOpenEntry={openEntry}
            onOpenBlock={setBlockMenu}
            onOpenPeriod={(periodId) => setPeriodEditor({ periodId })}
            compact={compact}
          />
        )
      case 'woche':
      case 'tag':
        return (
          <TimeGrid
            days={route.view === 'woche' ? weekDays(route.date) : [route.date]}
            entries={visibleEntries}
            blocks={visibleBlocks}
            onOpenEntry={openEntry}
            onOpenBlock={setBlockMenu}
            onCreateAt={createAt}
            onOpenDay={route.view === 'woche' ? openDay : undefined}
            onOpenPeriod={(periodId) => setPeriodEditor({ periodId })}
            compact={compact}
          />
        )
      case 'liste':
        return (
          <UpcomingView
            entries={visibleEntries}
            onOpenEntry={openEntry}
            onOpenGrade={setGradeEditor}
            onOpenBlock={setBlockMenu}
            onOpenPeriod={setPeriodEditor}
            showToday
          />
        )
      case 'noten':
        return <GradesView onOpenGrade={setGradeEditor} onGoSubjects={() => changeView({ view: 'faecher' })} />
      case 'faecher':
        return <SubjectsView onOpenPeriod={setPeriodEditor} />
    }
  }

  return (
    <div className="app-root">
      <Header
        route={route}
        navigate={changeView}
        onStep={goStep}
        onToday={goToday}
        search={search}
        onSearch={setSearch}
        filtersOpen={filtersOpen}
        filterActive={isFilterActive(filters)}
        onToggleFilters={() => setFiltersOpen(!filtersOpen)}
      />
      {filtersOpen && <FilterBar filters={filters} onChange={setFilters} />}
      <StatusBanner />

      <div className="flex min-h-0 flex-1">
        <main ref={mainRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          {loading ? (
            <p className="p-6 text-center text-slate-500">Lädt Einträge …</p>
          ) : (
            // Als Liste mit key: React behält die alte Ansicht (samt Scroll-Position) als `leaving`,
            // die neue wird frisch aufgebaut → beide Animationen laufen gleichzeitig.
            [
              leaving && leaving.key !== viewKey && (
                <div
                  key={leaving.key}
                  aria-hidden
                  className={`view-layer pointer-events-none ${leaving.dir === 1 ? 'view-leave-next' : 'view-leave-prev'}`}
                  style={{ '--from-x': `${leaving.offset}px` } as CSSProperties}
                  onAnimationEnd={(e) => e.target === e.currentTarget && setLeaving(null)}
                >
                  {renderView(leaving.route)}
                </div>
              ),
              <div key={viewKey} data-view-current className={`view-layer ${animation}`}>
                {renderView(route)}
              </div>,
            ]
          )}
        </main>
        {wide && isCalendar && !loading && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 p-3 pb-28 dark:border-slate-800">
            <TodayPanel onOpenEntry={openEntry} onOpenBlock={setBlockMenu} onOpenPeriod={setPeriodEditor} />
          </aside>
        )}
      </div>

      {/* Schnelles Hinzufügen */}
      <button
        className="btn-primary fixed right-5 z-30 h-14 w-14 rounded-full p-0 shadow-lg"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
        aria-label={onGradesTab ? 'Neue Note' : 'Neuer Eintrag'}
        title={online ? (onGradesTab ? 'Neue Note' : 'Neuer Eintrag') : 'Offline – Änderungen nicht möglich'}
        disabled={!online}
        onClick={() =>
          onGradesTab ? setGradeEditor({}) : createAt(route.view === 'tag' ? route.date : todayKey())
        }
      >
        <Icon name="plus" className="h-7 w-7" />
      </button>

      {/* key: bei jedem Öffnen ein frisches Formular */}
      {editor && (
        <EntryEditor
          key={JSON.stringify(editor)}
          request={editor}
          onClose={() => setEditor(null)}
          onOpenGrade={setGradeEditor}
        />
      )}
      {gradeEditor && (
        <GradeEditor key={JSON.stringify(gradeEditor)} request={gradeEditor} onClose={() => setGradeEditor(null)} />
      )}
      {periodEditor && (
        <PeriodEditor key={JSON.stringify(periodEditor)} request={periodEditor} onClose={() => setPeriodEditor(null)} />
      )}
      {blockMenu && (
        <StudyBlockMenu
          blockId={blockMenu}
          onClose={() => setBlockMenu(null)}
          onOpenEntry={(id) => {
            setBlockMenu(null)
            openEntry(id)
          }}
        />
      )}
    </div>
  )
}

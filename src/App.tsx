// Oberste Ebene der App:
//   App → (Einrichtung fehlt?) → AuthProvider → (angemeldet?) → DataProvider → ToastProvider → Shell (Ansichten)

import { useMemo, useState } from 'react'
import { AuthProvider, useAuth } from './data/AuthProvider'
import { DataProvider, useData } from './data/DataProvider'
import { supabaseConfigured } from './lib/supabase'
import { useRoute } from './lib/router'
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
import { GradesView } from './views/GradesView'
import { ToastProvider } from './components/Toast'
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
  const onGradesTab = route.view === 'noten' && !search.trim()

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
  const openDay = (date: string) => navigate({ view: 'tag', date })
  const createAt = (date: string, time?: string) => online && setEditor({ date, time })

  function renderView() {
    if (search.trim()) return <SearchView query={search} entries={visibleEntries} onOpenEntry={openEntry} />
    switch (route.view) {
      case 'monat':
        return <MonthView date={route.date} entries={visibleEntries} blocks={visibleBlocks} onOpenDay={openDay} />
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
          />
        )
      case 'liste':
        return <UpcomingView entries={visibleEntries} onOpenEntry={openEntry} />
      case 'noten':
        return <GradesView onOpenGrade={setGradeEditor} onGoSubjects={() => navigate({ view: 'faecher' })} />
      case 'faecher':
        return <SubjectsView />
    }
  }

  return (
    <div className="app-root">
      <Header
        route={route}
        navigate={navigate}
        search={search}
        onSearch={setSearch}
        filtersOpen={filtersOpen}
        filterActive={isFilterActive(filters)}
        onToggleFilters={() => setFiltersOpen(!filtersOpen)}
      />
      {filtersOpen && <FilterBar filters={filters} onChange={setFilters} />}
      <StatusBanner />

      <main className="relative min-h-0 flex-1">
        {loading ? <p className="p-6 text-center text-slate-500">Lädt Einträge …</p> : renderView()}
      </main>

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
      {editor && <EntryEditor key={JSON.stringify(editor)} request={editor} onClose={() => setEditor(null)} />}
      {gradeEditor && (
        <GradeEditor key={JSON.stringify(gradeEditor)} request={gradeEditor} onClose={() => setGradeEditor(null)} />
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

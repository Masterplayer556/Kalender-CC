// Suchergebnisse: alle Einträge (auch alte), deren Titel oder Notizen passen. Neueste zuerst.

import { EntryRow } from '../components/EntryRow'
import { compareEntries } from '../lib/grouping'
import { matchesSearch } from '../lib/filters'
import type { Entry } from '../types'

export function SearchView({
  query,
  entries,
  onOpenEntry,
}: {
  query: string
  entries: Entry[]
  onOpenEntry: (id: string) => void
}) {
  const results = entries.filter((e) => matchesSearch(e, query)).sort((a, b) => compareEntries(b, a))

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl p-3 pb-28">
        <p className="mb-3 text-sm text-slate-500">
          {results.length === 0 ? 'Keine Treffer.' : `${results.length} Treffer für „${query.trim()}“`}
        </p>
        <ul className="space-y-2">
          {results.map((e) => (
            <EntryRow key={e.id} entry={e} onOpen={() => onOpenEntry(e.id)} />
          ))}
        </ul>
      </div>
    </div>
  )
}

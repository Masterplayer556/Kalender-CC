// Liste "Als Nächstes": kommende Einträge, gruppiert nach Heute / Morgen / Diese Woche / Später.

import { useState } from 'react'
import { EntryRow } from '../components/EntryRow'
import { loadPref, savePref } from '../lib/cache'
import { todayKey } from '../lib/dates'
import { groupUpcoming } from '../lib/grouping'
import { useData } from '../data/DataProvider'
import { overdueEntries, testsAwaitingGrade } from '../lib/overdue'
import type { GradeRequest } from '../components/GradeEditor'
import { TodayPanel } from '../components/TodayPanel'
import type { PeriodRequest } from '../components/PeriodEditor'
import type { Entry } from '../types'

export function UpcomingView({
  entries,
  onOpenEntry,
  onOpenGrade,
  onOpenBlock,
  onOpenPeriod,
  showToday,
}: {
  entries: Entry[]
  onOpenEntry: (id: string) => void
  onOpenGrade: (req: GradeRequest) => void
  onOpenBlock: (blockId: string) => void
  onOpenPeriod: (req: PeriodRequest) => void
  showToday: boolean // auf breiten Bildschirmen steht "Heute" schon in der Seitenleiste
}) {
  const { gradeByEntry, gradesMissing } = useData()
  const [showDone, setShowDone] = useState(() => loadPref('showDone', false))
  const today = todayKey()
  const groups = groupUpcoming(entries, today, showDone)
  const overdue = overdueEntries(entries, today)
  const awaitingGrade = gradesMissing ? [] : testsAwaitingGrade(entries, new Set(gradeByEntry.keys()), today)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-3 pb-28">
        {showToday && <TodayPanel onOpenEntry={onOpenEntry} onOpenBlock={onOpenBlock} onOpenPeriod={onOpenPeriod} />}

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={showDone}
            onChange={(e) => {
              setShowDone(e.target.checked)
              savePref('showDone', e.target.checked)
            }}
          />
          Erledigte anzeigen
        </label>

        {awaitingGrade.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
              🎓 Note eintragen?
            </h2>
            <ul className="space-y-2">
              {awaitingGrade.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  onOpen={() => onOpenEntry(e.id)}
                  onEnterGrade={() => onOpenGrade({ entryId: e.id })}
                />
              ))}
            </ul>
          </section>
        )}

        {overdue.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-red-600 uppercase dark:text-red-400">
              ⚠️ Überfällig
            </h2>
            <ul className="space-y-2">
              {overdue.map((e) => (
                <EntryRow key={e.id} entry={e} onOpen={() => onOpenEntry(e.id)} />
              ))}
            </ul>
          </section>
        )}

        {groups.length === 0 && overdue.length === 0 && awaitingGrade.length === 0 && (
          <p className="py-12 text-center text-slate-500">Nichts geplant. Tippe auf „+“, um einen Eintrag anzulegen.</p>
        )}

        {groups.map(({ group, entries: list }) => (
          <section key={group}>
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">{group}</h2>
            <ul className="space-y-2">
              {list.map((e) => (
                <EntryRow key={e.id} entry={e} onOpen={() => onOpenEntry(e.id)} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

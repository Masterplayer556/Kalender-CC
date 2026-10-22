// "Heute"-Übersicht: was heute ansteht, die heutigen Lernzeiten und der nächste Test.
// Erscheint oben in der Liste und – im iPad-Querformat – als Seitenleiste neben dem Kalender.

import { useData } from '../data/DataProvider'
import { CATEGORIES, NO_SUBJECT_COLOR } from '../lib/categories'
import { countdown, formatDate, formatTime, formatWeekday, isoToLocal, todayKey } from '../lib/dates'
import { compareEntries } from '../lib/grouping'

export function TodayPanel({
  onOpenEntry,
  onOpenBlock,
}: {
  onOpenEntry: (id: string) => void
  onOpenBlock: (blockId: string) => void
}) {
  const { entries, blocks, entryById, subjectById, blocksByEntry } = useData()
  const today = todayKey()
  const now = new Date().toISOString()
  const colorOf = (subjectId: string | null) => (subjectId && subjectById.get(subjectId)?.color) || NO_SUBJECT_COLOR

  const todayEntries = entries.filter((e) => e.date === today).sort(compareEntries)
  const todayBlocks = blocks
    .filter((b) => isoToLocal(b.starts_at).date === today && entryById.has(b.entry_id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  // Nächster offener Test ab morgen (heutige stehen schon oben)
  const nextTest = entries
    .filter((e) => e.category === 'test' && e.date > today && !e.done)
    .sort(compareEntries)[0]
  const nextTestBlocks = nextTest ? (blocksByEntry.get(nextTest.id) ?? []) : []
  // Nächste Lernzeit nach heute, falls heute keine mehr kommt
  const nextBlock = todayBlocks.some((b) => b.ends_at > now)
    ? undefined
    : blocks
        .filter((b) => isoToLocal(b.starts_at).date > today && entryById.has(b.entry_id) && !b.done)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]

  const nothingToday = todayEntries.length === 0 && todayBlocks.length === 0

  return (
    <section className="space-y-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
      <h2 className="font-semibold">
        Heute <span className="font-normal text-slate-500">· {formatWeekday(today, 'long')}, {formatDate(today)}</span>
      </h2>

      {nothingToday && <p className="text-sm text-slate-500">Heute steht nichts an. 🎉</p>}

      {todayEntries.length > 0 && (
        <ul className="space-y-1">
          {todayEntries.map((e) => (
            <li key={e.id}>
              <button
                className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-white px-2 text-left shadow-sm dark:bg-slate-800"
                style={{ borderLeft: `4px solid ${colorOf(e.subject_id)}` }}
                onClick={() => onOpenEntry(e.id)}
              >
                <span>{CATEGORIES[e.category].icon}</span>
                <span className={`min-w-0 flex-1 truncate font-medium ${e.done ? 'text-slate-400 line-through' : ''}`}>
                  {e.title}
                </span>
                {e.start_time && <span className="text-sm text-slate-500 tabular-nums">{formatTime(e.start_time)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {todayBlocks.length > 0 && (
        <ul className="space-y-1">
          {todayBlocks.map((b) => {
            const entry = entryById.get(b.entry_id)!
            const past = b.ends_at < now
            return (
              <li key={b.id}>
                <button
                  className={`study-stripes flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed px-2 text-left ${
                    b.done ? 'opacity-50' : ''
                  }`}
                  style={{ ['--c' as string]: colorOf(entry.subject_id), borderColor: colorOf(entry.subject_id) }}
                  onClick={() => onOpenBlock(b.id)}
                >
                  <span>{b.done ? '✅' : past ? '⏰' : '📖'}</span>
                  <span className={`min-w-0 flex-1 truncate ${b.done ? 'line-through' : ''}`}>Lernen: {entry.title}</span>
                  <span className="text-sm tabular-nums">
                    {isoToLocal(b.starts_at).time}–{isoToLocal(b.ends_at).time}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {(nextTest || nextBlock) && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {nextTest && (
            <button
              className="rounded-xl bg-white p-2 text-left shadow-sm dark:bg-slate-800"
              style={{ borderLeft: `4px solid ${colorOf(nextTest.subject_id)}` }}
              onClick={() => onOpenEntry(nextTest.id)}
            >
              <div className="text-xs text-slate-500">Nächster Test · {countdown(today, nextTest.date)}</div>
              <div className="truncate font-medium">📝 {nextTest.title}</div>
              {nextTestBlocks.length > 0 && (
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  {/* Fortschrittsbalken: erledigte Lernzeiten */}
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-green-500 transition-[width] duration-500"
                      style={{ width: `${(nextTestBlocks.filter((b) => b.done).length / nextTestBlocks.length) * 100}%` }}
                    />
                  </div>
                  {nextTestBlocks.filter((b) => b.done).length}/{nextTestBlocks.length} gelernt
                </div>
              )}
            </button>
          )}
          {nextBlock && (
            <button
              className="rounded-xl bg-white p-2 text-left shadow-sm dark:bg-slate-800"
              onClick={() => onOpenBlock(nextBlock.id)}
            >
              <div className="text-xs text-slate-500">Nächste Lernzeit · {countdown(today, isoToLocal(nextBlock.starts_at).date)}</div>
              <div className="truncate font-medium">📖 {entryById.get(nextBlock.entry_id)!.title}</div>
              <div className="text-xs text-slate-500 tabular-nums">
                {formatWeekday(isoToLocal(nextBlock.starts_at).date)}, {isoToLocal(nextBlock.starts_at).time}–
                {isoToLocal(nextBlock.ends_at).time}
              </div>
            </button>
          )}
        </div>
      )}
    </section>
  )
}

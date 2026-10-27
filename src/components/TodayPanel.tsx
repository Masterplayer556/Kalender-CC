// "Heute"-Übersicht: was heute ansteht, die heutigen Lernzeiten, der nächste Test und der Ferien-Countdown.
// Erscheint oben in der Liste und – im iPad-Querformat – als Seitenleiste neben dem Kalender.

import { useData } from '../data/DataProvider'
import { CATEGORIES, entryColor } from '../lib/categories'
import { countdown, formatDate, formatTime, formatWeekday, isoToLocal, todayKey } from '../lib/dates'
import { compareEntries, entryCovers } from '../lib/grouping'
import { PERIOD_KINDS, holidayStatus } from '../lib/periods'
import type { PeriodRequest } from './PeriodEditor'
import type { Entry } from '../types'

export function TodayPanel({
  onOpenEntry,
  onOpenBlock,
  onOpenPeriod,
}: {
  onOpenEntry: (id: string) => void
  onOpenBlock: (blockId: string) => void
  onOpenPeriod: (req: PeriodRequest) => void
}) {
  const { entries, blocks, entryById, subjectById, blocksByEntry, periods, periodsMissing } = useData()
  const today = todayKey()
  const now = new Date().toISOString()
  const colorOf = (e: Entry) => entryColor(e, subjectById)

  const todayEntries = entries.filter((e) => entryCovers(e, today)).sort(compareEntries)
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
  const holiday = holidayStatus(periods, today)

  return (
    <section className="space-y-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
      <h2 className="font-semibold">
        Heute <span className="font-normal text-slate-500">· {formatWeekday(today, 'long')}, {formatDate(today)}</span>
      </h2>

      {nothingToday && <p className="text-sm text-slate-500">Heute steht nichts an. 🎉</p>}

      {holiday && (
        <button
          className="flex w-full items-center gap-2 rounded-xl p-2 text-left"
          style={{
            background: `color-mix(in srgb, ${PERIOD_KINDS.ferien.color} 16%, transparent)`,
            borderLeft: `4px solid ${PERIOD_KINDS.ferien.color}`,
          }}
          onClick={() => onOpenPeriod({ periodId: holiday.period.id })}
        >
          <span className="text-2xl">{PERIOD_KINDS.ferien.icon}</span>
          <span className="min-w-0 flex-1">
            {holiday.state === 'during' ? (
              <>
                <span className="block truncate font-medium">{holiday.period.name} – geniessen!</span>
                <span className="block text-xs text-slate-600 dark:text-slate-300">
                  {holiday.daysLeft === 1 ? 'Letzter Tag' : `noch ${holiday.daysLeft} Tage`} · bis{' '}
                  {formatWeekday(holiday.period.end_date)}, {formatDate(holiday.period.end_date)}
                </span>
              </>
            ) : (
              <>
                <span className="block truncate font-medium">{holiday.period.name}</span>
                <span className="block text-xs text-slate-600 dark:text-slate-300">
                  {countdown(today, holiday.period.start_date)} · noch {holiday.schoolDays}{' '}
                  {holiday.schoolDays === 1 ? 'Schultag' : 'Schultage'}
                </span>
              </>
            )}
          </span>
        </button>
      )}
      {/* Noch keine Ferien eingetragen → dezenter Hinweis, wo das geht */}
      {!holiday && !periodsMissing && (
        <button className="text-sm text-blue-700 dark:text-blue-300" onClick={() => onOpenPeriod({})}>
          🏖️ Ferien eintragen, um den Countdown zu sehen →
        </button>
      )}

      {todayEntries.length > 0 && (
        <ul className="space-y-1">
          {todayEntries.map((e) => (
            <li key={e.id}>
              <button
                className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-white px-2 text-left shadow-sm dark:bg-slate-800"
                style={{ borderLeft: `4px solid ${colorOf(e)}` }}
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
                  style={{ ['--c' as string]: colorOf(entry), borderColor: colorOf(entry) }}
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
              style={{ borderLeft: `4px solid ${colorOf(nextTest)}` }}
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

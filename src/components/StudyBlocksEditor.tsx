// Bereich "Lernzeiten" im Eintrag-Formular: beliebig viele Zeiträume hinzufügen/entfernen.

import { addDays, formatDate, formatWeekday, timeToMinutes, todayKey, type DateKey } from '../lib/dates'
import type { StudyBlockInput } from '../types'
import { Icon } from './Icon'
import { TimeInput } from './TimeInput'

/** Vorschlag für eine neue Lernzeit: am Tag nach der letzten, sonst am Vortag des Termins. */
export function suggestBlock(entryDate: DateKey, blocks: StudyBlockInput[]): StudyBlockInput {
  const last = blocks.at(-1)
  if (last) return { date: addDays(last.date, 1), start: last.start, end: last.end, done: false }
  const today = todayKey()
  const dayBefore = addDays(entryDate, -1)
  return { date: dayBefore < today ? today : dayBefore, start: '17:00', end: '18:00', done: false }
}

export function StudyBlocksEditor({
  blocks,
  onChange,
  entryDate,
  disabled,
}: {
  blocks: StudyBlockInput[]
  onChange: (blocks: StudyBlockInput[]) => void
  entryDate: DateKey
  disabled: boolean
}) {
  const update = (i: number, patch: Partial<StudyBlockInput>) =>
    onChange(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)))

  return (
    <section className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
      <h3 className="mb-2 font-semibold">📖 Lernzeiten</h3>

      {blocks.length === 0 && (
        <p className="mb-2 text-sm text-slate-500">Noch keine Lernzeiten geplant.</p>
      )}

      <ul className="space-y-3">
        {blocks.map((b, i) => {
          const invalid = timeToMinutes(b.end) <= timeToMinutes(b.start)
          const afterEntry = b.date > entryDate
          return (
            <li key={b.id ?? `neu-${i}`} className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  className="input w-auto! flex-1"
                  value={b.date}
                  disabled={disabled}
                  aria-label="Tag der Lernzeit"
                  onChange={(e) => e.target.value && update(i, { date: e.target.value })}
                />
                <TimeInput label="Von" value={b.start} disabled={disabled} onChange={(start) => update(i, { start })} />
                <span>–</span>
                <TimeInput label="Bis" value={b.end} disabled={disabled} onChange={(end) => update(i, { end })} />
                <label className="flex min-h-11 items-center gap-2 px-1 text-sm">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={b.done}
                    disabled={disabled}
                    onChange={(e) => update(i, { done: e.target.checked })}
                  />
                  erledigt
                </label>
                <button
                  type="button"
                  className="btn-icon text-slate-500"
                  disabled={disabled}
                  aria-label="Lernzeit entfernen"
                  onClick={() => onChange(blocks.filter((_, j) => j !== i))}
                >
                  <Icon name="trash" />
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {formatWeekday(b.date, 'long')}, {formatDate(b.date)}
                {invalid && <span className="ml-2 text-red-600">Ende muss nach dem Start liegen.</span>}
                {!invalid && afterEntry && <span className="ml-2 text-amber-600">Liegt nach dem Termin.</span>}
              </p>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        className="btn-secondary mt-3 w-full"
        disabled={disabled}
        onClick={() => onChange([...blocks, suggestBlock(entryDate, blocks)])}
      >
        <Icon name="plus" /> Lernzeit hinzufügen
      </button>
    </section>
  )
}

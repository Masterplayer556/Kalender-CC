// Eine Zeile in der Liste "Als Nächstes" und in den Suchergebnissen.

import { useData } from '../data/DataProvider'
import { CATEGORIES, entryColor } from '../lib/categories'
import { addDays, countdown, formatDate, formatTime, formatWeekday, todayKey } from '../lib/dates'
import { formatGrade, gradeClass } from '../lib/grades'
import { entryEnd } from '../lib/grouping'
import { canBeOverdue } from '../lib/overdue'
import type { Entry } from '../types'

export function EntryRow({
  entry,
  onOpen,
  onEnterGrade,
}: {
  entry: Entry
  onOpen: () => void
  onEnterGrade?: () => void // zeigt den Knopf "Note eintragen"
}) {
  const { subjectById, blocksByEntry, attachmentsByEntry, gradeByEntry, online, setEntryDone } = useData()
  const grade = gradeByEntry.get(entry.id)
  const attachmentCount = attachmentsByEntry.get(entry.id)?.length ?? 0
  const subject = entry.subject_id ? subjectById.get(entry.subject_id) : undefined
  const color = entryColor(entry, subjectById)
  const blocks = blocksByEntry.get(entry.id) ?? []
  const doneBlocks = blocks.filter((b) => b.done).length
  const today = todayKey()
  const end = entryEnd(entry)
  const when = entry.date < today && end >= today ? (end === today ? 'letzter Tag' : 'läuft') : countdown(today, entry.date)
  // Rot hervorheben: heute, morgen oder überfällig (vorbei, nicht erledigt – wie in overdue.ts)
  const urgent =
    !entry.done && entry.date <= addDays(today, 1) && (entry.date >= today || canBeOverdue(entry))

  return (
    <li
      className="flex items-stretch gap-1 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      style={{ borderLeft: `5px solid ${color}` }}
    >
      <label className="flex min-w-11 items-center justify-center" title="erledigt">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={entry.done}
          disabled={!online}
          aria-label={`${entry.title} erledigt`}
          onChange={(e) => setEntryDone(entry.id, e.target.checked).catch((err) => alert(err.message))}
        />
      </label>
      <button className="min-w-0 flex-1 py-3 pr-3 text-left" onClick={onOpen}>
        <div className="flex items-start gap-2">
          <span className={`min-w-0 flex-1 font-medium ${entry.done ? 'text-slate-400 line-through' : ''}`}>
            {CATEGORIES[entry.category].icon} {entry.title}
          </span>
          {grade && (
            <span className={`shrink-0 rounded-lg px-1.5 py-0.5 text-sm font-bold tabular-nums ${gradeClass(grade.grade)}`} title="Note">
              {formatGrade(grade.grade)}
            </span>
          )}
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              urgent
                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {when}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
          <span>
            {formatWeekday(entry.date)}, {formatDate(entry.date)}
            {end !== entry.date && ` – ${formatWeekday(end)}, ${formatDate(end)}`}
            {entry.start_time && `, ${formatTime(entry.start_time)}`}
            {entry.end_time && `–${formatTime(entry.end_time)}`}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            {subject?.name ?? 'ohne Fach'}
          </span>
          <span>{CATEGORIES[entry.category].label}</span>
          {blocks.length > 0 && (
            <span>
              📖 {doneBlocks}/{blocks.length} Lernzeiten erledigt
            </span>
          )}
          {attachmentCount > 0 && <span>📎 {attachmentCount}</span>}
        </div>
      </button>
      {onEnterGrade && (
        <button className="btn-secondary my-2 mr-2 shrink-0 self-center text-sm" disabled={!online} onClick={onEnterGrade}>
          🎓 Note
        </button>
      )}
    </li>
  )
}

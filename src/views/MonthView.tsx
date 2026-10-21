// Monatsansicht: klassischer Kalender, Woche beginnt am Montag.

import { useMemo } from 'react'
import { useData } from '../data/DataProvider'
import { CATEGORIES, NO_SUBJECT_COLOR } from '../lib/categories'
import { compareEntries } from '../lib/grouping'
import { isoToLocal, monthGrid, todayKey, type DateKey } from '../lib/dates'
import type { Entry, StudyBlock } from '../types'

const MAX_VISIBLE = 3 // so viele Einträge pro Tag, danach "+2 weitere"
const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export function MonthView({
  date,
  entries,
  blocks,
  onOpenDay,
}: {
  date: DateKey
  entries: Entry[]
  blocks: StudyBlock[]
  onOpenDay: (date: DateKey) => void
}) {
  const { subjectById } = useData()
  const today = todayKey()
  const month = date.slice(0, 7)
  const weeks = monthGrid(date)

  // Einträge und Anzahl Lernzeiten pro Tag nachschlagen
  const { entriesByDay, studyByDay } = useMemo(() => {
    const entriesByDay = new Map<DateKey, Entry[]>()
    for (const e of [...entries].sort(compareEntries)) {
      entriesByDay.set(e.date, [...(entriesByDay.get(e.date) ?? []), e])
    }
    const studyByDay = new Map<DateKey, number>()
    for (const b of blocks) {
      const day = isoToLocal(b.starts_at).date
      studyByDay.set(day, (studyByDay.get(day) ?? 0) + 1)
    }
    return { entriesByDay, studyByDay }
  }, [entries, blocks])

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-slate-200 bg-white text-center text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7" style={{ gridAutoRows: 'minmax(6rem, 1fr)' }}>
        {weeks.flat().map((day) => {
          const dayEntries = entriesByDay.get(day) ?? []
          const studyCount = studyByDay.get(day) ?? 0
          const inMonth = day.startsWith(month)
          const isToday = day === today
          return (
            <button
              key={day}
              onClick={() => onOpenDay(day)}
              aria-label={`Tag ${day} öffnen`}
              className={`flex min-w-0 flex-col items-stretch gap-0.5 border-r border-b border-slate-200 p-1 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 ${
                inMonth ? '' : 'bg-slate-50/60 text-slate-400 dark:bg-slate-900/40'
              }`}
            >
              <span
                className={`mb-0.5 flex h-7 w-7 items-center justify-center self-start rounded-full text-sm font-semibold ${
                  isToday ? 'bg-red-600 text-white' : ''
                }`}
              >
                {Number(day.slice(8))}
              </span>
              {dayEntries.slice(0, MAX_VISIBLE).map((e) => {
                const color = (e.subject_id && subjectById.get(e.subject_id)?.color) || NO_SUBJECT_COLOR
                return (
                  <span
                    key={e.id}
                    className={`truncate rounded px-1 py-0.5 text-[11px] leading-tight font-medium sm:text-xs ${
                      e.done ? 'line-through opacity-50' : ''
                    }`}
                    style={{ background: `color-mix(in srgb, ${color} 22%, transparent)`, borderLeft: `3px solid ${color}` }}
                  >
                    {CATEGORIES[e.category].icon} {e.title}
                  </span>
                )
              })}
              {dayEntries.length > MAX_VISIBLE && (
                <span className="px-1 text-[11px] text-slate-500">+{dayEntries.length - MAX_VISIBLE} weitere</span>
              )}
              {studyCount > 0 && (
                <span className="px-1 text-[11px] text-slate-500">📖 {studyCount}× lernen</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

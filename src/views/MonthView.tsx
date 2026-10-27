// Monatsansicht: klassischer Kalender, Woche beginnt am Montag.
// Ferien & freie Tage und mehrtägige Events erscheinen als farbiges Band über die Tage
// (Name am Anfang und jeden Montag).

import { useMemo } from 'react'
import { useData } from '../data/DataProvider'
import { CATEGORIES, entryColor } from '../lib/categories'
import { compareEntries, entryEnd } from '../lib/grouping'
import { daysBetween, isoToLocal, monthGrid, todayKey, type DateKey } from '../lib/dates'
import { bandLanes } from '../lib/layout'
import { PERIOD_KINDS, comparePeriods, periodCovers } from '../lib/periods'
import type { Entry, StudyBlock } from '../types'

const MAX_VISIBLE = 3 // so viele Einträge pro Tag, danach "+2 weitere"
const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/**
 * Ein Tagesstück eines Bands über mehrere Tage. Die Stücke stossen an den Zellrändern aneinander;
 * der Name steht am Anfang und an jedem Montag und darf über die folgenden Tage derselben Zeile laufen.
 * index: Position des Tags im Monatsraster (0 = Montag oben links).
 */
interface BandItem {
  key: string
  start: DateKey
  end: DateKey // inklusive
  color: string
  label: string
  done?: boolean
}

const BAND_TEXT = 'py-px text-[11px] leading-tight font-semibold sm:text-xs'

function Band({ day, index, band }: { day: DateKey; index: number; band: BandItem }) {
  const { start, end, color, label } = band
  const first = start === day
  const last = end === day
  const showLabel = first || index % 7 === 0
  const span = Math.min(daysBetween(day, end) + 1, 7 - (index % 7))
  return (
    <span
      className={`relative ${BAND_TEXT} ${first ? 'rounded-l-full pl-1.5' : '-ml-1 pl-1'} ${
        last ? 'rounded-r-full pr-1.5' : '-mr-1 pr-1'
      } ${band.done ? 'line-through opacity-50' : ''}`}
      style={{ background: `color-mix(in srgb, ${color} 28%, transparent)` }}
      title={label}
    >
      {'\u00a0'}
      {showLabel && (
        <span
          className="absolute inset-y-0 left-0 truncate py-px pl-[inherit]"
          style={{ width: `calc(${span * 100}% + ${span - 1}px)` }}
        >
          {label}
        </span>
      )}
    </span>
  )
}

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
  const { subjectById, periods } = useData()
  const today = todayKey()
  const month = date.slice(0, 7)
  const weeks = monthGrid(date)

  // Einträge und Anzahl Lernzeiten pro Tag nachschlagen; mehrtägige separat (als Band)
  const { entriesByDay, multiDay, studyByDay } = useMemo(() => {
    const entriesByDay = new Map<DateKey, Entry[]>()
    const multiDay: Entry[] = []
    for (const e of [...entries].sort(compareEntries)) {
      if (e.end_date) multiDay.push(e)
      else entriesByDay.set(e.date, [...(entriesByDay.get(e.date) ?? []), e])
    }
    const studyByDay = new Map<DateKey, number>()
    for (const b of blocks) {
      const day = isoToLocal(b.starts_at).date
      studyByDay.set(day, (studyByDay.get(day) ?? 0) + 1)
    }
    return { entriesByDay, multiDay, studyByDay }
  }, [entries, blocks])

  // Bänder (zuerst Ferien & freie Tage, dann mehrtägige Einträge) pro Woche auf feste Spuren verteilen
  const lanesByDay = useMemo(() => {
    const bands: BandItem[] = [
      ...[...periods].sort(comparePeriods).map((p) => ({
        key: p.id,
        start: p.start_date,
        end: p.end_date,
        color: PERIOD_KINDS[p.kind].color,
        label: `${PERIOD_KINDS[p.kind].icon} ${p.name}`,
      })),
      ...multiDay.map((e) => ({
        key: e.id,
        start: e.date,
        end: entryEnd(e),
        color: entryColor(e, subjectById),
        label: `${CATEGORIES[e.category].icon} ${e.title}`,
        done: e.done,
      })),
    ]
    const map = new Map<DateKey, (BandItem | null)[]>()
    for (const week of monthGrid(date)) {
      bandLanes(bands, week).forEach((lanes, i) => map.set(week[i], lanes))
    }
    return map
  }, [periods, multiDay, subjectById, date])
  // Ferien färben den ganzen Tag leicht ein
  const tintOf = (day: DateKey) => {
    const p = periods.find((x) => periodCovers(x, day))
    return p && PERIOD_KINDS[p.kind].color
  }

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
        {weeks.flat().map((day, index) => {
          const dayEntries = entriesByDay.get(day) ?? []
          const tint = tintOf(day)
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
              style={tint ? { backgroundColor: `color-mix(in srgb, ${tint} ${inMonth ? 8 : 4}%, transparent)` } : undefined}
            >
              <span
                className={`mb-0.5 flex h-7 w-7 items-center justify-center self-start rounded-full text-sm font-semibold ${
                  isToday ? 'bg-red-600 text-white' : ''
                }`}
              >
                {Number(day.slice(8))}
              </span>
              {(lanesByDay.get(day) ?? []).map((band, lane) =>
                band ? (
                  <Band key={band.key} day={day} index={index} band={band} />
                ) : (
                  // Platzhalter: Spur ist hier frei, das Band darunter bleibt auf seiner Höhe
                  <span key={`frei-${lane}`} aria-hidden className={BAND_TEXT}>
                    {'\u00a0'}
                  </span>
                ),
              )}
              {dayEntries.slice(0, MAX_VISIBLE).map((e) => {
                const color = entryColor(e, subjectById)
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

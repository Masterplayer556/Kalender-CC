// Monatsansicht: klassischer Kalender, Woche beginnt am Montag.
// Ferien & freie Tage und mehrtägige Events erscheinen als farbiges Band über die Tage
// (Name am Anfang und jeden Montag).

import { useMemo, useState } from 'react'
import { useData } from '../data/DataProvider'
import { CATEGORIES, entryColor } from '../lib/categories'
import { compareEntries, entryCovers, entryEnd } from '../lib/grouping'
import { addDays, daysBetween, formatDate, formatTime, formatWeekday, isoToLocal, monthGrid, todayKey, type DateKey } from '../lib/dates'
import { bandLanes } from '../lib/layout'
import { PERIOD_KINDS, comparePeriods, periodCovers } from '../lib/periods'
import type { Entry, Period, StudyBlock } from '../types'
import { Icon } from '../components/Icon'

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
  onOpenEntry,
  onOpenBlock,
  onOpenPeriod,
  compact = false,
}: {
  date: DateKey
  entries: Entry[]
  blocks: StudyBlock[]
  onOpenDay: (date: DateKey) => void
  onOpenEntry: (entryId: string) => void
  onOpenBlock: (blockId: string) => void
  onOpenPeriod: (periodId: string) => void
  compact?: boolean // iPhone: Punkte statt Text, Einträge des gewählten Tags unter dem Raster
}) {
  if (compact)
    return (
      <CompactMonth
        date={date}
        entries={entries}
        blocks={blocks}
        onOpenDay={onOpenDay}
        onOpenEntry={onOpenEntry}
        onOpenBlock={onOpenBlock}
        onOpenPeriod={onOpenPeriod}
      />
    )
  return <FullMonth date={date} entries={entries} blocks={blocks} onOpenDay={onOpenDay} />
}

function FullMonth({
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

/**
 * iPhone-Monat: Im Raster stehen nur Tageszahl, Ferien-Streifen und farbige Punkte (ein Punkt pro Eintrag).
 * Antippen wählt den Tag – seine Einträge erscheinen darunter. Nochmals antippen öffnet die Tagesansicht.
 */
function CompactMonth({
  date,
  entries,
  blocks,
  onOpenDay,
  onOpenEntry,
  onOpenBlock,
  onOpenPeriod,
}: {
  date: DateKey
  entries: Entry[]
  blocks: StudyBlock[]
  onOpenDay: (date: DateKey) => void
  onOpenEntry: (entryId: string) => void
  onOpenBlock: (blockId: string) => void
  onOpenPeriod: (periodId: string) => void
}) {
  const { subjectById, entryById, periods } = useData()
  const today = todayKey()
  const month = date.slice(0, 7)
  const weeks = monthGrid(date)
  // Gewählter Tag: heute, wenn er in diesem Monat liegt, sonst das Datum aus der Adresse
  const [selected, setSelected] = useState<DateKey>(today.startsWith(month) ? today : date)

  const sortedEntries = useMemo(() => [...entries].sort(compareEntries), [entries])
  const blocksByDay = useMemo(() => {
    const map = new Map<DateKey, StudyBlock[]>()
    for (const b of [...blocks].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
      const day = isoToLocal(b.starts_at).date
      map.set(day, [...(map.get(day) ?? []), b])
    }
    return map
  }, [blocks])

  const periodsOn = (day: DateKey): Period[] => periods.filter((p) => periodCovers(p, day)).sort(comparePeriods)
  const entriesOn = (day: DateKey) => sortedEntries.filter((e) => entryCovers(e, day))

  const selEntries = entriesOn(selected)
  const selBlocks = (blocksByDay.get(selected) ?? []).filter((b) => entryById.has(b.entry_id))
  const selPeriods = periodsOn(selected)
  const nothing = selEntries.length === 0 && selBlocks.length === 0 && selPeriods.length === 0

  return (
    <div className="h-full overflow-y-auto overscroll-contain pb-28">
      <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-slate-200 bg-white text-center text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1.5">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((day) => {
          const inMonth = day.startsWith(month)
          const isToday = day === today
          const isSelected = day === selected
          const dayPeriods = periodsOn(day)
          const dayEntries = entriesOn(day)
          const studyCount = blocksByDay.get(day)?.length ?? 0
          const dots = dayEntries.slice(0, 4)
          return (
            <button
              key={day}
              onClick={() => (isSelected ? onOpenDay(day) : setSelected(day))}
              aria-label={`${formatWeekday(day, 'long')}, ${formatDate(day)}${dayEntries.length ? `, ${dayEntries.length} Einträge` : ''}`}
              aria-pressed={isSelected}
              className={`flex h-14 min-w-0 flex-col items-center gap-0.5 border-b border-slate-100 pt-1 dark:border-slate-900 ${
                inMonth ? '' : 'text-slate-400 dark:text-slate-600'
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[15px] ${
                  isToday
                    ? 'bg-red-600 font-semibold text-white'
                    : isSelected
                      ? 'bg-slate-900 font-semibold text-white dark:bg-slate-100 dark:text-slate-900'
                      : ''
                }`}
              >
                {Number(day.slice(8))}
              </span>
              {/* Ferien / freie Tage: durchgehender Streifen */}
              <span className="flex h-1 w-full">
                {dayPeriods[0] && (
                  <span
                    className={`h-1 w-full ${periodCovers(dayPeriods[0], addDays(day, -1)) ? '' : 'ml-1 rounded-l-full'} ${
                      periodCovers(dayPeriods[0], addDays(day, 1)) ? '' : 'mr-1 rounded-r-full'
                    }`}
                    style={{ background: PERIOD_KINDS[dayPeriods[0].kind].color, opacity: inMonth ? 0.7 : 0.35 }}
                  />
                )}
              </span>
              {/* Ein Punkt pro Eintrag (max. 4), Lernzeiten als Ring */}
              <span className="flex h-1.5 items-center gap-0.5">
                {dots.map((e) => (
                  <span
                    key={e.id}
                    className={`h-1.5 w-1.5 rounded-full ${e.done ? 'opacity-40' : ''}`}
                    style={{ background: entryColor(e, subjectById) }}
                  />
                ))}
                {studyCount > 0 && dots.length < 4 && (
                  <span className="h-1.5 w-1.5 rounded-full border border-slate-400" />
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* Einträge des gewählten Tags */}
      <section className="px-3 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-semibold">
            {formatWeekday(selected, 'long')}, {formatDate(selected)}
          </h2>
          <button className="flex min-h-9 items-center gap-0.5 text-sm font-medium text-blue-600 dark:text-blue-400" onClick={() => onOpenDay(selected)}>
            Tag öffnen <Icon name="right" className="h-4 w-4" />
          </button>
        </div>
        {nothing && <p className="py-4 text-center text-sm text-slate-500">Keine Einträge an diesem Tag.</p>}
        <ul className="space-y-1.5">
          {selPeriods.map((p) => (
            <li key={p.id}>
              <button
                className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold"
                style={{ background: `color-mix(in srgb, ${PERIOD_KINDS[p.kind].color} 22%, transparent)` }}
                onClick={() => onOpenPeriod(p.id)}
              >
                <span>{PERIOD_KINDS[p.kind].icon}</span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="shrink-0 text-xs font-normal text-slate-500">{PERIOD_KINDS[p.kind].label}</span>
              </button>
            </li>
          ))}
          {selEntries.map((e) => {
            const color = entryColor(e, subjectById)
            const time = e.start_time
              ? `${formatTime(e.start_time)}${e.end_time ? `–${formatTime(e.end_time)}` : ''}`
              : e.end_date
                ? 'mehrtägig'
                : 'ganztägig'
            return (
              <li key={e.id}>
                <button
                  className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm"
                  style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, borderLeft: `4px solid ${color}` }}
                  onClick={() => onOpenEntry(e.id)}
                >
                  <span className={`min-w-0 flex-1 font-medium ${e.done ? 'text-slate-400 line-through' : ''}`}>
                    {CATEGORIES[e.category].icon} {e.title}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500 tabular-nums">{time}</span>
                </button>
              </li>
            )
          })}
          {selBlocks.map((b) => {
            const entry = entryById.get(b.entry_id)!
            const color = entryColor(entry, subjectById)
            return (
              <li key={b.id}>
                <button
                  className="study-stripes flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-left text-sm"
                  style={{ ['--c' as string]: color, borderColor: color }}
                  onClick={() => onOpenBlock(b.id)}
                >
                  <span className={`min-w-0 flex-1 font-medium ${b.done ? 'text-slate-400 line-through' : ''}`}>
                    📖 Lernen: {entry.title}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                    {isoToLocal(b.starts_at).time}–{isoToLocal(b.ends_at).time}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

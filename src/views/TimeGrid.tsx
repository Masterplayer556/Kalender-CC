// Zeitraster 0–24 Uhr für die Wochen- und die Tagesansicht.
//
// Aufbau (ein einziger Scroll-Bereich, damit Kopfzeile und Raster beim Wischen zusammenbleiben):
//   ┌──────┬────────┬────────┬───
//   │      │ Mo 19  │ Di 20  │      ← Kopfzeile (bleibt oben kleben)
//   │ ganz │ 🏖️ …   │ 📝 …   │      ← Ferien/freie Tage und ganztägige Einträge
//   ├──────┼────────┼────────┼───
//   │ 07:00│ ▓▓▓▓   │ ////   │      ← Einträge (gefüllt) und Lernblöcke (gestreift)
//   │ 08:00│        │ ─────● │      ← rote Linie = jetzt

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useData } from '../data/DataProvider'
import { CATEGORIES, entryColor } from '../lib/categories'
import { formatWeekday, minutesToTime, timeToMinutes, todayKey, type DateKey } from '../lib/dates'
import { entryCovers } from '../lib/grouping'
import { MINUTES_PER_DAY, clipToDay, layoutDay } from '../lib/layout'
import { PERIOD_KINDS, periodsByDay } from '../lib/periods'
import type { Entry, StudyBlock } from '../types'

const HOUR_HEIGHT = 48 // Pixel pro Stunde
const PX_PER_MIN = HOUR_HEIGHT / 60
const SLOT_MINUTES = 30 // Antippen einer freien Stelle rundet auf halbe Stunden ab

interface GridItem {
  key: string
  kind: 'entry' | 'study'
  entry: Entry
  block?: StudyBlock
  start: number
  end: number
}

/** Aktuelle Uhrzeit in Minuten, aktualisiert jede Minute (für die rote Linie). */
function useNowMinutes(): number {
  const read = () => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  }
  const [now, setNow] = useState(read)
  useEffect(() => {
    const t = setInterval(() => setNow(read()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}

export function TimeGrid({
  days,
  entries,
  blocks,
  onOpenEntry,
  onOpenBlock,
  onCreateAt,
  onOpenDay,
  onOpenPeriod,
}: {
  days: DateKey[]
  entries: Entry[] // bereits gefiltert
  blocks: StudyBlock[] // bereits gefiltert
  onOpenEntry: (entryId: string) => void
  onOpenBlock: (blockId: string) => void // Lernblock angetippt → Menü zum Abhaken
  onCreateAt: (date: DateKey, time: string) => void
  onOpenDay?: (date: DateKey) => void
  onOpenPeriod: (periodId: string) => void
}) {
  const { subjectById, entryById, periods } = useData()
  const today = todayKey()
  const now = useNowMinutes()
  const scrollRef = useRef<HTMLDivElement>(null)

  const colorOf = (e: Entry) => entryColor(e, subjectById)

  // Pro Tag: ganztägige Einträge und platzierte Blöcke berechnen
  const columns = useMemo(
    () =>
      days.map((day) => {
        const allDay = entries.filter((e) => entryCovers(e, day) && !e.start_time)
        const items: GridItem[] = []
        for (const e of entries) {
          if (e.date !== day || !e.start_time) continue
          const start = timeToMinutes(e.start_time)
          const end = e.end_time ? timeToMinutes(e.end_time) : Math.min(start + 60, MINUTES_PER_DAY)
          items.push({ key: e.id, kind: 'entry', entry: e, start, end })
        }
        for (const b of blocks) {
          const entry = entryById.get(b.entry_id)
          const span = entry && clipToDay(new Date(b.starts_at), new Date(b.ends_at), day)
          if (span) items.push({ key: `${b.id}-${day}`, kind: 'study', entry, block: b, ...span })
        }
        return { day, allDay, items: layoutDay(items) }
      }),
    [days, entries, blocks, entryById],
  )
  const periodsOn = useMemo(() => periodsByDay(periods, days), [periods, days])

  // Beim Öffnen zur aktuellen Uhrzeit (wenn heute sichtbar) bzw. zu 7 Uhr scrollen.
  // Absichtlich nur beim Wechsel des Zeitraums – nicht jede Minute, wenn sich "now" ändert.
  const firstDay = days[0]
  useLayoutEffect(() => {
    const target = days.includes(today) ? Math.max(0, now - 60) : 7 * 60
    scrollRef.current?.scrollTo({ top: target * PX_PER_MIN })
  }, [firstDay, days.length])

  function handleColumnClick(day: DateKey, e: MouseEvent<HTMLDivElement>) {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    const minutes = Math.floor(y / PX_PER_MIN / SLOT_MINUTES) * SLOT_MINUTES
    onCreateAt(day, minutesToTime(Math.min(minutes, MINUTES_PER_DAY - 60)))
  }

  const gridCols = { gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }
  const minWidth = days.length > 1 ? 'min-w-[44rem]' : ''

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      <div className={minWidth}>
        {/* Kopfzeile mit Tagen und ganztägigen Einträgen */}
        <div
          className="sticky top-0 z-20 grid border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
          style={gridCols}
        >
          <div className="sticky left-0 z-10 bg-white dark:bg-slate-950" />
          {columns.map(({ day }) => {
            const isToday = day === today
            return (
              <button
                key={day}
                className="flex min-h-11 items-center justify-center gap-1.5 border-l border-slate-200 py-1 text-sm dark:border-slate-800"
                disabled={!onOpenDay}
                onClick={() => onOpenDay?.(day)}
              >
                <span className="text-slate-500">{formatWeekday(day)}</span>
                <span
                  className={`flex h-8 min-w-8 items-center justify-center rounded-full font-semibold ${
                    isToday ? 'bg-red-600 text-white' : ''
                  }`}
                >
                  {Number(day.slice(8))}
                </span>
              </button>
            )
          })}
          <div className="sticky left-0 z-10 flex items-start bg-white py-1 pr-1 text-right text-[11px] leading-tight text-slate-500 dark:bg-slate-950">
            ganz&shy;tägig
          </div>
          {columns.map(({ day, allDay }) => (
            <div key={day} className="min-h-9 space-y-1 border-l border-slate-200 p-1 dark:border-slate-800">
              {(periodsOn.get(day) ?? []).map((p) => (
                <button
                  key={p.id}
                  className="block w-full truncate rounded-full px-2 py-1 text-left text-xs font-semibold"
                  style={{ background: `color-mix(in srgb, ${PERIOD_KINDS[p.kind].color} 28%, transparent)` }}
                  title={`${PERIOD_KINDS[p.kind].label}: ${p.name}`}
                  onClick={() => onOpenPeriod(p.id)}
                >
                  {PERIOD_KINDS[p.kind].icon} {p.name}
                </button>
              ))}
              {allDay.map((e) => (
                <button
                  key={e.id}
                  className={`block w-full truncate rounded-md px-1.5 py-1 text-left text-xs font-medium ${
                    e.done ? 'line-through opacity-50' : ''
                  }`}
                  style={{
                    background: `color-mix(in srgb, ${colorOf(e)} 22%, transparent)`,
                    borderLeft: `3px solid ${colorOf(e)}`,
                  }}
                  onClick={() => onOpenEntry(e.id)}
                >
                  {CATEGORIES[e.category].icon} {e.title}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Raster 0–24 Uhr */}
        <div className="grid" style={{ ...gridCols, height: MINUTES_PER_DAY * PX_PER_MIN }}>
          <div className="sticky left-0 z-10 bg-white dark:bg-slate-950">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="relative pr-1 text-right text-[11px] text-slate-500"
                style={{ height: HOUR_HEIGHT }}
              >
                {h > 0 && <span className="relative -top-2">{String(h).padStart(2, '0')}:00</span>}
              </div>
            ))}
          </div>

          {columns.map(({ day, items }) => (
            <div
              key={day}
              className="hour-lines relative border-l border-slate-200 dark:border-slate-800"
              style={{ ['--hour-height' as string]: `${HOUR_HEIGHT}px` }}
              onClick={(e) => handleColumnClick(day, e)}
            >
              {items.map((it) => {
                const color = colorOf(it.entry)
                const done = it.kind === 'study' ? it.block!.done : it.entry.done
                const height = Math.max(it.end - it.start, 20) * PX_PER_MIN
                return (
                  <button
                    key={it.key}
                    className={`absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-xs leading-tight ${
                      it.kind === 'study' ? 'study-stripes border border-dashed' : ''
                    } ${done ? 'opacity-50' : ''}`}
                    style={{
                      top: it.start * PX_PER_MIN + 1,
                      height: height - 2,
                      left: `calc(${(it.column / it.columns) * 100}% + 2px)`,
                      width: `calc(${100 / it.columns}% - 4px)`,
                      ['--c' as string]: color,
                      borderColor: it.kind === 'study' ? color : undefined,
                      background: it.kind === 'entry' ? `color-mix(in srgb, ${color} 25%, transparent)` : undefined,
                      borderLeft: it.kind === 'entry' ? `3px solid ${color}` : undefined,
                    }}
                    onClick={(e) => {
                      e.stopPropagation() // sonst würde zusätzlich "Neuer Eintrag" aufgehen
                      if (it.kind === 'study') onOpenBlock(it.block!.id)
                      else onOpenEntry(it.entry.id)
                    }}
                  >
                    <div className={`font-semibold ${done ? 'line-through' : ''}`}>
                      {it.kind === 'study' ? `📖 Lernen: ${it.entry.title}` : `${CATEGORIES[it.entry.category].icon} ${it.entry.title}`}
                    </div>
                    {height >= 32 && (
                      <div className="text-slate-600 dark:text-slate-300">
                        {minutesToTime(it.start)}–{it.end === MINUTES_PER_DAY ? '24:00' : minutesToTime(it.end)}
                      </div>
                    )}
                  </button>
                )
              })}

              {/* Rote Linie: aktuelle Uhrzeit */}
              {day === today && (
                <div className="pointer-events-none absolute right-0 left-0 z-10" style={{ top: now * PX_PER_MIN }}>
                  <div className="h-0.5 bg-red-600" />
                  <div className="absolute -top-1 -left-1.5 h-2.5 w-2.5 rounded-full bg-red-600" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Heatmap: der Monat als "Belastung pro Tag". Je kräftiger ein Tag, desto mehr steht an.
// Rechts: stressigste Woche, Monat in Zahlen und die Einträge des gewählten Tags.
// Antippen wählt einen Tag, nochmals antippen öffnet die Tagesansicht.

import { useMemo, useState, type CSSProperties } from 'react'
import { useData } from '../data/DataProvider'
import { loadPref, savePref } from '../lib/cache'
import { CATEGORIES, entryColor } from '../lib/categories'
import { formatDate, formatTime, formatWeekday, isoToLocal, isoWeek, monthGrid, todayKey, type DateKey } from '../lib/dates'
import { compareEntries, entryCovers } from '../lib/grouping'
import { busiestWeek, dayLoads, heatLevel, loadCount } from '../lib/heatmap'
import { PERIOD_KINDS, comparePeriods, periodCovers } from '../lib/periods'
import type { Entry, StudyBlock } from '../types'
import { Icon } from '../components/Icon'
import { useTheme } from '../components/ThemeProvider'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export function HeatmapView({
  date,
  entries,
  blocks,
  onOpenEntry,
  onOpenBlock,
  onOpenPeriod,
  onOpenDay,
}: {
  date: DateKey
  entries: Entry[]
  blocks: StudyBlock[]
  onOpenEntry: (id: string) => void
  onOpenBlock: (id: string) => void
  onOpenPeriod: (periodId: string) => void
  onOpenDay: (day: DateKey) => void
}) {
  const { theme } = useTheme()
  const neon = theme === 'neon'
  const { periods, subjectById, entryById } = useData()
  const today = todayKey()
  const month = date.slice(0, 7)
  const weeks = useMemo(() => monthGrid(date), [date])
  // "Nur Offenes": Erledigtes zählt in Raster, stressigster Woche und Monatszahlen nicht mit (pro Gerät gemerkt)
  const [openOnly, setOpenOnlyState] = useState(() => loadPref('heatmapOpenOnly', false))
  const setOpenOnly = (value: boolean) => {
    setOpenOnlyState(value)
    savePref('heatmapOpenOnly', value)
  }
  const loads = useMemo(() => dayLoads(weeks.flat(), entries, blocks, openOnly), [weeks, entries, blocks, openOnly])
  const busiest = busiestWeek(weeks, loads, month)
  const [selected, setSelected] = useState<DateKey>(today.startsWith(month) ? today : `${month}-01`)

  // Monat in Zahlen (nur Tage dieses Monats)
  const totals = weeks
    .flat()
    .filter((d) => d.startsWith(month))
    .reduce(
      (sum, d) => {
        const l = loads.get(d)!
        return { tests: sum.tests + l.tests, others: sum.others + l.others, study: sum.study + l.study }
      },
      { tests: 0, others: 0, study: 0 },
    )

  // Gewählter Tag
  const selPeriods = periods.filter((p) => periodCovers(p, selected)).sort(comparePeriods)
  const selEntries = entries.filter((e) => entryCovers(e, selected)).sort(compareEntries)
  const selBlocks = blocks
    .filter((b) => isoToLocal(b.starts_at).date === selected && entryById.has(b.entry_id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const selCount = selPeriods.length + selEntries.length + selBlocks.length

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 pb-32 md:px-6 md:pb-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* ---------- Raster ---------- */}
        <section className="tile min-w-0 p-2.5 md:p-4" aria-label="Belastung pro Tag">
          <div className="mb-2 flex justify-end">
            <div className="segment" role="group" aria-label="Was zählt">
              <button className="text-[13px]!" aria-pressed={!openOnly} onClick={() => setOpenOnly(false)}>
                Alles
              </button>
              <button className="text-[13px]!" aria-pressed={openOnly} onClick={() => setOpenOnly(true)}>
                Nur Offenes
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {WEEKDAYS.map((w) => (
              <div key={w} className={`muted pb-1 text-center text-[11px] font-bold tracking-wide uppercase ${neon ? 'font-mono' : ''}`}>
                {w}
              </div>
            ))}
            {weeks.flat().map((day) => {
              const load = loads.get(day)!
              const level = heatLevel(load.score)
              const inMonth = day.startsWith(month)
              const period = periods.find((p) => periodCovers(p, day))
              const style: CSSProperties = period
                ? { outline: `2px dashed ${PERIOD_KINDS[period.kind].color}`, outlineOffset: -2 }
                : {}
              return (
                <button
                  key={day}
                  className={`heat-cell ${inMonth ? '' : 'opacity-35'} ${day === selected ? 'is-selected' : ''}`}
                  data-level={level}
                  style={style}
                  aria-pressed={day === selected}
                  aria-label={`${formatWeekday(day, 'long')}, ${formatDate(day)}: ${load.tests} Tests, ${load.others} weitere Einträge, ${load.study} Lernzeiten${period ? `, ${period.name}` : ''}`}
                  onClick={() => (day === selected ? onOpenDay(day) : setSelected(day))}
                >
                  <span className="text-[13px] md:text-[15px]">{Number(day.slice(8))}</span>
                  {load.tests > 0 && <span aria-hidden className="heat-dot" />}
                  {/* Anzahl Einträge + Lernzeiten (nicht die Punkte: ein Test zählt 2 Punkte, ist aber nur 1 Eintrag) */}
                  {load.score > 0 && inMonth && <span aria-hidden className="absolute bottom-1.5 left-2.5 hidden text-[11px] opacity-75 md:block">{loadCount(load)}</span>}
                  {day === today && <span aria-hidden className="absolute right-2 bottom-1.5 left-2 h-[3px] rounded-full bg-current md:left-auto md:w-5" />}
                </button>
              )
            })}
          </div>
          <div className={`muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-bold tracking-wide uppercase ${neon ? 'font-mono' : ''}`}>
            <span className="flex items-center gap-1.5">
              wenig
              {[0, 1, 2, 3].map((l) => (
                <span key={l} className="heat-cell heat-swatch" data-level={l} />
              ))}
              viel
            </span>
            <span className="ml-auto hidden md:inline">Zahl = Einträge & Lernzeiten</span>
            <span className="flex items-center gap-1.5 max-md:ml-auto">
              <span className="heat-dot static!" /> Test
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-[3px] border-2 border-dashed border-current" /> Ferien & Lager
            </span>
          </div>
        </section>

        {/* ---------- Seitenspalte ---------- */}
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-1">
          <section className="tile p-4 md:p-5" aria-label="Stressigste Woche">
            <div className="tag-label">Stressigste Woche</div>
            {busiest ? (
              <>
                <div className="num num-grad mt-2 text-5xl">KW {isoWeek(busiest.week[0])}</div>
                <div className="muted mt-2 text-sm font-semibold">
                  {busiest.load.tests} {busiest.load.tests === 1 ? 'Test' : 'Tests'} · {busiest.load.study}{' '}
                  {busiest.load.study === 1 ? 'Lernzeit' : 'Lernzeiten'} · {formatDate(busiest.week[0]).slice(0, 6)}–
                  {formatDate(busiest.week[6]).slice(0, 6)}
                </div>
              </>
            ) : (
              <p className="muted mt-2 text-sm">{openOnly ? 'Diesen Monat ist nichts mehr offen.' : 'Diesen Monat ist noch nichts geplant.'}</p>
            )}
          </section>

          <section className="tile tone-1 grid grid-cols-3" aria-label="Monat in Zahlen">
            {[
              { n: totals.tests, label: 'Tests' },
              { n: totals.others, label: 'Aufgaben & Co.' },
              { n: totals.study, label: 'Lernzeiten' },
            ].map((s, i) => (
              <div key={s.label} className={`p-4 ${neon && i ? 'border-l border-(--line)' : ''}`}>
                <div className="num text-4xl">{s.n}</div>
                <div className="muted mt-1 text-xs font-semibold">{s.label}</div>
              </div>
            ))}
          </section>

          <section className="md:col-span-2 lg:col-span-1" aria-label="Gewählter Tag">
            <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
              <h2 className="section-title">
                {formatWeekday(selected, 'long')}, {Number(selected.slice(8))}.
              </h2>
              <button className="ink-accent flex min-h-9 items-center gap-0.5 text-sm font-bold" onClick={() => onOpenDay(selected)}>
                Tag öffnen <Icon name="right" className="h-4 w-4" />
              </button>
            </div>
            <div className="tile overflow-hidden">
              {selCount === 0 && <p className="muted p-5 text-center text-sm">Frei – nichts geplant.</p>}
              {selPeriods.map((p) => (
                <button key={p.id} className="heat-row" onClick={() => onOpenPeriod(p.id)}>
                  <span className="heat-time">ganz</span>
                  <Icon name={PERIOD_KINDS[p.kind].icon} className="h-4 w-4 shrink-0" style={{ color: PERIOD_KINDS[p.kind].color }} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="heat-tag">{PERIOD_KINDS[p.kind].label}</span>
                </button>
              ))}
              {selEntries.map((e) => {
                const color = entryColor(e, subjectById)
                return (
                  <button key={e.id} className={`heat-row ${e.done ? 'opacity-60' : ''}`} onClick={() => onOpenEntry(e.id)}>
                    <span className="heat-time">{e.start_time ? formatTime(e.start_time) : '—'}</span>
                    <Icon name={CATEGORIES[e.category].icon} className="h-4 w-4 shrink-0" style={{ color }} strokeWidth={2.4} />
                    <span className={`min-w-0 flex-1 truncate ${e.done ? 'line-through' : ''}`}>{e.title}</span>
                    <span className="heat-tag">{CATEGORIES[e.category].label}</span>
                  </button>
                )
              })}
              {selBlocks.map((b) => {
                const entry = entryById.get(b.entry_id)!
                return (
                  <button key={b.id} className={`heat-row ${b.done ? 'opacity-60' : ''}`} onClick={() => onOpenBlock(b.id)}>
                    <span className="heat-time">{isoToLocal(b.starts_at).time}</span>
                    <Icon name="book" className="h-4 w-4 shrink-0" style={{ color: entryColor(entry, subjectById) }} />
                    <span className={`min-w-0 flex-1 truncate ${b.done ? 'line-through' : ''}`}>Lernen: {entry.title}</span>
                    <span className="heat-tag">Lernzeit</span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

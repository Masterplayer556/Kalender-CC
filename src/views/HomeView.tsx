// Heute-Übersicht ("Bento"): alles Wichtige auf einen Blick, in Kacheln.
//   iPad quer:  [ Nächster Test ············ ][ Ferien ]
//               [ Schnitt ][ Lernwoche ][ Noch diese Woche ]
//               [ Dein Tag ·········· ][ Als Nächstes ]
//   iPad hoch und iPhone: dieselben Kacheln, enger angeordnet.

import type { ReactNode } from 'react'
import { useClock } from '../components/useClock'
import { useData } from '../data/DataProvider'
import { blockTerms, entryColor } from '../lib/categories'
import { blockEndTime, addDays, countdown, daysBetween, formatDate, formatTime, formatWeekday, isoToLocal, todayKey, weekDays, type DateKey } from '../lib/dates'
import { gradesInSemester, overallAverage, semesterOf } from '../lib/grades'
import { overallTrend, trendDelta } from '../lib/gradeStats'
import { compareEntries, entryCovers, entryEnd } from '../lib/grouping'
import { overdueEntries, testsAwaitingGrade } from '../lib/overdue'
import { PERIOD_KINDS, comparePeriods, periodCovers } from '../lib/periods'
import { weekOutlook } from '../lib/week'
import type { Category, Entry, StudyBlock } from '../types'
import { CountUp } from '../components/CountUp'
import { GradeChart } from '../components/GradeChart'
import type { GradeRequest } from '../components/GradeEditor'
import { Icon, type IconName } from '../components/Icon'
import type { PeriodRequest } from '../components/PeriodEditor'
import { useTheme } from '../components/ThemeProvider'
import { EntryCard } from '../components/home/EntryCard'
import { HolidayTile } from '../components/home/HolidayTile'
import { NextTestTile } from '../components/home/NextTestTile'
import { StudyWeekTile } from '../components/home/StudyWeekTile'
import { Tile } from '../components/home/Tile'

export const CATEGORY_ICON: Record<Category, IconName> = { test: 'doc', aufgabe: 'check', event: 'sparkle', sonstiges: 'flag' }

export function HomeView({
  entries,
  blocks,
  onOpenEntry,
  onOpenBlock,
  onOpenPeriod,
  onOpenGrade,
  onGo,
}: {
  entries: Entry[]
  blocks: StudyBlock[]
  onOpenEntry: (id: string) => void
  onOpenBlock: (id: string) => void
  onOpenPeriod: (req: PeriodRequest) => void
  onOpenGrade: (req: GradeRequest) => void
  onGo: (view: 'noten' | 'liste' | 'mehr') => void
}) {
  const { theme } = useTheme()
  const neon = theme === 'neon'
  const { subjectById, entryById, periods, grades, gradesMissing, gradesByEntry, setEntryDone } = useData()
  const today = todayKey()
  const nowIso = new Date(useClock()).toISOString() // „vorbei – abhaken?“ aktualisiert sich jede Minute
  const colorOf = (e: Entry) => entryColor(e, subjectById)

  // --- Nächster Test ---
  const nextTest = entries.filter((e) => e.category === 'test' && e.date >= today && !e.done).sort(compareEntries)[0]

  // --- Schnitt (aktuelles Semester) ---
  // Gleiche Rechnung wie im Noten-Tab (lib/grades.ts), nur Fächer, die es noch gibt
  const semGrades = gradesInSemester(grades, semesterOf(today).key).filter((g) => subjectById.has(g.subject_id))
  const average = overallAverage(semGrades)
  const overall = average?.overall ?? null
  const trend = overallTrend(semGrades)
  const delta = trendDelta(trend, addDays(today, -30))

  // --- Diese Woche ---
  const week = weekDays(today)
  const inWeek = (d: DateKey) => d >= week[0] && d <= week[6]
  const weekBlocks = blocks
    .filter((b) => inWeek(isoToLocal(b.starts_at).date) && entryById.has(b.entry_id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  // Nur was noch kommt: Erledigtes und die vergangenen Tage der Woche zählen nicht mehr mit
  const ahead = weekOutlook(entries, today)
  const overdue = overdueEntries(entries, today)
  const awaiting = gradesMissing ? [] : testsAwaitingGrade(entries, new Set(gradesByEntry.keys()), today)

  // --- Dein Tag: Zeiträume, Einträge und Lernzeiten nach Uhrzeit ---
  const todayPeriods = periods.filter((p) => periodCovers(p, today)).sort(comparePeriods)
  type DayItem = { key: string; sort: string; time: string; sub: string; node: ReactNode }
  const dayItems: DayItem[] = [
    ...entries
      .filter((e) => entryCovers(e, today))
      .map((e) => ({
        key: e.id,
        sort: e.start_time ?? '',
        time: e.start_time ? formatTime(e.start_time) : '—',
        sub: e.end_time ? `bis ${formatTime(e.end_time)}` : e.start_time ? '' : e.end_date ? 'mehrtägig' : 'offen',
        node: <EntryCard entry={e} color={colorOf(e)} onOpen={() => onOpenEntry(e.id)} onToggle={(done) => setEntryDone(e.id, done).catch((err) => alert(err.message))} />,
      })),
    ...blocks
      .filter((b) => isoToLocal(b.starts_at).date === today && entryById.has(b.entry_id))
      .map((b) => {
        const entry = entryById.get(b.entry_id)!
        return {
          key: b.id,
          sort: isoToLocal(b.starts_at).time,
          time: isoToLocal(b.starts_at).time,
          sub: `bis ${blockEndTime(b.starts_at, b.ends_at)}`,
          node: (
            <button
              className={`study-stripes flex min-h-16 w-full items-center gap-3 rounded-[calc(var(--r-tile)-8px)] border-[1.5px] border-dashed px-3.5 py-2.5 text-left ${b.done ? 'opacity-55' : ''}`}
              style={{ ['--c' as string]: colorOf(entry), borderColor: colorOf(entry) }}
              onClick={() => onOpenBlock(b.id)}
            >
              <Icon name="book" className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-bold ${b.done ? 'line-through' : ''}`}>{blockTerms(entry.category).prefix}: {entry.title}</span>
                <span className="muted block text-[13px]">{b.done ? 'erledigt' : b.ends_at < nowIso ? 'vorbei – abhaken?' : blockTerms(entry.category).one}</span>
              </span>
              {b.done && <Icon name="check" className="h-5 w-5 text-green-600" strokeWidth={3} />}
            </button>
          ),
        }
      }),
  ].sort((a, b) => a.sort.localeCompare(b.sort))

  // --- Als Nächstes ---
  const upcoming = entries
    .filter((e) => e.date > today && !e.done)
    .sort(compareEntries)
    .slice(0, 6)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 pb-32 md:grid-cols-6 md:gap-4 md:px-6 md:pb-10 lg:grid-cols-12">
        <NextTestTile nextTest={nextTest} today={today} onOpenEntry={onOpenEntry} />

        <HolidayTile today={today} onOpenPeriod={onOpenPeriod} />

        {/* ---------- Schnitt ---------- */}
        <Tile i={2} className="tile col-span-1 flex min-h-[170px] flex-col p-4 md:col-span-3 md:p-5 lg:col-span-4" onClick={() => onGo('noten')} label="Notenschnitt">
          <div className="flex items-center justify-between gap-2">
            <span className="tag-label">Schnitt</span>
            {delta !== null && Math.abs(delta) >= 0.01 && (
              <span className={`shrink-0 whitespace-nowrap rounded-(--r-chip) px-2 py-0.5 text-xs font-bold ${delta > 0 ? 'grade-good' : 'grade-bad'} ${neon ? 'font-mono' : ''}`}>
                {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}
              </span>
            )}
          </div>
          {overall === null ? (
            <p className="muted mt-auto text-sm">{gradesMissing ? 'Noten sind noch nicht eingerichtet.' : 'Noch keine Noten in diesem Semester.'}</p>
          ) : (
            <>
              {trend.length > 1 && (
                <div className="mt-2 -mx-1">
                  <GradeChart line={trend} color="var(--accent-text)" height={46} sparkline label="Verlauf des Gesamtschnitts" />
                </div>
              )}
              <div className="mt-auto">
                <div className="num num-grad text-5xl md:text-[56px]"><CountUp value={overall} delay={140} format={(n) => n.toFixed(2)} /></div>
                <div className="muted mt-1 text-sm">Zeugnis-⌀ · {average!.reports.size} Fächer</div>
              </div>
            </>
          )}
        </Tile>

        <StudyWeekTile weekBlocks={weekBlocks} onOpenBlock={onOpenBlock} />

        {/* ---------- Noch diese Woche ---------- */}
        <Tile i={4} className="tile tone-3 col-span-2 flex flex-col md:col-span-3 lg:col-span-4" onClick={() => onGo('liste')} label="Noch diese Woche">
          <span className="tag-label px-4 pt-4 md:px-5 md:pt-5">Noch diese Woche</span>
          <div className="mt-auto grid grid-cols-3">
            {[
              { n: ahead.tests, label: ahead.tests === 1 ? 'Test' : 'Tests', color: 'text-(--accent-text)' },
              { n: ahead.tasks, label: ahead.tasks === 1 ? 'Aufgabe' : 'Aufgaben', color: 'text-(--accent-2)' },
              { n: overdue.length, label: 'Überfällig', color: overdue.length > 0 ? 'text-red-600 dark:text-red-400' : '' },
            ].map((s, i) => (
              <div key={s.label} className={`flex flex-col justify-end px-4 pt-3 pb-4 md:px-5 md:pb-5 ${neon && i ? 'border-l border-(--line)' : ''}`}>
                <span className={`num text-4xl md:text-5xl ${s.n > 0 ? s.color : ''}`}><CountUp value={s.n} delay={260 + i * 60} /></span>
                <span className="muted mt-1 text-sm font-semibold">{s.label}</span>
              </div>
            ))}
          </div>
        </Tile>

        {/* ---------- Dein Tag ---------- */}
        <Tile i={5} clip={false} className="col-span-2 md:col-span-6 lg:col-span-7" label="Dein Tag">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="section-title">Dein Tag</h2>
            <span className="muted text-sm font-semibold">
              {dayItems.length} {dayItems.length === 1 ? 'Eintrag' : 'Einträge'}
            </span>
          </div>
          <div className="space-y-2.5">
            {todayPeriods.map((p) => (
              <button
                key={p.id}
                className="tile flex min-h-14 w-full items-center gap-3 px-4 text-left font-bold"
                style={{ background: `color-mix(in srgb, ${PERIOD_KINDS[p.kind].color} 18%, var(--surface))` }}
                onClick={() => onOpenPeriod({ periodId: p.id })}
              >
                <Icon name={PERIOD_KINDS[p.kind].icon} className="h-5 w-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="muted text-sm font-semibold">{PERIOD_KINDS[p.kind].label}</span>
              </button>
            ))}
            {dayItems.length === 0 && todayPeriods.length === 0 && (
              <div className="tile-2 p-6 text-center">
                <div className="section-title">Frei!</div>
                <p className="muted mt-1 text-sm">Heute steht nichts an.</p>
              </div>
            )}
            {dayItems.map((it) => (
              <div key={it.key} className="grid grid-cols-[52px_minmax(0,1fr)] gap-2.5">
                <div className="pt-3.5 text-right">
                  <div className={`text-sm font-bold ${neon ? 'font-mono' : ''}`}>{it.time}</div>
                  {it.sub && <div className="muted text-[11px] font-semibold">{it.sub}</div>}
                </div>
                {it.node}
              </div>
            ))}
          </div>
        </Tile>

        {/* ---------- Als Nächstes ---------- */}
        <Tile i={6} clip={false} className="col-span-2 md:col-span-6 lg:col-span-5" label="Als Nächstes">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="section-title">Als Nächstes</h2>
            <button className="ink-accent min-h-9 text-sm font-bold" onClick={() => onGo('liste')}>
              Alle →
            </button>
          </div>
          {awaiting.length > 0 && (
            <button className="tile mb-2.5 flex min-h-14 w-full items-center gap-3 px-4 text-left" onClick={() => onOpenGrade({ entryId: awaiting[0].id })}>
              <Icon name="chart" className="ink-accent h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">Note eintragen: {awaiting[0].title}</span>
                <span className="muted block text-[13px]">
                  {awaiting.length > 1 ? `und ${awaiting.length - 1} weitere Tests ohne Note` : `Test vom ${formatDate(awaiting[0].date)}`}
                </span>
              </span>
            </button>
          )}
          {overdue.length > 0 && (
            <button className="tile mb-2.5 flex min-h-14 w-full items-center gap-3 px-4 text-left" onClick={() => onGo('liste')}>
              <Icon name="alert" className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <span className="min-w-0 flex-1 font-bold">
                {overdue.length} {overdue.length === 1 ? 'Aufgabe überfällig' : 'Aufgaben überfällig'}
              </span>
            </button>
          )}
          <div className={`tile overflow-hidden ${neon ? '' : 'divide-y divide-(--line)'}`}>
            {upcoming.length === 0 && <p className="muted p-5 text-center text-sm">Nichts geplant. Tippe auf „+“.</p>}
            {upcoming.map((e) => {
              const days = daysBetween(today, e.date)
              return (
                <button key={e.id} className={`flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left ${neon ? 'border-b border-(--line) last:border-b-0' : ''}`} onClick={() => onOpenEntry(e.id)}>
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-(--r-ctl) text-white"
                    style={{ background: neon ? 'transparent' : colorOf(e), color: neon ? colorOf(e) : undefined, border: neon ? `1.5px solid ${colorOf(e)}` : undefined }}
                  >
                    <Icon name={CATEGORY_ICON[e.category]} className="h-5 w-5" strokeWidth={2.3} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{e.title}</span>
                    <span className="muted block truncate text-[13px]">
                      {formatWeekday(e.date)} {formatDate(e.date).slice(0, 6)}
                      {entryEnd(e) !== e.date && ` – ${formatDate(entryEnd(e)).slice(0, 6)}`}
                      {e.subject_id && ` · ${subjectById.get(e.subject_id)?.name}`}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-(--r-chip) px-2.5 py-1 text-xs font-bold ${days <= 2 ? 'grade-bad' : 'bg-(--surface-2)'} ${neon ? 'font-mono' : ''}`}
                  >
                    {neon ? `T–${days}d` : countdown(today, e.date)}
                  </span>
                </button>
              )
            })}
          </div>
        </Tile>
      </div>
    </div>
  )
}

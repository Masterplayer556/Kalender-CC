// Heute-Übersicht ("Bento"): alles Wichtige auf einen Blick, in Kacheln.
//   iPad quer:  [ Nächster Test ············ ][ Ferien ]
//               [ Schnitt ][ Lernwoche ][ Diese Woche ]
//               [ Dein Tag ·········· ][ Als Nächstes ]
//   iPad hoch und iPhone: dieselben Kacheln, enger angeordnet.

import type { CSSProperties, ReactNode } from 'react'
import { useData } from '../data/DataProvider'
import { entryColor } from '../lib/categories'
import { addDays, countdown, daysBetween, formatDate, formatTime, formatWeekday, isoToLocal, todayKey, weekDays, type DateKey } from '../lib/dates'
import { roundToHalf, semesterOf, weightedAverage } from '../lib/grades'
import { overallTrend, trendDelta } from '../lib/gradeStats'
import { compareEntries, entryCovers, entryEnd } from '../lib/grouping'
import { overdueEntries, testsAwaitingGrade } from '../lib/overdue'
import { PERIOD_KINDS, comparePeriods, holidayStatus, periodCovers } from '../lib/periods'
import type { Category, Entry, StudyBlock } from '../types'
import { GradeChart } from '../components/GradeChart'
import type { GradeRequest } from '../components/GradeEditor'
import { Icon, type IconName } from '../components/Icon'
import type { PeriodRequest } from '../components/PeriodEditor'
import { useTheme } from '../components/ThemeProvider'

export const CATEGORY_ICON: Record<Category, IconName> = { test: 'doc', aufgabe: 'check', event: 'sparkle', sonstiges: 'flag' }

/** Kachel mit Einblend-Animation (--i = Reihenfolge) */
function Tile({ i, className = '', children, onClick, label }: { i: number; className?: string; children: ReactNode; onClick?: () => void; label?: string }) {
  const style = { '--i': i } as CSSProperties
  const cls = `tile-in relative overflow-hidden text-left ${className}`
  return onClick ? (
    <button className={cls} style={style} onClick={onClick} aria-label={label}>
      {children}
    </button>
  ) : (
    <section className={cls} style={style} aria-label={label}>
      {children}
    </section>
  )
}

/** "3 Tage" (Sunset) bzw. "T–3d" (Neon) */
function useCountdownLabel() {
  const { theme } = useTheme()
  return (days: number) => (theme === 'neon' ? `T–${days}d` : String(days))
}

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
  const { subjectById, entryById, blocksByEntry, periods, periodsMissing, grades, gradesMissing, gradeByEntry, online, setEntryDone } = useData()
  const today = todayKey()
  const nowIso = new Date().toISOString()
  const colorOf = (e: Entry) => entryColor(e, subjectById)
  const big = useCountdownLabel()

  // --- Nächster Test ---
  const nextTest = entries.filter((e) => e.category === 'test' && e.date >= today && !e.done).sort(compareEntries)[0]
  const testBlocks = nextTest ? (blocksByEntry.get(nextTest.id) ?? []) : []
  const testDone = testBlocks.filter((b) => b.done).length
  const testDays = nextTest ? daysBetween(today, nextTest.date) : 0

  // --- Ferien ---
  const holiday = holidayStatus(periods, today)
  const lastFerien = periods
    .filter((p) => p.kind === 'ferien' && p.end_date < today)
    .sort(comparePeriods)
    .at(-1)
  const ferienProgress =
    holiday?.state === 'upcoming' && lastFerien
      ? daysBetween(lastFerien.end_date, today) / Math.max(1, daysBetween(lastFerien.end_date, holiday.period.start_date))
      : null

  // --- Schnitt (aktuelles Semester) ---
  const semKey = semesterOf(today).key
  const semGrades = grades.filter((g) => semesterOf(g.date).key === semKey)
  const bySubject = new Map<string, typeof semGrades>()
  for (const g of semGrades) bySubject.set(g.subject_id, [...(bySubject.get(g.subject_id) ?? []), g])
  const reports = [...bySubject.values()].map((list) => roundToHalf(weightedAverage(list)!))
  const overall = reports.length ? reports.reduce((a, b) => a + b, 0) / reports.length : null
  const trend = overallTrend(semGrades)
  const delta = trendDelta(trend, addDays(today, -30))

  // --- Diese Woche ---
  const week = weekDays(today)
  const inWeek = (d: DateKey) => d >= week[0] && d <= week[6]
  const weekBlocks = blocks
    .filter((b) => inWeek(isoToLocal(b.starts_at).date) && entryById.has(b.entry_id))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const weekDone = weekBlocks.filter((b) => b.done).length
  const weekTests = entries.filter((e) => e.category === 'test' && inWeek(e.date)).length
  const weekTasks = entries.filter((e) => e.category === 'aufgabe' && inWeek(e.date)).length
  const overdue = overdueEntries(entries, today)
  const awaiting = gradesMissing ? [] : testsAwaitingGrade(entries, new Set(gradeByEntry.keys()), today)

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
        node: <EntryCard entry={e} color={colorOf(e)} onOpen={() => onOpenEntry(e.id)} canEdit={online} onToggle={(done) => setEntryDone(e.id, done).catch((err) => alert(err.message))} />,
      })),
    ...blocks
      .filter((b) => isoToLocal(b.starts_at).date === today && entryById.has(b.entry_id))
      .map((b) => {
        const entry = entryById.get(b.entry_id)!
        return {
          key: b.id,
          sort: isoToLocal(b.starts_at).time,
          time: isoToLocal(b.starts_at).time,
          sub: `bis ${isoToLocal(b.ends_at).time}`,
          node: (
            <button
              className={`study-stripes flex min-h-16 w-full items-center gap-3 rounded-[calc(var(--r-tile)-8px)] border-[1.5px] border-dashed px-3.5 py-2.5 text-left ${b.done ? 'opacity-55' : ''}`}
              style={{ ['--c' as string]: colorOf(entry), borderColor: colorOf(entry) }}
              onClick={() => onOpenBlock(b.id)}
            >
              <Icon name="book" className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-bold ${b.done ? 'line-through' : ''}`}>Lernen: {entry.title}</span>
                <span className="muted block text-[13px]">{b.done ? 'erledigt' : b.ends_at < nowIso ? 'vorbei – abhaken?' : 'Lernzeit'}</span>
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
        {/* ---------- Nächster Test ---------- */}
        <Tile
          i={0}
          className={`tile-hero col-span-2 min-h-[210px] p-5 md:col-span-6 md:p-6 lg:col-span-8`}
          onClick={nextTest ? () => onOpenEntry(nextTest.id) : undefined}
          label={nextTest ? `Nächster Test: ${nextTest.title}` : 'Kein Test geplant'}
        >
          {!neon && (
            <>
              <span aria-hidden className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-white/12" />
              <span aria-hidden className="absolute -top-6 right-6 h-32 w-32 rounded-full bg-white/12" />
            </>
          )}
          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between gap-2">
              <span className={neon ? 'tag-label ink-accent' : 'tag-label rounded-full bg-white/20 px-3 py-1.5'}>
                {neon ? '● Next_Test' : 'Nächster Test'}
              </span>
              {nextTest && (
                <span className={`text-sm font-bold ${neon ? 'font-mono' : ''}`}>
                  {formatWeekday(nextTest.date)} {formatDate(nextTest.date).slice(0, 6)}
                  {nextTest.start_time && ` · ${formatTime(nextTest.start_time)}`}
                </span>
              )}
            </div>
            {nextTest ? (
              <>
                <div className="mt-auto flex flex-wrap items-end gap-x-4 gap-y-1 pt-3">
                  <span className={`num text-[96px] md:text-[128px] ${neon ? 'ink-accent text-[64px]! md:text-[88px]!' : ''}`}>
                    {testDays === 0 ? (neon ? 'HEUTE' : '0') : big(testDays)}
                  </span>
                  <span className="min-w-0 pb-2 md:pb-4">
                    {!neon && <span className="block text-xl font-extrabold md:text-2xl">{testDays === 0 ? 'Heute ist es so weit' : testDays === 1 ? 'Tag bis' : 'Tage bis'}</span>}
                    <span className="block text-xl leading-tight font-extrabold md:text-[28px]">{nextTest.title}</span>
                    {nextTest.subject_id && (
                      <span className="block text-sm font-semibold opacity-85">{subjectById.get(nextTest.subject_id)?.name}</span>
                    )}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  {testBlocks.length > 0 ? (
                    <>
                      <div className={`progress-cells flex-1 ${neon ? '' : 'text-white'}`}>
                        {testBlocks.map((b) => (
                          <span key={b.id} className={b.done ? 'on' : ''} />
                        ))}
                      </div>
                      <span className={`shrink-0 text-sm font-bold ${neon ? 'font-mono' : ''}`}>
                        {testDone}/{testBlocks.length} gelernt
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-semibold opacity-85">Noch keine Lernzeiten geplant – im Test hinzufügen.</span>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-auto pt-6">
                <div className="num text-5xl md:text-6xl">{neon ? 'NULL_TESTS' : 'Kein Test'}</div>
                <p className="mt-2 font-semibold opacity-85">In nächster Zeit steht kein Test an. Geniess es!</p>
              </div>
            )}
          </div>
        </Tile>

        {/* ---------- Ferien ---------- */}
        <Tile
          i={1}
          className={`${neon ? 'tile' : 'tile-2'} col-span-1 flex min-h-[170px] flex-col p-4 md:col-span-3 md:p-5 lg:col-span-4`}
          onClick={() => (holiday ? onOpenPeriod({ periodId: holiday.period.id }) : onOpenPeriod({}))}
          label="Ferien"
        >
          <div className="flex items-center justify-between">
            <span className="tag-label">Ferien</span>
            <Icon name="sun" className="ink-accent h-6 w-6" />
          </div>
          {periodsMissing ? (
            <p className="muted mt-auto text-sm">Ferien sind noch nicht eingerichtet (siehe README).</p>
          ) : !holiday ? (
            <p className="mt-auto text-[15px] font-bold">Ferien eintragen, um den Countdown zu sehen →</p>
          ) : holiday.state === 'during' ? (
            <div className="mt-auto">
              <div className="num text-5xl md:text-6xl">{neon ? 'JETZT' : 'Ferien!'}</div>
              <div className="mt-1 truncate font-bold">{holiday.period.name}</div>
              <div className="muted text-sm">{holiday.daysLeft === 1 ? 'Letzter Tag – geniessen!' : `noch ${holiday.daysLeft} Tage`}</div>
            </div>
          ) : (
            <div className="mt-auto">
              <div className="num text-5xl md:text-[64px]">{big(holiday.daysUntil)}</div>
              <div className="mt-1 leading-tight font-bold">
                {neon ? holiday.period.name : `Tage bis ${holiday.period.name}`}
              </div>
              <div className="muted text-sm">
                noch {holiday.schoolDays} {holiday.schoolDays === 1 ? 'Schultag' : 'Schultage'}
              </div>
              {ferienProgress !== null && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--line)">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${Math.min(100, Math.max(4, ferienProgress * 100))}%`, background: neon ? '#3df5ff' : 'var(--hero)' }}
                  />
                </div>
              )}
            </div>
          )}
        </Tile>

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
                <div className="num text-5xl md:text-[56px]">{overall.toFixed(2)}</div>
                <div className="muted mt-1 text-sm">Zeugnis-⌀ · {bySubject.size} Fächer</div>
              </div>
            </>
          )}
        </Tile>

        {/* ---------- Lernwoche ---------- */}
        <Tile i={3} className="tile col-span-2 flex items-center gap-4 p-4 md:col-span-3 md:p-5 lg:col-span-4" label="Lernzeiten diese Woche">
          {neon ? (
            <div className="min-w-0 flex-1">
              <span className="tag-label">Lernzeiten · KW</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="num ink-accent text-5xl">{weekDone}</span>
                <span className="num muted text-2xl">/{weekBlocks.length}</span>
              </div>
              <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(18px,1fr))] gap-1">
                {weekBlocks.map((b) => (
                  <button
                    key={b.id}
                    className="aspect-square rounded-[3px] border"
                    style={b.done ? { background: colorOf(entryById.get(b.entry_id)!), borderColor: 'transparent' } : { borderColor: 'var(--line)' }}
                    aria-label={`Lernzeit ${entryById.get(b.entry_id)!.title}`}
                    onClick={() => onOpenBlock(b.id)}
                  />
                ))}
                {weekBlocks.length === 0 && <span className="muted col-span-full text-sm">keine geplant</span>}
              </div>
            </div>
          ) : (
            <>
              <WeekRing blocks={weekBlocks} colorOf={(b) => colorOf(entryById.get(b.entry_id)!)} />
              <div className="min-w-0">
                <div className="muted text-sm font-semibold">Lernplan diese Woche</div>
                <div className="num mt-1 text-4xl">
                  {weekDone} <span className="text-xl font-bold">von {weekBlocks.length}</span>
                </div>
                <div className="muted mt-1 text-sm">{weekBlocks.length ? 'Lernzeiten erledigt' : 'Noch keine Lernzeiten geplant'}</div>
              </div>
            </>
          )}
        </Tile>

        {/* ---------- Diese Woche ---------- */}
        <Tile i={4} className={`${neon ? 'tile' : 'tile-2'} col-span-2 flex flex-col md:col-span-3 lg:col-span-4`} onClick={() => onGo('liste')} label="Diese Woche">
          <span className="tag-label px-4 pt-4 md:px-5 md:pt-5">Diese Woche</span>
          <div className="mt-auto grid grid-cols-3">
            {[
              { n: weekTests, label: 'Tests' },
              { n: weekTasks, label: 'Aufgaben' },
              { n: overdue.length, label: 'Überfällig', alert: overdue.length > 0 },
            ].map((s, i) => (
              <div key={s.label} className={`flex flex-col justify-end px-4 pt-3 pb-4 md:px-5 md:pb-5 ${neon && i ? 'border-l border-(--line)' : ''}`}>
                <span className={`num text-4xl md:text-5xl ${s.alert ? 'text-red-600 dark:text-red-400' : ''}`}>{s.n}</span>
                <span className="muted mt-1 text-sm font-semibold">{s.label}</span>
              </div>
            ))}
          </div>
        </Tile>

        {/* ---------- Dein Tag ---------- */}
        <Tile i={5} className="col-span-2 md:col-span-6 lg:col-span-7" label="Dein Tag">
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
        <Tile i={6} className="col-span-2 md:col-span-6 lg:col-span-5" label="Als Nächstes">
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

/** Eintrag in "Dein Tag": Titel, Fach, Haken zum Abhaken */
function EntryCard({ entry, color, onOpen, onToggle, canEdit }: { entry: Entry; color: string; onOpen: () => void; onToggle: (done: boolean) => void; canEdit: boolean }) {
  const { subjectById } = useData()
  const { theme } = useTheme()
  return (
    <div className={`tile flex min-h-16 items-center gap-1 pr-2 ${entry.done ? 'opacity-70' : ''}`}>
      <button className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3.5 text-left" onClick={onOpen}>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[17px] font-bold ${entry.done ? 'muted line-through' : ''}`}>{entry.title}</span>
          <span className="mt-1 flex items-center gap-2 text-[13px]">
            <span
              className={`inline-flex h-[22px] items-center rounded-(--r-chip) px-2 text-xs font-bold ${theme === 'neon' ? 'font-mono uppercase' : ''}`}
              style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
            >
              {entry.subject_id ? subjectById.get(entry.subject_id)?.name : 'ohne Fach'}
            </span>
            <span className="muted">{{ test: 'Test', aufgabe: 'Aufgabe', event: 'Event', sonstiges: 'Sonstiges' }[entry.category]}</span>
          </span>
        </span>
      </button>
      <button
        className="grid h-11 w-11 shrink-0 place-items-center"
        aria-label={entry.done ? `${entry.title} als offen markieren` : `${entry.title} erledigt`}
        aria-pressed={entry.done}
        disabled={!canEdit}
        onClick={() => onToggle(!entry.done)}
      >
        <span
          className={`grid h-7 w-7 place-items-center border-2 ${theme === 'neon' ? 'rounded-md' : 'rounded-[10px]'} ${
            entry.done ? 'border-transparent bg-green-600 text-white' : 'border-(--line)'
          }`}
        >
          {entry.done && <Icon name="check" className="h-4 w-4" strokeWidth={3.4} />}
        </span>
      </button>
    </div>
  )
}

/** Ring mit einem Segment pro Lernzeit der Woche (erledigte in Fachfarbe) */
function WeekRing({ blocks, colorOf }: { blocks: StudyBlock[]; colorOf: (b: StudyBlock) => string }) {
  const r = 44
  const c = 2 * Math.PI * r
  const n = Math.max(blocks.length, 1)
  const slot = c / n
  const gap = blocks.length > 1 ? 4 : 0
  const done = blocks.filter((b) => b.done).length
  return (
    <div className="relative h-[116px] w-[116px] shrink-0">
      <svg viewBox="0 0 116 116" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="58" cy="58" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
        {blocks.map((b, i) =>
          b.done ? (
            <circle
              key={b.id}
              cx="58"
              cy="58"
              r={r}
              fill="none"
              stroke={colorOf(b)}
              strokeWidth="12"
              strokeDasharray={`${slot - gap} ${c - slot + gap}`}
              strokeDashoffset={-i * slot}
            />
          ) : null,
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <span>
          <span className="num block text-2xl">{blocks.length ? Math.round((done / blocks.length) * 100) : 0}%</span>
          <span className="muted block text-[11px] font-semibold">gelernt</span>
        </span>
      </div>
    </div>
  )
}


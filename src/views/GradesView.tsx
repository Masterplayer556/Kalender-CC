// Tab "Noten": Gesamtschnitt mit Verlauf, pro Fach ein eigener Graph, Zeugnisnote und Notenrechner.

import { useMemo, useState, type CSSProperties } from 'react'
import { useData } from '../data/DataProvider'
import { GradeChart, type ChartDot } from '../components/GradeChart'
import type { GradeRequest } from '../components/GradeEditor'
import { Icon } from '../components/Icon'
import { useTheme } from '../components/ThemeProvider'
import { loadPref, savePref } from '../lib/cache'
import { addDays, formatDate, todayKey, type DateKey } from '../lib/dates'
import {
  formatGrade,
  gradeClass,
  requiredGrade,
  roundToHalf,
  semesterOf,
  weightedAverage,
  type Weighted,
} from '../lib/grades'
import { overallTrend, runningAverage, trendDelta } from '../lib/gradeStats'
import { OVERALL, TARGET_OPTIONS, loadTargets, targetStatus, withTarget } from '../lib/targets'
import type { Grade, Subject } from '../types'

const ALL = 'alle'

/** Zeitraum eines Semesters: "2026-1" → 01.08.2026–31.01.2027, "2026-2" → 01.02.2027–31.07.2027 */
function semesterRange(key: string): [DateKey, DateKey] {
  const [y, half] = key.split('-').map(Number)
  return half === 1 ? [`${y}-08-01`, `${y + 1}-01-31`] : [`${y + 1}-02-01`, `${y + 1}-07-31`]
}

function GradeBadge({ value, big }: { value: number; big?: boolean }) {
  return (
    <span
      className={`grade-badge inline-flex items-center justify-center rounded-(--r-ctl) font-extrabold tabular-nums ${gradeClass(value)} ${
        big ? 'h-11 min-w-14 px-2.5 text-xl' : 'h-8 min-w-11 px-1.5 text-[15px]'
      }`}
    >
      {formatGrade(value)}
    </span>
  )
}

function Delta({ value }: { value: number | null }) {
  if (value === null || Math.abs(value) < 0.01) return null
  return (
    <span className={`grade-badge shrink-0 whitespace-nowrap rounded-(--r-chip) px-2 py-0.5 text-xs font-bold ${value > 0 ? 'grade-good' : 'grade-bad'}`}>
      {value > 0 ? '▲' : '▼'} {Math.abs(value).toFixed(2)}
    </span>
  )
}

/** Ziel wählen: sieht aus wie ein Chip, ist aber ein natives Auswahlfeld (gut bedienbar auf dem iPad) */
function TargetPicker({ value, onChange, onHero }: { value: number | undefined; onChange: (v: number | null) => void; onHero?: boolean }) {
  return (
    <label
      className={`chip relative min-h-9 cursor-pointer font-bold ${onHero ? 'border-transparent bg-white/15' : 'border-(--line) bg-(--surface)'}`}
    >
      <Icon name="target" className="h-4 w-4" />
      {value ? `Ziel ${formatGrade(value)}` : 'Ziel setzen'}
      <select
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Notenziel"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">kein Ziel</option>
        {TARGET_OPTIONS.map((t) => (
          <option key={t} value={t}>
            Ziel {formatGrade(t)}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Notenrechner für ein Fach: "Welche Note brauche ich?" */
function Calculator({ grades, initialTarget }: { grades: Weighted[]; initialTarget?: number }) {
  const { theme } = useTheme()
  const [targetText, setTargetText] = useState(String(initialTarget ?? 4.5))
  const [weightText, setWeightText] = useState('1')
  const [forReport, setForReport] = useState(true)

  const target = Number(targetText.replace(',', '.'))
  const weight = Number(weightText.replace(',', '.'))
  const valid = target >= 1 && target <= 6 && weight > 0
  // Für die Zeugnisnote reicht ein Schnitt, der aufgerundet wird: 4.5 im Zeugnis ab Schnitt 4.25
  const effectiveTarget = forReport ? target - 0.25 : target
  const needed = valid ? requiredGrade(grades, effectiveTarget, weight) : NaN
  const shown = Math.ceil(needed * 100 - 1e-9) / 100 // "mindestens": auf 2 Stellen aufrunden

  return (
    <div className="tile-2 mt-3 space-y-3 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="label">Ziel</span>
          <input className="input w-20!" inputMode="decimal" value={targetText} onChange={(e) => setTargetText(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="label">Gewicht nächste Prüfung</span>
          <input className="input w-20!" inputMode="decimal" value={weightText} onChange={(e) => setWeightText(e.target.value)} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-(--accent)" checked={forReport} onChange={(e) => setForReport(e.target.checked)} />
          als Zeugnisnote (gerundet)
        </label>
      </div>
      <div className={theme === 'neon' ? 'font-mono text-sm' : 'text-[15px]'}>
        {!valid && 'Ziel zwischen 1 und 6 und Gewicht grösser als 0 eingeben.'}
        {valid && needed > 6 && <>Mit einer Prüfung nicht erreichbar (bräuchte {formatGrade(shown)}).</>}
        {valid && needed <= 1 && <>Schon sicher – jede Note reicht.</>}
        {valid && needed > 1 && needed <= 6 && (
          <div className="flex items-center gap-4">
            <span className="num ink-accent text-5xl">{formatGrade(shown)}</span>
            <span className="font-semibold">
              brauchst du mindestens in der nächsten Prüfung
              {forReport ? ` für eine ${formatGrade(target)} im Zeugnis.` : ` für einen Schnitt von ${formatGrade(target)}.`}
              {theme === 'neon' && <span className="caret ml-1 inline-block h-4 w-2 bg-(--accent) align-[-2px]" />}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function SubjectCard({
  subject,
  grades,
  range,
  index,
  target,
  onTarget,
  onOpenGrade,
}: {
  subject: Subject
  grades: Grade[]
  range: [DateKey, DateKey] | undefined
  index: number
  target: number | undefined
  onTarget: (v: number | null) => void
  onOpenGrade: (req: GradeRequest) => void
}) {
  const { online } = useData()
  const { theme } = useTheme()
  const [showCalc, setShowCalc] = useState(false)
  const [showList, setShowList] = useState(false)
  const avg = weightedAverage(grades)!
  const sorted = [...grades].sort((a, b) => b.date.localeCompare(a.date))
  const line = runningAverage(grades)
  const dots: ChartDot[] = grades.map((g) => ({
    id: g.id,
    date: g.date,
    value: g.grade,
    weight: g.weight,
    label: `${g.title}: ${formatGrade(g.grade)} (${formatDate(g.date)})`,
  }))
  const delta = line.length > 1 ? line[line.length - 1].value - line[line.length - 2].value : null
  const best = Math.max(...grades.map((g) => g.grade))
  const worst = Math.min(...grades.map((g) => g.grade))
  const status = target ? targetStatus(grades, target) : null

  return (
    <li className="tile tile-in flex flex-col p-4 md:p-5" style={{ '--i': index } as CSSProperties}>
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-3.5 w-3.5 shrink-0 ${theme === 'neon' ? 'rounded-[3px]' : 'rounded-full'}`} style={{ background: subject.color }} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg leading-tight font-extrabold">{subject.name}</h3>
          <div className="muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span>
              Schnitt <strong className="text-(--ink) tabular-nums">{avg.toFixed(2)}</strong> · {grades.length} {grades.length === 1 ? 'Note' : 'Noten'}
            </span>
            <Delta value={delta} />
          </div>
        </div>
        <div className="flex flex-col items-center">
          <GradeBadge value={roundToHalf(avg)} big />
          <span className="muted mt-0.5 text-[10px] font-semibold tracking-wide uppercase">Zeugnis</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TargetPicker value={target} onChange={onTarget} />
        {status?.state === 'reached' && <span className="grade-good rounded-(--r-chip) px-2.5 py-1 text-xs font-bold">Ziel erreicht</span>}
        {status?.state === 'needs' && (
          <span className="text-sm font-semibold">
            nächste Prüfung <span className="ink-accent font-extrabold">≥ {formatGrade(status.grade)}</span>
          </span>
        )}
        {status?.state === 'out-of-reach' && (
          <span className="grade-bad rounded-(--r-chip) px-2.5 py-1 text-xs font-bold">mit einer Prüfung nicht erreichbar</span>
        )}
      </div>

      <div className="mt-2 -mx-1">
        <GradeChart
          line={line}
          dots={dots}
          color={subject.color}
          height={150}
          range={range}
          label={`Notenverlauf ${subject.name}`}
          onDot={(id) => onOpenGrade({ gradeId: id })}
          // Für die Zeugnisnote reicht ein Schnitt 0.25 darunter (wird aufgerundet)
          target={target ? { value: target - 0.25, label: `Ziel ${formatGrade(target)}` } : null}
        />
      </div>

      <div className="muted mt-1 flex justify-between px-1 text-xs font-semibold">
        <span>beste {formatGrade(best)}</span>
        <span>tiefste {formatGrade(worst)}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button className="btn-secondary px-2 text-sm" disabled={!online} onClick={() => onOpenGrade({ subjectId: subject.id })}>
          <Icon name="plus" className="h-4 w-4" /> Note
        </button>
        <button className="btn-secondary px-2 text-sm" aria-expanded={showList} onClick={() => setShowList(!showList)}>
          Liste
        </button>
        <button className="btn-secondary px-2 text-sm" aria-expanded={showCalc} onClick={() => setShowCalc(!showCalc)}>
          <Icon name="calc" className="h-4 w-4" /> Rechner
        </button>
      </div>

      {showList && (
        <ul className="mt-3 divide-y divide-(--line)">
          {sorted.map((g) => (
            <li key={g.id}>
              <button className="flex min-h-11 w-full items-center gap-3 py-1 text-left" onClick={() => onOpenGrade({ gradeId: g.id })}>
                <span className="muted w-20 shrink-0 text-sm tabular-nums">{formatDate(g.date).slice(0, 6)}</span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {g.title}
                  {g.entry_id && <Icon name="doc" className="muted ml-1.5 inline h-3.5 w-3.5 align-[-2px]" />}
                </span>
                {g.weight !== 1 && <span className="muted text-xs">{formatGrade(g.weight)}×</span>}
                <GradeBadge value={g.grade} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {showCalc && <Calculator grades={grades} initialTarget={target} />}
    </li>
  )
}

export function GradesView({
  onOpenGrade,
  onGoSubjects,
}: {
  onOpenGrade: (req: GradeRequest) => void
  onGoSubjects: () => void
}) {
  const { grades, gradesMissing, subjects, online } = useData()
  const { theme } = useTheme()
  const neon = theme === 'neon'
  const today = todayKey()
  const current = semesterOf(today)
  const [semester, setSemesterState] = useState<string>(() => loadPref('gradeSemester', current.key))
  const setSemester = (key: string) => {
    setSemesterState(key)
    savePref('gradeSemester', key)
  }
  const [targets, setTargets] = useState(loadTargets)
  const setTarget = (key: string, v: number | null) => setTargets((t) => withTarget(t, key, v))

  // Alle Semester, in denen es Noten gibt, plus das aktuelle – neueste zuerst
  const semesterOptions = useMemo(() => {
    const map = new Map([[current.key, current.label]])
    for (const g of grades) {
      const s = semesterOf(g.date)
      map.set(s.key, s.label)
    }
    return [...map].sort((a, b) => b[0].localeCompare(a[0]))
  }, [grades, current.key, current.label])

  const visible = semester === ALL ? grades : grades.filter((g) => semesterOf(g.date).key === semester)
  const bySubject = new Map<string, Grade[]>()
  for (const g of visible) bySubject.set(g.subject_id, [...(bySubject.get(g.subject_id) ?? []), g])
  const withGrades = subjects.filter((s) => bySubject.has(s.id))
  const withoutGrades = subjects.filter((s) => !bySubject.has(s.id))

  // Gesamtschnitt wie im Zeugnis: Durchschnitt der gerundeten Fachnoten
  const reportGrades = withGrades.map((s) => roundToHalf(weightedAverage(bySubject.get(s.id)!)!))
  const overall = reportGrades.length ? reportGrades.reduce((a, b) => a + b, 0) / reportGrades.length : null
  const rawOverall = withGrades.length
    ? withGrades.reduce((sum, s) => sum + weightedAverage(bySubject.get(s.id)!)!, 0) / withGrades.length
    : null
  const insufficient = reportGrades.filter((x) => x < 4).length
  const trend = overallTrend(visible)
  const delta = trendDelta(trend, addDays(today, -30))

  // Gemeinsame Zeitachse für alle Fach-Graphen: von der ersten Note bis heute (höchstens Semesterende)
  const range = useMemo((): [DateKey, DateKey] | undefined => {
    if (!visible.length) return undefined
    const dates = visible.map((g) => g.date).sort()
    let end = dates[dates.length - 1] > today ? dates[dates.length - 1] : today
    if (semester !== ALL) {
      const [, semEnd] = semesterRange(semester)
      if (end > semEnd) end = semEnd
    }
    return [dates[0], end]
  }, [visible, today, semester])

  if (gradesMissing) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="mx-auto max-w-xl space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <h2 className="font-semibold">Noten sind noch nicht eingerichtet</h2>
          <p className="text-sm">
            Führe im Supabase-Dashboard unter <strong>SQL Editor → New query</strong> den Inhalt der Datei{' '}
            <code>supabase/migrations/002_grades.sql</code> aus und lade die App danach neu.
          </p>
        </div>
      </div>
    )
  }

  if (subjects.length === 0) {
    return (
      <div className="h-full overflow-y-auto p-4 text-center">
        <p className="muted py-8">Lege zuerst ein Fach an, dann kannst du Noten eintragen.</p>
        <button className="btn-primary" onClick={onGoSubjects}>Fächer verwalten</button>
      </div>
    )
  }

  // Auf dem Sunset-Verlauf: helle Achsen. Bei Neon: normale Farben.
  const heroChartStyle = (neon
    ? {}
    : { '--chart-axis': 'rgb(255 255 255 / 0.85)', '--chart-grid': 'rgb(255 255 255 / 0.22)', '--chart-ring': '#be123c', '--chart-target': '#ffd5b8' }) as CSSProperties

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-4 px-4 pb-32 md:px-6 md:pb-10">
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto! font-semibold" value={semester} aria-label="Semester" onChange={(e) => setSemester(e.target.value)}>
            {semesterOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
                {key === current.key ? ' (aktuell)' : ''}
              </option>
            ))}
            <option value={ALL}>Alle Noten</option>
          </select>
          {withoutGrades.length > 0 && withGrades.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="muted">Noch ohne Noten:</span>
              {withoutGrades.map((s) => (
                <button key={s.id} className="chip border-(--line)" disabled={!online} onClick={() => onOpenGrade({ subjectId: s.id })}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.name} +
                </button>
              ))}
            </div>
          )}
        </div>

        {overall !== null && (
          <section className="tile-hero tile-in relative overflow-hidden p-5 md:p-6" aria-label="Gesamtschnitt">
            {!neon && <span aria-hidden className="absolute -top-24 -right-20 h-72 w-72 rounded-full bg-white/10" />}
            <div className="relative grid gap-5 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-end">
              <div>
                <div className={`tag-label ${neon ? 'ink-accent' : 'opacity-90'}`}>Gesamtschnitt</div>
                <div className="mt-2 flex items-end gap-3">
                  <span className="num text-[80px] md:text-[96px]">{overall.toFixed(2)}</span>
                  <span className="pb-3"><Delta value={delta} /></span>
                </div>
                <div className="mt-2 text-sm font-semibold opacity-85">
                  Ø der Zeugnisnoten · ungerundet {rawOverall!.toFixed(2)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <TargetPicker value={targets[OVERALL]} onChange={(v) => setTarget(OVERALL, v)} onHero={!neon} />
                  {targets[OVERALL] !== undefined &&
                    (overall >= targets[OVERALL] ? (
                      <span className="grade-good rounded-(--r-chip) px-2.5 py-1 text-xs font-bold">Ziel erreicht</span>
                    ) : (
                      <span className="text-sm font-bold">noch {(targets[OVERALL] - overall).toFixed(2)} bis zum Ziel</span>
                    ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <div className={`flex-1 rounded-(--r-ctl) px-3 py-2 ${neon ? 'border border-(--line)' : 'bg-white/15'}`}>
                    <div className="num text-2xl">{withGrades.length}</div>
                    <div className="text-xs font-semibold opacity-85">Fächer</div>
                  </div>
                  <div className={`flex-1 rounded-(--r-ctl) px-3 py-2 ${neon ? 'border border-(--line)' : 'bg-white/15'}`}>
                    <div className="num text-2xl">{visible.length}</div>
                    <div className="text-xs font-semibold opacity-85">Noten</div>
                  </div>
                  <div className={`flex-1 rounded-(--r-ctl) px-3 py-2 ${neon ? 'border border-(--line)' : 'bg-white/15'}`}>
                    <div className="num text-2xl">{insufficient}</div>
                    <div className="text-xs font-semibold opacity-85">unter 4</div>
                  </div>
                </div>
              </div>
              <div style={heroChartStyle}>
                {trend.length > 1 ? (
                  <GradeChart
                    line={trend}
                    color={neon ? 'var(--accent-text)' : '#ffffff'}
                    height={200}
                    range={range}
                    label="Verlauf des Gesamtschnitts"
                    target={targets[OVERALL] ? { value: targets[OVERALL], label: `Ziel ${formatGrade(targets[OVERALL])}` } : null}
                  />
                ) : (
                  <p className="text-sm font-semibold opacity-85">Der Verlauf erscheint ab der zweiten Note.</p>
                )}
              </div>
            </div>
            {/* Zeugnisnoten aller Fächer als Leiste */}
            <div className="relative mt-5 flex flex-wrap gap-2">
              {withGrades.map((s, i) => (
                <span
                  key={s.id}
                  className={`inline-flex items-center gap-2 rounded-(--r-chip) py-1 pr-1 pl-3 text-sm font-bold ${neon ? 'border border-(--line)' : 'bg-white/15'}`}
                >
                  {s.name}
                  <span className={`grade-badge rounded-(--r-chip) px-2 py-0.5 ${gradeClass(reportGrades[i])}`}>{formatGrade(reportGrades[i])}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {withGrades.length === 0 && (
          <p className="muted py-8 text-center">Noch keine Noten in diesem Zeitraum. Tippe auf „+“, um eine Note einzutragen.</p>
        )}

        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {withGrades.map((s, i) => (
            <SubjectCard
              key={s.id}
              subject={s}
              grades={bySubject.get(s.id)!}
              range={range}
              index={i + 1}
              target={targets[s.id]}
              onTarget={(v) => setTarget(s.id, v)}
              onOpenGrade={onOpenGrade}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}

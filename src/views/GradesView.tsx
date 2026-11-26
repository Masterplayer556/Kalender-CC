// Tab "Noten": Gesamtschnitt mit Verlauf, pro Fach ein eigener Graph, Zeugnisnote und Notenrechner,
// ganz unten die BM-Einschätzung (Kreuze für fachliche und persönliche Kompetenz).

import { useMemo, type CSSProperties } from 'react'
import { useData } from '../data/DataProvider'
import { BmSection } from '../components/BmSection'
import { CountUp } from '../components/CountUp'
import { GradeChart } from '../components/GradeChart'
import type { GradeRequest } from '../components/GradeEditor'
import { Delta } from '../components/grades/GradeBadges'
import { SubjectCard } from '../components/grades/SubjectCard'
import { TargetPicker } from '../components/grades/TargetPicker'
import { useTheme } from '../components/ThemeProvider'
import { addDays, todayKey, type DateKey } from '../lib/dates'
import {
  ALL_SEMESTERS,
  formatGrade,
  gradeClass,
  gradesInSemester,
  groupBySubject,
  overallAverage,
  pickSemester,
  semesterChoice,
  semesterOf,
  semesterRange,
} from '../lib/grades'
import { overallTrend, trendDelta } from '../lib/gradeStats'
import { OVERALL, asTargets, plannedTests, withTarget } from '../lib/targets'

const ALL = ALL_SEMESTERS

export function GradesView({
  onOpenGrade,
  onGoSubjects,
}: {
  onOpenGrade: (req: GradeRequest) => void
  onGoSubjects: () => void
}) {
  const { grades, gradesMissing, subjects, entries, gradesByEntry, online, prefs, setPref } = useData()
  const { theme } = useTheme()
  const neon = theme === 'neon'
  const today = todayKey()
  const current = semesterOf(today)
  // Gewähltes Semester: auf allen Geräten gleich (Einstellung "gradeSemester")
  const saved = prefs.gradeSemester
  const semester = pickSemester(saved, current.key)
  const setSemester = (key: string) => setPref('gradeSemester', semesterChoice(key, current.key))
  // Notenziele: auf allen Geräten gleich (Einstellung "gradeTargets")
  const targets = asTargets(prefs.gradeTargets)
  const setTarget = (key: string, v: number | null) => setPref('gradeTargets', withTarget(targets, key, v))

  // Alle Semester, in denen es Noten gibt, plus das aktuelle – neueste zuerst
  const semesterOptions = useMemo(() => {
    const map = new Map([[current.key, current.label]])
    for (const g of grades) {
      const s = semesterOf(g.date)
      map.set(s.key, s.label)
    }
    return [...map].sort((a, b) => b[0].localeCompare(a[0]))
  }, [grades, current.key, current.label])

  const visible = gradesInSemester(grades, semester)
  const bySubject = groupBySubject(visible)
  const withGrades = subjects.filter((s) => bySubject.has(s.id))
  const withoutGrades = subjects.filter((s) => !bySubject.has(s.id))

  // Gesamtschnitt wie im Zeugnis: Durchschnitt der gerundeten Fachnoten (lib/grades.ts, wie in der Heute-Kachel)
  const average = overallAverage(withGrades.flatMap((s) => bySubject.get(s.id)!))
  const overall = average?.overall ?? null
  const reportGrades = withGrades.map((s) => average!.reports.get(s.id)!)
  const insufficient = reportGrades.filter((x) => x < 4).length
  const trend = overallTrend(visible)
  const delta = trendDelta(trend, addDays(today, -30))

  // Tests im Kalender, die bis zum Ende des gewählten Semesters noch kommen und noch keine Note haben
  const planned = useMemo(
    () => plannedTests(entries, new Set(gradesByEntry.keys()), today, semesterRange(semester === ALL ? current.key : semester)[1]),
    [entries, gradesByEntry, today, semester, current.key],
  )

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
    : { '--chart-axis': 'rgb(255 255 255 / 0.9)', '--chart-grid': 'rgb(255 255 255 / 0.24)', '--chart-ring': '#c2185b', '--chart-target': '#ffe0b8' }) as CSSProperties

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
            <div className="relative grid gap-5 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-end">
              <div>
                <div className={`tag-label ${neon ? 'ink-accent' : 'opacity-90'}`}>Gesamtschnitt</div>
                <div className="mt-2 flex items-end gap-3">
                  <span className="num text-[80px] md:text-[96px]"><CountUp value={overall} format={(n) => n.toFixed(2)} /></span>
                  <span className="pb-3"><Delta value={delta} /></span>
                </div>
                <div className="mt-2 text-sm font-semibold opacity-85">
                  Ø der Zeugnisnoten · ungerundet {average!.raw.toFixed(2)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <TargetPicker value={targets[OVERALL]} onChange={(v) => setTarget(OVERALL, v)} onHero={!neon} />
                  {targets[OVERALL] !== undefined &&
                    (overall >= targets[OVERALL] ? (
                      <>
                        <span className="grade-good rounded-(--r-chip) px-2.5 py-1 text-xs font-bold">Ziel erreicht</span>
                        <span className="text-sm font-bold">Puffer {(overall - targets[OVERALL]).toFixed(2)}</span>
                      </>
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
              planned={planned.get(s.id) ?? []}
              onTarget={(v) => setTarget(s.id, v)}
              onOpenGrade={onOpenGrade}
            />
          ))}
        </ul>

        {/* BM-Einschätzung: bei "Alle Noten" gilt das aktuelle Semester */}
        <BmSection
          semester={semester === ALL ? current.key : semester}
          semesterLabel={semester === ALL ? current.label : (semesterOptions.find(([k]) => k === semester)?.[1] ?? current.label)}
          index={withGrades.length + 1}
        />
      </div>
    </div>
  )
}

// Tab "Noten": Noten pro Fach, gewichteter Schnitt, Zeugnisnote, Notenrechner.

import { useMemo, useState } from 'react'
import { useData } from '../data/DataProvider'
import type { GradeRequest } from '../components/GradeEditor'
import { Icon } from '../components/Icon'
import { loadPref, savePref } from '../lib/cache'
import { formatDate, todayKey } from '../lib/dates'
import {
  formatGrade,
  gradeClass,
  requiredGrade,
  roundToHalf,
  semesterOf,
  weightedAverage,
  type Weighted,
} from '../lib/grades'
import type { Grade, Subject } from '../types'

const ALL = 'alle'

function GradeBadge({ value, big }: { value: number; big?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg font-bold tabular-nums ${gradeClass(value)} ${
        big ? 'min-w-12 px-2 py-1 text-lg' : 'min-w-10 px-1.5 py-0.5'
      }`}
    >
      {formatGrade(value)}
    </span>
  )
}

/** Notenrechner für ein Fach: "Welche Note brauche ich?" */
function Calculator({ grades }: { grades: Weighted[] }) {
  const [targetText, setTargetText] = useState('4.5')
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
    <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
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
          <input type="checkbox" className="h-5 w-5" checked={forReport} onChange={(e) => setForReport(e.target.checked)} />
          als Zeugnisnote (gerundet)
        </label>
      </div>
      <p className="text-sm">
        {!valid && 'Ziel zwischen 1 und 6 und Gewicht grösser als 0 eingeben.'}
        {valid && needed > 6 && (
          <>❌ Mit einer Prüfung nicht erreichbar (bräuchte {formatGrade(shown)}).</>
        )}
        {valid && needed <= 1 && <>✅ Schon sicher – jede Note reicht.</>}
        {valid && needed > 1 && needed <= 6 && (
          <>
            Du brauchst mindestens <GradeBadge value={shown} /> in der nächsten Prüfung
            {forReport ? ` für eine ${formatGrade(target)} im Zeugnis.` : ` für einen Schnitt von ${formatGrade(target)}.`}
          </>
        )}
      </p>
    </div>
  )
}

function SubjectCard({
  subject,
  grades,
  onOpenGrade,
}: {
  subject: Subject
  grades: Grade[]
  onOpenGrade: (req: GradeRequest) => void
}) {
  const { online } = useData()
  const [showCalc, setShowCalc] = useState(false)
  const avg = weightedAverage(grades)!
  const sorted = [...grades].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <li
      className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      style={{ borderLeft: `6px solid ${subject.color}` }}
    >
      <div className="flex items-center gap-3">
        <h3 className="min-w-0 flex-1 truncate text-lg font-semibold">{subject.name}</h3>
        <div className="text-right text-sm text-slate-500">
          Schnitt <span className="font-semibold text-slate-900 tabular-nums dark:text-slate-100">{avg.toFixed(2)}</span>
        </div>
        <div className="flex flex-col items-center">
          <GradeBadge value={roundToHalf(avg)} big />
          <span className="text-[10px] text-slate-500">Zeugnis</span>
        </div>
      </div>

      <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
        {sorted.map((g) => (
          <li key={g.id}>
            <button className="flex min-h-11 w-full items-center gap-3 py-1 text-left" onClick={() => onOpenGrade({ gradeId: g.id })}>
              <span className="w-24 shrink-0 text-sm text-slate-500 tabular-nums">{formatDate(g.date)}</span>
              <span className="min-w-0 flex-1 truncate">
                {g.title}
                {g.entry_id && <span className="ml-1.5 text-xs" title="Mit Test im Kalender verknüpft">📝</span>}
              </span>
              {g.weight !== 1 && <span className="text-xs text-slate-500">{formatGrade(g.weight)}×</span>}
              <GradeBadge value={g.grade} />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex gap-2">
        <button className="btn-secondary flex-1" disabled={!online} onClick={() => onOpenGrade({ subjectId: subject.id })}>
          <Icon name="plus" /> Note
        </button>
        <button className="btn-secondary flex-1" aria-expanded={showCalc} onClick={() => setShowCalc(!showCalc)}>
          🧮 Notenrechner
        </button>
      </div>
      {showCalc && <Calculator grades={grades} />}
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
  const current = semesterOf(todayKey())
  const [semester, setSemesterState] = useState<string>(() => loadPref('gradeSemester', current.key))
  const setSemester = (key: string) => {
    setSemesterState(key)
    savePref('gradeSemester', key)
  }

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
  const insufficient = reportGrades.filter((x) => x < 4).length

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
        <p className="py-8 text-slate-500">Lege zuerst ein Fach an, dann kannst du Noten eintragen.</p>
        <button className="btn-primary" onClick={onGoSubjects}>Fächer verwalten</button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-3 pb-28">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input w-auto!"
            value={semester}
            aria-label="Semester"
            onChange={(e) => setSemester(e.target.value)}
          >
            {semesterOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
                {key === current.key ? ' (aktuell)' : ''}
              </option>
            ))}
            <option value={ALL}>Alle Noten</option>
          </select>
          {overall !== null && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Gesamtschnitt</span>
              <GradeBadge value={Math.round(overall * 100) / 100} big />
              {insufficient > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  {insufficient} {insufficient === 1 ? 'Fach' : 'Fächer'} unter 4
                </span>
              )}
            </div>
          )}
        </div>

        {withGrades.length === 0 && (
          <p className="py-8 text-center text-slate-500">
            Noch keine Noten in diesem Zeitraum. Tippe auf „+“, um eine Note einzutragen.
          </p>
        )}

        <ul className="space-y-3">
          {withGrades.map((s) => (
            <SubjectCard key={s.id} subject={s} grades={bySubject.get(s.id)!} onOpenGrade={onOpenGrade} />
          ))}
        </ul>

        {withoutGrades.length > 0 && withGrades.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            Noch ohne Noten:
            {withoutGrades.map((s) => (
              <button
                key={s.id}
                className="chip border-slate-300 dark:border-slate-700"
                disabled={!online}
                onClick={() => onOpenGrade({ subjectId: s.id })}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                {s.name} +
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

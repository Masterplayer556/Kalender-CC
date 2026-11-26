// Karte eines Fachs im Noten-Tab: Schnitt, Zeugnisnote, Ziel, Graph, Liste und Notenrechner.

import { useState, type CSSProperties } from 'react'
import { useData } from '../../data/DataProvider'
import { GradeChart, type ChartDot } from '../GradeChart'
import type { GradeRequest } from '../GradeEditor'
import { Icon } from '../Icon'
import { useTheme } from '../ThemeProvider'
import { formatDate, type DateKey } from '../../lib/dates'
import { formatGrade, roundToHalf, weightedAverage } from '../../lib/grades'
import { runningAverage } from '../../lib/gradeStats'
import { targetStatus } from '../../lib/targets'
import type { Entry, Grade, Subject } from '../../types'
import { Calculator } from './Calculator'
import { Delta, GradeBadge } from './GradeBadges'
import { TargetPicker } from './TargetPicker'

export function SubjectCard({
  subject,
  grades,
  range,
  index,
  target,
  planned,
  onTarget,
  onOpenGrade,
}: {
  subject: Subject
  grades: Grade[]
  planned: Entry[]
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
  // Kommen laut Kalender noch mehrere Tests, gilt die nötige Note für jeden davon
  const upcoming = Math.max(1, planned.length)
  const next = upcoming > 1 ? `nächste ${upcoming} Tests je` : 'nächste Prüfung'
  const status = target ? targetStatus(grades, target, upcoming) : null

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
        {status?.state === 'reached' && (
          <>
            <span className="grade-good rounded-(--r-chip) px-2.5 py-1 text-xs font-bold">Ziel erreicht</span>
            <span className="text-sm font-semibold">
              {status.keep === null ? (
                'hält auch mit einer 1'
              ) : (
                <>
                  halten: {next} <span className="ink-accent font-extrabold">≥ {formatGrade(status.keep)}</span>
                </>
              )}
            </span>
          </>
        )}
        {status?.state === 'needs' && (
          <span className="text-sm font-semibold">
            {next} <span className="ink-accent font-extrabold">≥ {formatGrade(status.grade)}</span>
          </span>
        )}
        {status?.state === 'out-of-reach' && (
          <span className="grade-bad rounded-(--r-chip) px-2.5 py-1 text-xs font-bold">{upcoming > 1 ? `mit ${upcoming} Tests nicht erreichbar` : 'mit einer Prüfung nicht erreichbar'}</span>
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
      {showCalc && <Calculator grades={grades} initialTarget={target} planned={planned} />}
    </li>
  )
}


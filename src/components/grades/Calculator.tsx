import { useState } from 'react'
import { useTheme } from '../ThemeProvider'
import { formatDate } from '../../lib/dates'
import { formatGrade, gradeClass, requiredGrade, type Weighted } from '../../lib/grades'
import { whatIf } from '../../lib/targets'
import type { Entry } from '../../types'

/** Notenrechner für ein Fach: "Welche Note brauche ich?" – auch für die geplanten Tests – und "Was wäre, wenn …" */
export function Calculator({ grades, initialTarget, planned }: { grades: Weighted[]; initialTarget?: number; planned: Entry[] }) {
  const { theme } = useTheme()
  const [targetText, setTargetText] = useState(String(initialTarget ?? 4.5))
  const [weightText, setWeightText] = useState('1')
  const [forReport, setForReport] = useState(true)
  const [guessText, setGuessText] = useState('')

  const target = Number(targetText.replace(',', '.'))
  const weight = Number(weightText.replace(',', '.'))
  const valid = target >= 1 && target <= 6 && weight > 0
  // Für die Zeugnisnote reicht ein Schnitt, der aufgerundet wird: 4.5 im Zeugnis ab Schnitt 4.25
  const effectiveTarget = forReport ? target - 0.25 : target
  const needed = valid ? requiredGrade(grades, effectiveTarget, weight) : NaN
  const shown = ceil2(needed) // "mindestens": auf 2 Stellen aufrunden
  const goal = forReport ? ` für eine ${formatGrade(target)} im Zeugnis` : ` für einen Schnitt von ${formatGrade(target)}`
  // Geplante Tests aus dem Kalender (je Gewicht 1): Welchen Schnitt braucht es in allen zusammen?
  const neededPlanned = valid && planned.length > 1 ? requiredGrade(grades, effectiveTarget, planned.length) : NaN
  // Was wäre, wenn: erwartete Note für die nächste Prüfung (mit dem Gewicht oben)
  const guess = Number(guessText.replace(',', '.'))
  const guessValid = guessText.trim() !== '' && guess >= 1 && guess <= 6 && weight > 0
  const after = guessValid ? whatIf(grades, guess, weight) : null
  const mono = theme === 'neon' ? 'font-mono text-sm' : 'text-[15px]'

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
      <div className={mono}>
        {!valid && 'Ziel zwischen 1 und 6 und Gewicht grösser als 0 eingeben.'}
        {valid && needed > 6 && <>Mit einer Prüfung nicht erreichbar (bräuchte {formatGrade(shown)}).</>}
        {valid && needed <= 1 && <>Schon sicher – jede Note reicht.</>}
        {valid && needed > 1 && needed <= 6 && (
          <div className="flex items-center gap-4">
            <span className="num ink-accent text-5xl">{formatGrade(shown)}</span>
            <span className="font-semibold">
              brauchst du mindestens in der nächsten Prüfung{goal}.
              {theme === 'neon' && <span className="caret ml-1 inline-block h-4 w-2 bg-(--accent) align-[-2px]" />}
            </span>
          </div>
        )}
      </div>

      {planned.length > 0 && (
        <div className={`border-t border-(--line) pt-3 ${mono}`}>
          <div className="font-semibold">
            {planned.length === 1 ? 'Geplant bis Semesterende: 1 Test' : `Geplant bis Semesterende: ${planned.length} Tests`}
          </div>
          <ul className="muted mt-1 text-sm">
            {planned.map((e) => (
              <li key={e.id}>
                {formatDate(e.date).slice(0, 6)} · {e.title}
              </li>
            ))}
          </ul>
          {valid && planned.length > 1 && (
            <p className="mt-2 font-semibold">
              {neededPlanned > 6
                ? `Auch mit allen ${planned.length} Tests nicht erreichbar (bräuchte je ${formatGrade(ceil2(neededPlanned))}).`
                : neededPlanned <= 1
                  ? `Mit den ${planned.length} Tests schon sicher – jede Note reicht.`
                  : <>In den {planned.length} Tests je mindestens <span className="ink-accent font-extrabold">{formatGrade(ceil2(neededPlanned))}</span> (bzw. im Schnitt){goal}.</>}
            </p>
          )}
        </div>
      )}

      <div className={`border-t border-(--line) pt-3 ${mono}`}>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">Was wäre, wenn ich in der nächsten Prüfung eine</span>
          <input
            className="input w-20!"
            inputMode="decimal"
            placeholder="z. B. 5"
            aria-label="Erwartete Note"
            value={guessText}
            onChange={(e) => setGuessText(e.target.value)}
          />
          <span className="font-semibold">schreibe?</span>
        </label>
        {after && (
          <p className="mt-2">
            Neuer Schnitt <strong className="tabular-nums">{after.average.toFixed(2)}</strong> → Zeugnis{' '}
            <span className={`grade-badge rounded-(--r-chip) px-2 py-0.5 font-bold ${gradeClass(after.report)}`}>{formatGrade(after.report)}</span>
          </p>
        )}
        {guessText.trim() !== '' && !guessValid && <p className="muted mt-2 text-sm">Note zwischen 1 und 6 eingeben.</p>}
      </div>
    </div>
  )
}

/** Auf Hundertstel aufrunden ("mindestens") */
function ceil2(x: number): number {
  return Math.ceil(x * 100 - 1e-9) / 100
}


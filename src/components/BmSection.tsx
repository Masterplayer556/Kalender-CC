// BM-Einschätzung ganz unten im Noten-Tab: Fächer waagerecht, darunter je ein Feld für fachliche und
// persönliche Kompetenz. Jedes Feld ist Ja, Nein oder noch offen. Ziel: 6 × Ja.
// Gespeichert pro Semester in Supabase (Tabelle bm_ratings), also auf allen Geräten gleich.

import type { CSSProperties } from 'react'
import { useData } from '../data/DataProvider'
import { useTheme } from './ThemeProvider'
import { useToast } from './Toast'
import { Icon } from './Icon'
import {
  BM_GOAL,
  BM_KINDS,
  BM_NO,
  BM_SUBJECTS,
  BM_YES,
  bmGoalState,
  bmHasData,
  bmSheet,
  bmTotals,
  matchSubject,
  previousSemester,
  toggleValue,
} from '../lib/bm'
import type { BmKind, BmSubject } from '../types'

/** Unterschied zum letzten Semester (Anzahl Ja) */
function Change({ value }: { value: number }) {
  if (value === 0) return null
  return (
    <span
      className={`grade-badge rounded-(--r-chip) px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${value > 0 ? 'grade-good' : 'grade-bad'}`}
      title="Ja im Vergleich zum letzten Semester"
    >
      {value > 0 ? '▲' : '▼'} {Math.abs(value)}
    </span>
  )
}

export function BmSection({ semester, semesterLabel, index }: { semester: string; semesterLabel: string; index: number }) {
  const { bm, bmMissing, subjects, online, saveBm } = useData()
  const { theme } = useTheme()
  const toast = useToast()
  const neon = theme === 'neon'

  const sheet = bmSheet(bm, semester)
  const totals = bmTotals(sheet)
  const goal = bmGoalState(sheet)
  const prevSheet = bmSheet(bm, previousSemester(semester))
  const hasPrev = bmHasData(prevSheet)
  const prevTotals = bmTotals(prevSheet)

  const choose = (subject: BmSubject, kind: BmKind, chosen: typeof BM_YES | typeof BM_NO) => {
    const next = { ...sheet[subject], [kind]: toggleValue(sheet[subject][kind], chosen) }
    saveBm(semester, subject, next.fach, next.pers).catch((err: Error) => toast({ message: err.message }))
  }

  return (
    <section className="tile tile-in p-4 md:p-5" style={{ '--i': index } as CSSProperties} aria-label="BM-Einschätzung">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="tag-label ink-accent">BM</div>
          <h2 className="section-title mt-0.5">Kompetenzen</h2>
          <p className="muted mt-1 text-sm">{semesterLabel}</p>
        </div>
        {!bmMissing && (
          <div className="text-right">
            <div className="flex items-end justify-end gap-2">
              {hasPrev && <span className="pb-1"><Change value={totals.yes - prevTotals.yes} /></span>}
              <span className="num text-5xl">{totals.yes}</span>
              <span className="muted pb-1 text-lg font-bold">/ {BM_GOAL}</span>
            </div>
            <div className="muted mt-1 text-xs font-semibold">Ja · Ziel {BM_GOAL}</div>
          </div>
        )}
      </div>

      {bmMissing ? (
        <div className="mt-4 rounded-(--r-ctl) border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          Noch nicht eingerichtet: Führe im Supabase-Dashboard unter <strong>SQL Editor → New query</strong> den Inhalt von{' '}
          <code>supabase/migrations/006_bm.sql</code> aus und lade die App neu.
        </div>
      ) : (
        <>
          {/* Fortschritt zum Ziel */}
          <div className="mt-3">
            <div className="progress-cells bm-goal" aria-hidden>
              {Array.from({ length: BM_GOAL }, (_, i) => (
                <span key={i} className={i < totals.yes ? 'on' : ''} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
              {goal === 'reached' && <span className="grade-good rounded-(--r-chip) px-2.5 py-0.5 font-bold">Ziel erreicht 🎉</span>}
              {goal === 'possible' && (
                <span>
                  noch <strong className="ink-accent">{BM_GOAL - totals.yes} × Ja</strong> bis zum Ziel
                </span>
              )}
              {goal === 'lost' && (
                <span className="grade-bad rounded-(--r-chip) px-2.5 py-0.5 font-bold">Ziel nicht mehr erreichbar (zu viele Nein)</span>
              )}
              <span className="muted text-xs">
                {totals.no} Nein · {totals.open} offen
                {hasPrev && ` · letztes Semester ${prevTotals.yes} Ja`}
              </span>
            </div>
          </div>

          {/* Tabelle: Fächer waagerecht, Kompetenzen als Zeilen */}
          <div className="bm-grid mt-4" role="table" aria-label="BM-Kompetenzen pro Fach">
            <div role="row" className="contents">
              <span role="columnheader" />
              {BM_SUBJECTS.map((s) => {
                const color = matchSubject(subjects, s.match)?.color
                return (
                  <div key={s.key} role="columnheader" className="min-w-0 pb-1 text-center">
                    {/* Handy: Punkt über dem Namen (sonst zu schmal), ab Tablet daneben */}
                    <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-center sm:gap-1.5">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 ${neon ? 'rounded-[2px]' : 'rounded-full'}`}
                        style={{ background: color ?? 'var(--accent)' }}
                      />
                      <span className="max-w-full truncate text-[12.5px] font-extrabold sm:text-base">{s.name}</span>
                    </div>
                    <div className="muted truncate text-[10px] font-semibold sm:text-xs">{s.detail ?? ' '}</div>
                  </div>
                )
              })}
            </div>
            {BM_KINDS.map((k) => (
              <div key={k.key} role="row" className="contents">
                <div role="rowheader" className="min-w-0">
                  <div className="text-[13px] leading-tight font-bold sm:text-sm">{k.short}</div>
                  <div className="muted text-[11px] font-semibold tabular-nums">
                    {totals[k.key]}/{BM_SUBJECTS.length} Ja
                  </div>
                </div>
                {BM_SUBJECTS.map((s) => {
                  const value = sheet[s.key][k.key]
                  return (
                    <div key={s.key} role="cell" className="bm-choice" aria-label={`${s.name} ${k.label}`}>
                      <button
                        type="button"
                        className={`bm-opt yes ${value === BM_YES ? 'on' : ''}`}
                        aria-pressed={value === BM_YES}
                        aria-label={`${s.name} ${k.short}: Ja`}
                        disabled={!online}
                        onClick={() => choose(s.key, k.key, BM_YES)}
                      >
                        <Icon name="check" className="hidden h-3.5 w-3.5 sm:block" strokeWidth={3} />
                        Ja
                      </button>
                      <button
                        type="button"
                        className={`bm-opt no ${value === BM_NO ? 'on' : ''}`}
                        aria-pressed={value === BM_NO}
                        aria-label={`${s.name} ${k.short}: Nein`}
                        disabled={!online}
                        onClick={() => choose(s.key, k.key, BM_NO)}
                      >
                        <Icon name="close" className="hidden h-3.5 w-3.5 sm:block" strokeWidth={3} />
                        Nein
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <p className="muted mt-3 text-xs font-semibold">Tippe auf Ja oder Nein. Nochmals tippen macht das Feld wieder offen.</p>
        </>
      )}
    </section>
  )
}

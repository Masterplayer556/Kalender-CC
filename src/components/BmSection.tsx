// BM-Einschätzung ganz unten im Noten-Tab: pro Fach ein Kreuz für fachliche und eins für persönliche Kompetenz.
// Gespeichert pro Semester in Supabase (Tabelle bm_ratings), also auf allen Geräten gleich.

import type { CSSProperties } from 'react'
import { useData } from '../data/DataProvider'
import { useTheme } from './ThemeProvider'
import { useToast } from './Toast'
import { Icon } from './Icon'
import { BM_KINDS, BM_SUBJECTS, bmHasData, bmMissingCrosses, bmSheet, bmTotals, matchSubject, previousSemester } from '../lib/bm'
import type { BmKind, BmSubject } from '../types'

/** Unterschied zum letzten Semester (nur wenn es dort Kreuze gab) */
function Change({ value }: { value: number }) {
  if (value === 0) return null
  return (
    <span
      className={`grade-badge rounded-(--r-chip) px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${value > 0 ? 'grade-good' : 'grade-bad'}`}
      title="im Vergleich zum letzten Semester"
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
  const prevSheet = bmSheet(bm, previousSemester(semester))
  const hasPrev = bmHasData(prevSheet)
  const prevTotals = bmTotals(prevSheet)
  const missing = bmMissingCrosses(sheet)

  const toggle = (subject: BmSubject, kind: BmKind) => {
    const next = { ...sheet[subject], [kind]: sheet[subject][kind] ? 0 : 1 }
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
              {hasPrev && <span className="pb-1"><Change value={totals.total - prevTotals.total} /></span>}
              <span className="num text-5xl">{totals.total}</span>
              <span className="muted pb-1 text-lg font-bold">/ {totals.max}</span>
            </div>
            <div className="muted mt-1 text-xs font-semibold">Kreuze</div>
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
          <div className="mt-4">
            <div className="bm-row muted border-b border-(--line) pb-2 text-xs font-bold tracking-wide uppercase">
              <span>Fach</span>
              {BM_KINDS.map((k) => (
                <span key={k.key} className="text-center">
                  {k.short}
                  <span className="block text-[11px] tabular-nums normal-case">
                    {totals[k.key]}/{BM_SUBJECTS.length}
                  </span>
                </span>
              ))}
            </div>
            <ul className="divide-y divide-(--line)">
              {BM_SUBJECTS.map((s) => {
                const color = matchSubject(subjects, s.match)?.color
                return (
                  <li key={s.key} className="bm-row py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`h-3 w-3 shrink-0 ${neon ? 'rounded-[3px]' : 'rounded-full'}`}
                        style={{ background: color ?? 'var(--accent)' }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-extrabold">{s.name}</span>
                        {s.detail && <span className="muted block truncate text-xs font-semibold">{s.detail}</span>}
                      </span>
                    </div>
                    {BM_KINDS.map((k) => {
                      const on = sheet[s.key][k.key] === 1
                      return (
                        <div key={k.key} className="flex justify-center">
                          <button
                            type="button"
                            className={`bm-cross ${k.key} ${on ? 'on' : ''}`}
                            aria-pressed={on}
                            aria-label={`${s.name} ${k.label}`}
                            disabled={!online}
                            onClick={() => toggle(s.key, k.key)}
                          >
                            <Icon name="close" className="h-5 w-5" strokeWidth={3} />
                          </button>
                        </div>
                      )
                    })}
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="muted mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs font-semibold">
            {missing.length === 0 ? (
              <span className="grade-good rounded-(--r-chip) px-2.5 py-1 font-bold">Alle 8 Kreuze 🎉</span>
            ) : (
              <span>
                Noch offen: <strong className="text-(--ink)">{missing.join(', ')}</strong>
              </span>
            )}
            {hasPrev && <span>Letztes Semester: {prevTotals.total} / {prevTotals.max}</span>}
          </div>
        </>
      )}
    </section>
  )
}

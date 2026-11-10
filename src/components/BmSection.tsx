// BM-Einschätzung ganz unten im Noten-Tab: pro Fach je 4 Kreuze für fachliche und persönliche Kompetenz.
// Gespeichert pro Semester in Supabase (Tabelle bm_ratings), also auf allen Geräten gleich.

import type { CSSProperties } from 'react'
import { useData } from '../data/DataProvider'
import { useTheme } from './ThemeProvider'
import { useToast } from './Toast'
import { Icon } from './Icon'
import {
  BM_KINDS,
  BM_MAX,
  BM_SUBJECTS,
  bmHasData,
  bmSheet,
  bmTotals,
  matchSubject,
  previousSemester,
  toggleCross,
  type BmScore,
} from '../lib/bm'
import type { BmKind, BmSubject } from '../types'

/** 4 Kreuz-Felder einer Kompetenz */
function Crosses({
  kind,
  value,
  label,
  disabled,
  onChange,
}: {
  kind: BmKind
  value: number
  label: string
  disabled: boolean
  onChange: (v: number) => void
}) {
  return (
    <div role="group" aria-label={`${label}: ${value} von ${BM_MAX}`} className="flex gap-1">
      {Array.from({ length: BM_MAX }, (_, i) => {
        const n = i + 1
        const on = n <= value
        return (
          <button
            key={n}
            type="button"
            className={`bm-cross ${kind} ${on ? 'on' : ''}`}
            aria-pressed={on}
            aria-label={`${label} ${n}`}
            disabled={disabled}
            onClick={() => onChange(toggleCross(value, n))}
          >
            <Icon name="close" className="h-4 w-4" strokeWidth={3} />
          </button>
        )
      })}
    </div>
  )
}

/** Unterschied zum letzten Semester (nur wenn es dort Kreuze gab) */
function Change({ value }: { value: number | null }) {
  if (value === null || value === 0) return null
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
  const prevKey = previousSemester(semester)
  const prevSheet = bmSheet(bm, prevKey)
  // Pro Fach nur vergleichen, wenn es letztes Semester für dieses Fach Kreuze gab
  const prevRated = new Set(bm.filter((r) => r.semester === prevKey && r.fach + r.pers > 0).map((r) => r.subject))
  const hasPrev = bmHasData(prevSheet)
  const prevTotals = bmTotals(prevSheet)
  const filled = bmHasData(sheet)

  // Wo fehlen am meisten Kreuze? (nur zeigen, wenn schon etwas eingetragen ist und nicht alles voll ist)
  const sum = (s: BmScore) => s.fach + s.pers
  const weakest = filled && totals.total < totals.max
    ? BM_SUBJECTS.reduce((a, b) => (sum(sheet[b.key]) < sum(sheet[a.key]) ? b : a))
    : null

  const change = (subject: BmSubject, kind: BmKind, v: number) => {
    const next = { ...sheet[subject], [kind]: v }
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
        {!bmMissing && <div className="text-right">
          <div className="flex items-end justify-end gap-2">
            {hasPrev && <span className="pb-1"><Change value={totals.total - prevTotals.total} /></span>}
            <span className="num text-5xl">{totals.total}</span>
            <span className="muted pb-1 text-lg font-bold">/ {totals.max}</span>
          </div>
          <div className="muted mt-1 text-xs font-semibold">Kreuze total</div>
        </div>}
      </div>

      {bmMissing ? (
        <div className="mt-4 rounded-(--r-ctl) border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          Noch nicht eingerichtet: Führe im Supabase-Dashboard unter <strong>SQL Editor → New query</strong> den Inhalt von{' '}
          <code>supabase/migrations/006_bm.sql</code> aus und lade die App neu.
        </div>
      ) : (
        <>
          {/* Summen pro Kompetenz als Kästchen-Leiste */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {BM_KINDS.map((k) => {
              const value = totals[k.key]
              const max = BM_SUBJECTS.length * BM_MAX
              return (
                <div key={k.key} className={`rounded-(--r-ctl) px-3 py-2.5 ${neon ? 'border border-(--line)' : 'bg-(--surface-2)'}`}>
                  <div className="flex items-baseline justify-between text-sm font-semibold">
                    <span>{k.label}</span>
                    <span className="tabular-nums">
                      <strong>{value}</strong>
                      <span className="muted"> / {max}</span>
                    </span>
                  </div>
                  <div className={`progress-cells bm-bar ${k.key} muted mt-2`} aria-hidden>
                    {Array.from({ length: max }, (_, i) => (
                      <span key={i} className={i < value ? 'on' : ''} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tabelle */}
          <div className="mt-4">
            <div className="bm-row muted hidden border-b border-(--line) pb-2 text-xs font-bold tracking-wide uppercase sm:grid">
              <span style={{ gridArea: 'name' }}>Fach</span>
              <span style={{ gridArea: 'fach' }}>Fachlich</span>
              <span style={{ gridArea: 'pers' }}>Persönlich</span>
              <span className="text-right" style={{ gridArea: 'total' }}>Total</span>
            </div>
            <ul className="divide-y divide-(--line)">
              {BM_SUBJECTS.map((s) => {
                const score = sheet[s.key]
                const color = matchSubject(subjects, s.match)?.color
                const prev = prevRated.has(s.key) ? sum(prevSheet[s.key]) : null
                return (
                  <li key={s.key} className="bm-row py-3">
                    <div className="flex min-w-0 items-center gap-2.5" style={{ gridArea: 'name' }}>
                      <span
                        className={`h-3 w-3 shrink-0 ${neon ? 'rounded-[3px]' : 'rounded-full'}`}
                        style={{ background: color ?? 'var(--accent)' }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-extrabold">{s.name}</span>
                        {s.detail && <span className="muted block truncate text-xs font-semibold">{s.detail}</span>}
                      </span>
                    </div>
                    {BM_KINDS.map((k) => (
                      <div key={k.key} style={{ gridArea: k.key }}>
                        <div className="muted mb-1 text-[10px] font-bold tracking-wide uppercase sm:hidden">{k.short}</div>
                        <Crosses
                          kind={k.key}
                          value={score[k.key]}
                          label={`${s.name} ${k.short}`}
                          disabled={!online}
                          onChange={(v) => change(s.key, k.key, v)}
                        />
                      </div>
                    ))}
                    <div className="flex items-center justify-end gap-1.5" style={{ gridArea: 'total' }}>
                      {prev !== null && <Change value={sum(score) - prev} />}
                      <span className="tabular-nums">
                        <strong className="text-lg">{sum(score)}</strong>
                        <span className="muted text-sm"> / {BM_MAX * 2}</span>
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="muted mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs font-semibold">
            <span>Tippe auf ein Kreuz, um bis dorthin zu füllen. Nochmals tippen nimmt es weg.</span>
            {weakest && <span>Am meisten Luft nach oben: <strong className="text-(--ink)">{weakest.name}</strong></span>}
            {hasPrev && <span>Letztes Semester: {prevTotals.total} / {prevTotals.max}</span>}
          </div>
        </>
      )}
    </section>
  )
}

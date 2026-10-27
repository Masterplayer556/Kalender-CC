// Dialog "Neue Ferien / freie Tage" bzw. Zeitraum bearbeiten.

import { useState, type FormEvent } from 'react'
import { useData } from '../data/DataProvider'
import { addDays, daysBetween, formatDate, formatWeekday, todayKey, type DateKey } from '../lib/dates'
import { PERIOD_KINDS, PERIOD_KIND_KEYS, periodLength } from '../lib/periods'
import type { PeriodKind } from '../types'
import { Modal } from './Modal'
import { useToast } from './Toast'

export interface PeriodRequest {
  periodId?: string // bestehenden Zeitraum bearbeiten
  date?: DateKey // vorausgefüllter Beginn
}

/** Schnellwahl für die Dauer: so viele Tage ab Beginn (beide Enden mitgezählt) */
const LENGTH_PRESETS = [
  { label: '1 Tag', days: 1 },
  { label: '1 Woche', days: 7 },
  { label: '2 Wochen', days: 14 },
  { label: '5 Wochen', days: 35 },
]

export function PeriodEditor({ request, onClose }: { request: PeriodRequest; onClose: () => void }) {
  const { periods, online, savePeriod, deletePeriod, restorePeriod } = useData()
  const showToast = useToast()
  const existing = request.periodId ? periods.find((p) => p.id === request.periodId) : undefined

  const [kind, setKind] = useState<PeriodKind>(existing?.kind ?? 'ferien')
  const [name, setName] = useState(existing?.name ?? '')
  const initialStart = existing?.start_date ?? request.date ?? todayKey()
  const [start, setStart] = useState<DateKey>(initialStart)
  const [end, setEnd] = useState<DateKey>(existing?.end_date ?? addDays(initialStart, 6))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const readOnly = !online || saving
  const valid = end >= start
  const length = valid ? periodLength({ start_date: start, end_date: end }) : 0

  /** Beginn verschieben: Die Dauer bleibt gleich, das Ende wandert mit. */
  function changeStart(next: DateKey) {
    if (valid) setEnd(addDays(next, daysBetween(start, end)))
    setStart(next)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!valid) return setError('Das Ende muss am oder nach dem Beginn liegen.')
    setSaving(true)
    setError(null)
    try {
      // Ohne Namen heisst der Zeitraum wie seine Art ("Ferien")
      await savePeriod(existing?.id ?? null, {
        name: name.trim() || PERIOD_KINDS[kind].label,
        kind,
        start_date: start,
        end_date: end,
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  /** Löscht sofort und bietet einige Sekunden lang "Rückgängig" an. */
  async function handleDelete() {
    if (!existing) return
    setSaving(true)
    try {
      await deletePeriod(existing.id)
      onClose()
      showToast({
        message: `„${existing.name}“ gelöscht`,
        action: { label: 'Rückgängig', run: () => restorePeriod(existing) },
      })
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  const meta = PERIOD_KINDS[kind]

  return (
    <Modal
      title={existing ? `${meta.icon} ${existing.name}` : 'Ferien & freie Tage'}
      onClose={onClose}
      footer={
        <>
          {existing && (
            <button type="button" className="btn-danger" onClick={handleDelete} disabled={readOnly}>
              Löschen
            </button>
          )}
          <div className="flex-1" />
          <button type="button" className="btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" form="period-form" className="btn-primary" disabled={readOnly}>
            {saving ? 'Speichert …' : 'Speichern'}
          </button>
        </>
      }
    >
      {!online && (
        <p className="mb-4 rounded-xl bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Offline – Änderungen nicht möglich.
        </p>
      )}

      <form id="period-form" onSubmit={handleSave} className="space-y-4">
        <div>
          <span className="label">Art</span>
          <div className="segment flex-wrap">
            {PERIOD_KIND_KEYS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} disabled={readOnly} onClick={() => setKind(k)}>
                {PERIOD_KINDS[k].icon} {PERIOD_KINDS[k].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="period-name">Name</label>
          <input
            id="period-name"
            className="input"
            value={name}
            disabled={readOnly}
            placeholder={meta.placeholder}
            autoFocus={!existing}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="period-start">Von</label>
            <input
              id="period-start"
              type="date"
              className="input"
              value={start}
              disabled={readOnly}
              onChange={(e) => e.target.value && changeStart(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="period-end">Bis (inklusive)</label>
            <input
              id="period-end"
              type="date"
              className="input"
              value={end}
              min={start}
              disabled={readOnly}
              onChange={(e) => e.target.value && setEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Dauer:</span>
          {LENGTH_PRESETS.map((preset) => (
            <button
              key={preset.days}
              type="button"
              className={`chip ${
                length === preset.days
                  ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                  : 'border-slate-300 dark:border-slate-700'
              }`}
              disabled={readOnly}
              onClick={() => setEnd(addDays(start, preset.days - 1))}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Zusammenfassung – so sieht man sofort, ob Wochentage und Länge stimmen */}
        <p
          className="rounded-xl p-3 text-sm"
          style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, borderLeft: `4px solid ${meta.color}` }}
        >
          {valid ? (
            <>
              {meta.icon} {formatWeekday(start)}, {formatDate(start)}
              {end !== start && ` – ${formatWeekday(end)}, ${formatDate(end)}`}
              <span className="text-slate-500">
                {' '}
                · {length} {length === 1 ? 'Tag' : 'Tage'}
              </span>
            </>
          ) : (
            'Das Ende liegt vor dem Beginn.'
          )}
        </p>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}

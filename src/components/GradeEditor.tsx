// Dialog "Neue Note" / "Note bearbeiten".

import { useState, type FormEvent } from 'react'
import { useData } from '../data/DataProvider'
import { formatGrade } from '../lib/grades'
import { todayKey } from '../lib/dates'
import { Modal } from './Modal'
import { useToast } from './Toast'

export interface GradeRequest {
  gradeId?: string // bestehende Note bearbeiten
  subjectId?: string // vorausgewähltes Fach (z. B. "+ Note" in der Fach-Karte)
}

/** "4,75" oder "4.75" → 4.75; ungültig → NaN */
function parseDecimal(text: string): number {
  return text.trim() === '' ? NaN : Number(text.trim().replace(',', '.'))
}

const WEIGHT_PRESETS = [0.5, 1, 2]

export function GradeEditor({ request, onClose }: { request: GradeRequest; onClose: () => void }) {
  const { grades, subjects, online, saveGrade, deleteGrade, restoreGrade } = useData()
  const showToast = useToast()
  const existing = request.gradeId ? grades.find((g) => g.id === request.gradeId) : undefined

  const [subjectId, setSubjectId] = useState(existing?.subject_id ?? request.subjectId ?? subjects[0]?.id ?? '')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [date, setDate] = useState(existing?.date ?? todayKey())
  const [gradeText, setGradeText] = useState(existing ? formatGrade(existing.grade) : '')
  const [weightText, setWeightText] = useState(existing ? formatGrade(existing.weight) : '1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const readOnly = !online || saving

  function validate(): string | null {
    if (!subjectId) return 'Bitte wähle ein Fach.'
    if (!title.trim()) return 'Bitte gib einen Titel ein (z. B. „Test Erster Weltkrieg“).'
    const grade = parseDecimal(gradeText)
    if (Number.isNaN(grade) || grade < 1 || grade > 6) return 'Die Note muss zwischen 1 und 6 liegen.'
    const weight = parseDecimal(weightText)
    if (Number.isNaN(weight) || weight <= 0 || weight > 100) return 'Die Gewichtung muss grösser als 0 sein.'
    return null
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const problem = validate()
    if (problem) return setError(problem)
    setSaving(true)
    setError(null)
    try {
      await saveGrade(existing?.id ?? null, {
        subject_id: subjectId,
        title: title.trim(),
        date,
        grade: parseDecimal(gradeText),
        weight: parseDecimal(weightText),
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    setSaving(true)
    try {
      await deleteGrade(existing.id)
      onClose()
      showToast({
        message: `Note „${existing.title}“ gelöscht`,
        action: { label: 'Rückgängig', run: () => restoreGrade(existing) },
      })
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <Modal
      title={existing ? 'Note bearbeiten' : 'Neue Note'}
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
          <button type="submit" form="grade-form" className="btn-primary" disabled={readOnly}>
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

      <form id="grade-form" onSubmit={handleSave} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="g-subject">Fach</label>
            <select
              id="g-subject"
              className="input"
              value={subjectId}
              disabled={readOnly}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="g-date">Datum</label>
            <input
              id="g-date"
              type="date"
              className="input"
              value={date}
              disabled={readOnly}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="g-title">Titel</label>
          <input
            id="g-title"
            className="input"
            value={title}
            disabled={readOnly}
            placeholder="z. B. Test Erster Weltkrieg"
            autoFocus={!existing}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="g-grade">Note (1–6)</label>
            <input
              id="g-grade"
              className="input text-lg font-semibold"
              inputMode="decimal" // iPad: Zahlentastatur mit Komma
              placeholder="z. B. 4.5"
              value={gradeText}
              disabled={readOnly}
              onChange={(e) => setGradeText(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="g-weight">Gewichtung</label>
            <div className="flex gap-2">
              {WEIGHT_PRESETS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`btn-secondary px-3 ${parseDecimal(weightText) === w ? 'ring-2 ring-blue-500' : ''}`}
                  disabled={readOnly}
                  onClick={() => setWeightText(String(w))}
                >
                  {w === 0.5 ? '½' : `${w}×`}
                </button>
              ))}
              <input
                id="g-weight"
                className="input"
                inputMode="decimal"
                aria-label="Gewichtung (frei)"
                value={weightText}
                disabled={readOnly}
                onChange={(e) => setWeightText(e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}

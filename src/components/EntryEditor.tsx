// Dialog "Neuer Eintrag" / "Eintrag bearbeiten".

import { useState, type FormEvent } from 'react'
import { useData } from '../data/DataProvider'
import { CATEGORIES, CATEGORY_KEYS } from '../lib/categories'
import { formatTime, isoToLocal, minutesToTime, timeToMinutes, todayKey, type DateKey } from '../lib/dates'
import { formatGrade, gradeClass } from '../lib/grades'
import type { Attachment, Category, PendingAttachment, StudyBlockInput } from '../types'
import { AttachmentsEditor } from './AttachmentsEditor'
import type { GradeRequest } from './GradeEditor'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { StudyBlocksEditor } from './StudyBlocksEditor'
import { TimeInput } from './TimeInput'

/** Was beim Öffnen des Editors bekannt ist. */
export interface EditorRequest {
  entryId?: string // bestehenden Eintrag bearbeiten
  date?: DateKey // vorausgefüllt (z. B. angetippter Tag)
  time?: string // vorausgefüllt (z. B. angetippte Uhrzeit im Raster)
}

export function EntryEditor({
  request,
  onClose,
  onOpenGrade,
}: {
  request: EditorRequest
  onClose: () => void
  onOpenGrade: (req: GradeRequest) => void // öffnet das Noten-Formular über diesem Dialog
}) {
  const {
    entryById,
    blocksByEntry,
    attachmentsByEntry,
    gradeByEntry,
    subjects,
    online,
    saveEntry,
    deleteEntry,
    restoreEntry,
    purgeAttachmentFiles,
  } = useData()
  const showToast = useToast()
  const existing = request.entryId ? entryById.get(request.entryId) : undefined
  // Nach "Duplizieren" zeigt das Formular eine Kopie, die als neuer Eintrag gespeichert wird.
  const [isCopy, setIsCopy] = useState(false)
  const editingId = existing && !isCopy ? existing.id : null

  // Formularzustand – mit den bestehenden Werten bzw. sinnvollen Vorgaben gefüllt
  const initialStart = existing?.start_time ? formatTime(existing.start_time) : (request.time ?? '08:00')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [category, setCategory] = useState<Category>(existing?.category ?? 'test')
  const [subjectId, setSubjectId] = useState(existing?.subject_id ?? '')
  const [date, setDate] = useState<DateKey>(existing?.date ?? request.date ?? todayKey())
  const [hasTime, setHasTime] = useState(Boolean(existing ? existing.start_time : request.time))
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(
    existing?.end_time ? formatTime(existing.end_time) : minutesToTime(Math.min(timeToMinutes(initialStart) + 60, 1435)),
  )
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [done, setDone] = useState(existing?.done ?? false)
  const [blocks, setBlocks] = useState<StudyBlockInput[]>(() =>
    (existing ? (blocksByEntry.get(existing.id) ?? []) : []).map((b) => {
      const s = isoToLocal(b.starts_at)
      return { id: b.id, date: s.date, start: s.time, end: isoToLocal(b.ends_at).time, done: b.done }
    }),
  )
  const savedAttachments = existing ? (attachmentsByEntry.get(existing.id) ?? []) : []
  const [keptAttachments, setKeptAttachments] = useState<Attachment[]>(savedAttachments)
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const linkedGrade = editingId ? gradeByEntry.get(editingId) : undefined
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const readOnly = !online || saving

  /** Prüft die Eingaben; gibt eine Fehlermeldung zurück oder null. */
  function validate(): string | null {
    if (!title.trim()) return 'Bitte gib einen Titel ein.'
    if (!date) return 'Bitte wähle ein Datum.'
    if (hasTime && timeToMinutes(end) <= timeToMinutes(start)) return 'Die Endzeit muss nach der Startzeit liegen.'
    if (blocks.some((b) => timeToMinutes(b.end) <= timeToMinutes(b.start)))
      return 'Bei einer Lernzeit liegt das Ende vor dem Start.'
    return null
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const problem = validate()
    if (problem) return setError(problem)
    setSaving(true)
    setError(null)
    try {
      await saveEntry(
        editingId,
        {
          title: title.trim(),
          category,
          subject_id: subjectId || null,
          date,
          start_time: hasTime ? start : null,
          end_time: hasTime ? end : null,
          notes: notes.trim() || null,
          done,
        },
        blocks,
        {
          added: pendingAttachments,
          // Beim Duplizieren gehören die gespeicherten Anhänge dem Original – nichts löschen
          removed: isCopy ? [] : savedAttachments.filter((a) => !keptAttachments.includes(a)),
        },
      )
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  /** Löscht sofort und bietet einige Sekunden lang "Rückgängig" an (statt vorher nachzufragen). */
  async function handleDelete() {
    if (!existing) return
    // Gespeicherten Stand merken, damit "Rückgängig" ihn wiederherstellen kann
    const savedBlocks = blocksByEntry.get(existing.id) ?? []
    const gradeIds = linkedGrade ? [linkedGrade.id] : []
    setSaving(true)
    try {
      await deleteEntry(existing.id)
      onClose()
      showToast({
        message: `„${existing.title}“ gelöscht`,
        action: { label: 'Rückgängig', run: () => restoreEntry(existing, savedBlocks, savedAttachments, gradeIds) },
        // Erst wenn "Rückgängig" nicht mehr möglich ist, die Dateien wirklich aus dem Speicher löschen
        onExpire: () => void purgeAttachmentFiles(savedAttachments),
      })
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  /** Formular in eine Kopie verwandeln: gleiche Angaben, aber neu, offen, ohne Lernzeiten und Dateien.
   *  Links werden übernommen (sie kosten keinen Speicher). */
  function handleDuplicate() {
    setIsCopy(true)
    setDone(false)
    setBlocks([])
    setPendingAttachments([
      ...keptAttachments
        .filter((a) => a.kind === 'link')
        .map((a) => ({ kind: 'link' as const, url: a.url!, name: a.name })),
      ...pendingAttachments.filter((p) => p.kind === 'link'),
    ])
    setKeptAttachments([])
    setError(null)
  }

  const uploading = saving && pendingAttachments.some((p) => p.kind === 'file')

  return (
    <Modal
      title={isCopy ? 'Kopie bearbeiten' : existing ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
      onClose={onClose}
      footer={
        <>
          {editingId && (
            <>
              <button type="button" className="btn-danger" onClick={handleDelete} disabled={readOnly}>
                Löschen
              </button>
              <button type="button" className="btn-secondary" onClick={handleDuplicate} disabled={readOnly}>
                Duplizieren
              </button>
            </>
          )}
          <div className="flex-1" />
          <button type="button" className="btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" form="entry-form" className="btn-primary" disabled={readOnly}>
            {uploading ? 'Lädt hoch …' : saving ? 'Speichert …' : 'Speichern'}
          </button>
        </>
      }
    >
      {!online && (
        <p className="mb-4 rounded-xl bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Offline – Änderungen nicht möglich.
        </p>
      )}
      {isCopy && (
        <p className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-200">
          Das ist eine Kopie. Passe z. B. Titel und Datum an und tippe auf „Speichern“. Lernzeiten und Dateien werden
          nicht übernommen (Links schon), das Original bleibt unverändert.
        </p>
      )}

      <form id="entry-form" onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="label" htmlFor="title">Titel</label>
          <input
            id="title"
            className="input"
            value={title}
            disabled={readOnly}
            placeholder="z. B. Test über den Ersten Weltkrieg"
            autoFocus={!existing}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <span className="label">Kategorie</span>
          <div className="segment">
            {CATEGORY_KEYS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                disabled={readOnly}
                onClick={() => setCategory(c)}
              >
                {CATEGORIES[c].icon} {CATEGORIES[c].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="subject">Fach</label>
            <select
              id="subject"
              className="input"
              value={subjectId}
              disabled={readOnly}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">– kein Fach –</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="date">Datum</label>
            <input
              id="date"
              type="date"
              className="input"
              value={date}
              disabled={readOnly}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={hasTime}
              disabled={readOnly}
              onChange={(e) => setHasTime(e.target.checked)}
            />
            mit Uhrzeit
          </label>
          {hasTime && (
            <div className="flex flex-wrap items-center gap-2">
              <TimeInput label="Von" value={start} disabled={readOnly} onChange={setStart} />
              <span>bis</span>
              <TimeInput label="Bis" value={end} disabled={readOnly} onChange={setEnd} />
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="notes">Notizen</label>
          <textarea
            id="notes"
            className="input min-h-24 py-2"
            value={notes}
            disabled={readOnly}
            placeholder="z. B. Seiten 34–52, Lernziele 1–8"
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={done}
            disabled={readOnly}
            onChange={(e) => setDone(e.target.checked)}
          />
          erledigt
        </label>

        {/* Note: nur bei gespeicherten Tests (eine Note braucht einen bestehenden Eintrag) */}
        {editingId && category === 'test' && (
          <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
            <h3 className="font-semibold">🎓 Note</h3>
            {linkedGrade ? (
              <>
                <span className={`${gradeClass(linkedGrade.grade)} rounded-lg px-2 py-0.5 text-lg font-bold tabular-nums`}>
                  {formatGrade(linkedGrade.grade)}
                </span>
                {linkedGrade.weight !== 1 && <span className="text-sm text-slate-500">zählt {formatGrade(linkedGrade.weight)}×</span>}
                <div className="flex-1" />
                <button type="button" className="btn-secondary" onClick={() => onOpenGrade({ gradeId: linkedGrade.id })}>
                  Note bearbeiten
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-slate-500">noch keine</span>
                <div className="flex-1" />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!online}
                  onClick={() => onOpenGrade({ entryId: editingId })}
                >
                  Note eintragen
                </button>
              </>
            )}
          </section>
        )}

        <StudyBlocksEditor blocks={blocks} onChange={setBlocks} entryDate={date} disabled={readOnly} />

        <AttachmentsEditor
          kept={keptAttachments}
          pending={pendingAttachments}
          onChangeKept={setKeptAttachments}
          onChangePending={setPendingAttachments}
          disabled={readOnly}
        />

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}

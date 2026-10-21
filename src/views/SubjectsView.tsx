// Fächer verwalten: anlegen, umbenennen, Farbe wählen, löschen.

import { useState } from 'react'
import { useAuth } from '../data/AuthProvider'
import { useData } from '../data/DataProvider'
import { Icon } from '../components/Icon'
import { SUBJECT_PALETTE } from '../lib/categories'
import type { Subject } from '../types'

function ColorPicker({ value, onChange, disabled }: { value: string; onChange: (c: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SUBJECT_PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          aria-label={`Farbe ${c}`}
          aria-pressed={value === c}
          className={`h-9 w-9 rounded-full border-2 ${value === c ? 'border-slate-900 dark:border-white' : 'border-transparent'}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
      {/* Freie Farbwahl */}
      <input
        type="color"
        className="h-9 w-11 cursor-pointer rounded-lg"
        value={value}
        disabled={disabled}
        aria-label="Eigene Farbe"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function SubjectRow({ subject }: { subject: Subject }) {
  const { online, saveSubject, deleteSubject, entries, grades } = useData()
  const [name, setName] = useState(subject.name)
  const [color, setColor] = useState(subject.color)
  const [busy, setBusy] = useState(false)
  const changed = name.trim() !== subject.name || color !== subject.color
  const usage = entries.filter((e) => e.subject_id === subject.id).length
  const gradeCount = grades.filter((g) => g.subject_id === subject.id).length

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="space-y-2 rounded-2xl border border-slate-200 p-3 dark:border-slate-800" style={{ borderLeft: `6px solid ${color}` }}>
      <div className="flex gap-2">
        <input
          className="input"
          value={name}
          disabled={!online || busy}
          aria-label="Name des Fachs"
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="btn-danger btn-icon"
          disabled={!online || busy}
          aria-label={`${subject.name} löschen`}
          onClick={() => {
            // Noten würden sonst ihr Fach verlieren → Löschen erst, wenn keine Noten mehr da sind
            if (gradeCount)
              return alert(`„${subject.name}“ hat noch ${gradeCount} Note(n). Lösche zuerst die Noten im Tab „Noten“.`)
            const hint = usage ? `\n${usage} Einträge bleiben erhalten, sind dann aber ohne Fach.` : ''
            if (confirm(`Fach „${subject.name}“ löschen?${hint}`)) run(() => deleteSubject(subject.id))
          }}
        >
          <Icon name="trash" />
        </button>
      </div>
      <ColorPicker value={color} onChange={setColor} disabled={!online || busy} />
      {changed && (
        <button
          className="btn-primary"
          disabled={!online || busy || !name.trim()}
          onClick={() => run(() => saveSubject(subject.id, name.trim(), color))}
        >
          Änderungen speichern
        </button>
      )}
    </li>
  )
}

/** Konto: wer angemeldet ist + Abmelden. Bewusst hier unten statt in der Kopfzeile,
 *  damit man nicht versehentlich draufkommt – normalerweise bleibt man dauerhaft angemeldet. */
function AccountSection() {
  const { session, signOut } = useAuth()
  return (
    <section className="space-y-2 border-t border-slate-200 pt-6 dark:border-slate-800">
      <h2 className="font-semibold">Konto</h2>
      <p className="text-sm text-slate-500">
        Angemeldet als <strong>{session?.user.email}</strong>. Du bleibst auf diesem Gerät angemeldet, bis du dich abmeldest.
      </p>
      <button className="btn-secondary" onClick={() => confirm('Wirklich abmelden?') && signOut()}>
        <Icon name="logout" /> Abmelden
      </button>
    </section>
  )
}

export function SubjectsView() {
  const { subjects, online, saveSubject } = useData()
  const [name, setName] = useState('')
  const [color, setColor] = useState(SUBJECT_PALETTE[subjects.length % SUBJECT_PALETTE.length])
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await saveSubject(null, name.trim(), color)
      setName('')
      setColor(SUBJECT_PALETTE[(subjects.length + 1) % SUBJECT_PALETTE.length])
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-6 p-3 pb-28">
        <section className="space-y-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
          <h2 className="font-semibold">Neues Fach</h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
          >
            <input
              className="input"
              placeholder="z. B. Geschichte"
              value={name}
              disabled={!online || busy}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn-primary" disabled={!online || busy || !name.trim()}>
              Hinzufügen
            </button>
          </form>
          <ColorPicker value={color} onChange={setColor} disabled={!online || busy} />
        </section>

        <ul className="space-y-3">
          {subjects.map((s) => (
            // key enthält die Werte, damit die Zeile nach dem Neuladen frische Startwerte bekommt
            <SubjectRow key={`${s.id}-${s.name}-${s.color}`} subject={s} />
          ))}
        </ul>
        {subjects.length === 0 && <p className="text-center text-slate-500">Noch keine Fächer angelegt.</p>}

        <AccountSection />
      </div>
    </div>
  )
}

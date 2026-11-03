// Fächer verwalten (anlegen, umbenennen, Farbe wählen, löschen), Ferien & freie Tage, Konto.

import { useState } from 'react'
import { useAuth } from '../data/AuthProvider'
import { useData } from '../data/DataProvider'
import { Icon } from '../components/Icon'
import { ThemePicker } from '../components/ThemePicker'
import { SUBJECT_PALETTE } from '../lib/categories'
import { countdown, formatDate, formatWeekday, todayKey } from '../lib/dates'
import { PERIOD_KINDS, comparePeriods, periodLength } from '../lib/periods'
import type { PeriodRequest } from '../components/PeriodEditor'
import type { Period, Subject } from '../types'

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
    <li className="tile space-y-2 p-3" style={{ boxShadow: `inset 5px 0 0 ${color}, var(--tile-shadow)` }}>
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

function PeriodRow({ period, onOpen }: { period: Period; onOpen: () => void }) {
  const meta = PERIOD_KINDS[period.kind]
  const today = todayKey()
  const length = periodLength(period)
  const when =
    period.end_date < today ? null : period.start_date <= today ? 'läuft gerade' : countdown(today, period.start_date)
  return (
    <li>
      <button
        className="tile flex min-h-14 w-full items-center gap-3 p-3 text-left"
        style={{ boxShadow: `inset 5px 0 0 ${meta.color}, var(--tile-shadow)` }}
        onClick={onOpen}
      >
        <span className="text-xl">{meta.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{period.name}</span>
          <span className="block text-sm text-slate-500">
            {formatWeekday(period.start_date)}, {formatDate(period.start_date)}
            {length > 1 && ` – ${formatWeekday(period.end_date)}, ${formatDate(period.end_date)}`} · {length}{' '}
            {length === 1 ? 'Tag' : 'Tage'}
          </span>
        </span>
        {when && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {when}
          </span>
        )}
      </button>
    </li>
  )
}

/** Ferien, schulfreie Tage und Lager: kommende zuerst, vergangene aufklappbar. */
function PeriodsSection({ onOpenPeriod }: { onOpenPeriod: (req: PeriodRequest) => void }) {
  const { periods, periodsMissing, online } = useData()
  const [showPast, setShowPast] = useState(false)
  const today = todayKey()
  const sorted = [...periods].sort(comparePeriods)
  const upcoming = sorted.filter((p) => p.end_date >= today)
  const past = sorted.filter((p) => p.end_date < today).reverse() // zuletzt vergangene zuerst

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="section-title">Ferien & freie Tage</h2>
        <button className="btn-primary" disabled={!online || periodsMissing} onClick={() => onOpenPeriod({})}>
          <Icon name="plus" /> Neu
        </button>
      </div>

      {periodsMissing ? (
        <div className="space-y-1 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">Noch nicht eingerichtet</p>
          <p>
            Führe im Supabase-Dashboard unter <strong>SQL Editor → New query</strong> den Inhalt der Datei{' '}
            <code>supabase/migrations/004_events_and_periods.sql</code> aus und lade die App danach neu. Damit
            funktionieren auch Events.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            Erscheinen als farbiges Band im Kalender. Für Ferien zeigt „Heute“ einen Countdown mit den verbleibenden
            Schultagen.
          </p>
          <ul className="space-y-2">
            {upcoming.map((p) => (
              <PeriodRow key={p.id} period={p} onOpen={() => onOpenPeriod({ periodId: p.id })} />
            ))}
          </ul>
          {upcoming.length === 0 && <p className="text-center text-slate-500">Keine kommenden Ferien eingetragen.</p>}
          {past.length > 0 && (
            <>
              <button className="btn-secondary w-full" onClick={() => setShowPast(!showPast)}>
                {showPast ? 'Vergangene ausblenden' : `Vergangene anzeigen (${past.length})`}
              </button>
              {showPast && (
                <ul className="space-y-2 opacity-70">
                  {past.map((p) => (
                    <PeriodRow key={p.id} period={p} onOpen={() => onOpenPeriod({ periodId: p.id })} />
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}

/** Konto: wer angemeldet ist + Abmelden. Bewusst hier unten statt in der Kopfzeile,
 *  damit man nicht versehentlich draufkommt – normalerweise bleibt man dauerhaft angemeldet. */
function AccountSection() {
  const { session, signOut } = useAuth()
  return (
    <section className="tile space-y-2 p-4">
      <h2 className="font-bold">Konto</h2>
      <p className="text-sm text-slate-500">
        Angemeldet als <strong>{session?.user.email}</strong>. Du bleibst auf diesem Gerät angemeldet, bis du dich abmeldest.
      </p>
      <button className="btn-secondary" onClick={() => confirm('Wirklich abmelden?') && signOut()}>
        <Icon name="logout" /> Abmelden
      </button>
    </section>
  )
}

export function SubjectsView({ onOpenPeriod }: { onOpenPeriod: (req: PeriodRequest) => void }) {
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
      <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-32 md:px-6 md:pb-10 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <ThemePicker />
          <PeriodsSection onOpenPeriod={onOpenPeriod} />
          <AccountSection />
        </div>
        <div className="space-y-4">
        <h2 className="section-title">Fächer</h2>
        <section className="tile space-y-2 p-4">
          <h3 className="font-bold">Neues Fach</h3>
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
        </div>
      </div>
    </div>
  )
}

// Bereich "Anhänge" im Eintrag-Formular: Dateien (Word, PowerPoint, PDF, Fotos …) und Links.
// Neue Anhänge werden erst beim Speichern hochgeladen – wie die Lernzeiten.

import { useRef, useState } from 'react'
import { useData } from '../data/DataProvider'
import { MAX_FILE_SIZE, fileIcon, formatSize, linkLabel, normalizeUrl } from '../lib/files'
import type { Attachment, PendingAttachment } from '../types'
import { Icon } from './Icon'

/**
 * Öffnet einen Anhang in einem neuen Tab.
 * Safari blockiert Fenster, die erst nach einer Wartezeit geöffnet werden – deshalb das Fenster
 * sofort beim Antippen öffnen und die (zeitlich begrenzte) Datei-Adresse danach hineinladen.
 */
export function useOpenAttachment() {
  const { attachmentUrl } = useData()
  return async (a: Attachment) => {
    const win = a.kind === 'link' ? null : window.open('', '_blank')
    try {
      const url = await attachmentUrl(a)
      if (win) win.location.href = url
      else window.open(url, '_blank', 'noopener')
    } catch (err) {
      win?.close()
      alert((err as Error).message)
    }
  }
}

export function AttachmentsEditor({
  kept,
  pending,
  onChangeKept,
  onChangePending,
  disabled,
}: {
  kept: Attachment[] // bereits gespeicherte, die bleiben sollen
  pending: PendingAttachment[] // neu, noch nicht gespeichert
  onChangeKept: (list: Attachment[]) => void
  onChangePending: (list: PendingAttachment[]) => void
  disabled: boolean
}) {
  const { online } = useData()
  const openAttachment = useOpenAttachment()
  const fileInput = useRef<HTMLInputElement>(null)
  const [linkFormOpen, setLinkFormOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkName, setLinkName] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  function addFiles(files: FileList | null) {
    if (!files) return
    const ok: PendingAttachment[] = []
    const tooBig: string[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) tooBig.push(file.name)
      else ok.push({ kind: 'file', file, name: file.name })
    }
    onChangePending([...pending, ...ok])
    setMessage(tooBig.length ? `Zu gross (max. 50 MB): ${tooBig.join(', ')}` : null)
    if (fileInput.current) fileInput.current.value = '' // dieselbe Datei nochmals wählbar
  }

  function addLink() {
    const url = normalizeUrl(linkUrl)
    if (!url) return setMessage('Das ist kein gültiger Link (z. B. https://onedrive.live.com/…).')
    onChangePending([...pending, { kind: 'link', url, name: linkName.trim() || linkLabel(url) }])
    setLinkUrl('')
    setLinkName('')
    setLinkFormOpen(false)
    setMessage(null)
  }

  const empty = kept.length === 0 && pending.length === 0

  return (
    <section className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
      <h3 className="mb-2 font-semibold">📎 Anhänge</h3>
      {empty && <p className="mb-2 text-sm text-slate-500">z. B. Lernzielblatt, Zusammenfassung, Präsentation oder ein Link.</p>}

      <ul className="space-y-1">
        {kept.map((a) => (
          <li key={a.id} className="flex items-center gap-1 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <button
              type="button"
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 text-left disabled:opacity-50"
              disabled={!online}
              title={online ? 'Öffnen' : 'Offline – Anhänge nicht verfügbar'}
              onClick={() => openAttachment(a)}
            >
              <span className="text-lg">{a.kind === 'link' ? '🔗' : fileIcon(a.name, a.mime)}</span>
              <span className="min-w-0 flex-1 truncate text-blue-700 underline-offset-2 hover:underline dark:text-blue-300">
                {a.name}
              </span>
              {a.size != null && <span className="shrink-0 text-xs text-slate-500">{formatSize(a.size)}</span>}
            </button>
            <button
              type="button"
              className="btn-icon text-slate-500"
              disabled={disabled}
              aria-label={`${a.name} entfernen`}
              onClick={() => onChangeKept(kept.filter((k) => k.id !== a.id))}
            >
              <Icon name="close" />
            </button>
          </li>
        ))}
        {pending.map((p, i) => (
          <li key={`neu-${i}`} className="flex items-center gap-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <span className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2">
              <span className="text-lg">{p.kind === 'link' ? '🔗' : fileIcon(p.name, p.file.type)}</span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="shrink-0 text-xs text-slate-500">
                {p.kind === 'file' ? `${formatSize(p.file.size)} · ` : ''}neu
              </span>
            </span>
            <button
              type="button"
              className="btn-icon text-slate-500"
              disabled={disabled}
              aria-label={`${p.name} entfernen`}
              onClick={() => onChangePending(pending.filter((_, j) => j !== i))}
            >
              <Icon name="close" />
            </button>
          </li>
        ))}
      </ul>

      {linkFormOpen && (
        <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50">
          <input
            className="input"
            type="url"
            inputMode="url"
            placeholder="Link, z. B. https://onedrive.live.com/…"
            value={linkUrl}
            autoFocus
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
          />
          <input
            className="input"
            placeholder="Name (optional), z. B. Lernzielblatt"
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
          />
          <div className="flex gap-2">
            <button type="button" className="btn-primary flex-1" onClick={addLink}>Link hinzufügen</button>
            <button type="button" className="btn-secondary" onClick={() => setLinkFormOpen(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {message && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{message}</p>}

      {/* Verstecktes Datei-Feld: Auf dem iPad öffnet sich die Auswahl "Dateien / Fotos / Kamera" */}
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-secondary flex-1" disabled={disabled} onClick={() => fileInput.current?.click()}>
          📄 Datei
        </button>
        <button
          type="button"
          className="btn-secondary flex-1"
          disabled={disabled || linkFormOpen}
          onClick={() => setLinkFormOpen(true)}
        >
          🔗 Link
        </button>
      </div>
    </section>
  )
}

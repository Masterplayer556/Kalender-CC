// Bereich "Anhänge" im Eintrag-Formular: Dateien (Word, PowerPoint, PDF, Fotos …) und Links.
// Neue Anhänge werden erst beim Speichern hochgeladen – wie die Lernzeiten.

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useData } from '../data/DataProvider'
import { SIGNED_URL_SECONDS } from '../data/api'
import { MAX_FILE_SIZE, fileIcon, formatSize, linkLabel, normalizeUrl } from '../lib/files'
import { friendlyError } from '../lib/supabase'
import type { Attachment, PendingAttachment } from '../types'
import { Icon } from './Icon'

// Datei-Links 5 Minuten vor Ablauf erneuern
const REFRESH_MS = (SIGNED_URL_SECONDS - 5 * 60) * 1000

/**
 * Holt die Adressen der Anhänge schon beim Anzeigen – nicht erst beim Antippen.
 * Grund: Safari öffnet neue Fenster nur direkt beim Antippen, und ein vorab leer geöffnetes Fenster
 * lässt sich danach (v. a. als Home-Bildschirm-App) nicht mehr umleiten – es bliebe auf about:blank.
 * Mit fertiger Adresse ist jeder Anhang ein ganz normaler Link.
 */
function useAttachmentUrls(list: Attachment[], online: boolean) {
  const { attachmentUrls } = useData()
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const [fetchedAt, setFetchedAt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    if (!online || list.length === 0) return
    let cancelled = false
    let timer: number | undefined
    async function load() {
      try {
        const next = await attachmentUrls(list)
        if (cancelled) return
        setUrls(next)
        setFetchedAt(Date.now())
        setError(null)
        timer = window.setTimeout(load, REFRESH_MS)
      } catch (err) {
        if (!cancelled) setError(friendlyError(err))
      }
    }
    void load()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // attachmentUrls wird bei jeder Datenänderung neu erzeugt – nur die Liste selbst zählt
  }, [list, online, reloadCount])

  // Im Hintergrund (iPad gesperrt) laufen keine Timer – deshalb abgelaufene Links beim Antippen erkennen
  const isStale = () => Date.now() - fetchedAt > REFRESH_MS
  return { urls, isStale, error, reload: () => setReloadCount((n) => n + 1) }
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
  const { urls, isStale, error: urlError, reload: reloadUrls } = useAttachmentUrls(kept, online)
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

  function onOpenClick(e: MouseEvent, a: Attachment) {
    if (a.kind === 'file' && isStale()) {
      e.preventDefault()
      reloadUrls()
      setMessage('Der Datei-Link war abgelaufen und wird erneuert – bitte gleich nochmals antippen.')
    }
  }

  const empty = kept.length === 0 && pending.length === 0

  return (
    <section className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
      <h3 className="mb-2 font-semibold">📎 Anhänge</h3>
      {empty && <p className="mb-2 text-sm text-slate-500">z. B. Lernzielblatt, Zusammenfassung, Präsentation oder ein Link.</p>}

      <ul className="space-y-1">
        {kept.map((a) => {
          const url = online ? urls.get(a.id) : undefined
          return (
            <li key={a.id} className="flex items-center gap-1 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              {/* Echter Link statt Button: öffnet zuverlässig in einem neuen Tab (auch auf dem iPad) */}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 text-left ${url ? '' : 'pointer-events-none opacity-50'}`}
                aria-disabled={!url}
                title={!online ? 'Offline – Anhänge nicht verfügbar' : url ? 'Öffnen' : 'Wird geladen …'}
                onClick={(e) => onOpenClick(e, a)}
              >
                <span className="text-lg">{a.kind === 'link' ? '🔗' : fileIcon(a.name, a.mime)}</span>
                <span className="min-w-0 flex-1 truncate text-blue-700 underline-offset-2 hover:underline dark:text-blue-300">
                  {a.name}
                </span>
                {a.size != null && <span className="shrink-0 text-xs text-slate-500">{formatSize(a.size)}</span>}
              </a>
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
          )
        })}
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
      {online && urlError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          Anhänge konnten nicht geladen werden: {urlError}{' '}
          <button type="button" className="underline" onClick={reloadUrls}>Nochmals versuchen</button>
        </p>
      )}

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

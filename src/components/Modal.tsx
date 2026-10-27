import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

/** Dialogfenster: auf dem Handy bildschirmfüllend, auf iPad/Computer als Karte in der Mitte. */
export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Schliessen per Hintergrund, X oder Escape: erst kurz ausblenden, dann wirklich schliessen.
  // (Speichern/Abbrechen in den Formularen schliessen direkt über onClose.)
  const [closing, setClosing] = useState(false)
  const close = () => setClosing(true)
  useEffect(() => {
    if (!closing) return
    const timer = setTimeout(onClose, 180) // Dauer wie .modal-closing in index.css
    return () => clearTimeout(timer)
  }, [closing, onClose])

  // Escape-Taste schließt den Dialog (am Computer) – bei übereinanderliegenden Dialogen nur den obersten
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const dialogs = document.querySelectorAll('[role="dialog"]')
      if (dialogs[dialogs.length - 1] === dialogRef.current) setClosing(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className={`modal-backdrop fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-6 ${closing ? 'modal-closing pointer-events-none' : ''}`}
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal-sheet flex w-full flex-col bg-white shadow-2xl sm:max-h-[90dvh] sm:max-w-xl sm:rounded-2xl dark:bg-slate-900"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-800">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-icon" onClick={close} aria-label="Schließen">
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

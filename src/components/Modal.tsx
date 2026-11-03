import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/**
 * Dialogfenster: auf dem Handy bildschirmfüllend, auf iPad/Computer als Karte in der Mitte.
 * Kopf im Stil der App: Symbol-Kachel, kleine Zeile (eyebrow) und grosser Titel.
 */
export function Modal({
  title,
  eyebrow,
  icon,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string
  eyebrow?: string
  icon?: IconName
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean // breiter auf dem iPad (z. B. Eintrag mit zwei Spalten)
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
      className={`modal-backdrop fixed inset-0 z-50 flex items-stretch justify-center bg-black/45 backdrop-blur-[3px] sm:items-center sm:p-6 ${closing ? 'modal-closing pointer-events-none' : ''}`}
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal-sheet sheet flex w-full flex-col shadow-2xl sm:max-h-[90dvh] sm:rounded-(--r-tile) ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 sm:pt-5">
          {icon && (
            <span className="sheet-badge grid h-12 w-12 shrink-0 place-items-center">
              <Icon name={icon} className="h-6 w-6" strokeWidth={2.2} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && <div className="eyebrow truncate">{eyebrow}</div>}
            <h2 className="display truncate text-[26px] sm:text-[30px]">{title}</h2>
          </div>
          <button className="btn-icon btn-surface shrink-0" onClick={close} aria-label="Schließen">
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-1 pb-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center gap-2 border-t border-(--line) px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

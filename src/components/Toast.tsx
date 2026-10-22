// Kurze Meldung am unteren Rand, z. B. "„Test …“ gelöscht – Rückgängig".
// Es ist immer höchstens eine Meldung sichtbar; eine neue ersetzt die alte.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

interface Toast {
  message: string
  action?: { label: string; run: () => Promise<void> | void }
  /** Wird aufgerufen, wenn die Meldung verschwindet, OHNE dass die Aktion gewählt wurde. */
  onExpire?: () => void
}

const ToastContext = createContext<((toast: Toast) => void) | null>(null)

const DURATION_MS = 6000 // so lange bleibt "Rückgängig" verfügbar

export function ToastProvider({ children }: { children: ReactNode }) {
  // id: damit der Timer neu startet, auch wenn zweimal dieselbe Meldung kommt
  const [toast, setToast] = useState<(Toast & { id: number }) | null>(null)
  const [busy, setBusy] = useState(false)

  // Aktuelle Meldung auch ausserhalb von React-Renders erreichbar (für onExpire)
  const current = useRef<Toast | null>(null)

  /** Meldung schliessen; expired = true → Zeit abgelaufen oder ersetzt (nicht "Rückgängig" gewählt) */
  const close = useCallback((expired: boolean) => {
    if (expired) current.current?.onExpire?.()
    current.current = null
    setToast(null)
  }, [])

  const show = useCallback(
    (t: Toast) => {
      close(true) // eine noch sichtbare Meldung gilt als abgelaufen
      current.current = t
      setToast({ ...t, id: Date.now() })
    },
    [close],
  )

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => close(true), DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast, close])

  async function runAction() {
    if (!toast?.action) return
    current.current = null // Aktion gewählt → onExpire darf nicht mehr ausgelöst werden
    setBusy(true)
    try {
      await toast.action.run()
      close(false)
    } catch (err) {
      show({ message: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          role="status"
          key={toast.id}
          className="toast-in fixed left-1/2 z-40 flex w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl bg-slate-900 py-2 pr-2 pl-4 text-white shadow-xl dark:bg-slate-100 dark:text-slate-900"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)' }}
        >
          <span className="min-w-0 flex-1 text-sm">{toast.message}</span>
          {toast.action && (
            <button
              className="btn min-h-10 px-3 font-semibold text-blue-300 dark:text-blue-700"
              disabled={busy}
              onClick={runAction}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): (toast: Toast) => void {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast() muss innerhalb von <ToastProvider> verwendet werden')
  return ctx
}

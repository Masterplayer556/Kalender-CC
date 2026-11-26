// Hinweis "Neue Version – neu laden": Neue Versionen der App werden im Hintergrund geladen, aber erst
// übernommen, wenn man selbst tippt – so geht nichts verloren, was gerade im Formular steht.
// Ausserdem fragt die App regelmässig nach einer neuen Version (eine offen gelassene App auf dem iPad
// würde sonst erst nach einem Neustart davon erfahren).

import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_EVERY_MS = 60 * 60 * 1000 // stündlich

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return
      const check = async () => {
        if (!navigator.onLine || registration.installing) return
        // Erst prüfen, ob der Server erreichbar ist – sonst meldet update() unnötig einen Fehler
        try {
          const res = await fetch(swUrl, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } })
          if (res.status === 200) await registration.update()
        } catch {
          /* offline oder Server weg – beim nächsten Mal */
        }
      }
      setInterval(check, CHECK_EVERY_MS)
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
    },
  })

  if (!needRefresh) return null
  return (
    <div
      role="status"
      className="toast-in fixed top-[calc(env(safe-area-inset-top)+0.75rem)] left-1/2 z-50 flex w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl bg-slate-900 py-2 pr-2 pl-4 text-white shadow-xl dark:bg-slate-100 dark:text-slate-900"
    >
      <span className="min-w-0 flex-1 text-sm">Neue Version verfügbar</span>
      <button className="btn min-h-10 px-3 font-semibold text-blue-300 dark:text-blue-700" onClick={() => updateServiceWorker(true)}>
        Neu laden
      </button>
      <button className="btn min-h-10 px-3 text-slate-300 dark:text-slate-600" aria-label="Später" onClick={() => setNeedRefresh(false)}>
        Später
      </button>
    </div>
  )
}

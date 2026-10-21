// Wird angezeigt, wenn die Supabase-Zugangsdaten fehlen (.env-Datei bzw. GitHub-Secrets).

export function SetupMissingView() {
  return (
    <div className="app-root items-center justify-center overflow-y-auto p-6">
      <div className="max-w-lg space-y-3 rounded-3xl border border-amber-300 bg-amber-50 p-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <h1 className="text-xl font-bold">Einrichtung fehlt</h1>
        <p>Die App weiß noch nicht, mit welchem Supabase-Projekt sie sich verbinden soll.</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            <strong>Lokal:</strong> Kopiere <code>.env.example</code> zu <code>.env</code>, trage{' '}
            <code>VITE_SUPABASE_URL</code> und <code>VITE_SUPABASE_ANON_KEY</code> ein und starte{' '}
            <code>npm run dev</code> neu.
          </li>
          <li>
            <strong>GitHub Pages:</strong> Lege die beiden Werte als Repository-Secrets an und starte den
            Workflow erneut (siehe README).
          </li>
        </ul>
      </div>
    </div>
  )
}

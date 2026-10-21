import { useData } from '../data/DataProvider'
import { formatDate, isoToLocal } from '../lib/dates'

/** Hinweis bei fehlender Verbindung oder Ladefehlern. */
export function StatusBanner() {
  const { online, error, lastSync, reload } = useData()
  const stand = lastSync ? `Stand: ${formatDate(isoToLocal(lastSync).date)}, ${isoToLocal(lastSync).time} Uhr` : ''

  if (!online) {
    return (
      <div role="status" className="bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <strong>Offline – Änderungen nicht möglich.</strong> {stand}
      </div>
    )
  }
  if (error) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
        <span className="flex-1">{error} {stand}</span>
        <button className="btn-secondary min-h-9!" onClick={reload}>Erneut versuchen</button>
      </div>
    )
  }
  return null
}

// Kleines Menü beim Antippen eines Lernblocks: abhaken, ohne das ganze Formular zu öffnen.

import { useState } from 'react'
import { useData } from '../data/DataProvider'
import { formatDate, formatWeekday, isoToLocal } from '../lib/dates'
import { Modal } from './Modal'

export function StudyBlockMenu({
  blockId,
  onClose,
  onOpenEntry,
}: {
  blockId: string
  onClose: () => void
  onOpenEntry: (entryId: string) => void
}) {
  const { blocks, entryById, online, setBlockDone } = useData()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const block = blocks.find((b) => b.id === blockId)
  const entry = block && entryById.get(block.entry_id)
  if (!block || !entry) return null // z. B. inzwischen gelöscht

  const start = isoToLocal(block.starts_at)
  const end = isoToLocal(block.ends_at)

  async function toggle() {
    setBusy(true)
    try {
      await setBlockDone(block!.id, !block!.done)
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal title={`📖 Lernen: ${entry.title}`} onClose={onClose}>
      <p className="text-slate-600 dark:text-slate-300">
        {formatWeekday(start.date, 'long')}, {formatDate(start.date)} · {start.time}–{end.time} Uhr
        {block.done && <span className="ml-2 font-medium text-green-700 dark:text-green-400">✓ erledigt</span>}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button className="btn-primary flex-1" disabled={!online || busy} onClick={toggle}>
          {block.done ? 'Als nicht erledigt markieren' : '✓ Als erledigt markieren'}
        </button>
        <button className="btn-secondary flex-1" onClick={() => onOpenEntry(entry.id)}>
          Eintrag öffnen
        </button>
      </div>
      {!online && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Offline – Änderungen nicht möglich.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}

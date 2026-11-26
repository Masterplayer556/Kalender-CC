// Dateien im Speicher, die wohl bald keinen Anhang mehr haben und dann gelöscht werden sollen:
// - Eintrag gelöscht: Die Dateien bleiben nur für "Rückgängig" liegen.
// - Hochladen begonnen: Scheitert das Speichern und wird das Formular verlassen, gehört die Datei zu nichts.
// Die Liste liegt im localStorage – so wird auch aufgeräumt, wenn die App vorher geschlossen wurde.
// Gelöscht wird eine Datei erst, wenn es ihre Anhang-Zeile nicht (mehr) gibt.

export interface PurgeItem {
  id: string // id des Anhangs
  path: string // Pfad im Speicher
  due: number // frühestens dann aufräumen (ms seit 1970)
}

/** Einträge hinzufügen; ein Anhang, der schon in der Liste steht, wird ersetzt. */
export function enqueue(queue: PurgeItem[], items: PurgeItem[]): PurgeItem[] {
  const ids = new Set(items.map((i) => i.id))
  return [...queue.filter((q) => !ids.has(q.id)), ...items]
}

/** Was jetzt dran ist: fällig – oder ausdrücklich verlangt (force). */
export function dueItems(queue: PurgeItem[], now: number, force: Set<string> = new Set()): PurgeItem[] {
  return queue.filter((q) => q.due <= now || force.has(q.id))
}

/** Liste gültig? (kommt aus dem localStorage) */
export function asQueue(value: unknown): PurgeItem[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (v): v is PurgeItem =>
      !!v && typeof v === 'object' && typeof v.id === 'string' && typeof v.path === 'string' && typeof v.due === 'number',
  )
}

// Wann lädt die App beim Zurückkehren (App-Wechsel, Tab-Wechsel) neu?
// Jedes Laden sind 8 Anfragen. Auf dem iPhone wechselt man oft kurz die App – dann reicht der Stand,
// der vor wenigen Sekunden geladen wurde. Nach eigenen Änderungen lädt die App ohnehin sofort neu.

/** Mindestabstand zum letzten erfolgreichen Laden, bevor beim Zurückkehren neu geladen wird */
export const RETURN_RELOAD_GAP_MS = 30_000

/**
 * true, wenn beim Zurückkehren neu geladen werden soll: noch nie erfolgreich geladen oder das letzte
 * Laden liegt mindestens `gap` zurück (eine verstellte Uhr, die rückwärts springt, lädt auch neu).
 */
export function shouldReloadOnReturn(lastLoadAt: number | null, now: number, gap = RETURN_RELOAD_GAP_MS): boolean {
  if (lastLoadAt === null) return true
  const since = now - lastLoadAt
  return since < 0 || since >= gap
}

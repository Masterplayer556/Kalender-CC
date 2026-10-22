// Wisch-Erkennung für Monat / Woche / Tag: nach links oder rechts wischen = Zeitraum wechseln.

/** 1 = nächster Zeitraum, -1 = vorheriger, 0 = kein Wisch */
export type SwipeDir = 1 | -1 | 0

export const SWIPE_MIN_DISTANCE = 60 // Pixel – kürzere Bewegungen sind eher ein Antippen
export const SWIPE_MAX_DURATION = 800 // ms – langsamer ist eher Ziehen/Lesen als Wischen

/**
 * Wertet eine Fingerbewegung aus.
 * dx/dy: Weg in Pixeln (dx < 0 = nach links), ms: Dauer der Bewegung.
 */
export function swipeDirection(dx: number, dy: number, ms: number): SwipeDir {
  if (ms > SWIPE_MAX_DURATION) return 0
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return 0
  // Hauptsächlich senkrecht? Dann scrollt man im Kalender – kein Wisch.
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return 0

  // Wisch nach LINKS (dx < 0) → vorheriger Zeitraum; nach rechts → nächster.
  // Zum Umdrehen: -1 durch 1 ersetzen.
  const swipeLeft: SwipeDir = -1
  return (dx < 0 ? swipeLeft : -swipeLeft) as SwipeDir
}

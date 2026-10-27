// Wisch-Erkennung für Monat / Woche / Tag: nach links oder rechts wischen = Zeitraum wechseln.
// Der Kalender folgt dabei dem Finger (siehe components/useSwipe.ts); hier steht nur die Entscheidung.

/** 1 = nächster Zeitraum, -1 = vorheriger, 0 = kein Wisch */
export type SwipeDir = 1 | -1 | 0

export const AXIS_LOCK_DISTANCE = 10 // Pixel – ab hier steht fest, ob gewischt oder gescrollt wird
export const SWIPE_MIN_DISTANCE = 40 // Pixel – kürzere Bewegungen sind eher ein Antippen
export const SWIPE_DISTANCE_RATIO = 0.3 // so weit gezogen (Anteil der Breite) → wechseln, auch langsam
export const SWIPE_FLICK_VELOCITY = 0.35 // px/ms – so schnell "geschnippt" → wechseln, auch kurz

/**
 * Entscheidet nach den ersten Pixeln, wem die Geste gehört:
 * 'x' = Wischen (Kalender verschieben), 'y' = senkrecht scrollen, null = noch zu wenig Bewegung.
 */
export function lockAxis(dx: number, dy: number): 'x' | 'y' | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_DISTANCE) return null
  return Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y'
}

/**
 * Wertet eine waagrechte Fingerbewegung beim Loslassen aus.
 * dx: Weg in Pixeln (dx < 0 = nach links), velocity: Tempo am Schluss in px/ms, width: Breite der Ansicht.
 */
export function swipeDirection(dx: number, velocity: number, width: number): SwipeDir {
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return 0
  const farEnough = Math.abs(dx) >= width * SWIPE_DISTANCE_RATIO
  // Ein schneller Schnipp zählt nur, wenn er noch in dieselbe Richtung geht (nicht beim Zurückziehen)
  const flick = Math.abs(velocity) >= SWIPE_FLICK_VELOCITY && Math.sign(velocity) === Math.sign(dx)
  if (!farEnough && !flick) return 0

  // Wie beim Umblättern: nach LINKS wischen → nächster Zeitraum (August → September → Oktober),
  // nach rechts → vorheriger.
  return dx < 0 ? 1 : -1
}

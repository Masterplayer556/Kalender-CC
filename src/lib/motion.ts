/** "Bewegung reduzieren" in den Geräte-Einstellungen eingeschaltet? Dann keine Animationen. */
export const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

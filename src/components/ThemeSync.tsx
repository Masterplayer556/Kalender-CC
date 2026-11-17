// Übernimmt das Design aus den geräteübergreifenden Einstellungen (z. B. auf dem iPad auf "Neon"
// gestellt → das Handy wechselt beim nächsten Laden auch). Zeigt selbst nichts an.

import { useEffect } from 'react'
import { useData } from '../data/DataProvider'
import { MODE_NAMES, THEME_NAMES, type ThemeMode, type ThemeName } from '../lib/theme'
import { useTheme } from './ThemeProvider'

export function ThemeSync() {
  const { prefs } = useData()
  const { theme, mode, setTheme, setMode } = useTheme()

  // Nur reagieren, wenn sich die Einstellung ändert (nicht bei jeder lokalen Umstellung)
  useEffect(() => {
    const t = prefs.theme as ThemeName | undefined
    if (t && THEME_NAMES.includes(t) && t !== theme) setTheme(t)
  }, [prefs.theme])

  useEffect(() => {
    const m = prefs.themeMode as ThemeMode | undefined
    if (m && MODE_NAMES.includes(m) && m !== mode) setMode(m)
  }, [prefs.themeMode])

  return null
}

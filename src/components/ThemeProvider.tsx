import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  applyTheme,
  isDark,
  loadMode,
  loadTheme,
  saveTheme,
  systemPrefersDark,
  type ThemeMode,
  type ThemeName,
} from '../lib/theme'

interface ThemeState {
  theme: ThemeName
  mode: ThemeMode
  dark: boolean // tatsächlich dunkel (Modus + Systemeinstellung)
  setTheme: (t: ThemeName) => void
  setMode: (m: ThemeMode) => void
}

const ThemeContext = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(loadTheme)
  const [mode, setModeState] = useState<ThemeMode>(loadMode)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  // Systemeinstellung (hell/dunkel) live verfolgen – wichtig für "Automatisch"
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const dark = isDark(mode, systemDark)
  useEffect(() => {
    applyTheme(theme, dark)
    saveTheme(theme, mode)
  }, [theme, mode, dark])

  return (
    <ThemeContext.Provider value={{ theme, mode, dark, setTheme: setThemeState, setMode: setModeState }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme ausserhalb von ThemeProvider')
  return ctx
}

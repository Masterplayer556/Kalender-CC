// Design-Themes: "Sunset" (warm, Kacheln, grosse Zahlen) und "Neon" (Raster, Mono-Schrift, Lime).
// Jedes Theme gibt es hell und dunkel. Gespeichert wird nur auf diesem Gerät (localStorage).
//
// Umgesetzt über zwei Attribute auf <html>:
//   data-theme="sunset" | "neon"   → Farben, Schriften, Formen (siehe index.css)
//   class="dark"                   → Dunkelmodus (Tailwind-Variante "dark:")

import { loadPref, savePref } from './cache'

export type ThemeName = 'sunset' | 'neon'
export type ThemeMode = 'auto' | 'light' | 'dark'

export const THEMES: Record<ThemeName, { label: string; description: string }> = {
  sunset: { label: 'Sunset', description: 'Warm, Kacheln, grosse Zahlen' },
  neon: { label: 'Neon', description: 'Raster, Mono-Schrift, Lime' },
}
export const THEME_NAMES = Object.keys(THEMES) as ThemeName[]

export const MODES: Record<ThemeMode, string> = { auto: 'Automatisch', light: 'Hell', dark: 'Dunkel' }
export const MODE_NAMES = Object.keys(MODES) as ThemeMode[]

/** Hintergrundfarbe pro Theme und Modus – für die Statusleiste von iOS (meta theme-color). */
const STATUS_BAR: Record<ThemeName, { light: string; dark: string }> = {
  sunset: { light: '#fff4ea', dark: '#130910' },
  neon: { light: '#f3f4ee', dark: '#07090b' },
}

export function loadTheme(): ThemeName {
  const t = loadPref<string>('theme', 'sunset')
  return THEME_NAMES.includes(t as ThemeName) ? (t as ThemeName) : 'sunset'
}
export function loadMode(): ThemeMode {
  const m = loadPref<string>('themeMode', 'auto')
  return MODE_NAMES.includes(m as ThemeMode) ? (m as ThemeMode) : 'auto'
}
export function saveTheme(theme: ThemeName, mode: ThemeMode) {
  savePref('theme', theme)
  savePref('themeMode', mode)
}

export const systemPrefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

/** Ergibt der Modus gerade "dunkel"? */
export function isDark(mode: ThemeMode, systemDark: boolean): boolean {
  return mode === 'dark' || (mode === 'auto' && systemDark)
}

/** Theme auf <html> anwenden (auch vor dem ersten Zeichnen, damit nichts aufblitzt). */
export function applyTheme(theme: ThemeName, dark: boolean) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  const color = STATUS_BAR[theme][dark ? 'dark' : 'light']
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = color
}

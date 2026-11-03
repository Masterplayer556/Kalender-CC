import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'
import { applyTheme, isDark, loadMode, loadTheme, systemPrefersDark } from './lib/theme'

// Theme sofort setzen, damit beim Start nichts in falschen Farben aufblitzt
applyTheme(loadTheme(), isDark(loadMode(), systemPrefersDark()))

// Service Worker aktivieren: speichert die App-Dateien, damit sie auch offline startet,
// und lädt neue Versionen automatisch im Hintergrund.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

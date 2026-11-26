import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { applyTheme, isDark, loadMode, loadTheme, systemPrefersDark } from './lib/theme'

// Theme sofort setzen, damit beim Start nichts in falschen Farben aufblitzt
applyTheme(loadTheme(), isDark(loadMode(), systemPrefersDark()))

// Den Service Worker (App-Dateien offline speichern, neue Versionen) registriert components/UpdateBanner.tsx.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

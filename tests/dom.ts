// Gemeinsame Vorbereitung für Tests mit Oberfläche (@testing-library/react in jsdom).
// In jeder solchen Testdatei: ganz oben "// @vitest-environment jsdom" und dann "import './dom'".

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom kennt matchMedia nicht (ThemeProvider, Bewegung reduzieren …)
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

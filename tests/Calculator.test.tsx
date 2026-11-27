// @vitest-environment jsdom
import './dom'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Calculator } from '../src/components/grades/Calculator'
import { ThemeProvider } from '../src/components/ThemeProvider'
import type { Entry } from '../src/types'

const test = (id: string, date: string): Entry => ({
  id,
  user_id: 'u',
  title: `Test ${id}`,
  category: 'test',
  subject_id: 'm',
  date,
  end_date: null,
  start_time: null,
  end_time: null,
  notes: null,
  done: false,
  created_at: '',
  updated_at: '',
})

const renderCalc = (planned: Entry[] = []) =>
  render(
    <ThemeProvider>
      <Calculator grades={[{ grade: 4, weight: 1 }, { grade: 5, weight: 1 }]} initialTarget={5} planned={planned} />
    </ThemeProvider>,
  )

describe('Notenrechner (Oberfläche)', () => {
  it('zeigt die nötige Note für die nächste Prüfung', () => {
    renderCalc()
    // Schnitt 4.5 bei 2 Noten; für 5 im Zeugnis Schnitt 4.75 → (9 + x) / 3 = 4.75 → x = 5.25
    expect(screen.getByText('5.25')).toBeTruthy()
    expect(screen.getByText(/für eine 5 im Zeugnis/)).toBeTruthy()
  })

  it('rechnet mit allen geplanten Tests', () => {
    renderCalc([test('a', '2026-12-01'), test('b', '2026-12-15')])
    expect(screen.getByText(/Geplant bis Semesterende: 2 Tests/)).toBeTruthy()
    // (9 + 2x) / 4 = 4.75 → x = 5
    expect(screen.getByText(/In den 2 Tests je mindestens/).textContent).toContain('5')
  })

  it('Was wäre, wenn: neue Zeugnisnote', async () => {
    renderCalc()
    await userEvent.type(screen.getByLabelText('Erwartete Note'), '6')
    // (4 + 5 + 6) / 3 = 5 → Zeugnis 5
    expect(screen.getByText(/Neuer Schnitt/).textContent).toMatch(/5\.00.*Zeugnis\s*5/)
  })

  it('ungültige Eingabe → Hinweis statt Ergebnis', async () => {
    renderCalc()
    const target = screen.getByDisplayValue('5')
    await userEvent.clear(target)
    await userEvent.type(target, '9')
    expect(screen.getByText(/Ziel zwischen 1 und 6/)).toBeTruthy()
  })
})

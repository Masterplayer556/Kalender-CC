// @vitest-environment jsdom
// Eintrag-Formular und Lernzeit-Menü mit nachgebildeten Daten (useData).
import './dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Entry, StudyBlock } from '../src/types'

const fake = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../src/data/DataProvider', () => ({ useData: () => fake.value }))

const { EntryEditor } = await import('../src/components/EntryEditor')
const { StudyBlockMenu } = await import('../src/components/StudyBlockMenu')
const { ToastProvider } = await import('../src/components/Toast')

const entry: Entry = {
  id: 'e1',
  user_id: 'u',
  title: 'Vokabeltest',
  category: 'test',
  subject_id: null,
  date: '2026-12-10',
  end_date: null,
  start_time: null,
  end_time: null,
  notes: null,
  done: false,
  created_at: '',
  updated_at: '',
}
const block: StudyBlock = { id: 'b1', user_id: 'u', entry_id: 'e1', starts_at: '2026-12-08T16:00:00Z', ends_at: '2026-12-08T17:00:00Z', done: false }

let online = true
const saveEntry = vi.fn()
const setBlockDone = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  online = true
  saveEntry.mockResolvedValue(undefined)
  setBlockDone.mockResolvedValue(undefined)
  fake.value = {
    get online() {
      return online
    },
    entryById: new Map([[entry.id, entry]]),
    blocks: [block],
    blocksByEntry: new Map([[entry.id, [block]]]),
    attachmentsByEntry: new Map(),
    gradesByEntry: new Map(),
    subjects: [],
    periods: [],
    saveEntry,
    deleteEntry: vi.fn(),
    restoreEntry: vi.fn(),
    purgeAttachmentFiles: vi.fn(),
    attachmentUrls: vi.fn().mockResolvedValue(new Map()),
    setBlockDone,
  }
})

const renderEditor = (onClose = vi.fn()) =>
  render(
    <ToastProvider>
      <EntryEditor request={{ entryId: 'e1' }} onClose={onClose} onOpenGrade={() => {}} />
    </ToastProvider>,
  )

describe('Eintrag-Formular', () => {
  it('speichert mit Titel, Lernzeit und ohne gelöschte Lernzeiten', async () => {
    const onClose = vi.fn()
    renderEditor(onClose)
    const title = screen.getByLabelText('Titel')
    await userEvent.clear(title)
    await userEvent.type(title, '  Vokabeltest Unité 4 ')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(saveEntry).toHaveBeenCalledTimes(1)
    const [target, input, blocks, removed] = saveEntry.mock.calls[0]
    expect(target).toEqual({ id: 'e1', create: false })
    expect(input.title).toBe('Vokabeltest Unité 4')
    expect(blocks.map((b: { id: string }) => b.id)).toEqual(['b1'])
    expect(removed).toEqual([])
    expect(onClose).toHaveBeenCalled()
  })

  it('Datum verschoben → offene Lernzeiten lassen sich mitverschieben', async () => {
    renderEditor()
    // Datumsfeld: in jsdom direkt setzen (wie die Auswahl im Kalender des Geräts)
    fireEvent.change(screen.getByLabelText('Datum'), { target: { value: '2026-12-12' } })
    await userEvent.click(screen.getByRole('button', { name: /mitverschieben/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    const [, input, blocks] = saveEntry.mock.calls[0]
    expect(input.date).toBe('2026-12-12')
    expect(blocks[0].date).toBe('2026-12-10') // 08.12. + 2 Tage
  })

  it('leerer Titel → Hinweis statt Speichern', async () => {
    renderEditor()
    await userEvent.clear(screen.getByLabelText('Titel'))
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    expect(saveEntry).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toMatch(/Titel/)
  })

  it('offline: Speichern geht, Löschen und Anhänge nicht', () => {
    online = false
    renderEditor()
    expect(screen.getByText(/sobald du wieder online bist/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Speichern' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'Löschen' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Duplizieren' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('Lernzeit-Menü', () => {
  it('abhaken auch offline', async () => {
    online = false
    const onClose = vi.fn()
    render(<StudyBlockMenu blockId="b1" onClose={onClose} onOpenEntry={() => {}} />)
    expect(screen.getByText(/sobald du wieder online bist/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Als erledigt markieren/ }))
    expect(setBlockDone).toHaveBeenCalledWith('b1', true)
    expect(onClose).toHaveBeenCalled()
  })

  it('Fehler wird angezeigt, Menü bleibt offen', async () => {
    setBlockDone.mockRejectedValueOnce(new Error('Keine Verbindung zum Server.'))
    const onClose = vi.fn()
    render(<StudyBlockMenu blockId="b1" onClose={onClose} onOpenEntry={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /Als erledigt markieren/ }))
    expect(screen.getByRole('alert').textContent).toMatch(/Keine Verbindung/)
    expect(onClose).not.toHaveBeenCalled()
  })
})

import { describe, expect, it } from 'vitest'
import { asQueue, dueItems, enqueue } from '../src/lib/purge'

describe('Aufräum-Liste für Dateien', () => {
  const a = { id: 'a', path: 'u/e/a.docx', due: 100 }
  const b = { id: 'b', path: 'u/e/b.pdf', due: 200 }

  it('ersetzt denselben Anhang statt ihn doppelt aufzunehmen', () => {
    expect(enqueue([a, b], [{ ...a, due: 300 }])).toEqual([b, { ...a, due: 300 }])
  })
  it('liefert Fälliges und ausdrücklich Verlangtes', () => {
    expect(dueItems([a, b], 150)).toEqual([a])
    expect(dueItems([a, b], 50, new Set(['b']))).toEqual([b])
  })
  it('verwirft kaputte Einträge', () => {
    expect(asQueue([a, { id: 1 }, null])).toEqual([a])
    expect(asQueue('x')).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { RETURN_RELOAD_GAP_MS, shouldReloadOnReturn } from '../src/lib/refresh'

describe('Neu laden beim Zurückkehren', () => {
  const t = 1_800_000_000_000
  it('noch nie geladen → laden', () => {
    expect(shouldReloadOnReturn(null, t)).toBe(true)
  })
  it('vor 5 s geladen → nicht laden', () => {
    expect(shouldReloadOnReturn(t - 5_000, t)).toBe(false)
  })
  it('ab 30 s → laden', () => {
    expect(shouldReloadOnReturn(t - RETURN_RELOAD_GAP_MS, t)).toBe(true)
    expect(shouldReloadOnReturn(t - RETURN_RELOAD_GAP_MS + 1, t)).toBe(false)
  })
  it('Uhr zurückgestellt → laden', () => {
    expect(shouldReloadOnReturn(t + 60_000, t)).toBe(true)
  })
})

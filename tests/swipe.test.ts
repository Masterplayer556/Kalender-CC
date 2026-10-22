import { describe, expect, it } from 'vitest'
import { swipeDirection } from '../src/lib/swipe'

describe('Wischen', () => {
  it('links und rechts wechseln in entgegengesetzte Richtungen', () => {
    const left = swipeDirection(-120, 10, 250)
    const right = swipeDirection(120, -10, 250)
    expect(left).not.toBe(0) // ein klarer Wisch muss etwas bewirken
    expect(right).toBe(-left)
  })
  it('zu kurz → kein Wisch (Antippen)', () => {
    expect(swipeDirection(-30, 0, 100)).toBe(0)
  })
  it('zu langsam → kein Wisch', () => {
    expect(swipeDirection(-200, 0, 1500)).toBe(0)
  })
  it('eher senkrecht → Scrollen, kein Wisch', () => {
    expect(swipeDirection(-80, 200, 300)).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { lockAxis, swipeDirection } from '../src/lib/swipe'

const WIDTH = 800 // Breite der Ansicht in Pixeln

describe('Wischen', () => {
  it('nach links → nächster Zeitraum (August → September), nach rechts → vorheriger', () => {
    expect(swipeDirection(-300, 0, WIDTH)).toBe(1)
    expect(swipeDirection(300, 0, WIDTH)).toBe(-1)
  })
  it('kurzer, schneller Schnipp reicht', () => {
    expect(swipeDirection(-80, -0.8, WIDTH)).toBe(1)
    expect(swipeDirection(80, 0.8, WIDTH)).toBe(-1)
  })
  it('kurz und langsam → zurückfedern', () => {
    expect(swipeDirection(-80, -0.05, WIDTH)).toBe(0)
  })
  it('zu kurz → kein Wisch (Antippen)', () => {
    expect(swipeDirection(-30, -2, WIDTH)).toBe(0)
  })
  it('Schnipp zurück zur Mitte zählt nicht', () => {
    expect(swipeDirection(-100, 0.8, WIDTH)).toBe(0)
  })
})

describe('Richtung festlegen', () => {
  it('erst nach ein paar Pixeln', () => {
    expect(lockAxis(4, 3)).toBeNull()
  })
  it('waagrecht → wischen, senkrecht oder schräg → scrollen', () => {
    expect(lockAxis(-20, 5)).toBe('x')
    expect(lockAxis(5, 20)).toBe('y')
    expect(lockAxis(15, 14)).toBe('y')
  })
})

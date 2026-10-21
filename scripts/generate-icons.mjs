// Erzeugt die App-Icons (PNG) in public/ – ohne zusätzliche Pakete.
// Aufruf: npm run icons
//
// Das Bild wird in "normierten" Koordinaten (0 … 1) beschrieben und mit 4×4-Supersampling
// geglättet. Ändern kannst du z. B. die Farben in COLORS.

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const COLORS = {
  background: [37, 99, 235], // Blau
  card: [255, 255, 255],
  header: [239, 68, 68], // Rot
  rings: [30, 58, 138],
  cell: [203, 213, 225],
  highlight: [37, 99, 235],
}

/** Liegt (u, v) in einem Rechteck mit abgerundeten Ecken? */
function inRoundRect(u, v, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(u, x0 + r), x1 - r)
  const cy = Math.min(Math.max(v, y0 + r), y1 - r)
  return u >= x0 && u <= x1 && v >= y0 && v <= y1 && (u - cx) ** 2 + (v - cy) ** 2 <= r * r
}

/** Farbe an Position (u, v). scale < 1 verkleinert das Motiv (für "maskable"-Icons mit Rand). */
function colorAt(u, v, scale) {
  u = (u - 0.5) / scale + 0.5
  v = (v - 0.5) / scale + 0.5
  // Ringe des Kalenderblatts
  if (inRoundRect(u, v, 0.33, 0.17, 0.38, 0.31, 0.025) || inRoundRect(u, v, 0.62, 0.17, 0.67, 0.31, 0.025))
    return COLORS.rings
  if (inRoundRect(u, v, 0.2, 0.24, 0.8, 0.8, 0.07)) {
    if (v < 0.38) return COLORS.header
    // 3 × 2 Kästchen, eines hervorgehoben
    for (const [i, cx] of [0.33, 0.5, 0.67].entries()) {
      for (const [j, cy] of [0.5, 0.66].entries()) {
        if (inRoundRect(u, v, cx - 0.055, cy - 0.055, cx + 0.055, cy + 0.055, 0.02))
          return i === 2 && j === 0 ? COLORS.highlight : COLORS.cell
      }
    }
    return COLORS.card
  }
  return COLORS.background
}

function crc32(buf) {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, scale = 1) {
  const SS = 4 // Supersampling pro Achse
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0 // Filtertyp "keiner"
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0]
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = colorAt((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, scale)
          for (let k = 0; k < 3; k++) sum[k] += c[k]
        }
      const o = y * (size * 3 + 1) + 1 + x * 3
      for (let k = 0; k < 3; k++) raw[o + k] = Math.round(sum[k] / (SS * SS))
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // Bit pro Kanal
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const out = new URL('../public/', import.meta.url)
writeFileSync(new URL('icon-192.png', out), png(192))
writeFileSync(new URL('icon-512.png', out), png(512))
writeFileSync(new URL('icon-maskable-512.png', out), png(512, 0.8)) // Android schneidet den Rand evtl. rund ab
writeFileSync(new URL('apple-touch-icon.png', out), png(180)) // iPad/iPhone Home-Bildschirm
console.log('Icons erzeugt in public/')

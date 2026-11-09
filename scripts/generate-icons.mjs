// Erzeugt die App-Icons in public/ – ohne zusätzliche Pakete:
//   favicon.svg, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
// Aufruf: npm run icons
//
// Das Motiv wird EINMAL als Liste von Formen beschrieben (Koordinaten 0 … 100). Daraus entstehen
// sowohl das SVG als auch die PNGs (eigener kleiner Rasterizer mit Supersampling), damit beide
// gleich aussehen. Farben ändern: PALETTE anpassen.
//
// Stil: Sunset-Theme der App – Verlauf Orange → Rose → Magenta, eine tief stehende Sonne,
// ein leicht schräges Kalenderblatt mit Pflaumen-Kopf und ein "erledigter" Tag mit Häkchen.

import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const PALETTE = {
  orange: '#fb923c',
  rose: '#e11d48',
  magenta: '#86198f',
  plum: '#24101c',
  plumLight: '#4e3546',
  cream: '#fff4ea',
  peach: '#ffb38a',
  dot: '#f0d9cf',
  sun: '#fde68a',
}

// ---------- Motiv ----------

/** Hintergrund (füllt immer die ganze Fläche, wird beim maskable-Icon nicht verkleinert). */
const BACKGROUND = {
  type: 'linear', x1: 0, y1: 0, x2: 100, y2: 100,
  stops: [[0, PALETTE.orange], [0.5, PALETTE.rose], [1, PALETTE.magenta]],
}

const CARD = { x: 19, y: 27, w: 62, h: 57, r: 12 }
const HEADER_BOTTOM = 43
const COLS = [30, 43.3, 56.7, 70]
const ROWS = [53, 63.5, 74]
const DONE = { x: COLS[2], y: ROWS[1] } // hervorgehobener Tag mit Häkchen
const TODAY = { x: COLS[0], y: ROWS[2] } // dezent markierter Tag

const SHAPES = [
  // Sonne: weicher Schein + Scheibe, steht hinter dem Blatt
  { shape: 'circle', cx: 75, cy: 23, r: 36, fill: { type: 'radial', cx: 75, cy: 23, r: 36, stops: [[0, PALETTE.sun, 0.9], [0.35, PALETTE.peach, 0.45], [1, PALETTE.peach, 0]] } },
  { shape: 'circle', cx: 75, cy: 23, r: 11.5, fill: { type: 'linear', x1: 75, y1: 11.5, x2: 75, y2: 34.5, stops: [[0, '#fffbeb'], [0.5, PALETTE.sun], [1, '#fdba74']] } },

  // Hinteres Blatt (Tiefe), leicht gedreht
  { shape: 'rect', ...CARD, rot: 9, fill: '#ffffff', opacity: 0.25 },
  // Schatten des Blatts
  { shape: 'rect', ...CARD, y: CARD.y + 3.5, rot: -4, soft: 4.5, fill: '#3b0724', opacity: 0.45 },
  // Kalenderblatt
  { shape: 'rect', ...CARD, rot: -4, fill: { type: 'linear', x1: 50, y1: CARD.y, x2: 50, y2: CARD.y + CARD.h, stops: [[0, '#ffffff'], [1, PALETTE.cream]] } },
  // Kopf des Blatts (nur der obere Teil der Karte)
  { shape: 'rect', ...CARD, rot: -4, clipBottom: HEADER_BOTTOM, fill: { type: 'linear', x1: 19, y1: 27, x2: 81, y2: 43, stops: [[0, PALETTE.plumLight], [1, PALETTE.plum]] } },
  // "Monatsname" im Kopf
  { shape: 'rect', x: 27, y: 33.5, w: 20, h: 3.6, r: 1.8, rot: -4, fill: PALETTE.peach },
  { shape: 'rect', x: 50, y: 33.5, w: 7, h: 3.6, r: 1.8, rot: -4, fill: PALETTE.peach, opacity: 0.45 },
  // Ringe
  ...[35, 65].map((x) => ({ shape: 'rect', x: x - 2.6, y: 20, w: 5.2, h: 13, r: 2.6, rot: -4, fill: { type: 'linear', x1: x - 2.6, y1: 0, x2: x + 2.6, y2: 0, stops: [[0, '#ffffff'], [1, PALETTE.dot]] } })),

  // Tage als Punkte
  ...ROWS.flatMap((y) =>
    COLS.filter((x) => !(x === DONE.x && y === DONE.y) && !(x === TODAY.x && y === TODAY.y)).map((x) => ({
      shape: 'circle', cx: x, cy: y, r: 2.7, rot: -4, fill: PALETTE.dot,
    })),
  ),
  // "Heute": Ring
  { shape: 'ring', cx: TODAY.x, cy: TODAY.y, r: 4.4, width: 1.4, rot: -4, fill: PALETTE.rose },
  // Erledigter Tag: Glühen + Verlaufsscheibe + Häkchen
  { shape: 'circle', cx: DONE.x, cy: DONE.y + 1.5, r: 7.5, soft: 3, rot: -4, fill: PALETTE.rose, opacity: 0.5 },
  { shape: 'circle', cx: DONE.x, cy: DONE.y, r: 7.5, rot: -4, fill: { type: 'linear', x1: DONE.x - 7.5, y1: DONE.y - 7.5, x2: DONE.x + 7.5, y2: DONE.y + 7.5, stops: [[0, PALETTE.orange], [0.55, PALETTE.rose], [1, PALETTE.magenta]] } },
  { shape: 'polyline', points: [[DONE.x - 3.4, DONE.y + 0.2], [DONE.x - 0.9, DONE.y + 2.8], [DONE.x + 3.6, DONE.y - 2.6]], width: 2.3, rot: -4, fill: '#ffffff' },
]

// Gedrehte Formen drehen (wenn nicht anders angegeben) alle um die Kartenmitte – so bleibt der Inhalt auf dem Blatt.
for (const s of SHAPES) if (s.rot && !s.pivot) s.pivot = [CARD.x + CARD.w / 2, CARD.y + CARD.h / 2]

// ---------- Farben ----------

function hex(c) {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (t) => Math.min(1, Math.max(0, t))
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/** Farbe + Deckkraft einer Füllung am Punkt (u, v) → [r, g, b, a] */
function paint(fill, u, v) {
  if (typeof fill === 'string') return [...hex(fill), 1]
  let t
  if (fill.type === 'linear') {
    const dx = fill.x2 - fill.x1
    const dy = fill.y2 - fill.y1
    t = ((u - fill.x1) * dx + (v - fill.y1) * dy) / (dx * dx + dy * dy)
  } else {
    t = Math.hypot(u - fill.cx, v - fill.cy) / fill.r
  }
  t = clamp01(t)
  const stops = fill.stops
  let i = 0
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++
  const [t0, c0, a0 = 1] = stops[i]
  const [t1, c1, a1 = 1] = stops[i + 1]
  const k = t1 === t0 ? 0 : clamp01((t - t0) / (t1 - t0))
  const A = hex(c0)
  const B = hex(c1)
  return [lerp(A[0], B[0], k), lerp(A[1], B[1], k), lerp(A[2], B[2], k), lerp(a0, a1, k)]
}

// ---------- Abstandsfunktionen (negativ = innen) ----------

function sdRoundRect(u, v, s) {
  const cx = s.x + s.w / 2
  const cy = s.y + s.h / 2
  const qx = Math.abs(u - cx) - s.w / 2 + s.r
  const qy = Math.abs(v - cy) - s.h / 2 + s.r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - s.r
}
function sdSegment(u, v, [ax, ay], [bx, by]) {
  const px = u - ax
  const py = v - ay
  const dx = bx - ax
  const dy = by - ay
  const h = clamp01((px * dx + py * dy) / (dx * dx + dy * dy))
  return Math.hypot(px - dx * h, py - dy * h)
}
function sdf(s, u, v) {
  switch (s.shape) {
    case 'rect':
      return sdRoundRect(u, v, s)
    case 'circle':
      return Math.hypot(u - s.cx, v - s.cy) - s.r
    case 'ring':
      return Math.abs(Math.hypot(u - s.cx, v - s.cy) - s.r) - s.width / 2
    case 'polyline': {
      let d = Infinity
      for (let i = 0; i < s.points.length - 1; i++) d = Math.min(d, sdSegment(u, v, s.points[i], s.points[i + 1]))
      return d - s.width / 2
    }
  }
}

/** Punkt in das (ungedrehte) Koordinatensystem der Form zurückdrehen. */
function local(s, u, v) {
  if (!s.rot) return [u, v]
  const a = (-s.rot * Math.PI) / 180
  const [px, py] = s.pivot
  const dx = u - px
  const dy = v - py
  return [px + dx * Math.cos(a) - dy * Math.sin(a), py + dx * Math.sin(a) + dy * Math.cos(a)]
}

// ---------- PNG ----------

/** Farbe an (u, v) in 0 … 100. scale < 1 verkleinert das Motiv (maskable-Icon mit Rand). */
function colorAt(u, v, scale, aa) {
  const c = paint(BACKGROUND, u, v).slice(0, 3)
  u = (u - 50) / scale + 50
  v = (v - 50) / scale + 50
  for (const s of SHAPES) {
    const [lu, lv] = local(s, u, v)
    const d = sdf(s, lu, lv)
    let cover
    if (s.soft) cover = 1 - smoothstep(-s.soft, s.soft, d)
    else cover = clamp01(0.5 - d / aa) // weiche Kante über ca. 1 Pixel
    if (s.clipBottom !== undefined && lv > s.clipBottom) cover *= clamp01(0.5 - (lv - s.clipBottom) / aa)
    if (cover <= 0) continue
    const p = paint(s.fill, lu, lv)
    const a = cover * p[3] * (s.opacity ?? 1)
    for (let k = 0; k < 3; k++) c[k] = c[k] * (1 - a) + p[k] * a
  }
  return c
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
  const SS = 3 // Supersampling pro Achse
  const px = 100 / size // Grösse eines Pixels in Motiv-Koordinaten
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0 // Filtertyp "keiner"
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0]
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = colorAt((x + (sx + 0.5) / SS) * px, (y + (sy + 0.5) / SS) * px, scale, px / scale / SS)
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
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- SVG ----------

const n = (x) => +x.toFixed(2)

function svg() {
  const defs = []
  let id = 0
  const fillRef = (fill) => {
    if (typeof fill === 'string') return fill
    const gid = `g${id++}`
    const stops = fill.stops
      .map(([t, c, a = 1]) => `<stop offset="${t}" stop-color="${c}"${a !== 1 ? ` stop-opacity="${a}"` : ''}/>`)
      .join('')
    defs.push(
      fill.type === 'linear'
        ? `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${n(fill.x1)}" y1="${n(fill.y1)}" x2="${n(fill.x2)}" y2="${n(fill.y2)}">${stops}</linearGradient>`
        : `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="${n(fill.cx)}" cy="${n(fill.cy)}" r="${n(fill.r)}">${stops}</radialGradient>`,
    )
    return `url(#${gid})`
  }

  const body = [`<rect width="100" height="100" rx="22" fill="${fillRef(BACKGROUND)}"/>`]
  for (const s of SHAPES) {
    const attrs = []
    if (s.rot) attrs.push(`transform="rotate(${s.rot} ${n(s.pivot[0])} ${n(s.pivot[1])})"`)
    if (s.opacity !== undefined) attrs.push(`opacity="${s.opacity}"`)
    if (s.soft) {
      const fid = `f${id++}`
      defs.push(`<filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(s.soft / 2)}"/></filter>`)
      attrs.push(`filter="url(#${fid})"`)
    }
    if (s.clipBottom !== undefined) {
      const cid = `c${id++}`
      defs.push(`<clipPath id="${cid}"><rect x="0" y="0" width="100" height="${n(s.clipBottom)}"/></clipPath>`)
      attrs.push(`clip-path="url(#${cid})"`)
    }
    const fill = fillRef(s.fill)
    const a = attrs.length ? ' ' + attrs.join(' ') : ''
    if (s.shape === 'rect')
      body.push(`<rect x="${n(s.x)}" y="${n(s.y)}" width="${n(s.w)}" height="${n(s.h)}" rx="${n(s.r)}" fill="${fill}"${a}/>`)
    else if (s.shape === 'circle') body.push(`<circle cx="${n(s.cx)}" cy="${n(s.cy)}" r="${n(s.r)}" fill="${fill}"${a}/>`)
    else if (s.shape === 'ring')
      body.push(`<circle cx="${n(s.cx)}" cy="${n(s.cy)}" r="${n(s.r)}" fill="none" stroke="${fill}" stroke-width="${n(s.width)}"${a}/>`)
    else if (s.shape === 'polyline')
      body.push(
        `<polyline points="${s.points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="none" stroke="${fill}" stroke-width="${n(s.width)}" stroke-linecap="round" stroke-linejoin="round"${a}/>`,
      )
  }
  // Clip auf die abgerundete Grundfläche, damit Sonnenschein & Co. nicht über den Rand ragen
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    `<defs><clipPath id="bg"><rect width="100" height="100" rx="22"/></clipPath>${defs.join('')}</defs>`,
    `<g clip-path="url(#bg)">`,
    ...body.map((l) => '  ' + l),
    '</g>',
    '</svg>',
    '',
  ].join('\n')
}

// ---------- Ausgabe ----------

const out = new URL('../public/', import.meta.url)
writeFileSync(new URL('favicon.svg', out), svg())
writeFileSync(new URL('icon-192.png', out), png(192))
writeFileSync(new URL('icon-512.png', out), png(512))
writeFileSync(new URL('icon-maskable-512.png', out), png(512, 0.8)) // Android schneidet den Rand evtl. rund ab
writeFileSync(new URL('apple-touch-icon.png', out), png(180)) // iPad/iPhone Home-Bildschirm
console.log('Icons erzeugt in public/')

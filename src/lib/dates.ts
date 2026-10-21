// Datumslogik der App.
//
// Ein Kalendertag wird überall als Text "JJJJ-MM-TT" (ein "DateKey") weitergegeben.
// Vorteil: Keine Zeitzonen-Überraschungen, einfach vergleichbar (Textvergleich = Datumsvergleich)
// und genau das Format, das Postgres für den Typ "date" verwendet.

export type DateKey = string

const LOCALE = 'de-CH'

const pad = (n: number) => String(n).padStart(2, '0')

/** Date-Objekt (lokale Zeit) → "JJJJ-MM-TT" */
export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "JJJJ-MM-TT" → Date um 00:00 Uhr lokaler Zeit */
export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey(): DateKey {
  return toDateKey(new Date())
}

export function isDateKey(value: string | undefined): value is DateKey {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDateKey(value).getTime())
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + days) // setDate rechnet Monats-/Jahreswechsel selbst um
  return toDateKey(d)
}

/** Monate addieren; der Tag wird gekürzt, falls es ihn nicht gibt (31.01. + 1 Monat → 28./29.02.). */
export function addMonths(key: DateKey, months: number): DateKey {
  const d = parseDateKey(key)
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), lastDay))
  return toDateKey(target)
}

/** Montag der Woche, in der der Tag liegt. */
export function startOfWeek(key: DateKey): DateKey {
  const d = parseDateKey(key)
  const mondayOffset = (d.getDay() + 6) % 7 // getDay(): 0 = Sonntag … 6 = Samstag
  return addDays(key, -mondayOffset)
}

export function startOfMonth(key: DateKey): DateKey {
  return key.slice(0, 8) + '01'
}

/** Die 7 Tage (Mo–So) der Woche, in der der Tag liegt. */
export function weekDays(key: DateKey): DateKey[] {
  const monday = startOfWeek(key)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** Monatsraster: Liste von Wochen (je 7 Tage, ab Montag), die den ganzen Monat abdecken. */
export function monthGrid(key: DateKey): DateKey[][] {
  const first = startOfMonth(key)
  const last = addDays(addMonths(first, 1), -1)
  const weeks: DateKey[][] = []
  // Textvergleich funktioniert, weil "JJJJ-MM-TT" chronologisch sortiert
  for (let monday = startOfWeek(first); monday <= last; monday = addDays(monday, 7)) {
    weeks.push(weekDays(monday))
  }
  return weeks
}

/** Anzahl Tage von "from" bis "to" (negativ, wenn "to" vorher liegt). Unabhängig von Sommerzeit. */
export function daysBetween(from: DateKey, to: DateKey): number {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** "in 3 Tagen", "morgen", "heute", "gestern", "vor 5 Tagen" */
export function countdown(today: DateKey, key: DateKey): string {
  const n = daysBetween(today, key)
  if (n === 0) return 'heute'
  if (n === 1) return 'morgen'
  if (n === 2) return 'übermorgen'
  if (n === -1) return 'gestern'
  return n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`
}

// ---------------------------------------------------------------------
// Formatierung für die Anzeige
// ---------------------------------------------------------------------

/** "20.10.2026" */
export function formatDate(key: DateKey): string {
  const [y, m, d] = key.split('-')
  return `${d}.${m}.${y}`
}

/** "Di" oder "Dienstag" */
export function formatWeekday(key: DateKey, style: 'short' | 'long' = 'short'): string {
  return parseDateKey(key).toLocaleDateString(LOCALE, { weekday: style }).replace('.', '')
}

/** "Oktober 2026" */
export function formatMonthYear(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })
}

/** "Dienstag, 20.10.2026" */
export function formatLongDate(key: DateKey): string {
  return `${formatWeekday(key, 'long')}, ${formatDate(key)}`
}

/** "19.10. – 25.10.2026" */
export function formatWeekRange(key: DateKey): string {
  const days = weekDays(key)
  return `${formatDate(days[0]).slice(0, 6)} – ${formatDate(days[6])}`
}

// ---------------------------------------------------------------------
// Uhrzeiten
// ---------------------------------------------------------------------

/** "17:30:00" oder "17:30" → "17:30" */
export function formatTime(time: string): string {
  return time.slice(0, 5)
}

/** "17:30" → 1050 (Minuten seit Mitternacht) */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** 1050 → "17:30" */
export function minutesToTime(minutes: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)))
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

/** Datum + Uhrzeit (lokale Zeit des Geräts) → ISO-Zeitstempel für die Datenbank */
export function localToIso(date: DateKey, time: string): string {
  const d = parseDateKey(date)
  const [h, m] = time.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

/** ISO-Zeitstempel → { date, time } in lokaler Zeit des Geräts */
export function isoToLocal(iso: string): { date: DateKey; time: string } {
  const d = new Date(iso)
  return { date: toDateKey(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}

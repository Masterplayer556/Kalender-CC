// Zeiträume (Ferien, schulfreie Tage, Lager): Arten, Nachschlagen pro Tag, Countdown bis zu den Ferien.

import { addDays, daysBetween, parseDateKey, type DateKey } from './dates'
import type { Period, PeriodKind } from '../types'

export const PERIOD_KINDS: Record<PeriodKind, { label: string; icon: string; color: string; placeholder: string }> = {
  ferien: { label: 'Ferien', icon: '🏖️', color: '#14b8a6', placeholder: 'z. B. Herbstferien' },
  frei: { label: 'Schulfrei', icon: '🎈', color: '#f59e0b', placeholder: 'z. B. Auffahrt, Weiterbildung Lehrer' },
  lager: { label: 'Lager & Reisen', icon: '🎒', color: '#8b5cf6', placeholder: 'z. B. Skilager, Projektwoche' },
}

export const PERIOD_KIND_KEYS = Object.keys(PERIOD_KINDS) as PeriodKind[]

/** Liegt der Tag im Zeitraum (beide Enden inklusive)? */
export function periodCovers(p: Pick<Period, 'start_date' | 'end_date'>, day: DateKey): boolean {
  return p.start_date <= day && day <= p.end_date
}

/** Anzahl Tage eines Zeitraums, beide Enden mitgezählt (03.10.–18.10. = 16 Tage) */
export function periodLength(p: Pick<Period, 'start_date' | 'end_date'>): number {
  return daysBetween(p.start_date, p.end_date) + 1
}

/** Nach Beginn sortiert, bei gleichem Beginn der längere zuerst (liegt dann im Kalender oben). */
export function comparePeriods(a: Period, b: Period): number {
  return a.start_date.localeCompare(b.start_date) || b.end_date.localeCompare(a.end_date) || a.name.localeCompare(b.name)
}

/** Alle Zeiträume, die einen der Tage berühren – pro Tag nachschlagbar. */
export function periodsByDay(periods: Period[], days: DateKey[]): Map<DateKey, Period[]> {
  const sorted = [...periods].sort(comparePeriods)
  return new Map(days.map((day) => [day, sorted.filter((p) => periodCovers(p, day))]))
}

const isWeekend = (day: DateKey) => {
  const weekday = parseDateKey(day).getDay()
  return weekday === 0 || weekday === 6
}

/**
 * Schultage von heute (inklusive) bis vor "until": Mo–Fr, ohne Tage in irgendeinem Zeitraum.
 * (Auch Lager zählen nicht als Schultag – da sitzt man nicht im Schulzimmer.)
 */
export function schoolDaysUntil(today: DateKey, until: DateKey, periods: Period[]): number {
  let count = 0
  for (let day = today; day < until; day = addDays(day, 1)) {
    if (!isWeekend(day) && !periods.some((p) => periodCovers(p, day))) count++
  }
  return count
}

export type HolidayStatus =
  | { state: 'during'; period: Period; daysLeft: number } // daysLeft: inkl. heute
  | { state: 'upcoming'; period: Period; daysUntil: number; schoolDays: number }
  | null

/**
 * Für die "Heute"-Übersicht: Sind gerade Ferien? Sonst: Wann kommen die nächsten?
 * Zählt nur die Art "Ferien" (ein einzelner freier Tag ist kein Countdown wert).
 */
export function holidayStatus(periods: Period[], today: DateKey): HolidayStatus {
  const ferien = periods.filter((p) => p.kind === 'ferien').sort(comparePeriods)
  const current = ferien.filter((p) => periodCovers(p, today)).sort((a, b) => b.end_date.localeCompare(a.end_date))[0]
  if (current) return { state: 'during', period: current, daysLeft: daysBetween(today, current.end_date) + 1 }
  const next = ferien.find((p) => p.start_date > today)
  if (!next) return null
  return {
    state: 'upcoming',
    period: next,
    daysUntil: daysBetween(today, next.start_date),
    schoolDays: schoolDaysUntil(today, next.start_date, periods),
  }
}

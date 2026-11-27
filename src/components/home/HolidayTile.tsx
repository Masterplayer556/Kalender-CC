// Kachel "Ferien": Countdown bis zu den nächsten Ferien mit Schultagen und Fortschritt seit den letzten.

import { useData } from '../../data/DataProvider'
import { daysBetween, weeksAndDays, type DateKey } from '../../lib/dates'
import { comparePeriods, holidayStatus } from '../../lib/periods'
import { Icon } from '../Icon'
import type { PeriodRequest } from '../PeriodEditor'
import { useTheme } from '../ThemeProvider'
import { Countdown, Tile } from './Tile'

export function HolidayTile({ today, onOpenPeriod }: { today: DateKey; onOpenPeriod: (req: PeriodRequest) => void }) {
  const { theme } = useTheme()
  const neon = theme === 'neon'
  const { periods, periodsMissing } = useData()
  const holiday = holidayStatus(periods, today)
  const lastFerien = periods
    .filter((p) => p.kind === 'ferien' && p.end_date < today)
    .sort(comparePeriods)
    .at(-1)
  const ferienProgress =
    holiday?.state === 'upcoming' && lastFerien
      ? daysBetween(lastFerien.end_date, today) / Math.max(1, daysBetween(lastFerien.end_date, holiday.period.start_date))
      : null
  return (
    <Tile
      i={1}
      className="tile tone-1 col-span-1 flex min-h-[170px] flex-col p-4 md:col-span-3 md:p-5 lg:col-span-4"
      onClick={() => (holiday ? onOpenPeriod({ periodId: holiday.period.id }) : onOpenPeriod({}))}
      label="Ferien"
    >
      <div className="flex items-center justify-between">
        <span className="tag-label">Ferien</span>
        {/* Sonne dreht sich ganz langsam */}
        <Icon name="sun" className="tone-ink h-6 w-6 animate-[spin_26s_linear_infinite]" />
      </div>
      {periodsMissing ? (
        <p className="muted mt-auto text-sm">Ferien sind noch nicht eingerichtet (siehe README).</p>
      ) : !holiday ? (
        <p className="mt-auto text-[15px] font-bold">Ferien eintragen, um den Countdown zu sehen →</p>
      ) : holiday.state === 'during' ? (
        <div className="mt-auto">
          <div className="num text-5xl md:text-6xl">{neon ? 'JETZT' : 'Ferien!'}</div>
          <div className="mt-1 truncate font-bold">{holiday.period.name}</div>
          <div className="muted text-sm">{holiday.daysLeft === 1 ? 'Letzter Tag – geniessen!' : `noch ${holiday.daysLeft} Tage`}</div>
        </div>
      ) : (
        <div className="mt-auto">
          <div className="num text-5xl md:text-[64px]"><Countdown days={holiday.daysUntil} delay={80} /></div>
          <div className="mt-1 leading-tight font-bold">
            {neon ? holiday.period.name : `Tage bis ${holiday.period.name}`}
          </div>
          {weeksAndDays(holiday.daysUntil) && <div className="text-sm font-semibold opacity-85">= {weeksAndDays(holiday.daysUntil)}</div>}
          <div className="muted text-sm">
            noch {holiday.schoolDays} {holiday.schoolDays === 1 ? 'Schultag' : 'Schultage'}
          </div>
          {ferienProgress !== null && (
            <div className={`mt-3 h-2 overflow-hidden bg-(--line) ${neon ? 'rounded-[2px]' : 'rounded-full'}`}>
              <div
                className={`bar-grow h-full ${neon ? '' : 'rounded-full'}`}
                style={{ width: `${Math.min(100, Math.max(4, ferienProgress * 100))}%`, background: neon ? 'var(--neon-2)' : 'var(--btn-bg)' }}
              />
            </div>
          )}
        </div>
      )}
    </Tile>
  )
}

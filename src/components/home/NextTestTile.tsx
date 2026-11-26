// Kachel "Nächster Test": Countdown, Titel, Fach und Lernfortschritt.

import { useData } from '../../data/DataProvider'
import { daysBetween, formatDate, formatTime, formatWeekday, type DateKey } from '../../lib/dates'
import type { Entry } from '../../types'
import { useTheme } from '../ThemeProvider'
import { Countdown, Tile } from './Tile'

export function NextTestTile({ nextTest, today, onOpenEntry }: { nextTest: Entry | undefined; today: DateKey; onOpenEntry: (id: string) => void }) {
  const { theme } = useTheme()
  const neon = theme === 'neon'
  const { subjectById, blocksByEntry } = useData()
  const testBlocks = nextTest ? (blocksByEntry.get(nextTest.id) ?? []) : []
  const testDone = testBlocks.filter((b) => b.done).length
  const testDays = nextTest ? daysBetween(today, nextTest.date) : 0
  return (
    <Tile
      i={0}
      className={`tile-hero col-span-2 min-h-[210px] p-5 md:col-span-6 md:p-6 lg:col-span-8`}
      onClick={nextTest ? () => onOpenEntry(nextTest.id) : undefined}
      label={nextTest ? `Nächster Test: ${nextTest.title}` : 'Kein Test geplant'}
    >
      {/* Sonne und Strahlen (Sunset) bzw. Eck-Winkel und Lichtstreifen (Neon) kommen aus index.css (.tile-hero) */}
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between gap-2">
          <span className={neon ? 'tag-label ink-accent' : 'tag-label rounded-full bg-white/20 px-3 py-1.5 backdrop-blur-sm'}>
            {nextTest && <span aria-hidden className="live-dot" />}
            {neon ? 'Next_Test' : 'Nächster Test'}
          </span>
          {nextTest && (
            <span className={`text-sm font-bold ${neon ? 'font-mono' : ''}`}>
              {formatWeekday(nextTest.date)} {formatDate(nextTest.date).slice(0, 6)}
              {nextTest.start_time && ` · ${formatTime(nextTest.start_time)}`}
            </span>
          )}
        </div>
        {nextTest ? (
          <>
            <div className="mt-auto flex flex-wrap items-end gap-x-4 gap-y-1 pt-3">
              <span className={`num text-[96px] md:text-[128px] ${neon ? 'ink-accent text-[64px]! md:text-[88px]!' : ''}`}>
                {testDays === 0 ? (neon ? 'HEUTE' : '0') : <Countdown days={testDays} />}
              </span>
              <span className="min-w-0 pb-2 md:pb-4">
                {!neon && <span className="block text-xl font-extrabold md:text-2xl">{testDays === 0 ? 'Heute ist es so weit' : testDays === 1 ? 'Tag bis' : 'Tage bis'}</span>}
                <span className="block text-xl leading-tight font-extrabold md:text-[28px]">{nextTest.title}</span>
                {nextTest.subject_id && (
                  <span className="block text-sm font-semibold opacity-85">{subjectById.get(nextTest.subject_id)?.name}</span>
                )}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              {testBlocks.length > 0 ? (
                <>
                  <div className={`progress-cells flex-1 ${neon ? '' : 'text-white'}`}>
                    {testBlocks.map((b) => (
                      <span key={b.id} className={b.done ? 'on' : ''} />
                    ))}
                  </div>
                  <span className={`shrink-0 text-sm font-bold ${neon ? 'font-mono' : ''}`}>
                    {testDone}/{testBlocks.length} gelernt
                  </span>
                </>
              ) : (
                <span className="text-sm font-semibold opacity-85">Noch keine Lernzeiten geplant – im Test hinzufügen.</span>
              )}
            </div>
          </>
        ) : (
          <div className="mt-auto pt-6">
            <div className="num text-5xl md:text-6xl">{neon ? 'NULL_TESTS' : 'Kein Test'}</div>
            <p className="mt-2 font-semibold opacity-85">In nächster Zeit steht kein Test an. Geniess es!</p>
          </div>
        )}
      </div>
    </Tile>
  )
}

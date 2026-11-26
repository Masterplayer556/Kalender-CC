// Kachel "Lernwoche": gelernte und geplante Stunden dieser Woche, Ring bzw. Raster und ein Balken pro Fach.

import { useData } from '../../data/DataProvider'
import { blockTerms, entryColor } from '../../lib/categories'
import { blockMinutes, formatDuration, hours, studyWeek } from '../../lib/week'
import type { StudyBlock } from '../../types'
import { CountUp } from '../CountUp'
import { useTheme } from '../ThemeProvider'
import { Tile } from './Tile'

/** weekBlocks: Lernzeiten dieser Woche (nur solche mit Eintrag), nach Beginn sortiert */
export function StudyWeekTile({ weekBlocks, onOpenBlock }: { weekBlocks: StudyBlock[]; onOpenBlock: (id: string) => void }) {
  const { theme } = useTheme()
  const neon = theme === 'neon'
  const { entryById, subjectById } = useData()
  const colorOf = (b: StudyBlock) => entryColor(entryById.get(b.entry_id)!, subjectById)
  // Lernzeit in Minuten (eine IVE-Lektion zählt weniger als ein ganzer Abend), gesamt und pro Fach
  const study = studyWeek(weekBlocks, (b) => entryById.get(b.entry_id)?.subject_id ?? null)
  return (
    <Tile i={3} className="tile tone-2 col-span-2 flex flex-col gap-3 p-4 md:col-span-3 md:p-5 lg:col-span-4" label="Lernzeiten diese Woche">
      <div className="flex items-center gap-4">
        {neon ? (
          <div className="min-w-0 flex-1">
            <span className="tag-label">Lernzeiten · KW</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="num ink-accent text-5xl"><CountUp value={hours(study.done)} delay={200} format={(n) => String(Math.round(n * 10) / 10)} /></span>
              <span className="num muted text-2xl">/{hours(study.planned)} h</span>
            </div>
            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(18px,1fr))] gap-1">
              {weekBlocks.map((b) => (
                <button
                  key={b.id}
                  className="aspect-square rounded-[3px] border"
                  style={b.done ? { background: colorOf(b), borderColor: 'transparent' } : { borderColor: 'var(--line)' }}
                  aria-label={`${blockTerms(entryById.get(b.entry_id)!.category).one} ${entryById.get(b.entry_id)!.title}, ${formatDuration(blockMinutes(b))}`}
                  onClick={() => onOpenBlock(b.id)}
                />
              ))}
              {weekBlocks.length === 0 && <span className="muted col-span-full text-sm">keine geplant</span>}
            </div>
          </div>
        ) : (
          <>
            <WeekRing blocks={weekBlocks} colorOf={colorOf} />
            <div className="min-w-0">
              <div className="muted text-sm font-semibold">Lernplan diese Woche</div>
              <div className="num mt-1 text-4xl">
                <CountUp value={hours(study.done)} delay={200} format={(n) => String(Math.round(n * 10) / 10)} />{' '}
                <span className="text-xl font-bold">von {hours(study.planned)} h</span>
              </div>
              <div className="muted mt-1 text-sm">
                {weekBlocks.length
                  ? `${weekBlocks.filter((b) => b.done).length} von ${weekBlocks.length} Lernzeiten erledigt`
                  : 'Noch keine Lernzeiten geplant'}
              </div>
            </div>
          </>
        )}
      </div>
      {/* Pro Fach ein Balken: heller Teil = geplant, voller Teil = erledigt */}
      {study.bySubject.length > 1 && (
        <ul className="space-y-1.5" aria-label="Lernzeit pro Fach">
          {study.bySubject.slice(0, 4).map((t) => {
            const color = t.subjectId ? (subjectById.get(t.subjectId)?.color ?? 'var(--accent)') : 'var(--accent)'
            const name = t.subjectId ? (subjectById.get(t.subjectId)?.name ?? 'Fach') : 'ohne Fach'
            return (
              <li key={t.subjectId ?? '-'} className="grid grid-cols-[minmax(0,5.5rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs font-semibold">
                <span className="truncate">{name}</span>
                <span className={`relative h-2 overflow-hidden bg-(--line) ${neon ? 'rounded-[2px]' : 'rounded-full'}`}>
                  <span
                    className="absolute inset-y-0 left-0 opacity-35"
                    style={{ width: `${(t.planned / study.bySubject[0].planned) * 100}%`, background: color }}
                  />
                  <span
                    className="bar-grow absolute inset-y-0 left-0"
                    style={{ width: `${(t.done / study.bySubject[0].planned) * 100}%`, background: color }}
                  />
                </span>
                <span className={`muted tabular-nums ${neon ? 'font-mono' : ''}`}>
                  {formatDuration(t.done)} / {formatDuration(t.planned)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Tile>
  )
}

/** Ring mit einem Segment pro Lernzeit der Woche, so lang wie ihre Dauer (erledigte in Fachfarbe) */
function WeekRing({ blocks, colorOf }: { blocks: StudyBlock[]; colorOf: (b: StudyBlock) => string }) {
  const r = 44
  const c = 2 * Math.PI * r
  const minutes = blocks.map(blockMinutes)
  const total = minutes.reduce((a, b) => a + b, 0)
  const done = blocks.reduce((sum, b, i) => sum + (b.done ? minutes[i] : 0), 0)
  const gap = blocks.length > 1 ? 4 : 0
  // Länge jedes Segments und wo es beginnt (Summe der vorherigen)
  const slots = minutes.map((m) => (total ? (m / total) * c : 0))
  const starts = slots.map((_, i) => slots.slice(0, i).reduce((a, b) => a + b, 0))
  return (
    <div className="relative h-[116px] w-[116px] shrink-0">
      <svg viewBox="0 0 116 116" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="58" cy="58" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
        {blocks.map((b, i) => {
          const slot = slots[i]
          const start = starts[i]
          return b.done && slot > gap ? (
            <circle
              key={b.id}
              cx="58"
              cy="58"
              r={r}
              fill="none"
              stroke={colorOf(b)}
              strokeWidth="12"
              strokeDasharray={`${slot - gap} ${c - slot + gap}`}
              strokeDashoffset={-start}
            />
          ) : null
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <span>
          <span className="num block text-2xl">{total ? Math.round((done / total) * 100) : 0}%</span>
          <span className="muted block text-[11px] font-semibold">gelernt</span>
        </span>
      </div>
    </div>
  )
}

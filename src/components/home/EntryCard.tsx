import { useData } from '../../data/DataProvider'
import type { Entry } from '../../types'
import { Icon } from '../Icon'
import { useTheme } from '../ThemeProvider'

/** Eintrag in "Dein Tag": Titel, Fach, Haken zum Abhaken */
export function EntryCard({ entry, color, onOpen, onToggle }: { entry: Entry; color: string; onOpen: () => void; onToggle: (done: boolean) => void }) {
  const { subjectById } = useData()
  const { theme } = useTheme()
  return (
    // Farbiger Streifen links in der Fachfarbe
    <div className={`tile flex min-h-16 items-center gap-1 pr-2 ${entry.done ? 'opacity-70' : ''}`} style={{ boxShadow: `inset 5px 0 0 ${color}, var(--tile-shadow)` }}>
      <button className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4.5 text-left" onClick={onOpen}>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[17px] font-bold ${entry.done ? 'muted line-through' : ''}`}>{entry.title}</span>
          <span className="mt-1 flex items-center gap-2 text-[13px]">
            <span
              className={`inline-flex h-[22px] items-center rounded-(--r-chip) px-2 text-xs font-bold ${theme === 'neon' ? 'font-mono uppercase' : ''}`}
              style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
            >
              {entry.subject_id ? subjectById.get(entry.subject_id)?.name : 'ohne Fach'}
            </span>
            <span className="muted">{{ test: 'Test', aufgabe: 'Aufgabe', event: 'Event', sonstiges: 'Sonstiges' }[entry.category]}</span>
          </span>
        </span>
      </button>
      <button
        className="grid h-11 w-11 shrink-0 place-items-center"
        aria-label={entry.done ? `${entry.title} als offen markieren` : `${entry.title} erledigt`}
        aria-pressed={entry.done}
        onClick={() => onToggle(!entry.done)}
      >
        <span
          className={`grid h-7 w-7 place-items-center border-2 ${theme === 'neon' ? 'rounded-md' : 'rounded-[10px]'} ${
            entry.done ? 'border-transparent bg-green-600 text-white' : 'border-(--line)'
          }`}
        >
          {entry.done && <Icon name="check" className="check-pop h-4 w-4" strokeWidth={3.4} />}
        </span>
      </button>
    </div>
  )
}

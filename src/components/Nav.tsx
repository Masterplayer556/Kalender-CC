// Hauptnavigation mit vier Bereichen: Heute · Kalender · Noten · Mehr – plus „Neu“.
//   iPad/Computer: Leiste links (rail)
//   iPhone:        Leiste unten. Sunset: schwebende dunkle Leiste mit erhöhtem „+“ in der Mitte.
//                  Neon: angedockte Leiste mit Lime-Strich, „+“ als Quadrat darüber.

import type { Section } from '../lib/router'
import { Icon, type IconName } from './Icon'
import { useTheme } from './ThemeProvider'

const ITEMS: { section: Section; label: string; icon: IconName }[] = [
  { section: 'heute', label: 'Heute', icon: 'sun' },
  { section: 'kalender', label: 'Kalender', icon: 'calendar' },
  { section: 'noten', label: 'Noten', icon: 'chart' },
  { section: 'mehr', label: 'Mehr', icon: 'grid' },
]

interface NavProps {
  section: Section | null // null = Suche aktiv
  onSection: (s: Section) => void
  onAdd: () => void
  addLabel: string
  canAdd: boolean
}

function Item({ item, active, onClick, rail }: { item: (typeof ITEMS)[number]; active: boolean; onClick: () => void; rail?: boolean }) {
  return (
    <button
      className={`nav-item relative ${rail ? 'h-16 w-full' : 'h-full w-full'}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <Icon name={item.icon} className="h-[22px] w-[22px]" strokeWidth={2.1} />
      {item.label}
    </button>
  )
}

export function SideRail({ section, onSection, onAdd, addLabel, canAdd }: NavProps) {
  const { theme } = useTheme()
  const neon = theme === 'neon'
  return (
    <nav
      aria-label="Bereiche"
      className={`nav-bar nav-rail flex shrink-0 flex-col items-center gap-2 ${
        neon ? 'w-[92px] border-t-0! border-r border-(--line) pt-4' : 'my-3 ml-3 w-[88px] py-4'
      }`}
    >
      <button
        className="nav-plus mb-3 grid h-14 w-14 place-items-center"
        aria-label={addLabel}
        title={canAdd ? addLabel : 'Offline – Änderungen nicht möglich'}
        disabled={!canAdd}
        onClick={onAdd}
      >
        <Icon name="plus" className="h-7 w-7" strokeWidth={2.6} />
      </button>
      {ITEMS.map((item) => (
        <Item key={item.section} item={item} rail active={section === item.section} onClick={() => onSection(item.section)} />
      ))}
    </nav>
  )
}

export function TabBar({ section, onSection, onAdd, addLabel, canAdd }: NavProps) {
  const { theme } = useTheme()
  const plus = (
    <button
      className={`nav-plus grid place-items-center ${theme === 'neon' ? 'h-14 w-14' : 'h-15 w-15 -translate-y-4 border-4 border-(--bg) box-content'}`}
      aria-label={addLabel}
      disabled={!canAdd}
      onClick={onAdd}
    >
      <Icon name="plus" className="h-7 w-7" strokeWidth={2.6} />
    </button>
  )

  if (theme === 'neon') {
    return (
      <>
        <div className="fixed right-4 z-30" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}>
          {plus}
        </div>
        <nav
          aria-label="Bereiche"
          className="nav-bar nav-tabs fixed inset-x-0 bottom-0 z-30 grid grid-cols-4"
          style={{ height: 'calc(env(safe-area-inset-bottom) + 68px)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {ITEMS.map((item) => (
            <Item key={item.section} item={item} active={section === item.section} onClick={() => onSection(item.section)} />
          ))}
        </nav>
      </>
    )
  }

  return (
    <nav
      aria-label="Bereiche"
      className="nav-bar nav-tabs fixed inset-x-3.5 z-30 grid h-[72px] grid-cols-5 items-center px-1.5"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
    >
      {ITEMS.slice(0, 2).map((item) => (
        <Item key={item.section} item={item} active={section === item.section} onClick={() => onSection(item.section)} />
      ))}
      <div className="grid place-items-center">{plus}</div>
      {ITEMS.slice(2).map((item) => (
        <Item key={item.section} item={item} active={section === item.section} onClick={() => onSection(item.section)} />
      ))}
    </nav>
  )
}

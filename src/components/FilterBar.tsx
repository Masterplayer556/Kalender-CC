import { useData } from '../data/DataProvider'
import { Icon } from './Icon'
import { CATEGORIES, CATEGORY_KEYS, NO_SUBJECT_COLOR } from '../lib/categories'
import { EMPTY_FILTERS, NO_SUBJECT, isFilterActive, type Filters } from '../lib/filters'

/** Fügt einen Wert hinzu bzw. entfernt ihn (Ein/Aus-Schalter für Filter-Chips). */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const { subjects } = useData()
  const chipClass = (active: boolean) =>
    `chip font-semibold ${active ? 'border-transparent bg-(--accent) text-(--on-accent)' : 'border-(--line) bg-(--surface)'}`

  const subjectOptions = [
    ...subjects.map((s) => ({ id: s.id, name: s.name, color: s.color })),
    { id: NO_SUBJECT, name: 'ohne Fach', color: NO_SUBJECT_COLOR },
  ]

  return (
    <div className="no-scrollbar flex flex-wrap items-center gap-2 px-4 pb-3 md:px-6">
      {CATEGORY_KEYS.map((c) => (
        <button
          key={c}
          className={chipClass(filters.categories.includes(c))}
          aria-pressed={filters.categories.includes(c)}
          onClick={() => onChange({ ...filters, categories: toggle(filters.categories, c) })}
        >
          <Icon name={CATEGORIES[c].icon} className="h-4 w-4" /> {CATEGORIES[c].label}
        </button>
      ))}
      <span className="mx-1 h-6 w-px bg-slate-300 dark:bg-slate-700" />
      {subjectOptions.map((s) => (
        <button
          key={s.id}
          className={chipClass(filters.subjects.includes(s.id))}
          aria-pressed={filters.subjects.includes(s.id)}
          onClick={() => onChange({ ...filters, subjects: toggle(filters.subjects, s.id) })}
        >
          <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
          {s.name}
        </button>
      ))}
      {isFilterActive(filters) && (
        <button className="chip ink-accent border-transparent font-bold" onClick={() => onChange(EMPTY_FILTERS)}>
          Zurücksetzen
        </button>
      )}
    </div>
  )
}

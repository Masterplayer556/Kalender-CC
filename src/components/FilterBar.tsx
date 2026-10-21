import { useData } from '../data/DataProvider'
import { CATEGORIES, CATEGORY_KEYS, NO_SUBJECT_COLOR } from '../lib/categories'
import { EMPTY_FILTERS, NO_SUBJECT, isFilterActive, type Filters } from '../lib/filters'

/** Fügt einen Wert hinzu bzw. entfernt ihn (Ein/Aus-Schalter für Filter-Chips). */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const { subjects } = useData()
  const chipClass = (active: boolean) =>
    `chip ${active
      ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
      : 'border-slate-300 dark:border-slate-700'}`

  const subjectOptions = [
    ...subjects.map((s) => ({ id: s.id, name: s.name, color: s.color })),
    { id: NO_SUBJECT, name: 'ohne Fach', color: NO_SUBJECT_COLOR },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
      {CATEGORY_KEYS.map((c) => (
        <button
          key={c}
          className={chipClass(filters.categories.includes(c))}
          aria-pressed={filters.categories.includes(c)}
          onClick={() => onChange({ ...filters, categories: toggle(filters.categories, c) })}
        >
          {CATEGORIES[c].icon} {CATEGORIES[c].label}
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
        <button className="chip border-transparent text-blue-700 dark:text-blue-300" onClick={() => onChange(EMPTY_FILTERS)}>
          Zurücksetzen
        </button>
      )}
    </div>
  )
}

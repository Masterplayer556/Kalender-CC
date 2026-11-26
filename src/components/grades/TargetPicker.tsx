import { Icon } from '../Icon'
import { formatGrade } from '../../lib/grades'
import { TARGET_OPTIONS } from '../../lib/targets'

/** Ziel wählen: sieht aus wie ein Chip, ist aber ein natives Auswahlfeld (gut bedienbar auf dem iPad) */
export function TargetPicker({ value, onChange, onHero }: { value: number | undefined; onChange: (v: number | null) => void; onHero?: boolean }) {
  return (
    <label
      className={`chip relative min-h-9 cursor-pointer font-bold ${onHero ? 'border-transparent bg-white/15' : 'border-(--line) bg-(--surface)'}`}
    >
      <Icon name="target" className="h-4 w-4" />
      {value ? `Ziel ${formatGrade(value)}` : 'Ziel setzen'}
      <select
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Notenziel"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">kein Ziel</option>
        {TARGET_OPTIONS.map((t) => (
          <option key={t} value={t}>
            Ziel {formatGrade(t)}
          </option>
        ))}
      </select>
    </label>
  )
}


// Uhrzeit-Auswahl mit zwei Listen (Stunde / Minute).
// Das eingebaute <input type="time"> zeigt je nach Computer-Einstellung "AM/PM" –
// so ist das 24-Stunden-Format garantiert, und auf dem iPad erscheinen bequeme Drehräder.

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

export function TimeInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string // "HH:MM"
  onChange: (value: string) => void
  disabled?: boolean
  label: string // für Screenreader
}) {
  const [h, m] = value.split(':')
  // Falls eine Minute nicht im 5er-Raster liegt (z. B. 17:33), trotzdem anzeigen
  const minutes = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort()

  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <select
        className="input w-auto! px-2"
        value={h}
        disabled={disabled}
        aria-label={`${label} Stunde`}
        onChange={(e) => onChange(`${e.target.value}:${m}`)}
      >
        {HOURS.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <span className="font-semibold">:</span>
      <select
        className="input w-auto! px-2"
        value={m}
        disabled={disabled}
        aria-label={`${label} Minute`}
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
      >
        {minutes.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </div>
  )
}

import { useId } from 'react'

/**
 * Labeled range input styled via accent-color (native = smooth + accessible),
 * with the live value set in tabular numerals — a Zine signature.
 */
export default function Slider({ label, value, onChange, min, max, step = 1, format }) {
  const id = useId()
  return (
    <div className="flex items-center gap-4">
      <label htmlFor={id} className="w-36 shrink-0 text-sm text-muted">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="focus-ink h-1 flex-1 cursor-pointer appearance-auto"
        style={{ accentColor: 'var(--accent)' }}
      />
      <span className="tnum w-14 shrink-0 text-right text-sm font-semibold">
        {format ? format(value) : value}
      </span>
    </div>
  )
}

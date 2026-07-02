import { useId } from 'react'

export default function Select({ label, value, onChange, options, className }) {
  const id = useId()
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1 block text-xs font-semibold tracking-widest text-muted uppercase">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ink w-full cursor-pointer rounded-md border border-border bg-surface-raised px-3 py-2 text-sm hover:border-accent/60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

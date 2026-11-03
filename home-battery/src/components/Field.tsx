import type React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
  hint?: string
  type?: string
  placeholder?: string
}

export function Field({ id, label, value, onChange, suffix, hint, type = 'number', placeholder }: FieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          step="any"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={suffix ? 'pr-16' : undefined}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Stat({ label, value, sub }: { label: React.ReactNode; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

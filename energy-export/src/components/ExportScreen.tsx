import { useState } from 'react'
import { Check, Copy, Loader2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  addDays,
  type Credentials,
  type DayRow,
  type Device,
  fetchDays,
  formatNumber,
  HomeWizardError,
  localDate,
  toSheetRows,
} from '@/lib/homewizard'
import { useStoredState } from '@/lib/storage'

interface Props {
  creds: Credentials
  devices: Device[]
  onLoginExpired: () => void
}

const MAX_DAYS = 366

export function ExportScreen({ creds, devices, onLoginExpired }: Props) {
  const today = localDate()
  const yesterday = addDays(today, -1)
  // remember where the last export ended, so the next one starts the day after
  const [lastTo, setLastTo] = useStoredState<string | null>('energy-export.lastTo', null)
  const [from, setFrom] = useState(() => (lastTo && lastTo < yesterday ? addDays(lastTo, 1) : addDays(yesterday, -6)))
  const [to, setTo] = useState(yesterday)
  const [includeDate, setIncludeDate] = useStoredState('energy-export.includeDate', false)
  const [rows, setRows] = useState<DayRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const dayCount = from && to && from <= to ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 : 0
  const rangeError =
    !from || !to
      ? 'Choose both dates.'
      : from > to
        ? 'The start date must be on or before the end date.'
        : to > today
          ? 'Future days have no numbers yet.'
          : dayCount > MAX_DAYS
            ? `Choose at most ${MAX_DAYS} days.`
            : null

  async function load() {
    setBusy(true)
    setError(null)
    setCopied(false)
    try {
      setRows(await fetchDays(creds, devices, from, to))
    } catch (err) {
      if (err instanceof HomeWizardError && err.kind === 'login') onLoginExpired()
      setError(err instanceof HomeWizardError ? err.message : 'Something went wrong. Try again.')
      setRows(null)
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!rows) return
    const text = toSheetRows(rows, includeDate)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // older browsers: fall back to a hidden textarea
      const area = document.createElement('textarea')
      area.value = text
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    setLastTo(rows[rows.length - 1].date)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasSolar = devices.some((d) => d.type === 'energymeter')

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="from">From</Label>
              <Input id="from" type="date" max={today} value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" max={today} value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          {lastTo && <p className="-mt-2 text-xs text-muted-foreground">Last copied up to {formatDate(lastTo)}.</p>}
          {rangeError && <p className="text-sm text-destructive">{rangeError}</p>}
          <Button size="lg" onClick={load} disabled={busy || !!rangeError}>
            {busy && <Loader2 className="animate-spin" />}
            Fetch {dayCount > 0 && !rangeError ? `${dayCount} ${dayCount === 1 ? 'day' : 'days'}` : ''}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {rows && (
        <Card>
          <CardContent className="grid gap-4">
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-1 py-2 text-left font-medium">Datum</th>
                    <th className="px-1 py-2 text-right font-medium">
                      Stroom&shy;verbruik
                      <br />
                      kWh
                    </th>
                    <th className="px-1 py-2 text-right font-medium">
                      Naar net
                      <br />
                      kWh
                    </th>
                    <th className="px-1 py-2 text-right font-medium">
                      Zon&shy;productie
                      <br />
                      kWh
                    </th>
                    <th className="px-1 py-2 text-right font-medium">
                      Gas
                      <br />
                      m³
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.date} className="border-b last:border-0">
                      <td className="px-1 py-2 whitespace-nowrap">
                        {formatDate(r.date)}
                        {r.date === today && <span className="ml-1 text-xs text-muted-foreground">(so far)</span>}
                      </td>
                      <td className="px-1 py-2 text-right">{show(r.importKwh, 2)}</td>
                      <td className="px-1 py-2 text-right">{show(r.exportKwh, 2)}</td>
                      <td className="px-1 py-2 text-right">
                        {r.solarMissing ? (
                          <TriangleAlert className="ml-auto size-4 text-amber-500" aria-label="No solar data" />
                        ) : hasSolar ? (
                          show(r.solarKwh, 2)
                        ) : (
                          'n/a'
                        )}
                      </td>
                      <td className="px-1 py-2 text-right">{show(r.gasM3, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.some((r) => r.solarMissing) && (
              <p className="flex gap-2 text-xs text-muted-foreground">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                The solar meter has no data for these days (it was probably offline). That cell stays empty in the copy.
              </p>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={includeDate}
                onChange={(e) => setIncludeDate(e.target.checked)}
              />
              Include the date in the copy
            </label>

            <Button size="lg" onClick={copy}>
              {copied ? <Check /> : <Copy />}
              {copied ? 'Copied' : `Copy ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`}
            </Button>
            <p className="text-xs text-muted-foreground">
              In your Sheet, click the first empty cell under {includeDate ? '"Datum"' : '"Stroomverbruik"'} and paste. The
              columns are {includeDate ? 'Datum, ' : ''}Stroomverbruik, Zonnepanelen Opbrengst (to the grid), Zonnepanelen
              productie and Gasverbruik. An empty cell means HomeWizard has no number for that day.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function show(v: number | null, decimals: number) {
  return v === null ? <span className="text-muted-foreground">–</span> : formatNumber(v, decimals)
}

function formatDate(date: string) {
  const [y, m, d] = date.split('-')
  return `${Number(d)}-${Number(m)}-${y}`
}

import { useState } from 'react'
import { Info, Loader2, PlugZap, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Stat } from '@/components/Field'
import { Segmented } from '@/components/Segmented'
import { CHARGING_LOSS, eur, fmtTime, priceSession, type PricedSession, type PriceSlot } from '@/lib/prices'
import { useSettings } from '@/lib/settings'
import { num } from '@/lib/storage'
import { usePrices } from '@/lib/usePrices'

type Day = 'today' | 'tomorrow'
const HOUR = 3600_000

const pad = (n: number) => String(n).padStart(2, '0')
const toHHMM = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Now, rounded up to the next quarter hour. */
function defaultStart() {
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15)
  return d
}

function atTime(day: Day, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const d = new Date()
  if (day === 'tomorrow') d.setDate(d.getDate() + 1)
  d.setHours(h, m, 0, 0)
  return d
}

interface Session extends PricedSession {
  hours: number
  gridKwh: number
  batteryKwh: number
  km: number
}

function calculate(start: Date, end: Date, rate: number, efficiency: number, markup: number, prices: PriceSlot[]): Session {
  const hours = (end.getTime() - start.getTime()) / HOUR
  const gridKwh = rate * hours
  const batteryKwh = gridKwh * (1 - CHARGING_LOSS)
  return { ...priceSession(start, end, rate, prices, markup), hours, gridKwh, batteryKwh, km: batteryKwh * efficiency }
}

export function ChargeCost() {
  const { settings } = useSettings()
  const { prices, error: priceError } = usePrices()

  const [day, setDay] = useState<Day>('today')
  const [startTime, setStartTime] = useState(() => toHHMM(defaultStart()))
  const [endTime, setEndTime] = useState(() => toHHMM(new Date(defaultStart().getTime() + 2 * HOUR)))

  // per-session overrides; start from (and reset to) the saved car settings
  const [rate, setRate] = useState(settings.chargerKw)
  const [efficiency, setEfficiency] = useState(settings.efficiency)
  const isAdjusted = rate !== settings.chargerKw || efficiency !== settings.efficiency
  const resetAdjustments = () => {
    setRate(settings.chargerKw)
    setEfficiency(settings.efficiency)
  }

  const markup = num(settings.markup) || 0
  const start = atTime(day, startTime)
  let end = atTime(day, endTime)
  // an end time before the start means charging past midnight
  if (start && end && end <= start) end = new Date(end.getTime() + 24 * HOUR)

  const r = num(rate)
  const eff = num(efficiency)
  const session = start && end && prices && r > 0 && eff > 0 ? calculate(start, end, r, eff, markup, prices) : null

  const complete = session && session.missingHours < 1 / 60
  const avgPrice = session && session.gridKwh > 0 ? session.cost / session.gridKwh : 0

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="size-5" /> Charging session
          </CardTitle>
          <CardDescription>When will the car be charging?</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Segmented
            label="Day"
            options={[
              { value: 'today', label: 'Today' },
              { value: 'tomorrow', label: 'Tomorrow' },
            ]}
            value={day}
            onChange={setDay}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field id="start" label="From" type="time" value={startTime} onChange={setStartTime} />
            <Field id="end" label="Until" type="time" value={endTime} onChange={setEndTime} />
          </div>

          <details className="group rounded-lg border text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-3">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              <span className="flex-1">
                {settings.evName}: {rate} kWh/h · {efficiency} km/kWh
              </span>
              <span className="text-xs text-muted-foreground group-open:hidden">Adjust</span>
            </summary>
            <div className="grid grid-cols-2 gap-3 border-t p-3">
              <Field id="rate" label="Charging rate" value={rate} onChange={setRate} suffix="kWh/h" />
              <Field id="eff" label="Efficiency" value={efficiency} onChange={setEfficiency} suffix="km/kWh" />
              {isAdjusted && (
                <Button variant="ghost" className="self-end" onClick={resetAdjustments}>
                  Reset
                </Button>
              )}
            </div>
          </details>
        </CardContent>
      </Card>

      {priceError ? (
        <p className="text-sm text-destructive">{priceError}</p>
      ) : !prices ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : !session ? (
        <p className="text-sm text-muted-foreground">Enter a valid time window, charging rate and efficiency.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Session cost</CardTitle>
            <CardDescription>
              {session.hours.toFixed(2).replace(/\.?0+$/, '')} h of charging · {session.gridKwh.toFixed(1)} kWh from the grid
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!complete && (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                Prices for part of this window aren&apos;t published yet (tomorrow&apos;s prices appear around 15:00). The
                figures below only cover the hours with a known price.
              </p>
            )}
            {complete && (
              <>
                <div className="rounded-lg bg-muted p-4 text-center">
                  <div className="text-xs text-muted-foreground">Cost per km</div>
                  <div className="text-3xl font-semibold tabular-nums">
                    {eur(session.km > 0 ? session.cost / session.km : 0, 3)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {eur((session.km > 0 ? session.cost / session.km : 0) * 100)} per 100 km
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Total cost" value={eur(session.cost)} sub={`avg ${eur(avgPrice, 3)}/kWh`} />
                  <Stat label="Range added" value={`${Math.round(session.km)} km`} sub={`${session.batteryKwh.toFixed(1)} kWh into battery`} />
                </div>
              </>
            )}

            {session.parts.length > 0 && (
            <div className="grid gap-1 text-sm">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs text-muted-foreground">
                <span>Time</span>
                <span className="text-right">€/kWh</span>
                <span className="w-16 text-right">Cost</span>
              </div>
              {session.parts.map((p) => (
                <div key={p.slot.start.getTime()} className="grid grid-cols-[1fr_auto_auto] gap-x-4 tabular-nums">
                  <span>
                    {fmtTime(p.from)} – {fmtTime(p.to)}
                  </span>
                  <span className="text-right">{eur(p.slot.price + markup, 3)}</span>
                  <span className="w-16 text-right">{eur(p.cost)}</span>
                </div>
              ))}
            </div>
            )}
          </CardContent>
        </Card>
      )}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Hourly prices incl. VAT{markup ? ` plus your ${eur(markup, 3)}/kWh markup` : ''}. The charging rate is what
        actually flows from the grid; ~10% is lost on the way into the battery.
      </p>
    </div>
  )
}

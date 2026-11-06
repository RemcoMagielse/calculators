import { useMemo } from 'react'
import { BatteryFull, BatteryMedium, Clock, Info, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Stat } from '@/components/Field'
import { Segmented } from '@/components/Segmented'
import { CHARGING_LOSS, cheapestWindow, eur, fmtDay, fmtTime, priceSession, type PriceSlot } from '@/lib/prices'
import { useSettings } from '@/lib/settings'
import { num, useStoredState } from '@/lib/storage'
import { usePrices } from '@/lib/usePrices'

// above this level the car slows down charging, even on a home charger
const TAPER_FROM = 90
const TAPER_SPEED = 0.7

const fmtDuration = (h: number) => {
  const total = Math.round(h * 60)
  return total >= 60 ? `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m` : `${total} min`
}

interface Plan {
  target: number
  batteryKwh: number
  gridKwh: number
  hours: number
}

function planCharge(from: number, target: number, capacity: number, kw: number): Plan | null {
  if (!(capacity > 0 && kw > 0) || from >= target) return null
  const intoBattery = kw * (1 - CHARGING_LOSS) // kWh per hour into the battery
  const normal = (capacity * (Math.min(target, TAPER_FROM) - Math.min(from, TAPER_FROM))) / 100
  const tapered = (capacity * (Math.max(target, TAPER_FROM) - Math.max(from, TAPER_FROM))) / 100
  const batteryKwh = normal + tapered
  return {
    target,
    batteryKwh,
    gridKwh: batteryKwh / (1 - CHARGING_LOSS),
    hours: normal / intoBattery + tapered / (intoBattery * TAPER_SPEED),
  }
}

export function BatteryTool() {
  const { settings } = useSettings()
  const [current, setCurrent] = useStoredState('batteryPct', '35')
  const { prices, error: priceError } = usePrices()

  const pct = Math.min(100, Math.max(0, num(current) || 0))
  const capacity = num(settings.batteryKwh)
  const kw = num(settings.chargerKw)
  const [target, setTarget] = useStoredState<'80' | '100'>('batteryTarget', '80')
  const plan = useMemo(() => planCharge(pct, Number(target), capacity, kw), [pct, target, capacity, kw])

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BatteryMedium className="size-5" /> Current charge
          </CardTitle>
          <CardDescription>
            {settings.evName} · {settings.batteryKwh} kWh usable · {settings.chargerKw} kWh/h charging
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={pct}
              onChange={(e) => setCurrent(e.target.value)}
              aria-label="Current charge"
              className="h-2 flex-1 accent-primary"
            />
            <div className="relative w-24">
              <Label htmlFor="pct" className="sr-only">
                Current charge in percent
              </Label>
              <Input
                id="pct"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="pr-7 text-right"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                %
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            In the battery now: {((capacity * pct) / 100).toFixed(1)} kWh
          </p>
        </CardContent>
      </Card>

      <Segmented
        label="Charge to"
        options={[
          { value: '80', label: 'To 80%' },
          { value: '100', label: 'To 100%' },
        ]}
        value={target}
        onChange={setTarget}
      />
      <TargetCard target={Number(target)} plan={plan} prices={prices} />

      {priceError && <p className="text-sm text-destructive">{priceError}</p>}
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Includes ~10% charging loss. Above {TAPER_FROM}% the car charges slower, so the time to 100% is an estimate.
        Change battery size and charging rate in Settings.
      </p>
    </div>
  )
}

function TargetCard({ target, plan, prices }: { target: number; plan: Plan | null; prices: PriceSlot[] | null }) {
  const { settings } = useSettings()
  const markup = num(settings.markup) || 0
  const efficiency = num(settings.efficiency) || 0
  const fallbackPrice = num(settings.kwhPrice) || 0
  const Icon = target === 100 ? BatteryFull : BatteryMedium

  const now = new Date()
  const stopAt = plan ? new Date(now.getTime() + plan.hours * 3600_000) : null
  const km = plan ? plan.batteryKwh * efficiency : 0
  const perKm = (cost: number) => (km > 0 ? cost / km : 0)

  // start now: real hourly prices over the session; hours without a price use the default price from Settings
  const nowSession = plan && stopAt && prices ? priceSession(now, stopAt, plan.gridKwh / plan.hours, prices, markup) : null
  const nowCost = nowSession && plan ? nowSession.cost + (plan.gridKwh / plan.hours) * nowSession.missingHours * fallbackPrice : null
  const estimated = !!nowSession && nowSession.missingHours > 1 / 60

  const cheapest = plan && prices ? cheapestWindow(prices, plan.hours) : null
  const cheapestStop = cheapest && plan ? new Date(cheapest.start.getTime() + plan.hours * 3600_000) : null
  const cheapestSession =
    cheapest && cheapestStop && plan && prices ? priceSession(cheapest.start, cheapestStop, plan.gridKwh / plan.hours, prices, markup) : null
  const cheapestCost = cheapestSession && plan ? cheapestSession.cost + (plan.gridKwh / plan.hours) * cheapestSession.missingHours * fallbackPrice : null
  const saving = nowCost !== null && cheapestCost !== null ? nowCost - cheapestCost : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-5" /> To {target}%
        </CardTitle>
        {plan && stopAt && (
          <CardDescription>
            Start now, stop at{' '}
            <span className="font-semibold text-foreground">
              {fmtDay(stopAt) === 'today' ? '' : `${fmtDay(stopAt)} `}
              {fmtTime(stopAt)}
            </span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="grid gap-3">
        {!plan ? (
          <p className="text-sm text-muted-foreground">Already at {target}% or more.</p>
        ) : (
          <>
            <div className="rounded-lg bg-muted p-4 text-center">
              <div className="text-xs text-muted-foreground">Cost per km if you start now</div>
              {nowCost === null ? (
                <Loader2 className="mx-auto my-2 size-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="text-3xl font-semibold tabular-nums">{eur(perKm(nowCost), 3)}</div>
                  <div className="text-xs text-muted-foreground">
                    {eur(nowCost)} in total{estimated ? ' (partly estimated)' : ''}
                  </div>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Charge for"
                value={`${target === 100 ? '~' : ''}${fmtDuration(plan.hours)}`}
                sub={`${plan.gridKwh.toFixed(1)} kWh from the grid`}
              />
              <Stat label="Range added" value={`${Math.round(km)} km`} sub={`${plan.batteryKwh.toFixed(1)} kWh into battery`} />
            </div>
            {cheapest && cheapestStop && cheapestCost !== null && saving < 0.01 ? (
              <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
                <Clock className="size-4 shrink-0" /> Starting now is already the cheapest option.
              </div>
            ) : cheapest && cheapestStop && cheapestCost !== null && (
              <div className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">
                    Cheapest: {fmtDay(cheapest.start)} {fmtTime(cheapest.start)} – {fmtTime(cheapestStop)}
                  </div>
                  <div className="text-muted-foreground">
                    {eur(perKm(cheapestCost), 3)}/km · {eur(cheapestCost)} in total · saves {eur(saving)}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

import { useMemo } from 'react'
import { BatteryFull, BatteryMedium, Clock, Info, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Stat } from '@/components/Field'
import { CHARGING_LOSS, cheapestWindow, eur, fmtDay, fmtTime, type PriceSlot } from '@/lib/prices'
import { useSettings } from '@/lib/settings'
import { num, useStoredState } from '@/lib/storage'
import { currentPrice, usePrices } from '@/lib/usePrices'

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
  const plans = useMemo(
    () => [80, 100].map((t) => ({ target: t, plan: planCharge(pct, t, capacity, kw) })),
    [pct, capacity, kw],
  )

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

      {plans.map(({ target, plan }) => (
        <TargetCard key={target} target={target} plan={plan} prices={prices} />
      ))}

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
  const Icon = target === 100 ? BatteryFull : BatteryMedium

  const now = new Date()
  const stopAt = plan ? new Date(now.getTime() + plan.hours * 3600_000) : null
  const nowPrice = currentPrice(prices)
  const perKwhNow = nowPrice !== undefined ? nowPrice + markup : num(settings.kwhPrice) || 0
  const cheapest = plan && prices ? cheapestWindow(prices, plan.hours) : null
  const cheapestStop = cheapest && plan ? new Date(cheapest.start.getTime() + plan.hours * 3600_000) : null

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
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Charge for"
                value={`${target === 100 ? '~' : ''}${fmtDuration(plan.hours)}`}
                sub={`at ${settings.chargerKw} kWh/h`}
              />
              <Stat
                label="From the grid"
                value={`${plan.gridKwh.toFixed(1)} kWh`}
                sub={`${plan.batteryKwh.toFixed(1)} kWh into battery`}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Cost if you start now: <span className="font-medium text-foreground">{eur(perKwhNow * plan.gridKwh)}</span>
            </div>
            {!prices ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              cheapest &&
              cheapestStop && (
                <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
                  <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <div className="font-medium">
                      Cheapest: {fmtDay(cheapest.start)} {fmtTime(cheapest.start)} – {fmtTime(cheapestStop)}
                    </div>
                    <div className="text-muted-foreground">
                      approx. {eur((cheapest.avgPrice + markup) * plan.gridKwh)}
                    </div>
                  </div>
                </div>
              )
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

import { useMemo, useState } from 'react'
import { BatteryCharging, Calculator as CalculatorIcon, CircleCheck, CircleX, Loader2, Settings, Sun } from 'lucide-react'
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, Stat } from '@/components/Field'
import { cycleCost, planCycle, storedCost, toBattery, type Role } from '@/lib/battery'
import { ct, eur, fmtDay, fmtTime } from '@/lib/prices'
import { useSettings } from '@/lib/settings'
import { num } from '@/lib/storage'
import { currentPrice, usePrices } from '@/lib/usePrices'

const ROLE_COLOR: Record<Role, string> = {
  before: 'var(--series-muted)',
  charge: 'var(--series-1)',
  discharge: 'var(--series-good)',
  worth: 'var(--series-good-soft)',
  grid: 'var(--series-muted)',
}

const LEGEND: { role: Role; label: string }[] = [
  { role: 'charge', label: 'Charge (the dip)' },
  { role: 'discharge', label: 'Use battery' },
  { role: 'worth', label: 'Battery cheaper, but empty' },
  { role: 'grid', label: 'Grid cheaper' },
]

export function Calculator({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { settings } = useSettings()
  const battery = toBattery(settings)
  const markup = num(settings.markup) || 0
  const feedIn = num(settings.feedIn) || 0
  const { prices, error } = usePrices()
  const [buyPrice, setBuyPrice] = useState('')

  const plan = useMemo(() => (prices && battery ? planCycle(prices, battery, markup) : null), [prices, battery, markup])

  if (!battery) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set up your battery first</CardTitle>
          <CardDescription>Fill in all battery fields in the settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onOpenSettings}>
            <Settings /> Open settings
          </Button>
        </CardContent>
      </Card>
    )
  }

  const wear = cycleCost(battery)
  const manual = num(buyPrice)
  const marketNow = currentPrice(prices)
  const priceNow = marketNow === undefined ? undefined : marketNow + markup
  const manualPrice = manual > 0 ? manual : priceNow
  const midnight = plan?.hours.find((h, k) => k > 0 && h.start.getHours() === 0)
  const chartData = plan?.hours.map((h) => ({
    key: h.start.getTime(),
    label: `${fmtDay(h.start)} ${fmtTime(h.start)}`,
    price: h.price,
    role: h.role,
    kwh: h.kwh,
  }))

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BatteryCharging className="size-5" /> Next cycle
          </CardTitle>
          <CardDescription>
            {settings.name} · {battery.capacity} kWh · {Math.round(battery.rte * 100)}% RTE
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!prices && !error && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading prices…
            </p>
          )}
          {plan && (
            <>
              <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
                {plan.profit > 0 ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-[var(--series-good)]" />
                ) : (
                  <CircleX className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                {plan.profit > 0 ? (
                  <span>
                    Charge {fmtDay(plan.chargeStart)} {fmtTime(plan.chargeStart)}–{fmtTime(plan.chargeEnd)} and use{' '}
                    {plan.dischargeKwh.toFixed(1)} kWh in the green hours. Saves{' '}
                    <span className="font-medium">{eur(plan.profit)}</span> compared to buying from the grid.
                  </span>
                ) : (
                  <span>
                    Not worth it. Even charging in the dip, stored energy costs {ct(plan.breakEven)} and no later hour is
                    more expensive. Buy from the grid instead.
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Dip price" value={ct(plan.chargePrice)} sub="average while charging" />
                <Stat label="Break-even" value={ct(plan.breakEven)} sub="use battery above this" />
                {plan.profit > 0 && (
                  <>
                    <Stat label="From the grid" value={eur(plan.gridCost)} sub={`${plan.dischargeKwh.toFixed(1)} kWh`} />
                    <Stat label="Via the battery" value={eur(plan.batteryCost)} sub="incl. losses and wear" />
                  </>
                )}
              </div>
            </>
          )}
          {prices && !plan && <p className="text-sm text-muted-foreground">Not enough upcoming prices to plan a cycle.</p>}
        </CardContent>
      </Card>

      {chartData && plan && (
        <Card>
          <CardHeader>
            <CardTitle>Dip vs. grid, per hour</CardTitle>
            <CardDescription>
              All-in prices. Hours above the line are cheaper from the battery charged in the dip.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 16, right: 0, left: 0, bottom: 0 }} barCategoryGap={1}>
                  <XAxis
                    dataKey="key"
                    tickFormatter={(v: number) => fmtTime(new Date(v)).slice(0, 2)}
                    tickLine={false}
                    axisLine={false}
                    interval={3}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickFormatter={(v: number) => `${Math.round(v * 100)}`}
                    label={{ value: 'ct', position: 'insideTopLeft', offset: -14, fontSize: 11, fill: 'var(--muted-foreground)' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)' }}
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'var(--popover-foreground)',
                    }}
                    itemStyle={{ color: 'var(--popover-foreground)' }}
                    labelFormatter={(_, p) => p?.[0]?.payload.label ?? ''}
                    formatter={(v, _, item) => {
                      const d = item.payload as (typeof chartData)[number]
                      const diff = Number(v) - plan.breakEven
                      const verdict =
                        d.role === 'charge'
                          ? `charging ${d.kwh.toFixed(2)} kWh`
                          : d.role === 'before'
                            ? 'before the dip'
                            : diff > 0
                              ? `battery ${ct(diff)} cheaper`
                              : `grid ${ct(-diff)} cheaper`
                      return [`${ct(Number(v))} · ${verdict}`, 'Grid']
                    }}
                  />
                  {midnight && (
                    <ReferenceLine
                      x={midnight.start.getTime()}
                      stroke="var(--border)"
                      label={{ value: 'tomorrow', position: 'insideTopLeft', fontSize: 11, fill: 'var(--muted-foreground)' }}
                    />
                  )}
                  <Bar dataKey="price" radius={[3, 3, 0, 0]}>
                    {chartData.map((d) => (
                      <Cell key={d.key} fill={ROLE_COLOR[d.role]} fillOpacity={d.role === 'before' ? 0.4 : 1} />
                    ))}
                  </Bar>
                  <ReferenceLine
                    y={plan.breakEven}
                    stroke="var(--foreground)"
                    strokeDasharray="4 3"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {LEGEND.map(({ role, label }) => (
                <span key={role} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ background: ROLE_COLOR[role] }} />
                  {label}
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="w-3 border-t border-dashed border-foreground" />
                Break-even {ct(plan.breakEven)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalculatorIcon className="size-5" /> What does stored energy cost?
          </CardTitle>
          <CardDescription>Price you charge at ÷ RTE + wear per kWh.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Field
            id="buy"
            label="Charge price (all-in)"
            value={buyPrice}
            onChange={setBuyPrice}
            suffix="€/kWh"
            placeholder={priceNow?.toFixed(3) ?? '0.30'}
            hint={manual > 0 || priceNow === undefined ? undefined : `Empty: uses the current price (${ct(priceNow)}).`}
          />
          {manualPrice !== undefined && (
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Lost (RTE)" value={ct(manualPrice / battery.rte - manualPrice)} />
              <Stat label="Wear" value={ct(wear)} />
              <Stat label="Use above" value={ct(storedCost(battery, manualPrice))} />
            </div>
          )}
          <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
            <Sun className="mt-0.5 size-4 shrink-0" />
            <span>
              Solar: storing a kWh instead of exporting it for {ct(feedIn)} costs{' '}
              <span className="font-medium">{ct(storedCost(battery, feedIn))}</span>. Worth it when you'd otherwise buy
              above that.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

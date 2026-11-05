import { useMemo, useState } from 'react'
import { ArrowLeftRight, Clock, Euro, History, Home, Loader2, MapPin, RotateCcw, Route, SlidersHorizontal, Zap } from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Field, Stat } from '@/components/Field'
import { AddressInput } from '@/components/AddressInput'
import { geocode, route, type Place } from '@/lib/geo'
import { useSettings } from '@/lib/settings'
import { CHARGING_LOSS, cheapestWindow, eur, fmtDay, fmtTime } from '@/lib/prices'
import { usePrices } from '@/lib/usePrices'
import { num, useStoredState } from '@/lib/storage'

interface Trip {
  from: string
  to: string
  km: number
  minutes: number
}

export function ChargePlanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { settings } = useSettings()
  const home = settings.home
  const [destination, setDestination] = useState('')
  const [destPlace, setDestPlace] = useState<Place | null>(null)
  const [recent, setRecent] = useStoredState<Place[]>('recentDestinations', [])
  const [roundTrip, setRoundTrip] = useStoredState('roundTrip', true)
  // per-trip overrides; start from (and reset to) the saved car settings
  const [efficiency, setEfficiency] = useState(settings.efficiency)
  const [chargerKw, setChargerKw] = useState(settings.chargerKw)
  const [bufferPct, setBufferPct] = useState(settings.bufferPct)
  const isAdjusted =
    efficiency !== settings.efficiency || chargerKw !== settings.chargerKw || bufferPct !== settings.bufferPct
  const resetAdjustments = () => {
    setEfficiency(settings.efficiency)
    setChargerKw(settings.chargerKw)
    setBufferPct(settings.bufferPct)
  }
  const [readyBy, setReadyBy] = useState('')
  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { prices, error: priceError } = usePrices()

  async function calculate(place = destPlace) {
    if (!home) return
    setError('')
    setLoading(true)
    try {
      // picked from suggestions: coordinates known; typed freely: worldwide lookup (OpenStreetMap)
      const b = place ?? (await geocode(destination))
      const r = await route(home, b)
      setTrip({ from: home.label, to: b.label, ...r })
      setRecent((list) => [b, ...list.filter((p) => p.label !== b.label)].slice(0, 5))
    } catch (e) {
      setTrip(null)
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const result = useMemo(() => {
    const eff = num(efficiency)
    if (!trip || !(eff > 0)) return null
    const km = trip.km * (roundTrip ? 2 : 1)
    const batteryKwh = (km / eff) * (1 + (num(bufferPct) || 0) / 100)
    const gridKwh = batteryKwh / (1 - CHARGING_LOSS)
    const kw = num(chargerKw)
    const hours = kw > 0 ? gridKwh / kw : 0
    return { km, batteryKwh, gridKwh, hours }
  }, [trip, efficiency, roundTrip, bufferPct, chargerKw])

  const readyByDate = useMemo(() => {
    if (!readyBy) return undefined
    const [h, m] = readyBy.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    if (d <= new Date()) d.setDate(d.getDate() + 1)
    return d
  }, [readyBy])

  const chargeWindow = useMemo(
    () => (prices && result && result.hours > 0 ? cheapestWindow(prices, result.hours, readyByDate) : null),
    [prices, result, readyByDate],
  )

  // cheapest window price + supplier markup; fall back to the default price when no hourly prices are available
  const cost = useMemo(() => {
    if (!result) return { total: 0, source: '' }
    const perKwh = chargeWindow ? chargeWindow.avgPrice + (num(settings.markup) || 0) : num(settings.kwhPrice) || 0
    return { total: perKwh * result.gridKwh, source: chargeWindow ? 'cheapest hours' : 'default price' }
  }, [result, chargeWindow, settings.markup, settings.kwhPrice])

  const chartData = useMemo(() => {
    if (!prices) return []
    const now = new Date()
    now.setMinutes(0, 0, 0)
    return prices
      .filter((p) => p.start >= now)
      .map((p) => ({
        hour: fmtTime(p.start),
        label: `${fmtDay(p.start)} ${fmtTime(p.start)}`,
        price: p.price,
        inWindow: !!chargeWindow?.slots.includes(p),
      }))
  }, [prices, chargeWindow])

  const canCalculate = home && destination.trim() && num(efficiency) > 0 && !loading

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="size-5" /> Trip
          </CardTitle>
          <CardDescription>Where are you going?</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {home ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-start gap-2 rounded-lg bg-muted p-3 text-left text-sm"
            >
              <Home className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">
                <span className="font-medium">From home</span> · {home.label}
              </span>
            </button>
          ) : (
            <Button variant="outline" onClick={onOpenSettings}>
              <Home /> Set your home address first
            </Button>
          )}
          <AddressInput
            id="dest"
            label="Destination"
            value={destination}
            onChange={(text) => {
              setDestination(text)
              setDestPlace(null)
            }}
            onSelect={(place) => {
              setDestPlace(place)
              calculate(place)
            }}
            placeholder="Address or place"
          />
          {recent.length > 0 && (
            <div className="-mt-1 flex flex-wrap items-center gap-1.5">
              <History className="size-3.5 text-muted-foreground" aria-label="Recent destinations" />
              {recent.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setDestination(p.label)
                    setDestPlace(p)
                    calculate(p)
                  }}
                  className="max-w-full truncate rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
                >
                  {p.label.split(',')[0]}
                </button>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={roundTrip}
              onChange={(e) => setRoundTrip(e.target.checked)}
            />
            <ArrowLeftRight className="size-4 text-muted-foreground" /> Round trip (there and back)
          </label>
          <div className="grid gap-1.5">
            <Label htmlFor="ready">Ready by (optional)</Label>
            <input
              id="ready"
              type="time"
              value={readyBy}
              onChange={(e) => setReadyBy(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm"
            />
          </div>
          <details className="group rounded-lg border" open={isAdjusted || undefined}>
            <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              <span className="flex-1">
                {settings.evName}: {efficiency} km/kWh · {chargerKw} kWh/h · {bufferPct}% margin
              </span>
              <span className="text-xs text-muted-foreground group-open:hidden">Adjust</span>
            </summary>
            <div className="grid grid-cols-2 gap-3 border-t p-3">
              <Field id="eff" label="Efficiency" value={efficiency} onChange={setEfficiency} suffix="km/kWh" />
              <Field id="kw" label="Charging rate" value={chargerKw} onChange={setChargerKw} suffix="kWh/h" />
              <Field id="buffer" label="Safety margin" value={bufferPct} onChange={setBufferPct} suffix="%" />
              {isAdjusted && (
                <Button variant="ghost" className="self-end" onClick={resetAdjustments}>
                  <RotateCcw /> Defaults
                </Button>
              )}
              <p className="col-span-2 text-xs text-muted-foreground">Only for this trip. Change defaults in Settings.</p>
            </div>
          </details>
          <Button onClick={() => calculate()} disabled={!canCalculate} size="lg">
            {loading ? <Loader2 className="animate-spin" /> : <Zap />} Calculate
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {trip && result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="size-5" /> Charge {result.gridKwh.toFixed(1)} kWh
            </CardTitle>
            <CardDescription className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span className="line-clamp-2">{trip.to}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label={roundTrip ? 'Distance (round trip)' : 'Distance'}
                value={`${result.km.toFixed(0)} km`}
                sub={`${Math.round(trip.minutes * (roundTrip ? 2 : 1))} min driving`}
              />
              <Stat
                label="Charging time"
                value={result.hours >= 1 ? `${Math.floor(result.hours)}h ${Math.round((result.hours % 1) * 60)}m` : `${Math.round(result.hours * 60)} min`}
                sub={`at ${chargerKw} kW`}
              />
              <Stat
                label="Energy from the grid"
                value={`${result.gridKwh.toFixed(1)} kWh`}
                sub={`${result.batteryKwh.toFixed(1)} kWh into battery`}
              />
              <Stat
                label={
                  <span className="flex items-center gap-1">
                    <Euro className="size-3" /> Estimated cost
                  </span>
                }
                value={eur(cost.total)}
                sub={`${eur(cost.total / result.km, 3)} per km · ${cost.source}`}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5" /> Cheapest time to charge
          </CardTitle>
          <CardDescription>Hourly Dutch market prices incl. VAT (EnergyZero). Tomorrow appears after ~13:00.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {priceError && <p className="text-sm text-destructive">{priceError}</p>}
          {!prices && !priceError && <Loader2 className="animate-spin text-muted-foreground" />}
          {chargeWindow && result && (
            <div className="rounded-lg bg-muted p-3">
              <div className="text-lg font-semibold">
                {fmtDay(chargeWindow.start)} {fmtTime(chargeWindow.start)} – {fmtTime(chargeWindow.end)}
              </div>
              <div className="text-sm text-muted-foreground">
                avg {eur(chargeWindow.avgPrice, 3)}/kWh · approx. {eur((chargeWindow.avgPrice + (num(settings.markup) || 0)) * result.gridKwh)} for this trip
              </div>
            </div>
          )}
          {result && prices && !chargeWindow && (
            <p className="text-sm text-muted-foreground">No chargeWindow fits before your “ready by” time.</p>
          )}
          {chartData.length > 0 && (
            <div className="h-48 w-full" role="img" aria-label="Hourly electricity prices, cheapest charge chargeWindow highlighted">
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap={2}>
                  <XAxis
                    dataKey="hour"
                    tickLine={false}
                    axisLine={false}
                    interval={3}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickFormatter={(v: number) => `€${v.toFixed(2)}`}
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
                    labelFormatter={(_, p) => p?.[0]?.payload.label ?? ''}
                    formatter={(v) => [`${eur(Number(v), 3)}/kWh`, 'Price']}
                  />
                  <Bar dataKey="price" radius={[4, 4, 0, 0]}>
                    {chartData.map((d) => (
                      <Cell key={d.label} fill={d.inWindow ? 'var(--series-1)' : 'var(--series-muted)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

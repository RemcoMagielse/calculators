import { useState } from 'react'
import { Car, Check, Home, Info, Loader2, Receipt, Search, TriangleAlert, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AddressInput } from '@/components/AddressInput'
import { Field } from '@/components/Field'
import { geocode, type Place } from '@/lib/geo'
import { useSettings } from '@/lib/settings'

export function SettingsScreen() {
  const { settings, update } = useSettings()
  const [address, setAddress] = useState('')
  // a picked or found address waits here until the user confirms it
  const [pending, setPending] = useState<Place | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  async function searchWorldwide() {
    setError('')
    setSearching(true)
    try {
      setPending(await geocode(address))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSearching(false)
    }
  }

  function confirmHome() {
    if (!pending) return
    update({ home: pending })
    setPending(null)
    setAddress('')
  }

  function cancelHome() {
    setPending(null)
    setAddress('')
  }

  const imprecise = pending?.type !== undefined && pending.type !== 'adres'

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="size-5" /> Home
          </CardTitle>
          <CardDescription>Your trips start and end here.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {settings.home && (
            <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{settings.home.label}</span>
            </div>
          )}
          <AddressInput
            id="home"
            label={settings.home ? 'Change address' : 'Address'}
            value={address}
            onChange={(text) => {
              setAddress(text)
              setPending(null)
            }}
            onSelect={setPending}
            placeholder="Start typing, e.g. Damrak 1 Amsterdam"
          />
          {pending ? (
            <div className="grid gap-3 rounded-lg border p-3">
              <div className="text-sm">
                <span className="text-muted-foreground">New home:</span> <span className="font-medium">{pending.label}</span>
              </div>
              {imprecise && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                  No house number. Distances will be measured to the middle of this {pending.type === 'weg' ? 'street' : 'area'}.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={cancelHome}>
                  <X /> Cancel
                </Button>
                <Button onClick={confirmHome}>
                  <Check /> Save as home
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Pick a suggestion, then confirm. Outside the Netherlands?</p>
              <Button variant="outline" onClick={searchWorldwide} disabled={!address.trim() || searching}>
                {searching ? <Loader2 className="animate-spin" /> : <Search />} Search worldwide
              </Button>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-5" /> Electric car
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field id="evName" label="Name" type="text" value={settings.evName} onChange={(v) => update({ evName: v })} />
          </div>
          <Field id="eff" label="Efficiency" value={settings.efficiency} onChange={(v) => update({ efficiency: v })} suffix="km/kWh" />
          <Field
            id="kw"
            label="Charging rate"
            value={settings.chargerKw}
            onChange={(v) => update({ chargerKw: v })}
            suffix="kWh/h"
            hint="What effectively flows from the grid, e.g. 10.3"
          />
          <Field
            id="battery"
            label="Usable battery"
            value={settings.batteryKwh}
            onChange={(v) => update({ batteryKwh: v })}
            suffix="kWh"
          />
          <Field
            id="buffer"
            label="Safety margin"
            value={settings.bufferPct}
            onChange={(v) => update({ bufferPct: v })}
            suffix="%"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="size-5" /> Petrol car
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field
              id="petrolName"
              label="Name"
              type="text"
              value={settings.petrolName}
              onChange={(v) => update({ petrolName: v })}
            />
          </div>
          <Field id="kmL" label="Consumption" value={settings.kmPerL} onChange={(v) => update({ kmPerL: v })} suffix="km/L" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-5" /> Default prices
          </CardTitle>
          <CardDescription>Starting values for the Petrol vs EV comparison.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Field
            id="pL"
            label="Petrol"
            value={settings.petrolPrice}
            onChange={(v) => update({ petrolPrice: v })}
            suffix="€/L"
          />
          <Field
            id="pKwh"
            label="Electricity"
            value={settings.kwhPrice}
            onChange={(v) => update({ kwhPrice: v })}
            suffix="€/kWh"
          />
          <Field
            id="yearly"
            label="Km per year"
            value={settings.yearlyKm}
            onChange={(v) => update({ yearlyKm: v })}
            suffix="km"
          />
          <Field
            id="markup"
            label="Supplier markup"
            value={settings.markup}
            onChange={(v) => update({ markup: v })}
            suffix="€/kWh"
          />
          <p className="col-span-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            The markup is added to the hourly market prices when estimating what a charge costs (supplier fee + energy
            tax). Leave at 0 if unsure.
          </p>
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">Changes are saved automatically on this device.</p>
    </div>
  )
}

import { BatteryFull, Info, Receipt } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/Field'
import { cycleCost, toBattery } from '@/lib/battery'
import { ct, eur } from '@/lib/prices'
import { useSettings } from '@/lib/settings'

export function SettingsScreen() {
  const { settings, update } = useSettings()
  const battery = toBattery(settings)

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BatteryFull className="size-5" /> Your battery
          </CardTitle>
          <CardDescription>Every calculation uses this battery.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field id="name" label="Name" type="text" value={settings.name} onChange={(v) => update({ name: v })} />
          </div>
          <Field
            id="capacity"
            label="Usable capacity"
            value={settings.capacityKwh}
            onChange={(v) => update({ capacityKwh: v })}
            suffix="kWh"
          />
          <Field
            id="rte"
            label="Round-trip efficiency"
            value={settings.rtePct}
            onChange={(v) => update({ rtePct: v })}
            suffix="%"
          />
          <Field
            id="chargeKw"
            label="Charge power"
            value={settings.chargeKw}
            onChange={(v) => update({ chargeKw: v })}
            suffix="kW"
          />
          <Field
            id="dischargeKw"
            label="Discharge power"
            value={settings.dischargeKw}
            onChange={(v) => update({ dischargeKw: v })}
            suffix="kW"
          />
          <Field
            id="price"
            label="Purchase price"
            value={settings.priceEur}
            onChange={(v) => update({ priceEur: v })}
            suffix="€"
          />
          <Field id="cycles" label="Rated cycles" value={settings.cycles} onChange={(v) => update({ cycles: v })} />
          <Field
            id="eol"
            label="Capacity at end of life"
            value={settings.eolPct}
            onChange={(v) => update({ eolPct: v })}
            suffix="%"
          />
          <p className="col-span-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Discharge power is what the battery can actually deliver to your home per hour. Plug-in batteries are usually
            limited to 0.8 kW.
          </p>
          {battery && (
            <div className="col-span-2 rounded-lg bg-muted p-3 text-sm">
              Wear cost: <span className="font-medium tabular-nums">{ct(cycleCost(battery))}</span> per kWh ·{' '}
              <span className="font-medium tabular-nums">{eur(cycleCost(battery) * battery.capacity)}</span> per full
              cycle
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-5" /> Energy prices
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Field
            id="markup"
            label="Tax + supplier fee"
            value={settings.markup}
            onChange={(v) => update({ markup: v })}
            suffix="€/kWh"
          />
          <Field
            id="feedIn"
            label="Solar feed-in price"
            value={settings.feedIn}
            onChange={(v) => update({ feedIn: v })}
            suffix="€/kWh"
          />
          <p className="col-span-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            The hourly market prices exclude energy tax and your supplier's fee. Both are added on top (incl. VAT). The
            feed-in price is what you get for exporting a solar kWh, so it is what storing that kWh costs you.
          </p>
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">Changes are saved automatically on this device.</p>
    </div>
  )
}

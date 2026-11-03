export interface PriceSlot {
  start: Date
  price: number // €/kWh incl. VAT, market price only
}

/** Hourly Dutch day-ahead prices (EnergyZero) for today and tomorrow (when published). */
export async function fetchPrices(): Promise<PriceSlot[]> {
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const till = new Date(from)
  till.setDate(till.getDate() + 2)
  till.setMilliseconds(-1)
  const params = new URLSearchParams({
    fromDate: from.toISOString(),
    tillDate: till.toISOString(),
    interval: '4',
    usageType: '1',
    inclBtw: 'true',
  })
  const res = await fetch(`https://api.energyzero.nl/v1/energyprices?${params}`)
  if (!res.ok) throw new Error('Could not load energy prices')
  const data = (await res.json()) as { Prices: { readingDate: string; price: number }[] }
  return data.Prices.map((p) => ({ start: new Date(p.readingDate), price: p.price }))
}

export const fmtTime = (d: Date) => d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
export const fmtDay = (d: Date) => {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'today'
  if (d.toDateString() === tomorrow.toDateString()) return 'tomorrow'
  return d.toLocaleDateString('nl-NL', { weekday: 'short' })
}
export const eur = (v: number, digits = 2) =>
  v.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: digits, maximumFractionDigits: digits })
/** Price per kWh in cents, e.g. "30,4 ct". */
export const ct = (v: number) => `${(v * 100).toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ct`

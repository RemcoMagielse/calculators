/** Share of grid energy lost while charging (~10%). */
export const CHARGING_LOSS = 0.1

export interface PriceSlot {
  start: Date
  price: number // €/kWh incl. VAT
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

export interface ChargeWindow {
  slots: PriceSlot[]
  start: Date
  end: Date
  avgPrice: number
}

/**
 * Cheapest consecutive block of hours, starting no earlier than the current hour
 * and (optionally) finishing before `readyBy`.
 */
export function cheapestWindow(slots: PriceSlot[], hoursNeeded: number, readyBy?: Date): ChargeWindow | null {
  const n = Math.max(1, Math.ceil(hoursNeeded))
  const now = new Date()
  now.setMinutes(0, 0, 0)
  const upcoming = slots.filter((s) => s.start >= now)
  let best: ChargeWindow | null = null
  for (let i = 0; i + n <= upcoming.length; i++) {
    const block = upcoming.slice(i, i + n)
    const end = new Date(block[n - 1].start.getTime() + 3600_000)
    if (readyBy && end > readyBy) break
    // last hour may be partial: weight it by the fraction actually used
    const lastFraction = hoursNeeded - (n - 1) || 1
    const weighted = block.reduce((sum, s, k) => sum + s.price * (k === n - 1 ? lastFraction : 1), 0)
    const avgPrice = weighted / (n - 1 + lastFraction)
    // a block in the current hour can only start now, not at the top of the hour
    const start = block[0].start < new Date() ? new Date() : block[0].start
    if (!best || avgPrice < best.avgPrice) best = { slots: block, start, end, avgPrice }
  }
  return best
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

export interface PricedPart {
  slot: PriceSlot
  from: Date
  to: Date
  kwh: number
  cost: number
}

export interface PricedSession {
  cost: number
  parts: PricedPart[]
  missingHours: number // part of the window without a published price
}

/** Cost of drawing `kwhPerHour` from the grid between `start` and `end` at hourly prices (+ markup). */
export function priceSession(start: Date, end: Date, kwhPerHour: number, prices: PriceSlot[], markup = 0): PricedSession {
  const HOUR = 3600_000
  const hours = (end.getTime() - start.getTime()) / HOUR
  const parts: PricedPart[] = []
  let covered = 0
  for (const slot of prices) {
    const from = Math.max(slot.start.getTime(), start.getTime())
    const to = Math.min(slot.start.getTime() + HOUR, end.getTime())
    if (to <= from) continue
    const h = (to - from) / HOUR
    covered += h
    const kwh = kwhPerHour * h
    parts.push({ slot, from: new Date(from), to: new Date(to), kwh, cost: kwh * (slot.price + markup) })
  }
  return { cost: parts.reduce((s, p) => s + p.cost, 0), parts, missingHours: Math.max(0, hours - covered) }
}

import type { PriceSlot } from '@/lib/prices'
import type { Settings } from '@/lib/settings'
import { num } from '@/lib/storage'

export interface Battery {
  capacity: number // kWh
  chargeKw: number
  dischargeKw: number
  rte: number // 0..1
  price: number // €
  cycles: number
  eol: number // 0..1
}

/** Parsed battery from settings, or null while a field is empty or invalid. */
export function toBattery(s: Settings): Battery | null {
  const b = {
    capacity: num(s.capacityKwh),
    chargeKw: num(s.chargeKw),
    dischargeKw: num(s.dischargeKw),
    rte: num(s.rtePct) / 100,
    price: num(s.priceEur),
    cycles: num(s.cycles),
    eol: num(s.eolPct) / 100,
  }
  const valid = [b.capacity, b.chargeKw, b.dischargeKw, b.rte, b.cycles].every((v) => v > 0) && b.price >= 0 && b.eol >= 0
  return valid && b.rte <= 1 ? b : null
}

/**
 * Wear cost per kWh taken out of the battery: purchase price spread over every kWh it delivers
 * in its life. Capacity fades linearly to `eol`, so on average a cycle delivers (1 + eol) / 2.
 */
export const cycleCost = (b: Battery) => b.price / (b.cycles * b.capacity * ((1 + b.eol) / 2))

/** What a kWh from the battery really costs when it was charged at `chargePrice` (€/kWh). */
export const storedCost = (b: Battery, chargePrice: number) => chargePrice / b.rte + cycleCost(b)

export type Role = 'before' | 'charge' | 'discharge' | 'worth' | 'grid'

export interface Hour {
  start: Date
  price: number // all-in €/kWh (market + markup)
  role: Role
  kwh: number // charged or discharged in this hour
}

export interface Plan {
  hours: Hour[]
  chargeStart: Date
  chargeEnd: Date
  chargePrice: number // average all-in price paid while charging
  breakEven: number // stored cost: any hour above this is cheaper from the battery
  dischargeKwh: number
  gridCost: number // what the discharged kWh would have cost from the grid
  batteryCost: number // what they cost via the battery
  profit: number
}

/**
 * Best single cycle in the known prices: charge in one consecutive block (the dip), then
 * discharge in the most expensive later hours that beat the stored cost, limited by capacity
 * and discharge power. Returns the plan for the most profitable dip, or the cheapest dip
 * when no cycle pays off.
 */
export function planCycle(slots: PriceSlot[], b: Battery, markup: number, now = new Date()): Plan | null {
  const hourStart = new Date(now)
  hourStart.setMinutes(0, 0, 0)
  const upcoming = slots.filter((s) => s.start >= hourStart).map((s) => ({ start: s.start, price: s.price + markup }))
  const hoursNeeded = b.capacity / b.chargeKw
  const n = Math.max(1, Math.ceil(hoursNeeded))
  const lastFraction = hoursNeeded - (n - 1) || 1

  let best: (Plan & { i: number; picked: Map<number, number> }) | null = null
  for (let i = 0; i + n <= upcoming.length; i++) {
    const block = upcoming.slice(i, i + n)
    const weighted = block.reduce((sum, s, k) => sum + s.price * (k === n - 1 ? lastFraction : 1), 0)
    const chargePrice = weighted / hoursNeeded
    const breakEven = storedCost(b, chargePrice)

    // fill the battery's capacity with the most expensive hours after charging
    const picked = new Map<number, number>()
    let left = b.capacity
    let gridCost = 0
    const candidates = upcoming
      .map((s, idx) => ({ ...s, idx }))
      .slice(i + n)
      .filter((s) => s.price > breakEven)
      .sort((a, c) => c.price - a.price)
    for (const s of candidates) {
      if (left <= 0) break
      const kwh = Math.min(b.dischargeKw, left)
      picked.set(s.idx, kwh)
      gridCost += s.price * kwh
      left -= kwh
    }
    const dischargeKwh = b.capacity - left
    const batteryCost = breakEven * dischargeKwh
    const profit = gridCost - batteryCost
    if (!best || profit > best.profit + 1e-9 || (Math.abs(profit - best.profit) < 1e-9 && chargePrice < best.chargePrice)) {
      best = {
        i,
        picked,
        hours: [],
        chargeStart: block[0].start < now ? now : block[0].start,
        chargeEnd: new Date(block[0].start.getTime() + hoursNeeded * 3600_000),
        chargePrice,
        breakEven,
        dischargeKwh,
        gridCost,
        batteryCost,
        profit,
      }
    }
  }
  if (!best) return null

  const { i, picked, ...plan } = best
  plan.hours = upcoming.map((s, idx): Hour => {
    if (idx < i) return { ...s, role: 'before', kwh: 0 }
    if (idx < i + n) return { ...s, role: 'charge', kwh: b.chargeKw * (idx === i + n - 1 ? lastFraction : 1) }
    if (picked.has(idx)) return { ...s, role: 'discharge', kwh: picked.get(idx)! }
    return { ...s, role: s.price > plan.breakEven ? 'worth' : 'grid', kwh: 0 }
  })
  return plan
}

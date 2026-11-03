import { useEffect, useState } from 'react'
import { fetchPrices, type PriceSlot } from '@/lib/prices'

/** Hourly prices for today and tomorrow, loaded once per screen. */
export function usePrices() {
  const [prices, setPrices] = useState<PriceSlot[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    fetchPrices()
      .then(setPrices)
      .catch((e: Error) => setError(e.message))
  }, [])
  return { prices, error }
}

/** Price of the hour we're in now. */
export function currentPrice(prices: PriceSlot[] | null) {
  const now = Date.now()
  return prices?.find((p) => p.start.getTime() <= now && now < p.start.getTime() + 3600_000)?.price
}

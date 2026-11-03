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

import { createContext, useContext, type ReactNode } from 'react'
import { useStoredState } from '@/lib/storage'

export interface Settings {
  name: string
  capacityKwh: string // usable capacity
  chargeKw: string // max charge power from the socket
  dischargeKw: string // max power delivered to the home
  rtePct: string // round-trip efficiency
  priceEur: string // purchase price incl. installation
  cycles: string // rated full cycles
  eolPct: string // capacity left at end of warranty / life
  markup: string // €/kWh energy tax + supplier fee on top of market prices
  feedIn: string // €/kWh received for exporting solar
}

export const DEFAULT_SETTINGS: Settings = {
  name: 'Plug-in battery',
  capacityKwh: '2.7',
  chargeKw: '1.2',
  dischargeKw: '0.8',
  rtePct: '85',
  priceEur: '1000',
  cycles: '6000',
  eolPct: '70',
  markup: '0.13',
  feedIn: '0.05',
}

// the EV tools app is served from the same origin, so keys are prefixed
export const SETTINGS_KEY = 'hb:settings'

interface SettingsContextValue {
  settings: Settings
  update: (patch: Partial<Settings>) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useStoredState<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS)
  const settings = { ...DEFAULT_SETTINGS, ...stored }
  const update = (patch: Partial<Settings>) => setStored((s) => ({ ...DEFAULT_SETTINGS, ...s, ...patch }))
  return <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}

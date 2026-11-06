import { ArrowLeft, BatteryCharging, BatteryMedium, PlugZap, Scale, Settings as SettingsIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BatteryTool } from '@/components/BatteryTool'
import { ChargeCost } from '@/components/ChargeCost'
import { ChargePlanner } from '@/components/ChargePlanner'
import { CostCompare } from '@/components/CostCompare'
import { SettingsScreen } from '@/components/SettingsScreen'
import { cn } from '@/lib/utils'
import { SettingsProvider, useSettings } from '@/lib/settings'
import { useStoredState } from '@/lib/storage'
import { useState } from 'react'

type Tool = 'charge' | 'battery' | 'cost' | 'compare'

const TOOLS = [
  { id: 'charge', label: 'Trip', icon: BatteryCharging },
  { id: 'battery', label: 'Battery', icon: BatteryMedium },
  { id: 'cost', label: 'Charge cost', icon: PlugZap },
  { id: 'compare', label: 'Petrol vs EV', icon: Scale },
] as const

function Shell() {
  const { settings } = useSettings()
  const [tool, setTool] = useStoredState<Tool>('tab', 'charge')
  // first launch: start on settings until a home address is saved
  const [showSettings, setShowSettings] = useState(() => !settings.home)

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-14 flex-1 items-center gap-1">
          {showSettings && (
            <Button variant="ghost" size="icon-lg" aria-label="Back" onClick={() => setShowSettings(false)} className="-ml-2">
              <ArrowLeft />
            </Button>
          )}
          <h1 className="text-lg font-semibold tracking-tight">
            {showSettings ? 'Settings' : TOOLS.find((t) => t.id === tool)?.label}
          </h1>
        </div>
        {!showSettings && (
          <Button variant="ghost" size="icon-lg" aria-label="Settings" onClick={() => setShowSettings(true)} className="-mr-2">
            <SettingsIcon />
          </Button>
        )}
      </header>

      <main className="flex-1 px-4 pt-4 pb-24">
        {showSettings ? (
          <SettingsScreen />
        ) : tool === 'charge' ? (
          <ChargePlanner onOpenSettings={() => setShowSettings(true)} />
        ) : tool === 'battery' ? (
          <BatteryTool />
        ) : tool === 'cost' ? (
          <ChargeCost />
        ) : (
          <CostCompare />
        )}
      </main>

      {!showSettings && (
        <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto grid max-w-lg grid-cols-4">
            {TOOLS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTool(id)}
                aria-current={tool === id ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                  tool === id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className={cn('rounded-full px-4 py-1', tool === id && 'bg-muted')}>
                  <Icon className="size-5" />
                </span>
                {label}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  )
}

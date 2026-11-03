import { useState } from 'react'
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calculator } from '@/components/Calculator'
import { SettingsScreen } from '@/components/SettingsScreen'
import { SETTINGS_KEY, SettingsProvider } from '@/lib/settings'

function Shell() {
  // first launch: start on settings so the battery gets defined
  const [showSettings, setShowSettings] = useState(() => {
    try {
      return localStorage.getItem(SETTINGS_KEY) === null
    } catch {
      return false
    }
  })

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-14 flex-1 items-center gap-1">
          {showSettings && (
            <Button variant="ghost" size="icon-lg" aria-label="Back" onClick={() => setShowSettings(false)} className="-ml-2">
              <ArrowLeft />
            </Button>
          )}
          <h1 className="text-lg font-semibold tracking-tight">{showSettings ? 'Settings' : 'Home Battery'}</h1>
        </div>
        {!showSettings && (
          <Button variant="ghost" size="icon-lg" aria-label="Settings" onClick={() => setShowSettings(true)} className="-mr-2">
            <SettingsIcon />
          </Button>
        )}
      </header>

      <main className="flex-1 px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {showSettings ? <SettingsScreen /> : <Calculator onOpenSettings={() => setShowSettings(true)} />}
      </main>
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

import { useEffect, useState } from 'react'
import { Loader2, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ExportScreen } from '@/components/ExportScreen'
import { LoginScreen } from '@/components/LoginScreen'
import { type Credentials, type Device, forgetToken, getDevices, HomeWizardError } from '@/lib/homewizard'
import { useStoredState } from '@/lib/storage'

export default function App() {
  // the login lives only in this browser (localStorage); "Log out" removes it
  const [creds, setCreds] = useStoredState<Credentials | null>('energy-export.credentials', null)
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [startupError, setStartupError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!creds || devices) return
    let cancelled = false
    getDevices(creds)
      .then((list) => !cancelled && setDevices(list))
      .catch((err) => {
        if (cancelled) return
        if (err instanceof HomeWizardError && err.kind === 'login') setCreds(null)
        setStartupError(err instanceof HomeWizardError ? err.message : 'Something went wrong. Try again.')
      })
    return () => {
      cancelled = true
    }
  }, [creds, devices, setCreds, attempt])

  function logout() {
    forgetToken()
    setCreds(null)
    setDevices(null)
    setStartupError(null)
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <h1 className="flex h-14 flex-1 items-center text-lg font-semibold tracking-tight">Energy export</h1>
        {creds && (
          <Button variant="ghost" onClick={logout} className="-mr-2">
            <LogOut />
            Log out
          </Button>
        )}
      </header>

      <main className="flex-1 px-4 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <p className="mb-4 text-sm text-muted-foreground">Daily numbers from HomeWizard, ready to paste into your Google Sheet.</p>
        {!creds ? (
          <>
            {startupError && <p className="mb-4 text-sm text-destructive">{startupError}</p>}
            <LoginScreen
              onLoggedIn={(c, d) => {
                setStartupError(null)
                setCreds(c)
                setDevices(d)
              }}
            />
          </>
        ) : devices ? (
          <ExportScreen creds={creds} devices={devices} onLoginExpired={logout} />
        ) : startupError ? (
          <div className="grid gap-3">
            <p className="text-sm text-destructive">{startupError}</p>
            <Button
              variant="outline"
              onClick={() => {
                setStartupError(null)
                setAttempt((n) => n + 1)
              }}
            >
              Try again
            </Button>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading your meters…
          </p>
        )}
      </main>
    </div>
  )
}

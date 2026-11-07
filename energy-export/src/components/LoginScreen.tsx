import { useState } from 'react'
import { Loader2, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type Credentials, type Device, HomeWizardError, login } from '@/lib/homewizard'

interface Props {
  onLoggedIn: (creds: Credentials, devices: Device[]) => void
}

export function LoginScreen({ onLoggedIn }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const creds = { email: email.trim(), password }
    try {
      const devices = await login(creds)
      onLoggedIn(creds, devices)
    } catch (err) {
      setError(err instanceof HomeWizardError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Log in with HomeWizard</CardTitle>
          <CardDescription>Use the email and password of your HomeWizard Energy app.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Log in
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="flex gap-2 text-xs text-muted-foreground">
        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
        Your login is stored only in this browser on this device. "Log out" removes it. The daily numbers come from the
        HomeWizard cloud, the same place the app gets them from.
      </p>
    </div>
  )
}

// HomeWizard cloud (unofficial API, can change without notice).
// Login and the device list go through our relay (they don't allow browser calls);
// the daily history comes straight from tsdb-reader, which does.

export const RELAY_URL = (import.meta.env.VITE_RELAY_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const HISTORY_URL = 'https://tsdb-reader.homewizard.com/devices/date/'
export const TIMEZONE = 'Europe/Amsterdam'

export interface Credentials {
  email: string
  password: string
}

export interface Device {
  device_id: string
  type: string
  name: string
}

export interface DayRow {
  date: string // YYYY-MM-DD (Amsterdam)
  importKwh: number | null // Stroomverbruik: taken from the grid
  exportKwh: number | null // Zonnepanelen Opbrengst: delivered back to the grid
  solarKwh: number | null // Zonnepanelen productie: from the solar kWh meter
  gasM3: number | null
  solarMissing: boolean // the solar meter had no data (HomeWizard reports 0, but less than went to the grid)
}

export class HomeWizardError extends Error {
  kind: 'login' | 'expired' | 'network' | 'data'
  constructor(kind: 'login' | 'expired' | 'network' | 'data', message: string) {
    super(message)
    this.kind = kind
  }
}

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function localDate(value: Date = new Date()): string {
  return dateFormatter.format(value)
}

export function addDays(date: string, amount: number): string {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + amount)
  return d.toISOString().slice(0, 10)
}

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

// ISO week path, e.g. "2026/week/37". ISO weeks take the year of their Thursday.
export function weekPath(date: string): string {
  const d = new Date(date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const year = d.getUTCFullYear()
  const week = Math.ceil(((d.getTime() - Date.parse(year + '-01-01T12:00:00Z')) / 86400000 + 1) / 7)
  return `${year}/week/${String(week).padStart(2, '0')}`
}

async function send(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(20000) })
  } catch {
    throw new HomeWizardError('network', 'HomeWizard could not be reached. Check your internet connection and try again.')
  }
}

function basicAuth({ email, password }: Credentials): string {
  const bytes = new TextEncoder().encode(`${email}:${password}`)
  return 'Basic ' + btoa(String.fromCharCode(...bytes))
}

let cachedToken: { key: string; token: string; expires: number } | null = null

async function getToken(creds: Credentials): Promise<string> {
  const key = creds.email
  if (cachedToken && cachedToken.key === key && Date.now() < cachedToken.expires) return cachedToken.token
  if (!RELAY_URL) throw new HomeWizardError('network', 'The login relay is not configured for this build.')
  const res = await send(RELAY_URL + '/token', { headers: { Authorization: basicAuth(creds) } })
  if (res.status === 401 || res.status === 403) {
    throw new HomeWizardError('login', 'HomeWizard did not accept this email and password.')
  }
  if (!res.ok) throw new HomeWizardError('network', `HomeWizard login failed (error ${res.status}). Try again later.`)
  const data = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) throw new HomeWizardError('data', 'HomeWizard did not return a login token.')
  cachedToken = { key, token: data.access_token, expires: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000 }
  return data.access_token
}

export function forgetToken() {
  cachedToken = null
}

export async function login(creds: Credentials): Promise<Device[]> {
  forgetToken()
  return getDevices(creds)
}

export async function getDevices(creds: Credentials): Promise<Device[]> {
  const token = await getToken(creds)
  const res = await send(RELAY_URL + '/locations', { headers: { Authorization: 'Bearer ' + token } })
  if (!res.ok) throw new HomeWizardError('network', `Could not load your meters (error ${res.status}).`)
  return (await res.json()) as Device[]
}

interface HistoryPoint {
  time: string
  import?: number
  export?: number
  gas?: number
}

async function history(token: string, path: string, identifier: string, measurementType: string, type: string) {
  const res = await send(HISTORY_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      devices: [{ identifier, measurementType }],
      type,
      tz: TIMEZONE,
      fill: null,
      three_phases: false,
      values: true,
      wattage: false,
    }),
  })
  if (res.status === 401) throw new HomeWizardError('expired', 'Your HomeWizard session has expired. Try again.')
  if (!res.ok) throw new HomeWizardError('network', `HomeWizard could not return the history (error ${res.status}).`)
  const data = (await res.json()) as { values?: HistoryPoint[] }
  if (!Array.isArray(data.values)) throw new HomeWizardError('data', 'HomeWizard returned an unexpected history format.')
  return data.values
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function add(a: number | null, b: number | null): number | null {
  if (b === null) return a
  return (a ?? 0) + b
}

export async function fetchDays(creds: Credentials, devices: Device[], from: string, to: string): Promise<DayRow[]> {
  try {
    return await fetchDaysOnce(creds, devices, from, to)
  } catch (err) {
    // the token lasts an hour: on expiry, log in again once and retry
    if (!(err instanceof HomeWizardError && err.kind === 'expired')) throw err
    forgetToken()
    return fetchDaysOnce(creds, devices, from, to)
  }
}

async function fetchDaysOnce(creds: Credentials, devices: Device[], from: string, to: string): Promise<DayRow[]> {
  const dates = datesBetween(from, to)
  const rows = new Map<string, DayRow>(
    dates.map((date) => [date, { date, importKwh: null, exportKwh: null, solarKwh: null, gasM3: null, solarMissing: false }]),
  )
  const paths = [...new Set(dates.map(weekPath))]
  const p1s = devices.filter((d) => d.type === 'p1dongle')
  const solars = devices.filter((d) => d.type === 'energymeter')
  if (p1s.length === 0 && solars.length === 0) {
    throw new HomeWizardError('data', 'No P1 meter or kWh meter was found in this HomeWizard account.')
  }

  // each (meter, measurement, day) counts once, even if HomeWizard repeats a day in another week's answer
  const seen = new Set<string>()
  const rowFor = (source: string, time: string) => {
    const date = localDate(new Date(time))
    const key = `${source}|${date}`
    if (seen.has(key)) return undefined
    seen.add(key)
    return rows.get(date)
  }

  const token = await getToken(creds)
  const jobs: (() => Promise<void>)[] = []
  for (const path of paths) {
    for (const p1 of p1s) {
      jobs.push(async () => {
        for (const p of await history(token, path, p1.device_id, 'main_connection', 'main_connection')) {
          const row = rowFor(p1.device_id + '|grid', p.time)
          if (row) {
            row.importKwh = add(row.importKwh, num(p.import))
            row.exportKwh = add(row.exportKwh, num(p.export))
          }
        }
      })
      jobs.push(async () => {
        for (const p of await history(token, path, p1.device_id, 'gas', 'gas')) {
          const row = rowFor(p1.device_id + '|gas', p.time)
          if (row) row.gasM3 = add(row.gasM3, num(p.gas))
        }
      })
    }
    for (const meter of solars) {
      jobs.push(async () => {
        for (const p of await history(token, path, meter.device_id, 'power_import', 'solar')) {
          const row = rowFor(meter.device_id + '|solar', p.time)
          if (row) row.solarKwh = add(row.solarKwh, num(p.export))
        }
      })
    }
  }

  // a few requests at a time, to be gentle on HomeWizard
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(4, jobs.length) }, async () => {
      while (next < jobs.length) await jobs[next++]()
    }),
  )
  // The panels can't produce less than went back to the grid. If they seem to, the solar meter was
  // offline (HomeWizard then reports 0), so leave the number out rather than paste a false 0.
  for (const row of rows.values()) {
    if (row.solarKwh !== null && row.exportKwh !== null && row.solarKwh + 0.05 < row.exportKwh) {
      row.solarKwh = null
      row.solarMissing = true
    }
  }
  return dates.map((d) => rows.get(d)!)
}

// Google Sheets (Dutch locale): decimal comma, tab between cells, one line per day.
export function formatNumber(v: number | null, decimals: number): string {
  return v === null ? '' : v.toFixed(decimals).replace('.', ',')
}

export function toSheetRows(rows: DayRow[], includeDate: boolean): string {
  return rows
    .map((r) => {
      const cells = [
        formatNumber(r.importKwh, 2),
        formatNumber(r.exportKwh, 2),
        formatNumber(r.solarKwh, 2),
        formatNumber(r.gasM3, 3),
      ]
      if (includeDate) {
        const [y, m, d] = r.date.split('-')
        cells.unshift(`${Number(d)}-${Number(m)}-${y}`)
      }
      return cells.join('\t')
    })
    .join('\n')
}

// Login relay for Energy export.
// HomeWizard's login and device list don't allow browser calls from other websites (no CORS headers).
// This Worker passes those two calls on and stores nothing. The daily history is fetched by the
// browser directly from tsdb-reader.homewizard.com, which does allow browser calls.

const ALLOWED_ORIGINS = [/^https:\/\/remcomagielse\.github\.io$/, /^http:\/\/localhost(:\d+)?$/]

const ROUTES = {
  '/token': 'https://api.homewizardeasyonline.com/v1/auth/account/token',
  '/locations': 'https://homes.api.homewizard.com/locations',
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

// The account's locations include the home address and coordinates. Only pass on the meters.
function metersOnly(locations) {
  if (!Array.isArray(locations)) return []
  return locations.flatMap((home) =>
    (home.devices || []).map((d) => ({ device_id: d.device_id, type: d.type, name: d.name })),
  )
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || ''
    if (!ALLOWED_ORIGINS.some((re) => re.test(origin))) {
      return new Response('Forbidden', { status: 403 })
    }
    const cors = corsHeaders(origin)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const { pathname } = new URL(request.url)
    const target = ROUTES[pathname]
    if (request.method !== 'GET' || !target) {
      return new Response('Not found', { status: 404, headers: cors })
    }

    const upstream = await fetch(target, {
      headers: { Authorization: request.headers.get('Authorization') || '', Accept: 'application/json' },
    })
    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: upstream.status }), {
        status: upstream.status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const data = await upstream.json()
    const body = pathname === '/locations' ? metersOnly(data) : data
    return new Response(JSON.stringify(body), {
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  },
}

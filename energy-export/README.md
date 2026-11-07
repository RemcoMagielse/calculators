# Energy export

A small installable web app (PWA) that fetches daily numbers from a HomeWizard account and copies them as rows for
a spreadsheet (Dutch Google Sheets: decimal comma, one cell per column).

Per day:

| Column | Source |
|---|---|
| Stroomverbruik (kWh) | P1 meter, taken from the grid |
| Zonnepanelen Opbrengst (kWh) | P1 meter, delivered back to the grid |
| Zonnepanelen productie (kWh) | HomeWizard kWh meter on the solar panels |
| Gasverbruik (m³) | Gas meter via the P1 meter |

Pick a start and end date, press Fetch, then "Copy rows" and paste into the first empty cell of your sheet.
The app remembers where the last copy ended and starts the next one the day after.

## How it works

- The numbers come from the **HomeWizard cloud**, the same source the HomeWizard Energy app uses. This API is
  unofficial and can change without notice. The meters' local API has no history, which is why the cloud is needed.
- The HomeWizard login and device list don't allow browser calls from other websites. A tiny Cloudflare Worker
  ([`relay/`](relay/)) passes those two calls on. It stores nothing, strips the home address from the device list
  and only accepts requests from `remcomagielse.github.io`, `localhost` and `127.0.0.1`.
- The daily history is fetched by the browser directly from HomeWizard.
- The email and password are stored only in the browser (localStorage). "Log out" removes them.

## Relay setup (one time)

Needs a free [Cloudflare](https://dash.cloudflare.com/sign-up) account.

```bash
cd energy-export/relay
npx wrangler login
npx wrangler deploy
```

Put the printed `https://energy-export-relay.<your-subdomain>.workers.dev` address in [`.env`](.env) as
`VITE_RELAY_URL` and commit it. The address is not a secret.

## Development

```bash
npm install
npm run dev
```

Docker (served at http://localhost:8082):

```bash
docker compose up --build
```

## Deployment

The GitHub Pages workflow in the repo root builds this app too and publishes it at `/<repo>/energy-export/`.

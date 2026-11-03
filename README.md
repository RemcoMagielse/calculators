# Car Calculators

A small installable web app (PWA) with three tools for an electric car:

- **Trip** – how many kWh to charge for a trip from home (round trip optional), and the cheapest hours to charge, based on hourly Dutch energy prices.
- **Battery** – how long to charge from the current % to 80% and 100%, when to stop, and what it costs.
- **Petrol vs EV** – cost per km for both cars and the crossover price point.

Settings (home address, cars, default prices) are stored on the device.

The [`home-battery/`](home-battery/) folder holds a separate app: a calculator that checks whether charging a home battery in the price dip pays off after round-trip losses and battery wear. It is published at `/<repo>/home-battery/`.

## Data sources (free, no API keys)

- Address suggestions: [PDOK Locatieserver](https://api.pdok.nl/bzk/locatieserver/search/v3_1/ui/) (NL)
- Worldwide address search: [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap)
- Routing: OSRM ([demo server](https://router.project-osrm.org) and [FOSSGIS](https://routing.openstreetmap.de))
- Hourly energy prices: [EnergyZero](https://www.energyzero.nl)

## Development

```bash
npm install
npm run dev
```

Docker (served at http://localhost:8080):

```bash
docker compose up --build
```

## Deployment

Every push to `main` is built and published to GitHub Pages by `.github/workflows/deploy.yml`.
Open the site in Chrome on Android and choose **Install app**.

# Home Battery

A small installable web app (PWA) that checks whether charging a (plug-in) home battery in the price dip is actually
cheaper than buying from the grid later, once round-trip losses and battery wear are counted.

## How it calculates

- **Wear per kWh** = purchase price ÷ (rated cycles × usable kWh × (1 + end-of-life capacity) ÷ 2)
- **Stored cost** = charge price ÷ RTE + wear per kWh. Example: 30 ct at 85% RTE is 35.3 ct before wear.
- **Next cycle**: for every possible charge block in the known hourly prices, the battery is discharged in the most
  expensive later hours that beat the stored cost (limited by capacity and discharge power). The block with the
  highest saving is shown.
- **Solar**: storing a solar kWh costs the feed-in price you give up, so the same formula applies.

Prices are the hourly Dutch day-ahead prices from [EnergyZero](https://www.energyzero.nl) (incl. VAT). Energy tax and
supplier fee are added from the settings. The battery and prices are set in Settings and stored on the device.

## Development

```bash
npm install
npm run dev
```

Docker (served at http://localhost:8081):

```bash
docker compose up --build
```

## Deployment

The GitHub Pages workflow in the repo root builds this app too and publishes it at `/<repo>/home-battery/`.

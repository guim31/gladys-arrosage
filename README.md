# Arrosage conseillé — irrigation advice for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that tells how much water each zone of
your garden needs today, from the **water balance of the soil**: the reference evapotranspiration (ET0, FAO-56) minus
the rain, at the location of your house, read from [Open-Meteo](https://open-meteo.com/) (free, no account). The
equivalent of the Home Assistant [Smart Irrigation](https://github.com/jeroenterheerdt/HAsmartirrigation) component.

## What it does

- **One device per zone** (up to four): water to bring (mm), advised watering time (minutes, from the application
  rate or the flow and area), soil water balance (mm), yesterday's and today's ET0, rain forecast today.
- **Daily balance**: `balance = min(reserve, previous balance + rain − Kc × ET0)`, Kc from the type of planting
  (lawn 0.85, vegetable garden 1, flower beds 0.75, hedges and shrubs 0.5) or typed. The balance survives restarts;
  the days missed while stopped are caught up (7 days back).
- **Rain threshold**: no watering advised when enough rain is forecast for the day.
- **Scene trigger** "Watering advised", once a day at the computation hour, for each zone that needs water, with the
  water and time as variables: start your irrigation controller (OpenSprinkler, Rain Bird, a smart plug…).
- **Scene action** "Zone watered" to count a watering (an amount, or a full ration).
- **Dashboard widget** "Irrigation advice", with a "watered" button per zone.
- The integration never opens a valve itself: your scenes do.

Texts and documentation in English, French, German and Spanish: [en](docs/en.md), [fr](docs/fr.md),
[de](docs/de.md), [es](docs/es.md).

## Requirements

- Gladys Assistant **5.1.0** or later.
- The coordinates of your house in Gladys (**Settings → Houses**): the integration asks for the permission to read
  them (`location` in the manifest).
- Internet access from the container, to `api.open-meteo.com`.

## Installation

In Gladys, open **Integrations → Install from GitHub** and enter the address of this repository:
`https://github.com/guim31/gladys-arrosage`. Then name your zones in the configuration screen, and add the discovered
devices.

## Limits

- An estimate from modelled weather, not a soil moisture measure: soil type, slope, shade and local storms are not
  known. Tune the Kc and the reserve cap after a few weeks.
- Open-Meteo is free for non-commercial use, under 10,000 requests a day; the integration reads it every 3 hours. Its
  data is published under CC BY 4.0.
- The first house with coordinates is used. Up to four zones.
- Developed and tested against the real Open-Meteo API and the SDK's fake Gladys, not yet on a real Gladys with an
  irrigation controller: feedback welcome.

## Development

```bash
npm install
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys (`@gladysassistant/integration-sdk/testing`) with an injected clock and
real Open-Meteo answers recorded for Toulouse and Lille (`test/fixtures/`).

## Credits

- Weather data by [Open-Meteo.com](https://open-meteo.com/), CC BY 4.0.
- The bucket model follows [HAsmartirrigation](https://github.com/jeroenterheerdt/HAsmartirrigation) by Jeroen ter
  Heerdt (MIT); ET0 and crop coefficients from FAO Irrigation and Drainage Paper 56.

Not affiliated with Open-Meteo or Home Assistant.

## License

Apache-2.0, see [LICENSE](LICENSE).

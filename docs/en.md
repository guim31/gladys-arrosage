# Arrosage conseillé — irrigation advice

How much water each zone of your garden needs today, from the water balance of the soil: the reference
evapotranspiration (ET0, FAO-56) minus the rain, at the location of your house. The data comes from
[Open-Meteo](https://open-meteo.com/), free and without an account. The integration advises: it controls no valve
itself, your scenes start the irrigation controller.

## What you get

One device per zone, with read-only sensors:

- **Water to bring** (mm): the deficit of the balance, 0 when the soil has enough or when rain is forecast;
- **Advised watering time** (minutes): the water to bring divided by the application rate of the zone (only when a
  rate, or a flow and an area, are configured);
- **Soil water balance** (mm): negative = water missing, positive = water kept in reserve;
- **Yesterday's ET0** and **Today's ET0** (mm/day), and the **Rain forecast today** (mm/day).

## How the advice is computed

Every day at the computation hour, yesterday is added to the balance of every zone:

`balance = min(reserve cap, balance of the day before + rain − Kc × ET0)`

- **ET0** is the reference evapotranspiration of a well-watered grass (FAO-56 Penman-Monteith), computed by
  Open-Meteo from temperature, wind, humidity and sunshine.
- **Kc**, the crop coefficient, adapts it to the planting: lawn 0.85, vegetable garden 1, flower beds 0.75, hedges and
  shrubs 0.5, or the value you type.
- The **reserve cap** is the surplus water the soil keeps after a heavy rain; it is spent before any watering is
  advised.
- **Water to bring** = −balance when the balance is negative. When the rain forecast for the day reaches the
  threshold, the advice is 0 (the deficit stays in the balance, and the rain will be counted tomorrow).
- **Time** = water to bring ÷ application rate × 60. The rate in mm/h is typed, or computed from the flow and the
  area (1 L on 1 m² = 1 mm).

The balance is kept in `/data` across restarts. After a stop, the missing days are counted on the next computation
(up to 7 days back). Mark a watering with the "Zone watered" scene action or the widget button: without an amount, the
balance goes back to 0 (a full ration).

## Configuration

Set the coordinates of your house in Gladys (Settings → Houses): the integration reads them.

- **Language of names and texts**: the names of the features (frozen when the device is added) and the texts of the
  widget.
- **Rain that cancels watering**: in mm, decimals accepted (2,5); 0 disables it.
- **Hour of the daily computation** (0-23, 5 by default): pick it before your watering time.
- **Zones 1 to 4**: a zone exists once it has a name. Then its type of planting (or a Kc), its application rate in
  mm/h, or its flow in L/min and its watered area in m², and its reserve cap in mm (25 by default, 0 for no
  carry-over, e.g. pots).

Rates of thumb: oscillating sprinkler 5 to 10 mm/h, pop-up spray 25 to 40 mm/h, drip line: flow of the drippers ×
number ÷ area.

## Actions

**Show the advice now** reads Open-Meteo if needed and shows the water and time of every zone.

## Scenes

- Trigger **Watering advised**: once a day, at the computation hour, for each zone that needs water (filter on a zone
  or not). Its variables: zone, water to bring (mm), advised time (minutes, 0 if unknown). Typical scene: "Watering
  advised" on the lawn → open the valve of the irrigation controller (OpenSprinkler, Rain Bird, a smart plug…) → wait
  the advised time → close it → "Zone watered".
- Action **Zone watered**: counts a watering in the balance, the amount given in mm or a full ration when empty.
  Without a zone, every zone.
- The usual Gladys triggers on the device values also work, e.g. "Advised watering time above 0" combined with a time
  condition.

## Dashboard

The **Irrigation advice** widget shows today's ET0 and rain, the water and time of every zone, and a "watered" button
per zone. Its settings hide the weather line or the buttons. The device sensors can also be added to the dashboard,
with their history.

## Limits and troubleshooting

- An estimate, not a measure: the soil type, the slope, the shade or the wind are not known. Adjust the Kc or the
  reserve cap after a few weeks if the lawn turns yellow (Kc up) or stays soaked (Kc down).
- The rain counted is the rain modelled by Open-Meteo at your coordinates, not your rain gauge. A local storm may be
  missed.
- Open-Meteo is free for non-commercial use (fewer than 10,000 requests a day): the integration reads it every 3
  hours. Data under CC BY 4.0, by Open-Meteo.com.
- "No house location": set the coordinates of your house. "Open-Meteo cannot be reached": the advice keeps the last
  forecast and the integration retries every 15 minutes.
- Details in the logs: set `LOG_LEVEL=debug`.

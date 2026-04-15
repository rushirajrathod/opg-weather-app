# OPG Weather App

A full-stack weather dashboard built with **Next.js 15** that displays real-time conditions for six major US cities, powered entirely by the free [National Weather Service API](https://www.weather.gov/documentation/services-web-api) — no API key required.

---

## Live URLs

| Environment | URL |
|-------------|-----|
| Local dev   | http://localhost:3000 |
| Production  | *(deploy to Vercel / Railway and update this field)* |

**GitHub:** https://github.com/rushi-03/opg-weather-app

---

## Features

- Real-time weather for 6 US cities fetched in parallel
- Day / night card themes driven by the NWS `isDaytime` flag
- Structured JSON logging via **Winston** → written to `logs/`
- 30-minute HTTP cache headers + `stale-while-revalidate` on the API route
- Graceful degradation — if one city's NWS call fails it is logged and skipped; others still render
- Full TypeScript throughout — separate raw NWS types vs. application types
- 7 Jest unit tests covering happy path, error paths, and parallel failure handling

---

## Cities Covered

| City        | State | Latitude  | Longitude  |
|-------------|-------|-----------|------------|
| Miami       | FL    | 25.7743   | -80.1937   |
| New York    | NY    | 40.7128   | -74.0060   |
| Los Angeles | CA    | 34.0522   | -118.2437  |
| Chicago     | IL    | 41.8781   | -87.6298   |
| Houston     | TX    | 29.7604   | -95.3698   |
| Phoenix     | AZ    | 33.4484   | -112.0740  |

---

## Directory Structure

```
opg-weather-app/
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/
│   │   │   └── weather/
│   │   │       └── route.ts        # BACKEND – GET /api/weather
│   │   ├── globals.css
│   │   ├── layout.tsx              # Root HTML shell
│   │   └── page.tsx                # Home page (server component)
│   │
│   ├── components/                 # FRONTEND – React client components
│   │   ├── WeatherCard.tsx         # Single city card (day/night theme)
│   │   ├── WeatherGrid.tsx         # Fetches data, renders all cards
│   │   └── LoadingSpinner.tsx      # Shown while API call is in-flight
│   │
│   ├── config/
│   │   └── cities.ts               # City list & coordinates (single source of truth)
│   │
│   ├── lib/
│   │   ├── logger.ts               # Winston logger (file + console)
│   │   └── nws/
│   │       ├── client.ts           # NWS HTTP client (resolveGridPoint → getForecast)
│   │       └── types.ts            # Raw NWS API response shapes
│   │
│   └── types/
│       └── weather.ts              # Application-level types (CityWeather, WeatherPeriod …)
│
├── tests/
│   ├── tsconfig.json               # Test-specific TS config (adds @types/jest)
│   └── lib/
│       └── nws-client.test.ts      # 7 Jest unit tests for the NWS client
│
├── logs/                           # Runtime log files (git-ignored, directory kept)
│   ├── combined.log                # All levels
│   └── error.log                   # Errors only
│
├── .env.example                    # Environment variable reference
├── jest.config.ts
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## How It Works

```
Browser
  │
  └─► GET /api/weather                       (WeatherGrid client component)
           │
           ▼
  Next.js API Route  (src/app/api/weather/route.ts)
           │
           ▼
  NWS Client  (src/lib/nws/client.ts)
           │
           ├─► GET /points/{lat},{lon}         →  resolve gridId / gridX / gridY
           │
           └─► GET /gridpoints/{id}/{x},{y}/forecast  →  fetch forecast periods
                    │
                    ▼
           Map raw NWS periods → CityWeather (application type)
                    │
                    ▼
  JSON response  →  WeatherGrid  →  WeatherCard × N
```

All HTTP calls go through `fetchWithTimeout` (10 s abort), every step is logged, and errors surface cleanly.

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- npm (or yarn / pnpm)

### Install & Run

```bash
git clone https://github.com/rushi-03/opg-weather-app.git
cd opg-weather-app

npm install
npm run dev          # http://localhost:3000
```

### Environment Variables

Copy `.env.example` to `.env.local` and adjust as needed:

```bash
cp .env.example .env.local
```

| Variable    | Default | Description                                    |
|-------------|---------|------------------------------------------------|
| `LOG_LEVEL` | `info`  | Winston level: `debug` / `info` / `warn` / `error` |
| `NODE_ENV`  | —       | Set to `production` to disable console output  |

### Other Commands

```bash
npm test             # Run all Jest unit tests
npm run test:watch   # Watch mode
npm run test:coverage
npm run build        # Production build
npm start            # Start production server
npm run lint         # ESLint
```

---

## API Reference

### `GET /api/weather`

Returns weather data for all configured cities.

**Query params**

| Param  | Type   | Description                            |
|--------|--------|----------------------------------------|
| `city` | string | Optional. Filter to one city by its id (e.g. `miami`, `new-york`). |

**200 Response**

```json
{
  "data": [
    {
      "city": { "id": "miami", "name": "Miami", "state": "FL", "lat": 25.7743, "lon": -80.1937 },
      "current": {
        "name": "Today",
        "temperature": 82,
        "temperatureUnit": "F",
        "isDaytime": true,
        "shortForecast": "Mostly Sunny",
        "windSpeed": "10 mph",
        "windDirection": "SE",
        "precipitationProbability": 10,
        "icon": "https://api.weather.gov/icons/land/day/few"
      },
      "upcoming": [ ...next 4 periods... ],
      "fetchedAt": "2024-01-15T12:00:00.000Z",
      "durationMs": 312
    }
  ],
  "citiesCount": 6,
  "fetchedAt": "2024-01-15T12:00:00.000Z"
}
```

**Error Responses**

| Status | When |
|--------|------|
| 404    | Unknown `?city` value |
| 500    | NWS upstream failure  |

---

## Logging

Logs are written to `logs/` at startup:

```
logs/
  combined.log   ← all log levels (JSON, one entry per line)
  error.log      ← errors only
```

Example entry:

```json
{"level":"info","message":"Weather fetch complete","city":"miami","durationMs":312,"timestamp":"2024-01-15 12:00:00"}
```

In development, the same output is printed to the console with colour and a short timestamp.

---

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Framework | Next.js 15 (App Router)           |
| Language  | TypeScript 5                      |
| Styling   | Tailwind CSS 3                    |
| Logging   | Winston 3                         |
| Testing   | Jest 29 + ts-jest                 |
| Data      | National Weather Service free API |

---

## License

MIT

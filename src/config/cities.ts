/**
 * =============================================================================
 * City Configuration — src/config/cities.ts
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * The single source of truth for every city the app tracks.
 * Any other file that needs the city list imports it from here.
 *
 * WHY A SEPARATE FILE?
 * If city data were scattered across components or API routes, adding or
 * removing a city would mean editing multiple files. With this approach,
 * adding a city is one line change here — the rest of the app picks it up
 * automatically.
 *
 * HOW TO ADD A NEW CITY:
 * 1. Look up the city's latitude and longitude (Google Maps → right-click → copy coords)
 * 2. Append a new entry to the CITIES array below
 * 3. Done — the WeatherGrid, API route, and tests all use this list directly
 */

/**
 * Describes a single city the app can display weather for.
 *
 * WHY lat/lon INSTEAD OF A ZIP CODE OR CITY NAME?
 * The NWS API works exclusively with geographic coordinates — it has no
 * city-name lookup. We need exact lat/lon to ask "which forecast grid square
 * does this location fall in?"
 */
export interface City {
  /** URL-safe identifier used in query parameters, e.g. "los-angeles" */
  id: string;
  /** Display name shown in the UI, e.g. "Los Angeles" */
  name: string;
  /** Two-letter US state abbreviation, e.g. "CA" */
  state: string;
  /** Latitude in decimal degrees (positive = North) */
  lat: number;
  /** Longitude in decimal degrees (negative = West for US cities) */
  lon: number;
}

/** The list of featured cities shown on the dashboard. */
export const CITIES: City[] = [
  { id: 'miami',       name: 'Miami',       state: 'FL', lat: 25.7743,  lon: -80.1937  },
  { id: 'new-york',    name: 'New York',    state: 'NY', lat: 40.7128,  lon: -74.0060  },
  { id: 'los-angeles', name: 'Los Angeles', state: 'CA', lat: 34.0522,  lon: -118.2437 },
  { id: 'chicago',     name: 'Chicago',     state: 'IL', lat: 41.8781,  lon: -87.6298  },
  { id: 'houston',     name: 'Houston',     state: 'TX', lat: 29.7604,  lon: -95.3698  },
  { id: 'phoenix',     name: 'Phoenix',     state: 'AZ', lat: 33.4484,  lon: -112.0740 },
];

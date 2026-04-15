/**
 * =============================================================================
 * Application Types — src/types/weather.ts
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * TypeScript type definitions that describe the shape of weather data used
 * throughout the app — in the API routes, components, and tests.
 *
 * WHY SEPARATE FROM src/lib/nws/types.ts?
 * There are two layers of types in this project:
 *
 *   src/lib/nws/types.ts  → Raw NWS API shapes (what the external API sends us)
 *   src/types/weather.ts  → Our app's own shapes (what we expose to the UI)
 *
 * The NWS API returns data in a verbose, inconsistent format (temperatures in
 * Celsius for observations, wind speed in km/h, etc.). The client code in
 * nws/client.ts translates that raw data into these cleaner app types.
 * This means if the NWS API changes its format, only the client and nws/types.ts
 * need updating — the components and API routes stay untouched.
 */

/**
 * Basic information about a city — used to label weather cards.
 * Mirrors the City interface in config/cities.ts but is kept separate
 * because searched/dynamic cities also get a CityInfo object.
 */
export interface CityInfo {
  id: string;
  name: string;
  state: string;
  lat: number;
  lon: number;
}

/**
 * One block of weather data — either "current conditions" or a forecast period.
 *
 * WHY ONE TYPE FOR BOTH?
 * The NWS API represents both current readings and upcoming periods with the
 * same fields. Reusing one type keeps the UI components simple — a WeatherCard
 * doesn't need to care whether it's showing live data or a forecast.
 */
export interface WeatherPeriod {
  /** Human-readable label, e.g. "Current Conditions", "Tonight", "Wednesday" */
  name: string;
  /** ISO 8601 timestamp string, e.g. "2024-01-15T06:00:00-05:00" */
  startTime: string;
  endTime: string;
  /** true = day period (affects the card's gradient colour) */
  isDaytime: boolean;
  /** Temperature value — always in °F coming from NWS; converted client-side for °C display */
  temperature: number;
  /** Always "F" from the NWS US endpoint */
  temperatureUnit: string;
  /** Formatted wind speed string, e.g. "10 mph" */
  windSpeed: string;
  /** Cardinal direction abbreviation, e.g. "SE", "NNW" */
  windDirection: string;
  /** One-liner condition summary, e.g. "Mostly Sunny" */
  shortForecast: string;
  /** Full paragraph description from NWS (shown in tooltips / detail views) */
  detailedForecast: string;
  /** NWS icon URL — can be used directly as <img src={icon} /> */
  icon: string;
  /**
   * Chance of rain/snow as a 0–100 integer, or null when NWS doesn't report it.
   * Current-conditions observations from real weather stations don't include this;
   * only forecast periods do.
   */
  precipitationProbability: number | null;
}

/**
 * All weather data for a single city — this is what a WeatherCard receives.
 */
export interface CityWeather {
  /** Identity and location of the city */
  city: CityInfo;
  /** Real-time reading from the nearest weather station (falls back to first forecast if unavailable) */
  current: WeatherPeriod;
  /** The next few upcoming forecast periods (used in the card's "Upcoming" list) */
  upcoming: WeatherPeriod[];
  /** ISO timestamp of when this data was fetched from NWS */
  fetchedAt: string;
  /** How long the full NWS round-trip took in milliseconds (useful for debugging slow responses) */
  durationMs: number;
}

/**
 * The JSON shape returned by GET /api/weather on success.
 * Wraps the data array with metadata so the frontend knows when data was fetched.
 */
export interface WeatherApiResponse {
  data: CityWeather[];
  fetchedAt: string;
  citiesCount: number;
}

/**
 * The JSON shape returned by GET /api/weather on failure.
 * Consistent error format means the frontend always knows how to display an error.
 */
export interface WeatherApiError {
  error: string;      // Short error category, e.g. "Not Found"
  message: string;    // Human-readable explanation shown to the user
  statusCode: number; // HTTP status code mirrored in the body for convenience
}

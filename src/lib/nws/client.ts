/**
 * =============================================================================
 * NWS API Client — src/lib/nws/client.ts
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * The core data-fetching layer of the app. All communication with the
 * National Weather Service (NWS) API lives here.
 *
 * WHY DOES THE NWS API REQUIRE MULTIPLE CALLS PER CITY?
 * The NWS API is designed around geographic grid squares, not city names.
 * To get weather for a city we must work through a chain of lookups:
 *
 *   Step 1 — Resolve the grid:
 *     GET /points/{lat},{lon}
 *     → Tells us which NWS forecast office covers this location and gives us
 *       the URLs for the forecast and nearby observation stations.
 *
 *   Step 2 (observation + forecast run IN PARALLEL to save time):
 *     GET {observationStations}               → list of nearby weather stations
 *     GET /stations/{id}/observations/latest  → REAL current conditions from the nearest station
 *     GET {forecast}                          → upcoming forecast periods (Today, Tonight, etc.)
 *
 * WHY FETCH REAL OBSERVATIONS INSTEAD OF JUST USING THE FORECAST?
 * The first forecast period covers a 12-hour window — it's an average, not a
 * live reading. The current temperature on Google Weather comes from real
 * sensor data at a nearby airport or weather station. By fetching
 * /stations/{id}/observations/latest we get that actual sensor reading,
 * which matches Google Weather and other services.
 * If the observation endpoint is unavailable, we fall back to the first
 * forecast period so the app always shows something.
 */

import logger from '@/lib/logger';
import type {
  NWSPointsResponse,
  NWSForecastResponse,
  NWSForecastPeriod,
  NWSStationsResponse,
  NWSObservationResponse,
} from './types';
import type { City } from '@/config/cities';
import type { CityWeather, WeatherPeriod } from '@/types/weather';

const NWS_BASE_URL    = 'https://api.weather.gov';
const REQUEST_TIMEOUT = 10_000; // Abort any single HTTP call after 10 seconds
// NWS requires a User-Agent header identifying your app — requests without one are rejected
const USER_AGENT      = '(opg-weather-app, https://github.com/rushi-03/opg-weather-app)';

// =============================================================================
// UNIT CONVERSION HELPERS
// The NWS observation endpoint returns SI units (Celsius, km/h, degrees).
// These helpers convert them to US customary units for display.
// =============================================================================

/** Converts Celsius to Fahrenheit, rounded to the nearest whole number */
function cToF(celsius: number): number {
  return Math.round(celsius * 9 / 5 + 32);
}

/** Converts kilometres per hour to miles per hour, rounded */
function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621371);
}

/**
 * Converts a compass bearing (0–360 degrees) to a 16-point cardinal abbreviation.
 * e.g. 0° → "N", 90° → "E", 135° → "SE", 247.5° → "WSW"
 *
 * HOW IT WORKS:
 * We split the full 360° circle into 16 equal segments of 22.5° each.
 * Dividing the bearing by 22.5 and rounding gives the index into the
 * directions array. The % 16 wraps 360° back to index 0 ("N").
 */
function degreesToCardinal(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// =============================================================================
// HTTP HELPER
// =============================================================================

/**
 * Wraps the built-in `fetch` with an automatic timeout.
 *
 * WHY DO WE NEED THIS?
 * By default, `fetch` will wait forever if the server doesn't respond.
 * The NWS API occasionally hangs on certain endpoints. Without a timeout,
 * one slow city could block the entire dashboard from loading.
 *
 * HOW IT WORKS:
 * We use `AbortController` — a browser/Node API that lets you cancel a
 * fetch request. We set a timer that fires after `timeoutMs` milliseconds
 * and calls `controller.abort()`, which cancels the in-flight request and
 * causes the fetch to throw an error. The `finally` block clears the timer
 * if the request completes normally (so we don't leave timers running).
 */
async function fetchWithTimeout(url: string, timeoutMs = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
      signal: controller.signal, // Attach the abort signal to the request
    });
  } finally {
    clearTimeout(timer); // Always clear the timer, even if the request throws
  }
}

// =============================================================================
// STEP 1: Resolve the grid point
// Turns a lat/lon pair into the grid coordinates and endpoint URLs we need.
// =============================================================================

async function resolveGridPoint(city: City): Promise<NWSPointsResponse['properties']> {
  const url = `${NWS_BASE_URL}/points/${city.lat},${city.lon}`;
  logger.info('Resolving grid point', { city: city.id, url });

  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    const msg = `NWS points API error: ${res.status} ${res.statusText}`;
    logger.error(msg, { city: city.id });
    throw new Error(msg);
  }

  const data = await res.json() as NWSPointsResponse;
  logger.debug('Grid point resolved', {
    city: city.id, gridId: data.properties.gridId,
    gridX: data.properties.gridX, gridY: data.properties.gridY,
  });
  return data.properties;
}

// =============================================================================
// STEP 2a: Fetch real current conditions from the nearest observation station
// Returns a WeatherPeriod on success, or null on any failure so the caller
// can fall back to the first forecast period without crashing.
// =============================================================================

async function fetchCurrentObservation(
  observationStationsUrl: string,
  city: City,
): Promise<WeatherPeriod | null> {
  try {
    // Sub-step: get the list of stations near this grid point
    const stationsRes = await fetchWithTimeout(observationStationsUrl);
    if (!stationsRes.ok) return null; // Can't get station list → give up silently

    const stations = await stationsRes.json() as NWSStationsResponse;
    if (!stations.features?.length) return null; // No stations found → fall back

    // Take the first station — NWS returns them ordered by distance (nearest first)
    const stationId = stations.features[0].properties.stationIdentifier;

    // Sub-step: get the latest sensor reading from that station
    const obsUrl = `${NWS_BASE_URL}/stations/${stationId}/observations/latest`;
    const obsRes = await fetchWithTimeout(obsUrl);
    if (!obsRes.ok) return null; // Station unreachable → fall back

    const obs = await obsRes.json() as NWSObservationResponse;
    const p   = obs.properties;

    // Temperature is the minimum useful field — if it's missing, the reading is unusable
    if (p.temperature?.value == null) return null;

    // Convert SI units → US customary for display
    const tempF   = cToF(p.temperature.value);
    const windMph = p.windSpeed?.value != null ? kmhToMph(p.windSpeed.value) : 0;
    const windDir = p.windDirection?.value != null ? degreesToCardinal(p.windDirection.value) : '';
    const windStr = windMph > 0 ? `${windMph} mph` : 'Calm';

    // Determine day/night from the icon URL — NWS icons contain "/day/" or "/night/" in the path
    const isDaytime = p.icon?.includes('/day/') ?? true;

    logger.info('Observation fetched', { city: city.id, stationId, tempF, condition: p.textDescription });

    // Return in the standard WeatherPeriod shape used throughout the app
    return {
      name:                     'Current Conditions',
      startTime:                p.timestamp,
      endTime:                  p.timestamp,
      isDaytime,
      temperature:              tempF,
      temperatureUnit:          'F',
      windSpeed:                windStr,
      windDirection:            windDir,
      shortForecast:            p.textDescription || 'N/A',
      detailedForecast:         p.textDescription || '',
      icon:                     p.icon ?? '',
      // Observations don't include a precipitation probability field
      precipitationProbability: null,
    };
  } catch (error) {
    // Any unexpected error (network, malformed JSON, etc.) — log a warning and
    // return null so getCityWeather() can fall back to the forecast period
    logger.warn('Observation unavailable, will fall back to forecast', { city: city.id, error: String(error) });
    return null;
  }
}

// =============================================================================
// STEP 2b: Fetch the upcoming forecast periods
// Used for the "Upcoming" section on the card, and as a fallback for current
// conditions when the observation endpoint is unavailable.
// Unlike the observation fetch, this THROWS on failure — a forecast is required.
// =============================================================================

async function fetchForecastPeriods(forecastUrl: string, city: City): Promise<NWSForecastPeriod[]> {
  logger.info('Fetching forecast', { city: city.id });

  const res = await fetchWithTimeout(forecastUrl);
  if (!res.ok) {
    const msg = `NWS forecast API error: ${res.status} ${res.statusText}`;
    logger.error(msg, { city: city.id });
    throw new Error(msg);
  }

  const data = await res.json() as NWSForecastResponse;
  logger.debug('Forecast received', { city: city.id, periods: data.properties.periods.length });
  return data.properties.periods;
}

/**
 * Converts a raw NWSForecastPeriod (from the API) into the app's WeatherPeriod shape.
 * Forecast periods are already in °F with pre-formatted wind strings,
 * so no unit conversion is needed — just a structural mapping.
 */
function mapForecastPeriod(period: NWSForecastPeriod): WeatherPeriod {
  return {
    name:                     period.name,
    startTime:                period.startTime,
    endTime:                  period.endTime,
    isDaytime:                period.isDaytime,
    temperature:              period.temperature,
    temperatureUnit:          period.temperatureUnit,
    windSpeed:                period.windSpeed,
    windDirection:            period.windDirection,
    shortForecast:            period.shortForecast,
    detailedForecast:         period.detailedForecast,
    icon:                     period.icon,
    // Use the precipitation value if present, otherwise null
    precipitationProbability: period.probabilityOfPrecipitation?.value ?? null,
  };
}

// =============================================================================
// PUBLIC API — the only two functions exported from this file
// =============================================================================

/**
 * Fetches current conditions + upcoming forecast for a single city.
 *
 * FLOW:
 *   1. Resolve the NWS grid point (sequential — we need the URLs it returns)
 *   2. Fetch observation + forecast AT THE SAME TIME (Promise.all = parallel)
 *      → Parallel fetching cuts latency roughly in half vs doing them one by one
 *   3. Use real observation as current conditions, or fall back to forecast[0]
 *   4. Return the combined result
 */
export async function getCityWeather(city: City): Promise<CityWeather> {
  const startTime = Date.now();
  logger.info('Starting weather fetch', { city: city.id });

  try {
    // Step 1: must complete before step 2 — its result gives us the URLs
    const gridProps = await resolveGridPoint(city);

    // Step 2: fetch both sources simultaneously.
    // Promise.all([a, b]) starts BOTH immediately and waits for both to finish.
    // observation is wrapped in try/catch internally, so only a forecast error
    // propagates here and rejects the whole Promise.all.
    const [observation, forecastPeriods] = await Promise.all([
      fetchCurrentObservation(gridProps.observationStations, city),
      fetchForecastPeriods(gridProps.forecast, city),
    ]);

    // The ?? operator: use observation if it's not null, otherwise use forecastPeriods[0]
    const current  = observation ?? mapForecastPeriod(forecastPeriods[0]);

    // Show the next 4 forecast periods in the "Upcoming" section of the weather card
    const upcoming = forecastPeriods.slice(0, 4).map(mapForecastPeriod);

    const result: CityWeather = {
      city:      { id: city.id, name: city.name, state: city.state, lat: city.lat, lon: city.lon },
      current,
      upcoming,
      fetchedAt:  new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };

    logger.info('Weather fetch complete', {
      city: city.id,
      durationMs: result.durationMs,
      usedObservation: observation !== null, // log whether we got live data or fell back
    });
    return result;
  } catch (error) {
    logger.error('Weather fetch failed', { city: city.id, error: String(error) });
    throw error; // Re-throw so getAllCitiesWeather can record this city as failed
  }
}

/**
 * Fetches weather for every city in the list, all at the same time.
 *
 * WHY Promise.allSettled INSTEAD OF Promise.all?
 * Promise.all cancels everything the moment any single city fails.
 * Promise.allSettled always waits for every city and collects both
 * successes and failures. We then filter out the failures and return
 * only the cities that worked — so one bad NWS response never takes
 * down the entire dashboard.
 */
export async function getAllCitiesWeather(cities: City[]): Promise<CityWeather[]> {
  logger.info('Fetching weather for all cities', { count: cities.length });

  // Fire all city fetches simultaneously
  const settled = await Promise.allSettled(cities.map((c) => getCityWeather(c)));

  const results: CityWeather[] = [];
  const failed:  string[]      = [];

  settled.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value);
    } else {
      // This city failed — log it and skip it, but don't crash the others
      failed.push(cities[i].id);
      logger.error('City skipped due to fetch error', {
        city: cities[i].id,
        error: (outcome.reason as Error)?.message,
      });
    }
  });

  logger.info('All-cities fetch complete', {
    successful: results.length,
    failed: failed.length,
    failedCities: failed,
  });
  return results;
}

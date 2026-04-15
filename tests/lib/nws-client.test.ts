/**
 * =============================================================================
 * Unit Tests — src/lib/nws/client.ts
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * This file tests the NWS (National Weather Service) API client — the code
 * responsible for fetching real weather data for each city.
 *
 * WHY DO WE TEST THIS?
 * The client makes real HTTP requests to an external API. If something breaks
 * (wrong URL, bad response shape, network error) we want to catch it here,
 * in isolation, rather than finding out when the app is running in production.
 *
 * HOW DO WE AVOID MAKING REAL NETWORK CALLS DURING TESTS?
 * We use "mocks" — fake versions of `fetch` that instantly return pre-written
 * responses. This means:
 *   - Tests run fast (no actual internet needed)
 *   - Tests are deterministic (same result every time, no flaky network)
 *   - We can simulate failures (503, 500 errors) that are hard to trigger for real
 *
 * THE FOUR API CALLS THE CLIENT MAKES PER CITY:
 *   1. GET /points/{lat},{lon}                    → resolve grid + station URL
 *   2. GET {observationStations}                  → list of nearby stations
 *   3. GET /stations/{id}/observations/latest     → real current conditions
 *   4. GET {forecast}                             → upcoming forecast periods
 *
 * Calls 2, 3, and 4 all start in parallel after call 1 finishes.
 * Because they run concurrently, the order in which they consume mock responses
 * is non-deterministic. We use URL-pattern matching in mockImplementation so
 * each call always gets the right response regardless of order.
 */

import { getCityWeather, getAllCitiesWeather } from '@/lib/nws/client';
import { CITIES } from '@/config/cities';

// =============================================================================
// MOCK SETUP
// =============================================================================

/**
 * WHY: We don't want tests to hit the real internet.
 * WHAT: Replace the browser/Node built-in `fetch` function with a Jest "spy"
 *       that we can program to return whatever we want.
 *
 * `jest.fn()` creates a fake function that records every call made to it,
 * so we can later ask things like "was fetch called 4 times?" or "what URL was used?"
 */
global.fetch = jest.fn();

/**
 * WHY: TypeScript needs to know this is a Jest mock (not the real fetch),
 *      so it unlocks helper methods like `.mockResolvedValueOnce()`.
 * WHAT: Cast `fetch` to Jest's typed mock wrapper — same object, just typed correctly.
 */
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// =============================================================================
// FIXTURE BUILDERS
// "Fixtures" are fake, pre-made data objects that look like real API responses.
// We build them with functions so each test gets a fresh copy it can modify.
// =============================================================================

// These constants mirror the URLs that makePointsBody returns, so URL-matching
// in the mock dispatcher can identify each endpoint.
const STATIONS_URL = 'https://api.weather.gov/gridpoints/MFL/110,40/stations';
const FORECAST_URL = 'https://api.weather.gov/gridpoints/MFL/110,40/forecast';

/**
 * WHY: The NWS `/points` endpoint returns a big JSON object. We only care
 *      about a small part of it — the forecast URL and nearby station list URL.
 * WHAT: Returns a minimal fake `/points` response that the client can parse.
 */
function makePointsBody() {
  return {
    properties: {
      cwa: 'MFL',                      // The NWS office that covers this area (Miami = MFL)
      gridId: 'MFL',
      gridX: 110,                      // X coordinate on the NWS forecast grid
      gridY: 40,                       // Y coordinate on the NWS forecast grid
      forecast: FORECAST_URL,          // URL the client calls next for the forecast
      forecastHourly: `${FORECAST_URL}/hourly`,
      observationStations: STATIONS_URL, // URL the client calls to find the nearest weather station
      relativeLocation: { properties: { city: 'Miami', state: 'FL' } },
    },
  };
}

/**
 * WHY: The NWS station list endpoint returns the nearest weather stations
 *      ordered by distance. The client picks the first one (closest).
 * WHAT: Returns a fake station list with one station entry.
 */
function makeStationsBody(stationId = 'KMIA') {
  return {
    features: [{ properties: { stationIdentifier: stationId, name: 'Miami Intl' } }],
  };
}

/**
 * WHY: The NWS `/stations/{id}/observations/latest` endpoint returns the actual
 *      sensor reading from a physical weather station — temperature in Celsius,
 *      wind speed in km/h, etc. The client converts these to US units for display.
 * WHAT: Returns a minimal fake observation response.
 *
 * Unit notes:
 *   cToF(28) = Math.round(28 × 9/5 + 32) = 82 °F
 *   kmhToMph(16) = Math.round(16 × 0.621371) = 10 mph
 *   degreesToCardinal(135) = dirs[6] = 'SE'
 */
function makeObservationBody(tempC = 28, description = 'Mostly Sunny') {
  return {
    properties: {
      timestamp: '2024-01-15T12:00:00Z',
      textDescription: description,
      icon: 'https://api.weather.gov/icons/land/day/few',
      temperature:        { unitCode: 'wmoUnit:degC',           value: tempC },
      dewpoint:           { unitCode: 'wmoUnit:degC',           value: 20 },
      windDirection:      { unitCode: 'wmoUnit:degree_(angle)', value: 135 }, // SE
      windSpeed:          { unitCode: 'wmoUnit:km_h-1',         value: 16 },  // ~10 mph
      windGust:           { unitCode: 'wmoUnit:km_h-1',         value: null },
      relativeHumidity:   { unitCode: 'wmoUnit:percent',        value: 80 },
      heatIndex:          { unitCode: 'wmoUnit:degC',           value: null },
      windChill:          { unitCode: 'wmoUnit:degC',           value: null },
      visibility:         { unitCode: 'wmoUnit:m',              value: 16000 },
      barometricPressure: { unitCode: 'wmoUnit:Pa',             value: 101325 },
    },
  };
}

/**
 * WHY: The NWS `/forecast` endpoint returns a list of "periods" — each covering
 *      roughly 12 hours (e.g. "Today", "Tonight", "Thursday").
 * WHAT: Returns a minimal fake forecast response with a single period.
 *
 * Parameters let tests control the temperature and condition so we can
 * verify the client maps them correctly into our app's data format.
 */
function makeForecastBody(temperature = 82, shortForecast = 'Mostly Sunny') {
  // A "period" represents one block of time in the forecast (e.g. "Today")
  const period = {
    number: 1,
    name: 'Today',
    startTime: '2024-01-15T06:00:00-05:00',
    endTime:   '2024-01-15T18:00:00-05:00',
    isDaytime: true,
    temperature,                          // In °F — NWS forecast uses US units by default
    temperatureUnit: 'F',
    temperatureTrend: null,               // null means temperature isn't trending up/down
    probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 10 }, // 10% chance of rain
    windSpeed: '10 mph',
    windDirection: 'SE',
    icon: 'https://api.weather.gov/icons/land/day/few',
    shortForecast,                        // e.g. "Mostly Sunny"
    detailedForecast: `${shortForecast} with a high near ${temperature}.`,
  };

  return { properties: { updated: '', units: 'us', generatedAt: '', updateTime: '', periods: [period] } };
}

/**
 * WHY: The real `fetch` API returns a `Response` object with an `ok` flag and
 *      a `.json()` method. Our mock needs to look the same so the client code
 *      doesn't know it's being faked.
 * WHAT: Wraps any JavaScript object in a fake Response where `ok: true` and
 *       `.json()` returns that object asynchronously (as a Promise).
 *
 * Used for: simulating a successful HTTP 200 response.
 */
function makeOkResponse(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as unknown as Response;
}

/**
 * WHY: We need to test what happens when the NWS API is down or broken.
 * WHAT: Returns a fake Response where `ok: false`, with a status code and text.
 *       For example: status=503, statusText='Service Unavailable'
 *
 * Used for: simulating HTTP error responses (4xx, 5xx).
 */
function makeErrorResponse(status: number, statusText: string): Response {
  return { ok: false, status, statusText } as unknown as Response;
}

/**
 * WHY: The client fetches observation and forecast IN PARALLEL after the points
 *      call. The order in which they consume mock responses is non-deterministic.
 *      Order-dependent mockResolvedValueOnce chains break randomly.
 * WHAT: Sets up mockFetch with URL-pattern matching so each fetch call always
 *       gets the correct response regardless of which runs first.
 *
 * URL patterns:
 *   /points/   → points body  (step 1)
 *   /gridpoints/.../stations  → station list body (step 2a)
 *   /stations/.../observations/latest → observation body (step 2b)
 *   /forecast  → forecast body (step 2c)
 */
function setupHappyMock(opts: {
  tempC?:             number;
  description?:       string;
  forecastTempF?:     number;
  forecastCondition?: string;
} = {}) {
  const { tempC = 28, description = 'Mostly Sunny', forecastTempF = 82, forecastCondition = 'Mostly Sunny' } = opts;

  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = input.toString();
    if (url.includes('/points/'))                           return Promise.resolve(makeOkResponse(makePointsBody()));
    if (/\/gridpoints\/.*\/stations/.test(url))            return Promise.resolve(makeOkResponse(makeStationsBody()));
    if (/\/stations\/.*\/observations\/latest/.test(url))  return Promise.resolve(makeOkResponse(makeObservationBody(tempC, description)));
    if (url.includes('/forecast'))                          return Promise.resolve(makeOkResponse(makeForecastBody(forecastTempF, forecastCondition)));
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

// =============================================================================
// TEST SUITE 1: getCityWeather
// Tests the function that fetches weather for a single city.
// =============================================================================

describe('getCityWeather', () => {
  /**
   * WHY: Mock state leaks between tests if not cleaned up. For example, if test A
   *      sets up a mockImplementation, test B would inherit it unless we clear.
   * WHAT: After EACH test, wipe all recorded calls and mock setups.
   */
  afterEach(() => jest.clearAllMocks());

  // Pull Miami out of the cities list — we'll use it as the test subject.
  // The `!` tells TypeScript "trust me, this will be found" (it's always in the list).
  const miami = CITIES.find((c) => c.id === 'miami')!;

  /**
   * THE "HAPPY PATH" TEST
   * WHY: Verify that when everything works, the client correctly reads the API
   *      response and maps the data into the shape our UI expects.
   * WHAT: Set up URL-matched mocks for all 4 endpoints (points → stations →
   *       observation + forecast), call getCityWeather, and check every field.
   *
   * Current conditions come from the OBSERVATION endpoint (real sensor data):
   *   - 28°C → cToF(28) = 82°F
   *   - 16 km/h wind → kmhToMph(16) = 10 mph
   *   - 135° bearing → degreesToCardinal(135) = 'SE'
   *   - precipitationProbability is null (observations don't include this)
   */
  it('returns real current conditions from the observation endpoint', async () => {
    setupHappyMock({ tempC: 28, description: 'Mostly Sunny' });

    const result = await getCityWeather(miami);

    // Verify city identity passes through
    expect(result.city.id).toBe('miami');
    expect(result.city.name).toBe('Miami');

    // Current conditions should come from the observation (real sensor reading)
    expect(result.current.temperature).toBe(82);              // 28°C → 82°F
    expect(result.current.shortForecast).toBe('Mostly Sunny');
    expect(result.current.windSpeed).toBe('10 mph');          // 16 km/h → 10 mph
    expect(result.current.windDirection).toBe('SE');           // 135° → SE
    // Observations don't include precipitation probability — always null
    expect(result.current.precipitationProbability).toBeNull();

    // Verify metadata fields
    expect(result.fetchedAt).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // 4 total calls: points + stations + observation + forecast
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  /**
   * OBSERVATION FALLBACK TEST
   * WHY: The real observation station might be offline. The client should fall
   *      back to the first forecast period for current conditions rather than
   *      showing an error.
   * WHAT: Return an empty station list (no stations found), which causes
   *       fetchCurrentObservation to return null, triggering the fallback.
   */
  it('falls back to the first forecast period when observation is unavailable', async () => {
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/points/'))
        return Promise.resolve(makeOkResponse(makePointsBody()));
      // Empty features array → no nearby station → observation returns null
      if (/\/gridpoints\/.*\/stations/.test(url))
        return Promise.resolve(makeOkResponse({ features: [] }));
      if (url.includes('/forecast'))
        return Promise.resolve(makeOkResponse(makeForecastBody(85, 'Partly Cloudy')));
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const result = await getCityWeather(miami);

    // Falls back to forecast period — forecast data includes precipitation probability
    expect(result.current.temperature).toBe(85);
    expect(result.current.shortForecast).toBe('Partly Cloudy');
    expect(result.current.precipitationProbability).toBe(10); // from the forecast fixture
  });

  /**
   * POINTS API FAILURE TEST
   * WHY: The very first call the client makes is to /points. If that fails
   *      (e.g. NWS is down), we should throw a clear error — not silently return
   *      empty data or crash with an unhelpful message.
   * WHAT: Queue a single 503 error response, then assert the thrown error
   *       message contains "NWS points API error: 503".
   */
  it('throws when the NWS points endpoint returns an error', async () => {
    // Simulate: NWS server is temporarily unavailable
    mockFetch.mockResolvedValueOnce(makeErrorResponse(503, 'Service Unavailable'));

    // `.rejects.toThrow(...)` — assert that the Promise rejects with this message
    await expect(getCityWeather(miami)).rejects.toThrow('NWS points API error: 503');
  });

  /**
   * FORECAST API FAILURE TEST
   * WHY: The /points call and observation might succeed but the /forecast call
   *      could still fail. The forecast is required — the whole city fetch fails.
   * WHAT: All endpoints succeed except the forecast, which returns a 500 error.
   *       We expect the client to throw with a clear "forecast" error message.
   */
  it('throws when the NWS forecast endpoint returns an error', async () => {
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/points/'))                           return Promise.resolve(makeOkResponse(makePointsBody()));
      if (/\/gridpoints\/.*\/stations/.test(url))            return Promise.resolve(makeOkResponse(makeStationsBody()));
      if (/\/stations\/.*\/observations\/latest/.test(url))  return Promise.resolve(makeOkResponse(makeObservationBody()));
      if (url.includes('/forecast'))                          return Promise.resolve(makeErrorResponse(500, 'Internal Server Error'));
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    await expect(getCityWeather(miami)).rejects.toThrow('NWS forecast API error: 500');
  });

  /**
   * NULL PRECIPITATION TEST — FORECAST PERIOD (fallback path)
   * WHY: The NWS API sometimes returns `null` for precipitation probability.
   *      The client must handle this gracefully — storing null rather than crashing.
   * WHAT: Observation is unavailable (empty station list), so we fall back to the
   *       forecast period. The forecast period has null precip → verify null is stored.
   */
  it('maps null precipitation probability correctly when falling back to forecast', async () => {
    // Build a forecast body with null precipitation
    const forecastWithNullPrecip = makeForecastBody();
    forecastWithNullPrecip.properties.periods[0].probabilityOfPrecipitation.value = null as unknown as number;

    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/points/'))
        return Promise.resolve(makeOkResponse(makePointsBody()));
      // No stations → falls back to forecast
      if (/\/gridpoints\/.*\/stations/.test(url))
        return Promise.resolve(makeOkResponse({ features: [] }));
      if (url.includes('/forecast'))
        return Promise.resolve(makeOkResponse(forecastWithNullPrecip));
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const result = await getCityWeather(miami);

    // null in → null out  (not undefined, not 0)
    expect(result.current.precipitationProbability).toBeNull();
  });
});

// =============================================================================
// TEST SUITE 2: getAllCitiesWeather
// Tests the function that fetches weather for ALL cities at once.
// This function runs the single-city fetch in parallel for every city and
// uses Promise.allSettled so one failure doesn't block the others.
// =============================================================================

describe('getAllCitiesWeather', () => {
  /**
   * WHY: Clean up mock state between tests to prevent interference.
   * WHAT: After each test, clear recorded calls and mock setups.
   */
  afterEach(() => jest.clearAllMocks());

  /**
   * ALL CITIES SUCCEED TEST
   * WHY: Verify that the parallel fetch works and all results are returned.
   * WHAT: Use the URL-pattern dispatcher so all cities get the right mocked
   *       responses for all 4 endpoints, then check the result array length.
   *
   * WHY URL DISPATCH INSTEAD OF ORDERED MOCKS FOR getAllCitiesWeather?
   * getAllCitiesWeather fires ALL city fetches simultaneously. Each city makes
   * 4 HTTP calls, and they all interleave unpredictably. URL-based matching
   * ensures every call gets the right response without caring about order.
   */
  it('returns results for all cities when all requests succeed', async () => {
    setupHappyMock();

    const results = await getAllCitiesWeather(CITIES);

    // Every city should have a result — none were dropped
    expect(results).toHaveLength(CITIES.length);
  });

  /**
   * PARTIAL FAILURE TEST
   * WHY: In production, one city's NWS data might be unavailable while the
   *      others are fine. We should still show weather for the working cities
   *      rather than failing the entire page.
   * WHAT: The first Once value is consumed by city[0]'s /points call (fails).
   *       All subsequent calls fall through to the URL-pattern implementation,
   *       which returns success for the remaining cities.
   */
  it('gracefully skips cities that fail and returns the rest', async () => {
    // City[0]'s first fetch (/points) returns an error
    mockFetch.mockResolvedValueOnce(makeErrorResponse(503, 'Unavailable'));

    // All remaining fetches (any URL, any city) use the happy-path dispatcher
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/points/'))                           return Promise.resolve(makeOkResponse(makePointsBody()));
      if (/\/gridpoints\/.*\/stations/.test(url))            return Promise.resolve(makeOkResponse(makeStationsBody()));
      if (/\/stations\/.*\/observations\/latest/.test(url))  return Promise.resolve(makeOkResponse(makeObservationBody()));
      if (url.includes('/forecast'))                          return Promise.resolve(makeOkResponse(makeForecastBody()));
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const results = await getAllCitiesWeather(CITIES);

    // One city failed, so we should get back (total - 1) results
    expect(results).toHaveLength(CITIES.length - 1);
  });

  /**
   * TOTAL FAILURE TEST
   * WHY: Edge case — what if every single city fails? The function should
   *      return an empty array rather than throwing or hanging.
   * WHAT: mockResolvedValue (without Once) returns an error for EVERY call,
   *       so every city's /points request fails immediately.
   */
  it('returns an empty array when every city fails', async () => {
    // Every fetch call returns a 500 error (no Once — applies to all calls)
    mockFetch.mockResolvedValue(makeErrorResponse(500, 'Error'));

    const results = await getAllCitiesWeather(CITIES);

    // Nothing succeeded → empty array (not an error, not undefined)
    expect(results).toHaveLength(0);
  });
});

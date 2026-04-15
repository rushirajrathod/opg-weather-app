/**
 * =============================================================================
 * NWS API Raw Response Types — src/lib/nws/types.ts
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * TypeScript interfaces that describe the exact JSON shape returned by the
 * National Weather Service (NWS) API endpoints we use.
 *
 * WHY KEEP THESE SEPARATE FROM src/types/weather.ts?
 * The NWS API returns data in its own format — temperatures in Celsius,
 * wind speeds in km/h, verbose nested objects, etc. These types mirror that
 * raw format exactly. The client code in nws/client.ts reads these raw types
 * and converts them into the cleaner app types (src/types/weather.ts) that
 * the rest of the app uses.
 *
 * This separation means: if the NWS API changes its format, only THIS file
 * and nws/client.ts need updating. The UI components stay completely untouched.
 *
 * API REFERENCE: https://www.weather.gov/documentation/services-web-api
 *
 * THE FOUR ENDPOINTS WE CALL PER CITY:
 *   1. GET /points/{lat},{lon}                      → NWSPointsResponse
 *   2. GET /gridpoints/{id}/{x},{y}/stations        → NWSStationsResponse
 *   3. GET /stations/{stationId}/observations/latest → NWSObservationResponse
 *   4. GET /gridpoints/{id}/{x},{y}/forecast        → NWSForecastResponse
 */

// =============================================================================
// ENDPOINT 1: GET /points/{lat},{lon}
// Given a latitude and longitude, NWS tells us which forecast office and grid
// square covers that location, plus the URLs to call for the forecast and
// nearby weather stations.
// =============================================================================

export interface NWSPointsResponse {
  properties: NWSPointsProperties;
}

export interface NWSPointsProperties {
  /** NWS weather forecast office code, e.g. "MFL" for Miami */
  cwa: string;
  /** The grid identifier — same as cwa for most offices */
  gridId: string;
  /** X position on the NWS forecast grid for this location */
  gridX: number;
  /** Y position on the NWS forecast grid for this location */
  gridY: number;
  /** Full URL for the 12-hour period forecast — passed to fetchForecastPeriods() */
  forecast: string;
  /** Full URL for the hourly forecast (not used by our app currently) */
  forecastHourly: string;
  /**
   * Full URL to list nearby observation stations ordered by distance.
   * We call this to find the nearest real weather sensor for live readings.
   */
  observationStations: string;
  /** The nearest city/state the NWS maps this grid point to */
  relativeLocation: {
    properties: {
      city: string;
      state: string;
    };
  };
}

// =============================================================================
// ENDPOINT 2: GET /gridpoints/{gridId}/{gridX},{gridY}/forecast
// Returns a list of "periods" — each covering roughly 12 hours.
// e.g. "Today", "Tonight", "Thursday", "Thursday Night", ...
// =============================================================================

export interface NWSForecastResponse {
  properties: {
    updated: string;        // When NWS last updated this forecast
    units: string;          // "us" for US customary units (°F, mph)
    generatedAt: string;
    updateTime: string;
    periods: NWSForecastPeriod[];
  };
}

/** One ~12-hour forecast period returned by the NWS forecast endpoint */
export interface NWSForecastPeriod {
  /** Numeric position in the list — 1 = the earliest / most current */
  number: number;
  /** Human label like "Today", "Tonight", or "Wednesday Night" */
  name: string;
  startTime: string;      // ISO 8601 timestamp
  endTime: string;
  /** true = daytime period; affects the card header gradient colour */
  isDaytime: boolean;
  /** Temperature in °F — NWS uses US units for this endpoint */
  temperature: number;
  temperatureUnit: string; // Always "F" for the US endpoint
  temperatureTrend: string | null; // "rising", "falling", or null
  /** Probability of precipitation as 0–100, or null when NWS doesn't report it */
  probabilityOfPrecipitation: {
    unitCode: string;
    value: number | null;
  };
  /** Already a formatted string like "10 to 15 mph" */
  windSpeed: string;
  /** Cardinal abbreviation like "SW" or "NNE" */
  windDirection: string;
  /** Full URL to the NWS condition icon image */
  icon: string;
  /** One-liner like "Mostly Sunny" or "Chance Showers And Thunderstorms" */
  shortForecast: string;
  /** Full paragraph description of the forecast period */
  detailedForecast: string;
}

// =============================================================================
// ENDPOINT 3: GET /gridpoints/{gridId}/{gridX},{gridY}/stations
// Lists weather observation stations near a grid point, ordered by distance.
// We take features[0] (the nearest one) to get live sensor readings.
// =============================================================================

export interface NWSStationsResponse {
  features: Array<{
    properties: {
      /** Station code like "KMIA" (Miami International Airport) */
      stationIdentifier: string;
      /** Human-readable name of the station */
      name: string;
    };
  }>;
}

// =============================================================================
// ENDPOINT 4: GET /stations/{stationId}/observations/latest
// The most recent sensor reading from a physical weather station.
// This is REAL current conditions — an actual measurement, not a forecast.
//
// IMPORTANT: All numeric values here use SI units:
//   - Temperature: Celsius (°C)  → we convert to °F with cToF()
//   - Wind speed:  km/h          → we convert to mph with kmhToMph()
//   - Direction:   degrees 0–360 → we convert to "N"/"SE"/etc. with degreesToCardinal()
// =============================================================================

/**
 * A single numeric measurement from the observation endpoint.
 * value is null when the sensor didn't report a reading for this field.
 */
export interface NWSObservationValue {
  unitCode: string;     // e.g. "wmoUnit:degC", "wmoUnit:km_h-1"
  value: number | null; // null = sensor didn't report this reading
}

export interface NWSObservationResponse {
  properties: {
    /** When this sensor reading was recorded (ISO 8601) */
    timestamp: string;
    /** Human description like "Mostly Cloudy" — may be an empty string */
    textDescription: string;
    /** URL to the NWS condition icon for the current observation */
    icon: string;
    temperature:         NWSObservationValue; // °C — converted to °F for display
    dewpoint:            NWSObservationValue; // °C — how much moisture is in the air
    windDirection:       NWSObservationValue; // Degrees 0–360 — converted to cardinal (N/S/E/W)
    windSpeed:           NWSObservationValue; // km/h — converted to mph
    windGust:            NWSObservationValue; // km/h peak gust speed
    relativeHumidity:    NWSObservationValue; // Percentage 0–100
    heatIndex:           NWSObservationValue; // °C — how hot it feels due to humidity
    windChill:           NWSObservationValue; // °C — how cold it feels due to wind
    visibility:          NWSObservationValue; // Metres
    barometricPressure:  NWSObservationValue; // Pascals
  };
}

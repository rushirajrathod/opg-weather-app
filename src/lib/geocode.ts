/**
 * =============================================================================
 * Geocoding Utilities — src/lib/geocode.ts
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * Converts city names or coordinate strings into usable lat/lon values
 * that the NWS API understands.
 *
 * WHY DO WE NEED THIS?
 * The NWS API only speaks in geographic coordinates — it has no city-name
 * lookup. When a user types "Denver" in the search bar, we need to translate
 * that into something like { lat: 39.7392, lon: -104.9903 } before we can
 * call the NWS API.
 *
 * TWO PATHS HANDLED:
 *
 *   1. "lat, lon" string  →  parseCoordinates()
 *      Pure local parsing — no network call needed. Validates the range too.
 *      e.g. "39.74,-104.99" or "39.74, -104.99" or "39.74 -104.99"
 *
 *   2. City name string   →  geocodeCity()
 *      Calls the Nominatim API (a free geocoding service from OpenStreetMap)
 *      to look up the city and return its coordinates.
 *      e.g. "Denver" → { lat: 39.7392, lon: -104.9903, name: "Denver", state: "Colorado" }
 *
 * WHY NOMINATIM (OpenStreetMap)?
 * It's completely free with no API key required. The only requirement is that
 * you identify your app in the User-Agent header (done below) and respect a
 * rate limit of one request per second — which is fine for a search-on-submit UX.
 *
 * Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
 */

import logger from '@/lib/logger';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// User-Agent is required by Nominatim's usage policy to identify your application
const USER_AGENT    = '(opg-weather-app, https://github.com/rushi-03/opg-weather-app)';

// =============================================================================
// INTERNAL TYPES (not exported — used only within this file)
// =============================================================================

/** The shape of each result returned by the Nominatim /search endpoint */
interface NominatimResult {
  lat: string;          // Note: Nominatim returns lat/lon as strings, not numbers
  lon: string;
  display_name: string; // Full formatted address
  address?: {           // Structured address fields (present when addressdetails=1)
    city?:    string;   // e.g. "Denver"
    town?:    string;   // For smaller places
    village?: string;   // For very small places
    county?:  string;   // e.g. "Denver County"
    state?:   string;   // e.g. "Colorado"
  };
}

// =============================================================================
// EXPORTED TYPES
// =============================================================================

/** The result we return after successfully geocoding a city name */
export interface GeocodedLocation {
  lat:   number;
  lon:   number;
  /** Best available city name extracted from the Nominatim response */
  name:  string;
  /** US state name, e.g. "Colorado" */
  state: string;
}

// =============================================================================
// COORDINATE PARSER
// Handles user input that looks like "39.74,-104.99" directly, without any
// network call. The search route tries this first before calling geocodeCity().
// =============================================================================

/**
 * Tries to parse a "lat, lon" string into numeric coordinates.
 * Returns null if the input doesn't look like valid coordinates.
 *
 * ACCEPTED FORMATS:
 *   "25.7743,-80.1937"    (comma-separated, no space)
 *   "25.7743, -80.1937"   (comma-separated, with space)
 *   "25.7743 -80.1937"    (space-separated)
 *   Negative values OK for West longitude and South latitude.
 *
 * VALIDATION:
 *   Latitude must be between -90 and 90 (poles)
 *   Longitude must be between -180 and 180 (date line)
 */
export function parseCoordinates(input: string): { lat: number; lon: number } | null {
  // Regex breakdown:
  //   ^            — start of string
  //   (-?\d+...)   — optional minus, digits, optional decimal part (latitude)
  //   \s*[,\s]\s*  — separator: comma or whitespace, with optional surrounding spaces
  //   (-?\d+...)   — same pattern (longitude)
  //   $            — end of string
  const match = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const lat = parseFloat(match[1]);
  const lon = parseFloat(match[2]);

  // Guard against NaN (shouldn't happen after the regex, but be safe)
  if (isNaN(lat) || isNaN(lon)) return null;

  // Validate geographic ranges
  if (lat < -90  || lat > 90)  return null; // Valid latitudes are -90 to 90
  if (lon < -180 || lon > 180) return null; // Valid longitudes are -180 to 180

  return { lat, lon };
}

// =============================================================================
// CITY NAME GEOCODER
// Calls the Nominatim API to convert a city name into coordinates.
// =============================================================================

/**
 * Geocodes a US city name to lat/lon via Nominatim (OpenStreetMap).
 * Returns null when no matching US location is found, rather than throwing.
 * The search route uses this result to build a City object and call the NWS API.
 */
export async function geocodeCity(query: string): Promise<GeocodedLocation | null> {
  // Build the Nominatim request URL with the required query parameters
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q',             query); // The search term (city name)
  url.searchParams.set('format',        'json'); // We want JSON back
  url.searchParams.set('limit',         '1');    // Only the top result
  url.searchParams.set('countrycodes',  'us');   // NWS only covers the US — filter to US results
  url.searchParams.set('addressdetails','1');     // Include structured address fields (city, state, etc.)

  logger.info('Geocoding city', { query });

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent':      USER_AGENT, // Required by Nominatim usage policy
      'Accept-Language': 'en',       // Return names in English
    },
  });

  if (!response.ok) {
    logger.error('Nominatim request failed', { status: response.status });
    return null; // Don't throw — let the search route return a 404 instead
  }

  const results = await response.json() as NominatimResult[];

  if (!results.length) {
    logger.warn('No geocoding results', { query });
    return null; // No match found — the search route will return a friendly 404
  }

  const { lat, lon, address = {} } = results[0];

  // Pick the best available name in priority order:
  // city > town > village > county > fall back to the original query
  const name  = address.city ?? address.town ?? address.village ?? address.county ?? query;
  const state = address.state ?? '';

  logger.info('Geocoding succeeded', { query, lat, lon, name, state });

  // Convert lat/lon from strings (Nominatim format) to numbers
  return { lat: parseFloat(lat), lon: parseFloat(lon), name, state };
}

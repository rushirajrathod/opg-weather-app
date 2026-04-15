/**
 * =============================================================================
 * API Route — GET /api/weather/search
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * A Next.js API route that powers the search bar. It accepts a city name or
 * coordinate string, resolves it to a lat/lon, and returns weather data.
 *
 * ACCEPTED INPUT (?q= parameter):
 *   • City name   — e.g. "Denver" or "Austin, TX"
 *   • Coordinates — e.g. "39.7392,-104.9903"
 *
 * HOW IT DECIDES WHICH PATH TO TAKE:
 *   1. Try to parse the input as "lat,lon" coordinates (no network call)
 *   2. If that fails, geocode the input as a city name via Nominatim (1 HTTP call)
 *   3. Either way, call the NWS API with the resolved coordinates
 *
 * RESPONSE SHAPES:
 *   200  { data: [CityWeather], fetchedAt, citiesCount: 1 }
 *   400  { error, message, statusCode }  — missing ?q= parameter
 *   404  { error, message, statusCode }  — city not found in Nominatim
 *   500  { error, message, statusCode }  — NWS API failure
 *
 * EXAMPLE CALLS:
 *   /api/weather/search?q=Denver
 *   /api/weather/search?q=39.7392,-104.9903
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getCityWeather }                 from '@/lib/nws/client';
import { geocodeCity, parseCoordinates }  from '@/lib/geocode';
import logger                             from '@/lib/logger';
import type { WeatherApiResponse, WeatherApiError } from '@/types/weather';
import type { City }                      from '@/config/cities';

// Always fetch fresh — search results should never be served from a stale cache
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
): Promise<NextResponse<WeatherApiResponse | WeatherApiError>> {
  // Read and trim the ?q= parameter; default to empty string if missing
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  // Require a non-empty search term
  if (!q) {
    return NextResponse.json(
      { error: 'Bad Request', message: 'Provide a ?q= parameter (city name or lat,lon).', statusCode: 400 },
      { status: 400 },
    );
  }

  logger.info('Search request received', { q });

  try {
    // city will hold the resolved location — built differently depending on input type
    let city: City;

    // ── Path A: Input looks like "lat,lon" ────────────────────────────────
    // parseCoordinates() does a local regex check — no network call needed.
    const coords = parseCoordinates(q);

    if (coords) {
      logger.info('Input parsed as coordinates', coords);
      // Build a City object from the raw coordinates.
      // id='search' marks it as a one-off search result (not a configured city).
      // name is formatted as "39.7392, -104.9903" so the card shows something useful.
      city = {
        id:    'search',
        name:  `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`,
        state: '',
        lat:   coords.lat,
        lon:   coords.lon,
      };
    } else {
      // ── Path B: Input is a city name — geocode it via Nominatim ──────────
      const location = await geocodeCity(q);

      if (!location) {
        // Nominatim returned no results — the city name is unrecognised
        return NextResponse.json(
          {
            error:      'Not Found',
            message:    `No US location found for "${q}". Try a more specific name or use lat,lon coordinates.`,
            statusCode: 404,
          },
          { status: 404 },
        );
      }

      // Build a City object using the coordinates and name returned by Nominatim
      city = {
        id:    'search',
        name:  location.name,
        state: location.state,
        lat:   location.lat,
        lon:   location.lon,
      };
    }

    // ── Fetch NWS weather for the resolved location ───────────────────────
    const weatherData = await getCityWeather(city);

    // Wrap in the standard API response shape so the SearchBar component can
    // handle it the same way as the /api/weather response
    return NextResponse.json({
      data:        [weatherData],
      fetchedAt:   new Date().toISOString(),
      citiesCount: 1,
    });
  } catch (error) {
    logger.error('Search request failed', { q, error: String(error) });
    return NextResponse.json(
      {
        error:      'Internal Server Error',
        message:    'Failed to fetch weather data. Please try again.',
        statusCode: 500,
      },
      { status: 500 },
    );
  }
}

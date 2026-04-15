/**
 * =============================================================================
 * API Route — GET /api/weather
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * A Next.js API route — a server-side endpoint that the browser can call.
 * This is the "bridge" between the frontend (WeatherGrid component) and the
 * NWS API. The browser doesn't talk to NWS directly; it asks this route,
 * which then talks to NWS and returns clean JSON.
 *
 * WHY HAVE AN API ROUTE AT ALL?
 * The NWS client uses Winston for logging, which is a Node.js library and
 * can't run in the browser. More generally, keeping external API calls on the
 * server is better practice — it hides credentials (if any), controls rate
 * limiting, and lets us shape the response before sending it to the client.
 *
 * SUPPORTED QUERY PARAMETERS:
 *   ?city=<id>   Return weather for one city only (id from src/config/cities.ts)
 *   (none)       Return weather for ALL configured cities
 *
 * RESPONSE SHAPES:
 *   200  { data: CityWeather[], fetchedAt: string, citiesCount: number }
 *   404  { error, message, statusCode }  — unknown ?city value
 *   500  { error, message, statusCode }  — upstream NWS API failure
 *
 * HOW TO CALL IT:
 *   fetch('/api/weather')            → all cities
 *   fetch('/api/weather?city=miami') → Miami only
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAllCitiesWeather, getCityWeather } from '@/lib/nws/client';
import { CITIES } from '@/config/cities';
import logger from '@/lib/logger';
import type { WeatherApiResponse, WeatherApiError } from '@/types/weather';

/**
 * Opt out of Next.js's static page cache.
 * Without this, Next.js might pre-render this route at build time and serve
 * the same stale response to everyone. Weather data should always be fetched
 * fresh on each request.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse<WeatherApiResponse | WeatherApiError>> {
  const startTime = Date.now();
  const cityId    = request.nextUrl.searchParams.get('city');
  // Generate a short random ID to correlate log entries for this request
  // (helpful when multiple requests come in at the same time)
  const requestId = crypto.randomUUID().slice(0, 8);

  logger.info('API request received', { requestId, endpoint: '/api/weather', cityId: cityId ?? 'all' });

  try {
    let weatherData;

    if (cityId) {
      // ── Single-city mode: look up the city by its id string ──────────────
      const city = CITIES.find((c) => c.id === cityId);

      if (!city) {
        // Unknown city id — return 404 with a helpful message
        logger.warn('Unknown city requested', { requestId, cityId });
        return NextResponse.json(
          {
            error:      'Not Found',
            message:    `City '${cityId}' is not configured. Check /api/weather for all available cities.`,
            statusCode: 404,
          },
          { status: 404 },
        );
      }

      weatherData = [await getCityWeather(city)];
    } else {
      // ── All-cities mode: fetch every configured city in parallel ─────────
      // getAllCitiesWeather uses Promise.allSettled internally, so one failing
      // city doesn't prevent the others from being returned
      weatherData = await getAllCitiesWeather(CITIES);
    }

    const body: WeatherApiResponse = {
      data:        weatherData,
      fetchedAt:   new Date().toISOString(),
      citiesCount: weatherData.length,
    };

    const durationMs = Date.now() - startTime;
    logger.info('API request completed', { requestId, durationMs, citiesCount: weatherData.length });

    return NextResponse.json(body, {
      status: 200,
      headers: {
        // Tell browsers and CDNs they can cache this response for 30 minutes.
        // stale-while-revalidate=300 means: serve the cached copy for up to 5
        // extra minutes while fetching a fresh one in the background.
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('API request failed', { requestId, durationMs, error: String(error) });

    return NextResponse.json(
      {
        error:      'Internal Server Error',
        message:    'Failed to fetch weather data. Please try again later.',
        statusCode: 500,
      },
      { status: 500 },
    );
  }
}

'use client';

/**
 * =============================================================================
 * Weather Grid — src/components/WeatherGrid.tsx
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * The main content area of the dashboard. It fetches weather data from our
 * own API route (/api/weather) and renders a grid of WeatherCard components —
 * one per city.
 *
 * WHY DOES THIS COMPONENT FETCH DATA INSTEAD OF THE PAGE?
 * Next.js allows two kinds of components:
 *
 *   Server Components (default) — run on the server, can't use browser APIs
 *   Client Components ('use client') — run in the browser, can use state/effects
 *
 * The page.tsx file is a Server Component (fast, SEO-friendly). But we need
 * interactive features here: a loading spinner, live refresh, and error state.
 * These require useState and useEffect, which only work in Client Components.
 * So this component handles all the data fetching and interactivity.
 *
 * DATA FLOW:
 *   WeatherGrid (this file) → fetch('/api/weather') → /api/weather/route.ts
 *   → nws/client.ts → NWS API → back up the chain → WeatherCard renders
 *
 * WHY fetch('/api/weather') AND NOT CALLING nws/client.ts DIRECTLY?
 * nws/client.ts runs server-side only (it uses Winston logger which is a
 * Node.js library, not a browser library). The API route acts as a bridge:
 * the browser calls our Next.js API, which then calls the NWS API from
 * the server and returns clean JSON.
 */

import { useEffect, useState } from 'react';
import WeatherCard from '@/components/WeatherCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { CityWeather, WeatherApiResponse } from '@/types/weather';

export default function WeatherGrid() {
  // React state: holds the list of city weather objects returned by the API
  const [cities,      setCities]      = useState<CityWeather[]>([]);
  // true while a fetch is in progress — used to show the spinner and disable the button
  const [loading,     setLoading]     = useState(true);
  // Non-null when the fetch failed — the error message to show to the user
  const [error,       setError]       = useState<string | null>(null);
  // Formatted time string shown as "Updated 12:34:56 PM" after a successful fetch
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  /**
   * Fetches weather data from the /api/weather route and updates state.
   * Called once on mount (via useEffect) and again when the user clicks Refresh.
   *
   * WHY cache: 'no-store'?
   * Without this, the browser caches the response and the Refresh button would
   * show the same data without making a new request. 'no-store' forces a real
   * network call every time so the user always gets the latest data.
   */
  async function fetchWeather() {
    setLoading(true);
    setError(null); // Clear any previous error before trying again

    try {
      const res = await fetch('/api/weather', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Server responded with ${res.status} ${res.statusText}`);

      const json = await res.json() as WeatherApiResponse;
      setCities(json.data); // Store the array of city weather objects
      // Format the fetchedAt timestamp as a local time string (e.g. "12:34:56 PM")
      setLastUpdated(new Date(json.fetchedAt).toLocaleTimeString());
    } catch (err) {
      // Store the error message so we can display it in the red error banner
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      // Always turn off the loading state, whether we succeeded or failed
      setLoading(false);
    }
  }

  // useEffect with [] runs once after the component first renders in the browser.
  // This triggers the initial data load — the page shows a spinner until it completes.
  useEffect(() => { fetchWeather(); }, []);

  return (
    <div>
      {/* ── Toolbar: city count badge + "Updated at" + Refresh button ────── */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Only show the city count once we have data */}
          {!loading && cities.length > 0 && (
            <span className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-300">
              {cities.length} cities
            </span>
          )}
          {/* Show when the data was last fetched */}
          {lastUpdated && (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Updated {lastUpdated}
            </p>
          )}
        </div>

        {/* Refresh button — disabled while a fetch is in progress to prevent double-clicks */}
        <button
          onClick={fetchWeather}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          {/* The refresh icon SVG spins while loading via the animate-spin Tailwind class */}
          <svg
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── Error banner — shown when the API call fails ──────────────────── */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-400">
          <p className="font-semibold">Unable to load weather data</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      {/* ── Loading spinner — shown while the fetch is in progress ─────────── */}
      {loading && <LoadingSpinner />}

      {/* ── City cards grid — shown only when we have data and aren't loading ─ */}
      {!loading && cities.length > 0 && (
        // Responsive grid: 1 column on mobile, 2 on tablet, 3 on desktop
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {cities.map((city) => (
            // key prop must be unique — React uses it to efficiently update the list
            <WeatherCard key={city.city.id} data={city} />
          ))}
        </div>
      )}

      {/* ── Empty state — shown when the fetch succeeds but returns no cities ─ */}
      {!loading && !error && cities.length === 0 && (
        <div className="py-24 text-center">
          <p className="text-xl text-gray-400 dark:text-gray-600">No weather data available.</p>
          <p className="mt-2 text-sm text-gray-400 dark:text-gray-600">The NWS API may be temporarily unavailable.</p>
        </div>
      )}
    </div>
  );
}

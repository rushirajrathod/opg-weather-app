'use client';

/**
 * =============================================================================
 * Search Bar — src/components/SearchBar.tsx
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * The search feature that lets users look up weather for any US city or
 * coordinates, separate from the pre-configured city grid.
 *
 * WHAT IT ACCEPTS:
 *   • City name   — e.g. "Denver" or "Austin, TX"
 *   • Coordinates — e.g. "39.7392,-104.9903"
 *
 * HOW IT WORKS:
 *   1. User types in the input and submits the form
 *   2. This component calls GET /api/weather/search?q=<input>
 *   3. The search route determines if the input is coordinates or a city name,
 *      geocodes it if needed, then calls the NWS API
 *   4. On success, renders a WeatherCard below the search bar
 *   5. On failure, shows a red error message
 *
 * WHY DOES THIS CALL /api/weather/search INSTEAD OF GEOCODING DIRECTLY?
 * Geocoding uses the Nominatim API and the NWS API — both server-side calls.
 * We keep them on the server (in the API route) for security and simplicity.
 * This component only needs to manage the form state and display the result.
 *
 * WHY 'use client'?
 * Uses useState (form state), useRef (focus management), and browser fetch.
 */

import { useRef, useState } from 'react';
import WeatherCard from '@/components/WeatherCard';
import type { CityWeather, WeatherApiError, WeatherApiResponse } from '@/types/weather';

export default function SearchBar() {
  // useRef gives us a direct reference to the <input> DOM element
  // so we can call inputRef.current.focus() after clearing the search
  const inputRef = useRef<HTMLInputElement>(null);

  // The current value of the text input
  const [query,   setQuery]   = useState('');
  // true while the API call is in progress
  const [loading, setLoading] = useState(false);
  // The weather data returned for a successful search
  const [result,  setResult]  = useState<CityWeather | null>(null);
  // Error message to display when the search fails
  const [error,   setError]   = useState<string | null>(null);

  /**
   * Called when the user submits the form (presses Enter or clicks Search).
   * e.preventDefault() stops the browser's default form behaviour (page reload).
   */
  async function handleSearch(e: { preventDefault: () => void }) {
    e.preventDefault(); // Prevent page reload on form submit
    const q = query.trim();
    if (!q) return; // Don't search if the input is empty

    setLoading(true);
    setError(null);  // Clear previous error
    setResult(null); // Clear previous result

    try {
      // encodeURIComponent makes the query safe to put in a URL
      // e.g. "New York" → "New%20York", "39.7,-104.9" stays as-is
      const res  = await fetch(`/api/weather/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      // The API returns either WeatherApiResponse (success) or WeatherApiError (failure)
      const json = await res.json() as WeatherApiResponse | WeatherApiError;

      if (!res.ok) {
        // Cast to error shape and throw so the catch block handles display
        throw new Error((json as WeatherApiError).message);
      }

      // On success, store the first (and only) city in the response
      setResult((json as WeatherApiResponse).data[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
    } finally {
      setLoading(false); // Always turn off loading indicator
    }
  }

  /** Resets the search: clears query, result, and error, then refocuses the input */
  function handleClear() {
    setQuery('');
    setResult(null);
    setError(null);
    // Move focus back to the input field so the user can type immediately
    inputRef.current?.focus(); // The ?. means "only call focus() if inputRef.current exists"
  }

  return (
    <div className="mb-10">
      {/* ── Search form ──────────────────────────────────────────────────── */}
      <form onSubmit={handleSearch} className="flex gap-2">

        {/* Text input with a search icon on the left and a clear button on the right */}
        <div className="relative flex-1">
          {/* Search icon — pointer-events-none means clicks pass through to the input */}
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)} // Keep state in sync with the input
            placeholder="City name or coordinates — e.g. Denver  or  39.7392,-104.9903"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 pl-9 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 shadow-sm outline-none transition-all focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-400/20 dark:focus:ring-blue-500/20"
          />

          {/* Clear (×) button — only shown when the input has text */}
          {query && (
            <button
              type="button" // Prevents this from submitting the form
              onClick={handleClear}
              aria-label="Clear search"
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Submit button — disabled while loading or when the input is empty */}
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-500 dark:bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-600 dark:hover:bg-blue-500 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          {/* Show spinning icon while loading, magnifying glass otherwise */}
          {loading ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* ── Error message — shown when the search returns an error ────────── */}
      {error && (
        <div className="mt-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* ── Result card — shown after a successful search ─────────────────── */}
      {result && (
        <div className="mt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Search result
          </p>
          {/* Constrain width so a single result card doesn't stretch full-width */}
          <div className="max-w-sm">
            <WeatherCard data={result} />
          </div>
        </div>
      )}
    </div>
  );
}

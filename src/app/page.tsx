/**
 * =============================================================================
 * Home Page — src/app/page.tsx
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * The root page of the application — what users see when they visit "/".
 * In Next.js App Router, every page.tsx file defines a route.
 *
 * WHY IS THIS A SERVER COMPONENT (no 'use client')?
 * This file contains only static layout — a header, footer, and static labels.
 * There's no state, no event handlers, and no browser APIs here.
 * Server Components render on the server and send plain HTML to the browser,
 * which is faster and better for SEO than rendering in JavaScript.
 *
 * The interactive parts (search bar, weather grid with refresh button) are
 * handled by the SearchBar and WeatherGrid components, which ARE client
 * components and do their own data fetching inside the browser.
 *
 * PAGE STRUCTURE:
 *   <main>
 *     <header>  — sticky top bar: logo + UnitToggle + ThemeToggle
 *     <section> — SearchBar (search any city) + WeatherGrid (featured cities)
 *     <footer>  — attribution
 *   </main>
 */

import WeatherGrid from '@/components/WeatherGrid';
import ThemeToggle from '@/components/ThemeToggle';
import UnitToggle  from '@/components/UnitToggle';
import SearchBar   from '@/components/SearchBar';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* ── Sticky header ────────────────────────────────────────────────────
          "sticky top-0 z-10" keeps the header visible while the user scrolls.
          "backdrop-blur-sm" makes it slightly frosted-glass over the content below. */}
      <header className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">

            {/* Logo + app name */}
            <div className="flex items-center gap-3">
              {/* aria-hidden hides the decorative emoji from screen readers */}
              <span className="text-3xl select-none" aria-hidden>🌤️</span>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl leading-tight">
                  US Weather Dashboard
                </h1>
                {/* Attribution link — hidden on small screens to save space */}
                <p className="hidden text-xs text-gray-500 dark:text-gray-400 sm:block">
                  Powered by the{' '}
                  <a
                    href="https://www.weather.gov/documentation/services-web-api"
                    target="_blank"
                    rel="noreferrer" // Security best practice for external links that open in a new tab
                    className="underline underline-offset-2 hover:text-blue-500 transition-colors"
                  >
                    National Weather Service API
                  </a>
                </p>
              </div>
            </div>

            {/* Controls: °F/°C toggle + dark mode toggle */}
            <div className="flex items-center gap-2">
              <UnitToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────────
          max-w-7xl centres the content and prevents it from stretching too wide
          on large monitors. The px/sm/lg padding adapts to different screen sizes. */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Search bar — lets users look up any US city or coordinates */}
        <SearchBar />

        {/* Visual divider with a "Featured cities" label */}
        <div className="mb-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Featured cities
          </span>
          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
        </div>

        {/* The grid of weather cards — fetches data and handles loading/error state */}
        <WeatherGrid />
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="mt-12 border-t border-gray-200 dark:border-gray-800 py-6">
        <p className="text-center text-xs text-gray-400 dark:text-gray-600">
          Data provided by the National Weather Service &bull; No API key required
        </p>
      </footer>
    </main>
  );
}

/**
 * =============================================================================
 * Loading Spinner — src/components/LoadingSpinner.tsx
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * A simple, centred loading indicator shown while weather data is being fetched.
 *
 * HOW THE SPINNER ANIMATION WORKS:
 * It's a circle (rounded-full) with a border where only the top portion is
 * coloured blue (border-t-blue-500). The rest of the border is grey.
 * Tailwind's "animate-spin" applies a CSS animation that rotates the element
 * 360° continuously, making the blue arc appear to spin around the circle.
 *
 * This is a Server Component (no 'use client' needed) because it has no state,
 * no event handlers, and no browser-only APIs — it's purely visual markup.
 */

export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      {/* The spinner: a circle with a coloured arc that rotates */}
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 dark:border-t-blue-400" />
      <p className="text-sm text-gray-400 dark:text-gray-500">Fetching live weather data…</p>
    </div>
  );
}

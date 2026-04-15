'use client';

/**
 * =============================================================================
 * Theme Toggle Button — src/components/ThemeToggle.tsx
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * A small circular button in the site header that switches between light and
 * dark mode. Shows a sun icon when in dark mode (click to go light) and a
 * moon icon when in light mode (click to go dark).
 *
 * HOW DOES IT WORK?
 * It reads the current theme from ThemeProvider via the useTheme() hook and
 * calls toggle() when clicked. The actual theme switching logic lives in
 * ThemeProvider — this component is just the UI button.
 *
 * WHY 'use client'?
 * This component uses the useTheme() hook which reads browser state (localStorage).
 * Client-only code must be marked with 'use client' in Next.js.
 */

import { useTheme } from './ThemeProvider';

/** Sun / moon button that toggles between light and dark mode. */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      // aria-label tells screen readers what the button does
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-all duration-200 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
    >
      {isDark ? (
        // Show the SUN icon when we're in dark mode (so the user knows clicking = go light)
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        // Show the MOON icon when we're in light mode (so the user knows clicking = go dark)
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

/**
 * =============================================================================
 * Root Layout — src/app/layout.tsx
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * In Next.js App Router, layout.tsx defines the shell that wraps every page.
 * This root layout runs once and wraps the entire application — it's the
 * equivalent of the <html> and <body> tags in a traditional HTML file.
 *
 * WHAT IT SETS UP:
 *   1. HTML document structure (<html>, <body>)
 *   2. Page metadata (browser tab title, description for search engines)
 *   3. Global font (Inter from Google Fonts)
 *   4. Global CSS (Tailwind base styles via globals.css)
 *   5. ThemeProvider — makes dark/light mode available to all components
 *   6. UnitProvider  — makes °F/°C preference available to all components
 *   7. An inline <script> to prevent a flash of the wrong theme on first load
 *
 * WHY THE INLINE SCRIPT IN <head>?
 * Without it, you'd see a brief "flash of unstyled content" (FOUC):
 *   - The server renders the page in light mode (it doesn't know the user's preference)
 *   - The HTML arrives in the browser
 *   - React hydrates and ThemeProvider reads localStorage → switches to dark mode
 *   - The user sees a white flash before the dark theme appears
 *
 * The inline script runs BEFORE React starts, reads the saved preference from
 * localStorage, and applies the "dark" class to <html> immediately. By the time
 * any CSS or JavaScript runs, the correct class is already in place.
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import { UnitProvider }  from '@/components/UnitProvider';
import './globals.css';

// Load the Inter font from Google Fonts — Next.js downloads it at build time
// and serves it from your own domain (no runtime Google Fonts request, no GDPR concern)
const inter = Inter({ subsets: ['latin'] });

/** Metadata shown in the browser tab and used by search engines / social media */
export const metadata: Metadata = {
  title: 'OPG Weather App',
  description: 'Live US city weather powered by the National Weather Service (NWS) free API',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /**
     * suppressHydrationWarning prevents React from complaining that the server
     * rendered <html class=""> but the client immediately adds "dark" (via the
     * inline script below). This mismatch is expected and intentional.
     */
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
         * THEME FLASH PREVENTION SCRIPT
         *
         * This script runs synchronously before anything else renders.
         * It checks localStorage for a saved theme, falls back to the OS preference,
         * and adds the "dark" class to <html> if needed — all before React starts.
         *
         * The try/catch is important: accessing localStorage can throw in some
         * browser environments (e.g. private mode on older browsers, or if the
         * user has disabled storage). We silently ignore those errors — the user
         * just sees the default light theme.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('theme') ||
                  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                document.documentElement.classList.toggle('dark', t === 'dark');
              } catch {}
            `,
          }}
        />
      </head>
      <body className={`${inter.className} antialiased bg-gray-50 dark:bg-gray-950`}>
        {/*
         * ThemeProvider and UnitProvider are React Context providers.
         * By wrapping {children} here (at the root), EVERY page and component
         * in the app can access theme and unit preferences via useTheme() / useUnit()
         * without needing any props passed down manually.
         */}
        <ThemeProvider>
          <UnitProvider>
            {children}
          </UnitProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

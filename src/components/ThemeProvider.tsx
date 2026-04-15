'use client';

/**
 * =============================================================================
 * Theme Provider — src/components/ThemeProvider.tsx
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * Manages the app's dark/light mode preference and makes it available to
 * every component in the app without passing props down manually.
 *
 * HOW DOES IT WORK? (React Context pattern)
 * React Context is a way to share data across many components without having
 * to pass it as a prop through every level. Think of it like a global variable
 * that's safe to use in React.
 *
 * This file creates a "ThemeContext" that stores the current theme and a
 * toggle function. The ThemeProvider component wraps the entire app (in layout.tsx)
 * and makes these values available to any child component that calls useTheme().
 *
 * HOW THEME SWITCHING WORKS:
 * Tailwind CSS supports dark mode via a CSS class. When the <html> element has
 * the class "dark", all CSS rules prefixed with "dark:" become active.
 * e.g. "bg-white dark:bg-gray-900" → white in light mode, dark grey in dark mode.
 * We toggle that class on/off on the <html> element to switch themes.
 *
 * HOW PREFERENCE IS SAVED:
 * The chosen theme is saved in localStorage (browser storage that persists
 * between page reloads). On first load, we check:
 *   1. Did the user previously choose a theme? (localStorage)
 *   2. If not, what does their OS/browser prefer? (prefers-color-scheme)
 *
 * WHY 'use client'?
 * This component uses localStorage and window — browser-only APIs. Next.js
 * would try to run it on the server too without this directive, which would
 * crash because those APIs don't exist on the server.
 */

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

/** The shape of what ThemeContext provides to any component that calls useTheme() */
interface ThemeContextValue {
  theme: Theme;
  toggle: () => void; // Call this to switch between light and dark
}

// Create the context with sensible defaults (used when a component calls
// useTheme() without being wrapped in a ThemeProvider — shouldn't happen in practice)
const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggle: () => {},
});

/**
 * Custom hook — components call this to read the current theme and toggle it.
 * Usage: const { theme, toggle } = useTheme();
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Wraps its children with the theme context.
 * This must be placed high in the component tree (in layout.tsx) so all
 * child components can access the theme via useTheme().
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // React state: holds the current theme value ('light' or 'dark')
  // useState starts with 'light' as the default before we read localStorage
  const [theme, setTheme] = useState<Theme>('light');

  // useEffect runs after the component first mounts in the browser.
  // We read the saved preference here (not during render) because localStorage
  // is only available in the browser, not on the server.
  useEffect(() => {
    const saved  = localStorage.getItem('theme') as Theme | null;
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    apply(saved ?? system); // Use saved preference, fall back to OS preference
  }, []); // Empty array = run this effect once, on first mount only

  /** Applies a theme: updates React state AND toggles the CSS class on <html> */
  function apply(next: Theme) {
    setTheme(next);
    // Add or remove the 'dark' class on the root <html> element.
    // This is what activates all the Tailwind "dark:" CSS rules.
    document.documentElement.classList.toggle('dark', next === 'dark');
  }

  /** Called when the user clicks the theme toggle button */
  function toggle() {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    apply(next);
    localStorage.setItem('theme', next); // Remember the choice for next visit
  }

  // Provide the theme value and toggle function to all children
  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

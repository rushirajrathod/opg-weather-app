'use client';

/**
 * =============================================================================
 * Unit Provider — src/components/UnitProvider.tsx
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * Manages the temperature unit preference (°F or °C) and makes it available
 * to every component in the app via the useUnit() hook.
 *
 * WHY IS CONVERSION DONE HERE AND NOT IN THE API?
 * The NWS API always returns temperatures in Fahrenheit (°F). We store °F
 * values throughout the backend and only convert at the last moment — right
 * before displaying a number to the user.
 *
 * This approach means:
 *   - The server doesn't need to know or care about the user's preference
 *   - Switching units is instant (no new API call needed)
 *   - The raw °F value is always stored, so switching back is lossless
 *
 * HOW IT WORKS (same React Context pattern as ThemeProvider):
 * UnitProvider wraps the whole app (in layout.tsx). Any component that needs
 * the unit or the convert() function calls useUnit() to get them.
 *
 * PREFERENCE PERSISTENCE:
 * The chosen unit is saved in localStorage so it survives page reloads.
 */

import { createContext, useContext, useEffect, useState } from 'react';

/** The two supported temperature units */
export type TempUnit = 'F' | 'C';

/** The shape of what UnitContext provides to any component that calls useUnit() */
interface UnitContextValue {
  /** The currently selected unit — 'F' or 'C' */
  unit: TempUnit;
  /** Call this to switch between °F and °C */
  toggle: () => void;
  /**
   * Converts a raw NWS temperature (always in °F) to the currently selected unit.
   * If unit is 'F', returns tempF unchanged.
   * If unit is 'C', applies the standard formula: (°F - 32) × 5/9
   */
  convert: (tempF: number) => number;
}

// Create the context. The defaults here are used if useUnit() is called outside
// a UnitProvider — which shouldn't happen since UnitProvider wraps the whole app.
const UnitContext = createContext<UnitContextValue>({
  unit:    'F',
  toggle:  () => {},
  convert: (t) => t, // Default: pass through unchanged (Fahrenheit)
});

/**
 * Custom hook — components call this to get the current unit and convert temperatures.
 * Usage:
 *   const { unit, convert } = useUnit();
 *   <span>{convert(current.temperature)}°{unit}</span>
 */
export function useUnit(): UnitContextValue {
  return useContext(UnitContext);
}

/**
 * Wraps children with the unit context.
 * Must be placed high in the component tree (in layout.tsx) so all
 * temperature-displaying components can access it via useUnit().
 */
export function UnitProvider({ children }: { children: React.ReactNode }) {
  const [unit, setUnit] = useState<TempUnit>('F');

  // On first mount, read the saved preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('unit');
    // Only accept known valid values — ignore corrupted or stale data
    if (saved === 'F' || saved === 'C') setUnit(saved);
  }, []);

  /** Called when the user clicks the UnitToggle button */
  function toggle() {
    const next: TempUnit = unit === 'F' ? 'C' : 'F';
    setUnit(next);
    localStorage.setItem('unit', next); // Persist so it survives page refresh
  }

  /**
   * Converts a Fahrenheit value to the currently selected unit.
   * °F → °F: no-op (return as-is)
   * °F → °C: subtract 32, multiply by 5/9, round to whole number
   */
  function convert(tempF: number): number {
    return unit === 'F' ? tempF : Math.round((tempF - 32) * 5 / 9);
  }

  return (
    <UnitContext.Provider value={{ unit, toggle, convert }}>
      {children}
    </UnitContext.Provider>
  );
}

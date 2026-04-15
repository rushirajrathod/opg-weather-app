'use client';

/**
 * =============================================================================
 * Unit Toggle Button — src/components/UnitToggle.tsx
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * A pill-shaped °F / °C toggle button shown in the site header.
 * The currently active unit is highlighted with a blue background;
 * the inactive unit is greyed out.
 *
 * HOW DOES IT WORK?
 * Reads the current unit from UnitProvider via useUnit() and calls toggle()
 * when clicked. All the state logic lives in UnitProvider — this is just
 * the visual button.
 *
 * WHY 'use client'?
 * Uses the useUnit() hook which reads from browser state (localStorage).
 */

import { useUnit } from './UnitProvider';

/** Pill-style °F / °C toggle button shown in the site header. */
export default function UnitToggle() {
  const { unit, toggle } = useUnit();

  return (
    <button
      onClick={toggle}
      // Tell screen readers what will happen when this button is clicked
      aria-label={`Switch to °${unit === 'F' ? 'C' : 'F'}`}
      className="flex h-9 items-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 text-xs font-bold transition-all hover:border-blue-400 dark:hover:border-blue-500"
    >
      {/* °F pill — blue/active when unit is 'F', grey/inactive otherwise */}
      <span className={`rounded-full px-2.5 py-1 transition-all duration-200 ${
        unit === 'F'
          ? 'bg-blue-500 text-white shadow-sm'                                        // active style
          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300' // inactive style
      }`}>
        °F
      </span>

      {/* °C pill — blue/active when unit is 'C', grey/inactive otherwise */}
      <span className={`rounded-full px-2.5 py-1 transition-all duration-200 ${
        unit === 'C'
          ? 'bg-blue-500 text-white shadow-sm'                                        // active style
          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300' // inactive style
      }`}>
        °C
      </span>
    </button>
  );
}

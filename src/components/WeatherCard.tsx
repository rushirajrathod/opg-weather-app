'use client';

/**
 * =============================================================================
 * Weather Card — src/components/WeatherCard.tsx
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * The main UI component. Renders all weather information for one city as a
 * visually styled card — gradient header, current conditions, and upcoming
 * forecast periods.
 *
 * WHAT IT RECEIVES (Props):
 * A single `data` prop of type CityWeather — the full weather object for one
 * city, as returned by the /api/weather route.
 *
 * HOW IT READS TEMPERATURE UNIT:
 * It calls useUnit() from UnitProvider to get the convert() function. Every
 * temperature value is passed through convert() before display, so switching
 * between °F and °C in the header automatically updates all numbers here too.
 *
 * WHY 'use client'?
 * Uses the useUnit() hook, which reads from browser state (localStorage).
 */

import type { CityWeather } from '@/types/weather';
import { useUnit } from '@/components/UnitProvider';

interface Props {
  data: CityWeather;
}

// =============================================================================
// CONDITION → EMOJI MAPPING
// Maps weather condition text to an emoji for visual display.
// Rules are checked in order — the FIRST match wins.
// More specific conditions (e.g. "blizzard") must come before general ones
// (e.g. "snow") to avoid being shadowed.
// =============================================================================

const CONDITION_EMOJIS: [string, string][] = [
  ['thunderstorm', '⛈️'],
  ['snow',         '🌨️'],
  ['sleet',        '🌨️'],
  ['freezing',     '🌨️'],
  ['blizzard',     '❄️'],
  ['fog',          '🌫️'],
  ['windy',        '💨'],
  ['breezy',       '💨'],
  ['rain',         '🌧️'],
  ['showers',      '🌦️'],
  ['drizzle',      '🌦️'],
  ['overcast',     '☁️'],
  ['cloudy',       '🌥️'],
  ['partly',       '⛅'],
  ['mostly sunny', '🌤️'],
  ['mostly clear', '🌤️'],
  ['sunny',        '☀️'],
  ['clear',        '☀️'],
];

/**
 * Returns the best-matching emoji for a weather condition string.
 * Falls back to a thermometer emoji if no keyword matches.
 */
function getEmoji(shortForecast: string): string {
  const lower = shortForecast.toLowerCase();
  for (const [keyword, emoji] of CONDITION_EMOJIS) {
    if (lower.includes(keyword)) return emoji;
  }
  return '🌡️'; // Generic fallback
}

export default function WeatherCard({ data }: Props) {
  const { city, current, upcoming } = data;

  // Get the temperature converter and current unit label from UnitProvider
  const { unit, convert } = useUnit();

  // Pick the right emoji for the current condition (e.g. "Mostly Sunny" → ☀️)
  const emoji = getEmoji(current.shortForecast);

  // The card header gradient changes based on whether it's day or night.
  // isDaytime comes from the NWS data — it reflects the local time at the city.
  const headerGradient = current.isDaytime
    ? 'bg-gradient-to-br from-blue-500 via-blue-400 to-sky-300'   // bright blue for daytime
    : 'bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-800'; // dark navy for nighttime

  return (
    <article className="flex flex-col rounded-2xl overflow-hidden border border-gray-200/60 dark:border-gray-700/40 bg-white dark:bg-gray-900 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">

      {/* ── Gradient header ────────────────────────────────────────────────── */}
      <header className={`relative overflow-hidden ${headerGradient} p-6 text-white`}>
        {/* Decorative blurred circles — purely visual, ignored by screen readers */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-white/10 blur-xl" />

        {/* City name + state on the left, condition emoji on the right */}
        <div className="relative flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold leading-tight">{city.name}</h2>
            <p className="text-sm font-medium opacity-70">{city.state}</p>
          </div>
          {/* aria-label provides the text description for screen readers */}
          <span className="text-5xl drop-shadow" role="img" aria-label={current.shortForecast}>
            {emoji}
          </span>
        </div>

        {/* Current temperature and condition */}
        <div className="relative mt-5">
          {/* convert() applies °F → °C if the user has selected Celsius */}
          <p className="text-6xl font-thin tabular-nums">
            {convert(current.temperature)}
            <span className="text-3xl align-super opacity-80">°{unit}</span>
          </p>
          {/* e.g. "Mostly Sunny" */}
          <p className="mt-1.5 text-sm font-medium opacity-80">{current.shortForecast}</p>
          {/* e.g. "Current Conditions" or "Today" */}
          <p className="text-xs opacity-50 mt-0.5">{current.name}</p>
        </div>
      </header>

      {/* ── Card body ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-4 p-5">

        {/* Stat pills: wind and precipitation probability */}
        <div className="flex flex-wrap gap-2">
          {/* Wind speed and direction from the observation or forecast */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
            💨 {current.windSpeed} {current.windDirection}
          </span>
          {/* Only show precipitation if the data includes it (observation doesn't; forecasts do) */}
          {current.precipitationProbability !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-300">
              🌧️ {current.precipitationProbability}% precip
            </span>
          )}
        </div>

        {/* Upcoming forecast periods — the next few 12-hour blocks */}
        {upcoming.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Upcoming
            </p>
            <ul className="space-y-2.5">
              {upcoming.map((period, i) => (
                // Each row: period name — dotted line — emoji — temperature
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-24 shrink-0 truncate text-gray-500 dark:text-gray-400">
                    {period.name}
                  </span>
                  {/* Decorative divider line between name and temperature */}
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                  <span className="text-base">{getEmoji(period.shortForecast)}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                    {convert(period.temperature)}°{unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Coordinates — shown at the bottom in a subtle monospace font */}
        <p className="mt-auto pt-3 font-mono text-xs text-gray-300 dark:text-gray-700">
          {city.lat.toFixed(4)}, {city.lon.toFixed(4)}
        </p>
      </div>
    </article>
  );
}

/**
 * =============================================================================
 * Centralised Logger — src/lib/logger.ts
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * A single, shared logger instance used throughout the server-side code.
 * It uses the Winston library, which is the industry standard for Node.js logging.
 *
 * WHY USE A LOGGER INSTEAD OF console.log?
 * console.log just dumps text to the terminal with no structure. A logger gives us:
 *   - Log levels (info, warn, error) so you can filter by severity
 *   - Timestamps on every line so you know exactly when something happened
 *   - Structured metadata (e.g. { city: 'miami', durationMs: 420 }) that
 *     cloud platforms can index and search through
 *   - File output in development so logs survive after the terminal closes
 *
 * HOW IT BEHAVES IN EACH ENVIRONMENT:
 *
 *   Development  →  coloured, human-readable output in the terminal
 *                   + log files written to the /logs directory
 *                   (combined.log = everything, error.log = errors only)
 *
 *   Production   →  one JSON object per line written to stdout (standard output)
 *                   Docker, Azure, AWS CloudWatch, and GCP Logging all capture
 *                   stdout automatically and can parse JSON logs for searching
 *
 * USAGE (anywhere in the server-side code):
 *   import logger from '@/lib/logger';
 *   logger.info('Something happened', { city: 'miami', durationMs: 42 });
 *   logger.warn('Fallback triggered', { reason: 'observation unavailable' });
 *   logger.error('Request failed', { error: err.message });
 */

import fs      from 'fs';
import path    from 'path';
import winston from 'winston';

// Check if we're running in production (set by Next.js when you run `npm run build && npm start`)
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ── Format: structured JSON ────────────────────────────────────────────────────
// Used in production and for log files in development.
// Each log entry becomes one line like:
//   {"level":"info","message":"Weather fetched","city":"miami","timestamp":"2024-01-15 12:00:00"}
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Add a readable timestamp
  winston.format.errors({ stack: true }),   // Include full stack traces for Error objects
  winston.format.json(),                    // Serialize the whole entry as JSON
);

// ── Format: coloured, human-readable ──────────────────────────────────────────
// Used only in development terminal output — much easier to read while coding.
// Each log entry looks like:
//   12:00:00 info: Weather fetched {"city":"miami","durationMs":42}
const prettyFormat = winston.format.combine(
  winston.format.colorize(), // Colour-code the level: green=info, yellow=warn, red=error
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    // Append any extra metadata fields as a compact JSON string (if any exist)
    const extras = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${extras}`;
  }),
);

// ── Build the list of "transports" (output destinations) ──────────────────────
// A "transport" is Winston's term for a destination where log entries are sent.
// We can have multiple transports active at once (e.g. console + file).
const transports: winston.transport[] = [];

if (IS_PRODUCTION) {
  // Production: one JSON transport to stdout only.
  // Stdout is captured by the Docker container / cloud platform.
  transports.push(new winston.transports.Console({ format: jsonFormat }));
} else {
  // Development: write to log files AND pretty-print to the terminal.
  const LOG_DIR = path.join(process.cwd(), 'logs');
  // Create the logs/ directory if it doesn't exist yet (no-op if it already does)
  fs.mkdirSync(LOG_DIR, { recursive: true });

  transports.push(
    // All log levels → logs/combined.log
    new winston.transports.File({ filename: path.join(LOG_DIR, 'combined.log'), format: jsonFormat }),
    // Error level only → logs/error.log (makes it easy to find problems)
    new winston.transports.File({ filename: path.join(LOG_DIR, 'error.log'), format: jsonFormat, level: 'error' }),
    // Also print to the terminal in coloured format
    new winston.transports.Console({ format: prettyFormat }),
  );
}

// ── Create and export the logger instance ─────────────────────────────────────
const logger = winston.createLogger({
  // Minimum level to log. Levels in order: error > warn > info > http > debug
  // LOG_LEVEL env var lets you override without changing code (e.g. LOG_LEVEL=debug for verbose mode)
  level: process.env.LOG_LEVEL ?? 'info',
  transports,
});

export default logger;

/**
 * =============================================================================
 * Next.js Instrumentation Hook — src/instrumentation.ts
 * =============================================================================
 *
 * WHAT IS THIS FILE?
 * Next.js automatically runs the `register()` function in this file once when
 * the server process starts — before handling any incoming requests.
 * It's a safe place to run one-time server startup logic.
 *
 * WHY DOES THIS FILE EXIST?
 * It fixes a specific bug caused by the environment this app is developed in.
 *
 * THE PROBLEM:
 * The VS Code extension (and the Claude Code CLI) launches Node.js with a
 * flag called --localstorage-file. This flag injects a partial `localStorage`
 * object into the Node.js global scope. However, the injected object is broken
 * — it exists but is missing required methods like `getItem()`.
 *
 * Next.js 15's development server calls `localStorage.getItem()` during page
 * rendering. When it hits the broken stub, it throws:
 *   TypeError: localStorage.getItem is not a function
 * ...which causes every page render to return HTTP 500 (Internal Server Error).
 *
 * THE FIX:
 * At startup, we check if `localStorage` is present but broken. If so, we
 * replace it with a safe no-op stub that has all the required methods.
 * This is transparent — no app behaviour changes, we're just making the stub
 * functional so Next.js doesn't crash.
 */

export async function register() {
  // localStorage only exists in the browser — if we're in a browser context
  // (e.g. during client-side rendering), skip this patch entirely.
  if (typeof window !== 'undefined') return;

  // Cast globalThis so TypeScript lets us read and write arbitrary properties
  const g = globalThis as unknown as Record<string, unknown>;

  // Only patch if localStorage is defined but its getItem method is not a function
  // (i.e. it's the broken stub injected by the VS Code extension)
  if (g.localStorage !== undefined && typeof (g.localStorage as Storage).getItem !== 'function') {
    // Replace with a fully functional no-op stub.
    // All methods exist but do nothing (or return null), which is what
    // server-side code expects — there's no real browser storage on the server.
    g.localStorage = {
      getItem:    () => null,   // Always returns null (no stored value)
      setItem:    () => {},     // Accepts a write but discards it
      removeItem: () => {},     // Accepts a delete but does nothing
      clear:      () => {},     // Accepts a clear but does nothing
      length:     0,            // No items stored
      key:        () => null,   // No keys to return
    } satisfies Storage;
  }
}

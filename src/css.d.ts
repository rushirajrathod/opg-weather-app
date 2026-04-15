/**
 * CSS module type declaration.
 *
 * TypeScript doesn't natively understand CSS imports — it only handles .ts/.tsx files.
 * This declaration tells TypeScript: "any file ending in .css is a valid import,
 * treat it as an empty module (side-effect only)."
 *
 * This fixes the IDE error on `import './globals.css'` in layout.tsx.
 * The actual CSS processing is handled by Next.js/webpack at build time.
 */
declare module '*.css';

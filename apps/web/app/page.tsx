// This file is intentionally minimal — the actual dashboard lives in
// app/(dashboard)/page.tsx. Having this file causes a duplicate route
// conflict. Keeping it here only to prevent a 404; the (dashboard) group
// should take precedence. Remove this file if Next.js supports it cleanly.
export { default } from "./(dashboard)/page";

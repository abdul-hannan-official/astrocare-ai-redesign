import { createApiApp } from '../server/app.ts';

/**
 * Vercel serverless entry point for the ASTROCARE AI Express API.
 *
 * Vercel cannot run the long-lived server in server.ts, so this file exposes
 * the same Express app (createApiApp) as a serverless function. vercel.json
 * rewrites every /api/* request to this function. On each cold start the
 * function creates and seeds a fresh SQLite database at DATABASE_PATH
 * (/tmp/astrocare.db on Vercel), so demo data is always present and writes
 * live only as long as that function instance lives. GEMINI_API_KEY is not
 * set on Vercel, so the assistant uses its deterministic reading-grounded
 * engine, exactly as on AI Studio without a key.
 */
const app = createApiApp();

export default app;

/**
 * Central environment flag resolution.
 *
 * DEMO_MODE is blocked in production environments to prevent accidental
 * exposure of the entire database behind no authentication (#3).
 */
const IS_PRODUCTION =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

export const DEMO_MODE = process.env.DEMO_MODE === "true" && !IS_PRODUCTION;

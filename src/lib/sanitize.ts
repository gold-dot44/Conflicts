/**
 * Input sanitization for user-provided text that gets stored in the database.
 * Prevents XSS via stored payloads and limits data size (#5).
 */

/** Sanitize a text input: trim, limit length, strip HTML-unsafe characters */
export function sanitizeText(input: string | undefined | null, maxLength = 500): string {
  if (!input) return "";
  return input.trim().slice(0, maxLength).replace(/[<>]/g, "");
}

/** Sanitize a rationale or notes field (longer limit) */
export function sanitizeRationale(input: string | undefined | null): string {
  return sanitizeText(input, 2000);
}

/** Validate that a string is a valid UUID */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

// lib/storage/json.ts

/**
 * Safely parse a JSON string read from storage (localStorage, Capacitor
 * Preferences, etc.).
 *
 * Returns the parsed value, or `null` when the input is missing/empty
 * (`null` / `undefined` / `""`) or when `JSON.parse` throws. Never throws.
 *
 * The result is asserted as `T` for caller convenience; this is an unchecked
 * cast, so callers that need structural guarantees (array-ness, shape) should
 * still validate the returned value.
 */
export function safeParse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

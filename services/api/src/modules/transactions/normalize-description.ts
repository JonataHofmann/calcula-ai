/**
 * Canonical form of a transaction description for suggestion lookups and dedup:
 * trims, lowercases and collapses internal whitespace runs to a single space.
 */
export function normalizeDescription(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, ' ');
}

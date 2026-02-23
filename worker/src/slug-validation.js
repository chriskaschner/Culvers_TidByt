/**
 * Slug validation helpers shared across worker modules.
 */

// Reject slugs with invalid characters before checking allowlist (defense-in-depth)
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{1,59}$/;

/**
 * Validate a slug against the regex pattern and the allowlist.
 * @param {string} slug
 * @param {Set<string>} validSlugs
 * @returns {{ valid: boolean, reason?: string }}
 */
export function isValidSlug(slug, validSlugs) {
  if (!slug) {
    return { valid: false, reason: 'Slug is empty' };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return { valid: false, reason: 'Slug contains invalid characters' };
  }
  if (!validSlugs.has(slug)) {
    return { valid: false, reason: 'Unknown store slug' };
  }
  return { valid: true };
}

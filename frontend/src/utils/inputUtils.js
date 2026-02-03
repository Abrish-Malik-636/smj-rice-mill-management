/**
 * Input sanitization and validation utilities for Master Data forms.
 * - Title case for name fields (First Letter Of Each Word)
 * - Block special characters
 * - No numbers in name fields
 */

// Allowed: letters and spaces only (for names)
export const SANITIZE_NAME = /[^a-zA-Z\s]/g;

// Allowed: letters, numbers, spaces (for description, address - no special chars)
export const SANITIZE_TEXT = /[^a-zA-Z0-9\s.,\-]/g;

// Convert to Title Case (First Letter Of Each Word Capitalized)
export function toTitleCase(str) {
  if (!str || typeof str !== "string") return str;
  return str
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Sanitize name field: letters and spaces only, no numbers
export function sanitizeName(value) {
  if (!value) return "";
  return String(value).replace(/[0-9]/g, "").replace(/[^a-zA-Z\s]/g, "");
}

// Sanitize text field: letters, numbers, spaces, basic punctuation (comma, period, hyphen)
export function sanitizeText(value) {
  if (!value) return "";
  return String(value).replace(/[^a-zA-Z0-9\s.,\-]/g, "");
}

// Check if string contains special characters (excluding allowed: letters, numbers, space, . , -)
export function hasSpecialChars(value, allowNumbers = false) {
  if (!value) return false;
  const pattern = allowNumbers ? /[^a-zA-Z0-9\s.,\-]/ : /[^a-zA-Z\s]/;
  return pattern.test(value);
}

// Check if string contains numbers
export function hasNumbers(value) {
  return value && /\d/.test(value);
}

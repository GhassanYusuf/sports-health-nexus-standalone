/**
 * Phone number utilities for formatting and validation
 */

/**
 * Formats phone number for database lookup by removing spaces, dashes, and parentheses
 */
export const formatPhoneForLookup = (phone: string): string => {
  return phone.replace(/[\s\-\(\)]/g, '');
};

/**
 * Checks if a string looks like a phone number
 */
export const isPhoneNumber = (identifier: string): boolean => {
  return /^\+?[\d\s\-\(\)]+$/.test(identifier);
};

/**
 * Formats phone number for display (e.g., "33791210" -> "+973 3379 1210")
 */
export const formatPhoneDisplay = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 8) {
    return `+973 ${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
  }
  return phone;
};

/**
 * Currency Utilities
 * Provides dynamic currency formatting based on club settings
 */

export interface CurrencyFormatOptions {
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  showSymbol?: boolean;
}

/**
 * Format a number as currency using the club's configured currency
 */
export function formatCurrency(
  amount: number,
  options: CurrencyFormatOptions = {}
): string {
  const {
    currency = 'USD',
    minimumFractionDigits,
    maximumFractionDigits,
    showSymbol = true,
  } = options;

  const hasDecimals = amount % 1 !== 0;
  const minDigits = minimumFractionDigits ?? (hasDecimals ? 2 : 0);
  const maxDigits = maximumFractionDigits ?? (hasDecimals ? 2 : 0);

  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: showSymbol ? 'currency' : 'decimal',
      currency: currency,
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    }).format(amount);

    return formatted;
  } catch (error) {
    // Fallback if currency code is invalid
    console.error('Invalid currency code:', currency, error);
    return `${amount.toFixed(maxDigits)}`;
  }
}

/**
 * Get currency symbol for a given currency code
 */
export function getCurrencySymbol(currencyCode: string = 'USD'): string {
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);

    // Extract symbol from formatted string
    return formatted.replace(/[\d,.\s]/g, '');
  } catch (error) {
    console.error('Error getting currency symbol:', error);
    return currencyCode;
  }
}

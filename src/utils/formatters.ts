/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Dynamic price formatter with full decimal precision retention.
 * Prevents truncation, rounding errors, and baştaki sıfırların kaybolması.
 * 
 * Example inputs and outputs:
 * 0.657 -> $0.657
 * 0.04578 -> $0.04578
 * 0.00001234 -> $0.00001234
 * 50000 -> $50,000.00
 * 1.04578 -> $1.04578
 */
export function formatUSD(val: number): string {
  if (val === undefined || val === null || isNaN(val)) return '$0.00';
  if (val === 0) return '$0.00';

  const str = val.toString();
  const parts = str.split('.');

  let decimals = 2;
  if (parts.length > 1) {
    const decimalPart = parts[1];
    let leadingZeros = 0;
    for (let i = 0; i < decimalPart.length; i++) {
      if (decimalPart[i] === '0') {
        leadingZeros++;
      } else {
        break;
      }
    }
    // Preserve up to 10 decimal digits, with at least leadingZeros + 5 significant digits (which matches the original string length)
    decimals = Math.max(2, Math.min(10, Math.max(decimalPart.length, leadingZeros + 5)));
  }

  // Format with the determined decimal count
  let formatted = val.toFixed(decimals);

  // Strip trailing zeros after the decimal point, but keep at least 2 decimals
  if (formatted.includes('.')) {
    formatted = formatted.replace(/0+$/, '');
    if (formatted.endsWith('.')) {
      formatted += '00';
    } else {
      const decPart = formatted.split('.')[1];
      if (decPart.length === 1) {
        formatted += '0';
      }
    }
  }

  // Add commas to the integer part for highly readable formatting
  const formattedParts = formatted.split('.');
  const integerPart = formattedParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimalPart = formattedParts[1];

  return '$' + integerPart + '.' + decimalPart;
}

/**
 * Format price without the currency symbol ($) e.g., for technical chart vertical axis.
 */
export function formatPriceOnly(val: number): string {
  const withSymbol = formatUSD(val);
  return withSymbol.replace(/^\$/, '');
}

/**
 * Large volume formatter using standard financial prefixes (M for million, B for billion).
 */
export function formatVolume(val: number): string {
  if (val === undefined || val === null || isNaN(val)) return '$0.00';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return formatUSD(val);
}

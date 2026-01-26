/**
 * Converts Human Readable Decimal (e.g., "1.5") to BigInt (scaled by 18 decimals)
 * Useful for creating the initial initial Hex values.
 */
export function fromDecimalString(
  amount: string,
  decimals: number = 18,
): string {
  // Split into integer and fraction parts
  const [integerPart, fractionPart = ''] = amount.split('.');

  // Pad fraction with zeros to match decimal length
  const paddedFraction = fractionPart.padEnd(decimals, '0').slice(0, decimals);

  // Combine and convert
  const rawValue = BigInt(`${integerPart}${paddedFraction}`);
  return toHex(rawValue);
}

/**
 * Adds two hex strings.
 * Returns result as a hex string.
 */
export function addHexBalances(hexA: string, hexB: string): string {
  const a = toBigInt(hexA);
  const b = toBigInt(hexB);
  const result = a + b;
  return toHex(result);
}

/**
 * Safely converts hex string to BigInt
 */
export function toBigInt(hex: string): bigint {
  if (!hex) return 0n;
  // Handle negative hex strings (e.g. -0x1a)
  if (hex.startsWith('-0x')) {
    return -BigInt(hex.slice(1));
  }
  // Ensure 0x prefix is present for BigInt parsing
  const normalized = hex.startsWith('0x') ? hex : '0x' + hex;
  return BigInt(normalized);
}

/**
 * Converts BigInt back to Hex String
 */
export function toHex(val: bigint): string {
  const hex = val.toString(16);
  return val < 0n ? `-0x${hex.substring(1)}` : `0x${hex}`;
}

/**
 * Subtracts hexB from hexA (A - B).
 * Returns result as a hex string.
 */
export function subHexBalances(hexA: string, hexB: string): string {
  const a = toBigInt(hexA);
  const b = toBigInt(hexB);
  const result = a - b;
  return toHex(result);
}

/**
 * Checks if the hex string represents zero.
 */
export function isZero(hex: string): boolean {
  return toBigInt(hex) === 0n;
}

/**
 * Checks if the hex string represents a negative number.
 */
export function isNegative(hex: string): boolean {
  return toBigInt(hex) < 0n;
}

/**
 * Normalizes a hex string balance from its native decimals to 18 decimals.
 * If current decimals < 18, it scales up.
 * If current decimals > 18, it scales down (with precision loss).
 */
export function normalizeTo18Decimals(hex: string, decimals: number): string {
  if (decimals === 18) {
    return hex;
  }

  const value = toBigInt(hex);

  if (decimals < 18) {
    const scaleFactor = 10n ** BigInt(18 - decimals);
    return toHex(value * scaleFactor);
  } else {
    // decimals > 18
    const scaleFactor = 10n ** BigInt(decimals - 18);
    return toHex(value / scaleFactor);
  }
}

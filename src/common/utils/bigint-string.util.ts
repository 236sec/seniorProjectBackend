/**
 * Parse hex or decimal string to BigInt
 */
function parseToBigInt(value: string): bigint {
  if (value.startsWith('0x')) {
    return BigInt(value);
  }
  return BigInt(value);
}

/**
 * Convert hex balance (e.g., "0x00...15") to human-readable decimal using decimals
 */
export function formatTokenBalance(
  rawBalance: string,
  decimals: number,
): string {
  if (!rawBalance || rawBalance === '0' || rawBalance === '0x0') return '0';

  const balance = parseToBigInt(rawBalance);
  const divisor = BigInt(10 ** decimals);
  const integerPart = balance / divisor;
  const remainder = balance % divisor;

  if (remainder === BigInt(0)) {
    return integerPart.toString();
  }

  const fractionalPart = remainder.toString().padStart(decimals, '0');
  // Remove trailing zeros from fractional part
  const trimmed = fractionalPart.replace(/0+$/, '');
  if (trimmed === '') {
    return integerPart.toString();
  }
  return `${integerPart}.${trimmed}`;
}

/**
 * Convert human-readable decimal back to hex string with padding
 * e.g., "3.5" with decimals=18 -> "0x00000000000000000000000000000000000000000000000030927f74c9de0000"
 */
export function toHexBalance(decimalValue: string, decimals: number): string {
  const parts = decimalValue.split('.');
  const integerPart = BigInt(parts[0] || '0');
  const fractionalPart = parts[1] || '';

  // Pad or truncate fractional part to match decimals
  const paddedFraction = fractionalPart
    .padEnd(decimals, '0')
    .slice(0, decimals);
  const fractionValue = BigInt(paddedFraction || '0');

  const multiplier = BigInt(10 ** decimals);
  const totalValue = integerPart * multiplier + fractionValue;

  // Convert to hex and pad to 64 characters (32 bytes)
  const hex = totalValue.toString(16);
  return '0x' + hex.padStart(64, '0');
}

/**
 * Add two balances in hex format, perform arithmetic in decimal, return hex
 */
export function addHexBalances(
  a: string,
  b: string,
  decimals: number = 18,
): string {
  const aDecimal = formatTokenBalance(a, decimals);
  const bDecimal = formatTokenBalance(b, decimals);

  // Parse decimal strings and add
  const [aInt, aFrac = '0'] = aDecimal.split('.');
  const [bInt, bFrac = '0'] = bDecimal.split('.');

  const maxFracLen = Math.max(aFrac.length, bFrac.length);
  const aPadded = aFrac.padEnd(maxFracLen, '0');
  const bPadded = bFrac.padEnd(maxFracLen, '0');

  const aValue = BigInt(aInt) * BigInt(10 ** maxFracLen) + BigInt(aPadded);
  const bValue = BigInt(bInt) * BigInt(10 ** maxFracLen) + BigInt(bPadded);
  const sum = aValue + bValue;

  const sumInt = sum / BigInt(10 ** maxFracLen);
  const sumFrac = sum % BigInt(10 ** maxFracLen);
  const decimalResult =
    sumFrac === BigInt(0)
      ? sumInt.toString()
      : `${sumInt}.${sumFrac.toString().padStart(maxFracLen, '0')}`;

  return toHexBalance(decimalResult, decimals);
}

/**
 * Subtract two balances in hex format, perform arithmetic in decimal, return hex
 */
export function subHexBalances(
  a: string,
  b: string,
  decimals: number = 18,
): string {
  const aDecimal = formatTokenBalance(a, decimals);
  const bDecimal = formatTokenBalance(b, decimals);

  // Parse decimal strings and subtract
  const [aInt, aFrac = '0'] = aDecimal.split('.');
  const [bInt, bFrac = '0'] = bDecimal.split('.');

  const maxFracLen = Math.max(aFrac.length, bFrac.length);
  const aPadded = aFrac.padEnd(maxFracLen, '0');
  const bPadded = bFrac.padEnd(maxFracLen, '0');

  const aValue = BigInt(aInt) * BigInt(10 ** maxFracLen) + BigInt(aPadded);
  const bValue = BigInt(bInt) * BigInt(10 ** maxFracLen) + BigInt(bPadded);
  const diff = aValue - bValue;

  const diffInt = diff / BigInt(10 ** maxFracLen);
  const diffFrac = diff % BigInt(10 ** maxFracLen);
  const decimalResult =
    diffFrac === BigInt(0)
      ? diffInt.toString()
      : `${diffInt}.${diffFrac.toString().padStart(maxFracLen, '0')}`;

  return toHexBalance(decimalResult, decimals);
}

/**
 * Check if hex balance is zero or negative
 */
export function isZeroOrNegative(hexBalance: string): boolean {
  if (!hexBalance || hexBalance === '0' || hexBalance === '0x0') return true;

  // Check if it's a negative value (starts with 0xf... for two's complement negative)
  if (hexBalance.startsWith('0x')) {
    const firstNonZeroChar = hexBalance.slice(2).replace(/^0+/, '')[0];
    if (firstNonZeroChar && parseInt(firstNonZeroChar, 16) >= 8) {
      // Likely negative (high bit set in first significant nibble)
      return true;
    }
  }

  try {
    const value = BigInt(hexBalance);
    return value <= BigInt(0);
  } catch {
    return true;
  }
}

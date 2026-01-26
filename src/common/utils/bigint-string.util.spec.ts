import {
  addHexBalances,
  fromDecimalString,
  isNegative,
  isZero,
  normalizeTo18Decimals,
  subHexBalances,
  toBigInt,
  toHex,
} from './bigint-string.util';

describe('BigInt String Utils', () => {
  describe('fromDecimalString', () => {
    it('should convert whole numbers correctly with default 18 decimals', () => {
      // 1 ETH = 10^18 wei
      // 1 in decimal -> 1 * 10^18
      const result = fromDecimalString('1');
      // 10^18 in hex is 0xde0b6b3a7640000
      expect(result).toBe('0xde0b6b3a7640000');
    });

    it('should convert fractional numbers correctly', () => {
      // 1.5 ETH = 15 * 10^17 wei
      const result = fromDecimalString('1.5');
      // 1.5 * 10^18 = 1500000000000000000
      expect(toBigInt(result)).toBe(1500000000000000000n);
    });

    it('should handle custom decimals', () => {
      // 100 USDC (6 decimals) -> 100 * 10^6 = 100,000,000
      const result = fromDecimalString('100', 6);
      expect(toBigInt(result)).toBe(100000000n);
    });

    it('should truncate extra decimals if they exceed precision', () => {
      // 1.12345 with 4 decimals -> 1.1234 * 10^4 = 11234
      const result = fromDecimalString('1.12345', 4);
      expect(toBigInt(result)).toBe(11234n);
    });

    it('should handle missing integer part if just fraction (e.g. .5)', () => {
      const result = fromDecimalString('.5');
      expect(toBigInt(result)).toBe(500000000000000000n);
    });
  });

  describe('toBigInt', () => {
    it('should convert hex string to BigInt', () => {
      expect(toBigInt('0x10')).toBe(16n);
      expect(toBigInt('0xff')).toBe(255n);
    });

    it('should handle hex string without 0x prefix', () => {
      expect(toBigInt('10')).toBe(16n);
      expect(toBigInt('ff')).toBe(255n);
    });

    it('should handle negative hex strings', () => {
      expect(toBigInt('-0x10')).toBe(-16n);
    });

    it('should return 0n for empty or null inputs', () => {
      expect(toBigInt('')).toBe(0n);
      expect(toBigInt(null as any)).toBe(0n);
      expect(toBigInt(undefined as any)).toBe(0n);
    });
  });

  describe('toHex', () => {
    it('should convert BigInt to hex string', () => {
      expect(toHex(16n)).toBe('0x10');
      expect(toHex(255n)).toBe('0xff');
    });

    it('should handle negative BigInt', () => {
      expect(toHex(-16n)).toBe('-0x10');
    });

    it('should handle zero', () => {
      expect(toHex(0n)).toBe('0x0');
    });
  });

  describe('addHexBalances', () => {
    it('should add two hex values correctly', () => {
      const a = toHex(100n);
      const b = toHex(50n);
      const result = addHexBalances(a, b);
      expect(toBigInt(result)).toBe(150n);
    });

    it('should handle negative values addition', () => {
      const a = toHex(100n);
      const b = toHex(-50n);
      const result = addHexBalances(a, b);
      expect(toBigInt(result)).toBe(50n);
    });
  });

  describe('subHexBalances', () => {
    it('should subtract two hex values correctly', () => {
      const a = toHex(100n);
      const b = toHex(40n);
      const result = subHexBalances(a, b);
      expect(toBigInt(result)).toBe(60n);
    });

    it('should result in negative if subtraction goes below zero', () => {
      const a = toHex(50n);
      const b = toHex(100n);
      const result = subHexBalances(a, b);
      expect(toBigInt(result)).toBe(-50n);
      expect(isNegative(result)).toBe(true);
    });
  });

  describe('isZero', () => {
    it('should return true for zero values', () => {
      expect(isZero('0x0')).toBe(true);
      expect(isZero('0x000')).toBe(true);
      expect(isZero('0')).toBe(true);
      expect(isZero('')).toBe(true);
    });

    it('should return false for non-zero values', () => {
      expect(isZero('0x1')).toBe(false);
      expect(isZero('-0x1')).toBe(false);
    });
  });

  describe('isNegative', () => {
    it('should return true for negative values', () => {
      expect(isNegative('-0x1')).toBe(true);
      expect(isNegative('-0xff')).toBe(true);
    });

    it('should return false for positive or zero values', () => {
      expect(isNegative('0x1')).toBe(false);
      expect(isNegative('0x0')).toBe(false);
    });
  });

  describe('normalizeTo18Decimals', () => {
    it('should scale up if decimals < 18', () => {
      // 1 USDC (6 decimals) = 1,000,000
      // Scaled to 18 decimals => 1 * 10^18
      const val = toHex(1000000n); // 10^6
      const result = normalizeTo18Decimals(val, 6);
      expect(toBigInt(result)).toBe(1000000000000000000n); // 10^18
    });

    it('should scale down if decimals > 18', () => {
      // Token with 20 decimals. Value 10^20 (which is "1.0")
      // Scaled to 18 decimals => 10^18
      const val = toHex(100000000000000000000n); // 10^20
      const result = normalizeTo18Decimals(val, 20);
      expect(toBigInt(result)).toBe(1000000000000000000n); // 10^18
    });

    it('should return same value if decimals === 18', () => {
      const val = toHex(123456789n);
      const result = normalizeTo18Decimals(val, 18);
      expect(result).toBe(val);
    });
  });
});

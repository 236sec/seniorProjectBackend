import {
  addHexBalances,
  formatTokenBalance,
  subHexBalances,
  toHexBalance,
} from './bigint-string.util';

describe('bigint-string utils - Hex Balance Operations', () => {
  describe('formatTokenBalance', () => {
    it('should format hex balance to human-readable decimal', () => {
      // 0x0de0b6b3a7640000 = 1000000000000000000 wei = 1 ETH
      expect(formatTokenBalance('0x0de0b6b3a7640000', 18)).toBe('1');
    });

    it('should handle zero balance', () => {
      expect(formatTokenBalance('0x0', 18)).toBe('0');
      expect(formatTokenBalance('0', 18)).toBe('0');
    });

    it('should format fractional amounts correctly', () => {
      // 0x016345785d8a0000 = 100000000000000000 wei = 0.1 ETH
      expect(formatTokenBalance('0x016345785d8a0000', 18)).toBe('0.1');
    });

    it('should handle large hex values', () => {
      // Example: 0xc62a36cfe0d515 = 55778460292928789 wei
      const result = formatTokenBalance('0x00c62a36cfe0d515', 18);
      expect(result).toBe('0.055778460292928789');
    });

    it('should handle decimal string input', () => {
      expect(formatTokenBalance('1000000000000000000', 18)).toBe('1');
    });
  });

  describe('toHexBalance', () => {
    it('should convert decimal to padded hex', () => {
      const hex = toHexBalance('1', 18);
      expect(hex).toBe(
        '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000',
      );
    });

    it('should handle fractional values', () => {
      const hex = toHexBalance('0.1', 18);
      expect(hex).toBe(
        '0x000000000000000000000000000000000000000000000000016345785d8a0000',
      );
    });

    it('should handle zero', () => {
      const hex = toHexBalance('0', 18);
      expect(hex).toBe(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      );
    });

    it('should pad hex to 64 characters', () => {
      const hex = toHexBalance('3.5', 18);
      expect(hex.length).toBe(66); // '0x' + 64 hex chars
      expect(hex.startsWith('0x')).toBe(true);
    });
  });

  describe('addHexBalances', () => {
    it('should add two hex balances', () => {
      // 1 ETH + 0.5 ETH = 1.5 ETH
      const a =
        '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000'; // 1 ETH
      const b =
        '0x00000000000000000000000000000000000000000000000006f05b59d3b20000'; // 0.5 ETH
      const result = addHexBalances(a, b, 18);

      // Verify result equals 1.5 ETH
      const formatted = formatTokenBalance(result, 18);
      expect(formatted).toBe('1.5');
    });

    it('should handle zero additions', () => {
      const a = '0x0de0b6b3a7640000'; // 1 ETH
      const b = '0x0';
      const result = addHexBalances(a, b, 18);
      expect(formatTokenBalance(result, 18)).toBe('1');
    });

    it('should add fractional amounts', () => {
      // 0.055778460292928789 ETH + 0.1 ETH
      const a = '0x00c62a36cfe0d515';
      const b = '0x016345785d8a0000';
      const result = addHexBalances(a, b, 18);
      const formatted = formatTokenBalance(result, 18);
      expect(formatted).toBe('0.155778460292928789');
    });

    it('should handle large values', () => {
      const a =
        '0x00000000000000000000000000000000000000000000000000c62a36cfe0d515';
      const b =
        '0x00000000000000000000000000000000000000000000000000c62a36cfe0d515';
      const result = addHexBalances(a, b, 18);
      expect(result).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });

  describe('subHexBalances', () => {
    it('should subtract two hex balances', () => {
      // 1.5 ETH - 0.5 ETH = 1 ETH
      const a =
        '0x00000000000000000000000000000000000000000000000014d1120d7b160000'; // 1.5 ETH
      const b =
        '0x00000000000000000000000000000000000000000000000006f05b59d3b20000'; // 0.5 ETH
      const result = subHexBalances(a, b, 18);

      const formatted = formatTokenBalance(result, 18);
      expect(formatted).toBe('1');
    });

    it('should handle subtraction resulting in zero', () => {
      const a = '0x0de0b6b3a7640000'; // 1 ETH
      const b = '0x0de0b6b3a7640000'; // 1 ETH
      const result = subHexBalances(a, b, 18);
      expect(formatTokenBalance(result, 18)).toBe('0');
    });

    it('should subtract fractional amounts', () => {
      // 1 ETH - 0.055778460292928789 ETH
      const a = '0x0de0b6b3a7640000';
      const b = '0x00c62a36cfe0d515';
      const result = subHexBalances(a, b, 18);
      const formatted = formatTokenBalance(result, 18);
      expect(formatted).toBe('0.944221539707071211');
    });
  });

  describe('roundtrip conversions', () => {
    it('should convert decimal to hex and back', () => {
      const original = '123.456789';
      const hex = toHexBalance(original, 18);
      const restored = formatTokenBalance(hex, 18);
      expect(restored).toBe(original);
    });

    it('should handle example from requirements', () => {
      const exampleHex =
        '0x00000000000000000000000000000000000000000000000000c62a36cfe0d515';
      const decimal = formatTokenBalance(exampleHex, 18);
      const backToHex = toHexBalance(decimal, 18);
      expect(backToHex).toBe(exampleHex);
    });
  });
});

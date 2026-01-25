/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { AlchemysService } from './alchemys.service';
import { SupportedChain } from './interfaces/alchemy-api.interface';

// Mock the util function to simplify testing
jest.mock('src/common/utils/bigint-string.util', () => ({
  normalizeTo18Decimals: jest.fn((val) => val), // Simple pass-through for mock
}));

describe('AlchemysService', () => {
  let service: AlchemysService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  const mockApiKey = 'test-api-key';
  const mockAddress = '0x1234567890123456789012345678901234567890'; // Valid length
  const mockBaseUrl = 'https://eth-mainnet.g.alchemy.com/v2';

  beforeEach(async () => {
    const mockHttpService = {
      request: jest.fn(),
      post: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'ALCHEMY_API_KEY') return mockApiKey;
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlchemysService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AlchemysService>(AlchemysService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should log warning if API key is missing', async () => {
      // Re-create module with missing config
      const noKeyConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module = await Test.createTestingModule({
        providers: [
          AlchemysService,
          {
            provide: HttpService,
            useValue: { request: jest.fn(), post: jest.fn() },
          },
          { provide: ConfigService, useValue: noKeyConfigService },
        ],
      }).compile();

      const noKeyService = module.get<AlchemysService>(AlchemysService);
      expect(noKeyService).toBeDefined();
    });
  });

  describe('getSupportedChains', () => {
    it('should return list of supported chains', () => {
      const chains = service.getSupportedChains();
      expect(chains).toBeInstanceOf(Array);
      expect(chains.length).toBeGreaterThan(0);
      expect(chains).toContain('eth-mainnet');
    });
  });

  describe('getTransactionsByAddress', () => {
    it('should return error if invalid address provided', async () => {
      const result = await service.getTransactionsByAddress('invalid');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid wallet address');
    });

    it('should return error if unsupported chain provided', async () => {
      const result = await service.getTransactionsByAddress(
        mockAddress,
        'invalid-chain' as SupportedChain,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported chain');
    });

    it('should fetch and merge outgoing and incoming transactions successfully', async () => {
      const mockOutgoingTransfer = {
        blockNum: '0x10',
        hash: '0xabc',
        from: mockAddress,
        to: '0xother',
        value: 1.5,
        asset: 'ETH',
        category: 'external',
      };

      const mockIncomingTransfer = {
        blockNum: '0x20', // Higher block number = newer
        hash: '0xdef',
        from: '0xother',
        to: mockAddress,
        value: 2.0,
        asset: 'ETH',
        category: 'external',
      };

      // Mock first call (outgoing)
      httpService.request.mockReturnValueOnce(
        of({
          data: {
            result: {
              transfers: [mockOutgoingTransfer],
              pageKey: 'page1',
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        } as AxiosResponse),
      );

      // Mock second call (incoming)
      httpService.request.mockReturnValueOnce(
        of({
          data: {
            result: {
              transfers: [mockIncomingTransfer],
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        } as AxiosResponse),
      );

      const result = await service.getTransactionsByAddress(
        mockAddress,
        'eth-mainnet',
      );

      expect(result.success).toBe(true);
      expect(result.transactionCount).toBe(2);
      expect(result.outgoingCount).toBe(1);
      expect(result.incomingCount).toBe(1);

      // Check sorting (newest first)
      expect(result.transactions[0].hash).toBe(mockIncomingTransfer.hash);
      expect(result.transactions[1].hash).toBe(mockOutgoingTransfer.hash);

      expect(httpService.request).toHaveBeenCalledTimes(2);

      // Verify outgoing request params
      const outgoingCall = httpService.request.mock.calls[0][0];
      expect(outgoingCall.url).toContain(
        'https://eth-mainnet.g.alchemy.com/v2',
      );
      const outgoingBody = JSON.parse(outgoingCall.data);
      expect(outgoingBody.method).toBe('alchemy_getAssetTransfers');
      expect(outgoingBody.params[0].fromAddress).toBe(mockAddress);

      // Verify incoming request params
      const incomingCall = httpService.request.mock.calls[1][0];
      const incomingBody = JSON.parse(incomingCall.data);
      expect(incomingBody.params[0].toAddress).toBe(mockAddress);
    });

    it('should handle API errors gracefully', async () => {
      httpService.request.mockReturnValue(
        throwError(() => new Error('API Timeout')),
      );

      const result = await service.getTransactionsByAddress(mockAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Timeout');
      expect(result.transactions).toEqual([]);
    });

    it('should handle Alchemy API error response structure', async () => {
      httpService.request.mockReturnValue(
        of({
          data: {
            error: { message: 'Rate limited' },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        } as AxiosResponse),
      );

      const result = await service.getTransactionsByAddress(mockAddress);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Alchemy API Error');
    });

    it('should handle Alchemy API error on incoming transactions', async () => {
      // First call (outgoing) succeeds
      httpService.request.mockReturnValueOnce(
        of({
          data: { result: { transfers: [] } },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        } as AxiosResponse),
      );

      // Second call (incoming) fails with API error
      httpService.request.mockReturnValueOnce(
        of({
          data: { error: { message: 'Incoming Error' } },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        } as AxiosResponse),
      );

      const result = await service.getTransactionsByAddress(mockAddress);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Alchemy API Error (incoming)');
    });

    it('should handle empty/malformed results gracefully (branch coverage)', async () => {
      // Outgoing: result is null
      httpService.request.mockReturnValueOnce(
        of({
          data: { result: null },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        } as AxiosResponse),
      );

      // Incoming: transfers is undefined
      httpService.request.mockReturnValueOnce(
        of({
          data: { result: { transfers: undefined } },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        } as AxiosResponse),
      );

      const result = await service.getTransactionsByAddress(mockAddress);

      expect(result.success).toBe(true);
      expect(result.transactionCount).toBe(0);
      expect(result.transactions).toEqual([]);
    });

    it('should handle API error without api key', async () => {
      // Re-create module with missing config
      const noKeyConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module = await Test.createTestingModule({
        providers: [
          AlchemysService,
          {
            provide: HttpService,
            useValue: { request: jest.fn(), post: jest.fn() },
          },
          { provide: ConfigService, useValue: noKeyConfigService },
        ],
      }).compile();

      const noKeyService = module.get<AlchemysService>(AlchemysService);
      const result = await noKeyService.getTransactionsByAddress(mockAddress);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Alchemy API not configured');
    });
  });

  describe('getAllTransactionsByAddress', () => {
    it('should fetch all pages of transactions', async () => {
      const mockResultPage1 = {
        success: true,
        transactions: [{ hash: '1' }],
        pageKey: 'nextPage',
      };

      const mockResultPage2 = {
        success: true,
        transactions: [{ hash: '2' }],
        pageKey: undefined,
      };

      jest
        .spyOn(service, 'getTransactionsByAddress')
        .mockResolvedValueOnce(mockResultPage1 as any)
        .mockResolvedValueOnce(mockResultPage2 as any);

      const result = await service.getAllTransactionsByAddress(
        mockAddress,
        'eth-mainnet',
      );

      expect(result.success).toBe(true);
      expect(result.totalTransactions).toBe(2);
      expect(result.transactions).toHaveLength(2);
      expect(service.getTransactionsByAddress).toHaveBeenCalledTimes(2);
      expect(service.getTransactionsByAddress).toHaveBeenCalledWith(
        mockAddress,
        'eth-mainnet',
        undefined,
      );
      expect(service.getTransactionsByAddress).toHaveBeenCalledWith(
        mockAddress,
        'eth-mainnet',
        'nextPage',
      );
    });

    it('should stop fetching if maxPages is reached', async () => {
      const mockResultPage = {
        success: true,
        transactions: [{ hash: '1' }],
        pageKey: 'nextPage',
      };

      jest
        .spyOn(service, 'getTransactionsByAddress')
        .mockResolvedValue(mockResultPage as any);

      const maxPages = 2;
      const result = await service.getAllTransactionsByAddress(
        mockAddress,
        'eth-mainnet',
        maxPages,
      );

      expect(result.success).toBe(true);
      // It attempts the 3rd page, sees limit, and breaks. So pages count loop iteration reached 3.
      expect(result.totalPages).toBeGreaterThanOrEqual(2);
      expect(service.getTransactionsByAddress).toHaveBeenCalledTimes(2);
    });

    it('should handle unlimited pages when maxPages is 0', async () => {
      const mockResultPage1 = {
        success: true,
        transactions: [],
        pageKey: 'p2',
      };
      const mockResultPage2 = {
        success: true,
        transactions: [],
        pageKey: undefined,
      };

      jest
        .spyOn(service, 'getTransactionsByAddress')
        .mockResolvedValueOnce(mockResultPage1 as any)
        .mockResolvedValueOnce(mockResultPage2 as any);

      const result = await service.getAllTransactionsByAddress(
        mockAddress,
        'eth-mainnet',
        0, // unlimited
      );

      expect(result.success).toBe(true);
      expect(service.getTransactionsByAddress).toHaveBeenCalledTimes(2);
    });

    it('should return failure if a page fetch fails', async () => {
      jest.spyOn(service, 'getTransactionsByAddress').mockResolvedValue({
        success: false,
        error: 'Fetch failed',
        transactions: [],
        transactionCount: 0,
      } as any);

      const result = await service.getAllTransactionsByAddress(mockAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Fetch failed');
    });

    it('should handle unexpected errors during loop', async () => {
      jest
        .spyOn(service, 'getTransactionsByAddress')
        .mockRejectedValue(new Error('Unexpected'));

      const result = await service.getAllTransactionsByAddress(mockAddress);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected');
    });
  });

  describe('formatTokenBalance', () => {
    it('should return 0 for empty or zero balance', () => {
      expect(service.formatTokenBalance('0', 18)).toBe('0');
      expect(service.formatTokenBalance('', 18)).toBe('0');
    });

    it('should format integers correctly', () => {
      // 1 token with 18 decimals
      const balance = '1000000000000000000';
      expect(service.formatTokenBalance(balance, 18)).toBe('1');
    });

    it('should format decimals correctly', () => {
      // 1.5 tokens with 18 decimals (15 + 17 zeros)
      const balance = '1500000000000000000';
      expect(service.formatTokenBalance(balance, 18)).toBe(
        '1.500000000000000000',
      );
    });

    it('should format small decimals correctly', () => {
      // 0.00...01
      const balance = '1';
      expect(service.formatTokenBalance(balance, 18)).toBe(
        '0.000000000000000001',
      );
    });
  });

  describe('getTokenBalances', () => {
    it('should throw error if API key is missing', async () => {
      const noKeyConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };
      const module = await Test.createTestingModule({
        providers: [
          AlchemysService,
          { provide: HttpService, useValue: { post: jest.fn() } },
          { provide: ConfigService, useValue: noKeyConfigService },
        ],
      }).compile();
      const noKeyService = module.get<AlchemysService>(AlchemysService);

      await expect(
        noKeyService.getTokenBalances(['eth-mainnet'], mockAddress),
      ).rejects.toThrow('Alchemy API not configured');
    });

    it('should throw error if no chains provided', async () => {
      await expect(service.getTokenBalances([], mockAddress)).rejects.toThrow(
        'At least one chain must be specified',
      );
    });

    it('should throw error for unsupported chains', async () => {
      await expect(
        service.getTokenBalances(['invalid-chain'], mockAddress),
      ).rejects.toThrow('Unsupported chains');
    });

    it('should throw error for invalid address', async () => {
      await expect(
        service.getTokenBalances(['eth-mainnet'], 'short'),
      ).rejects.toThrow('Invalid wallet address');
    });

    it('should return empty balances if API response is empty', async () => {
      httpService.post.mockReturnValue(of({ data: {} } as AxiosResponse));

      const result = await service.getTokenBalances(
        ['eth-mainnet'],
        mockAddress,
      );
      expect(result.nativeBalances).toEqual([]);
      expect(result.tokenBalances).toEqual([]);
    });

    it('should correctly parse native and ERC20 tokens', async () => {
      const mockApiResponse = {
        data: {
          data: {
            tokens: [
              {
                // Native Token (ETH)
                tokenAddress: null,
                tokenBalance: '1000000000000000000', // 1 ETH
                network: 'eth-mainnet',
              },
              {
                // ERC20 Token (VALID)
                tokenAddress: '0xToken',
                tokenBalance: '500',
                network: 'eth-mainnet',
                tokenMetadata: {
                  decimals: 18,
                  symbol: 'TKN',
                  name: 'Token',
                  logo: 'http://logo.png',
                },
              },
              {
                // Zero Balance Token (Should be filtered)
                tokenAddress: '0xZero',
                tokenBalance: '0',
                network: 'eth-mainnet',
              },
              {
                // 0x Zero Balance (Should be filtered)
                tokenAddress: '0xZeroHex',
                tokenBalance: '0x0000000000000000000000000000000000000000',
                network: 'eth-mainnet',
              },
            ],
          },
        },
      };

      httpService.post.mockReturnValue(of(mockApiResponse as AxiosResponse));

      const result = await service.getTokenBalances(
        ['eth-mainnet'],
        mockAddress,
      );

      expect(result.nativeBalances).toHaveLength(1);
      expect(result.nativeBalances[0].balance).toBe('1');

      expect(result.tokenBalances).toHaveLength(1);
      expect(result.tokenBalances[0].symbol).toBe('TKN');
      expect(result.tokenBalances[0].balance).toBe('0.000000000000000500'); // 500 wei
    });

    it('should handle token metadata missing gracefully', async () => {
      const mockApiResponse = {
        data: {
          data: {
            tokens: [
              {
                // ERC20 Token with missing metadata
                tokenAddress: '0xToken',
                tokenBalance: '100',
                network: 'eth-mainnet',
                tokenMetadata: null, // null metadata
              },
              {
                // Metadata present but invalid properties
                tokenAddress: '0xToken2',
                tokenBalance: '100',
                network: 'eth-mainnet',
                tokenMetadata: {
                  decimals: 'invalid', // Not a number
                  symbol: 123, // Not a string
                  name: 123, // Not a string
                  logo: 123, // Not a string
                },
              },
            ],
          },
        },
      };

      httpService.post.mockReturnValue(of(mockApiResponse as AxiosResponse));

      const result = await service.getTokenBalances(
        ['eth-mainnet'],
        mockAddress,
      );

      expect(result.tokenBalances).toHaveLength(2);

      // Check first token (null metadata)
      expect(result.tokenBalances[0].decimals).toBe(18); // Default
      expect(result.tokenBalances[0].symbol).toBeUndefined();

      // Check second token (invalid metadata properies)
      expect(result.tokenBalances[1].decimals).toBe(18); // Default fallback
      expect(result.tokenBalances[1].symbol).toBeUndefined(); // Fallback
    });

    it('should handle hex balances that are non-zero', async () => {
      const mockApiResponse = {
        data: {
          data: {
            tokens: [
              {
                tokenAddress: '0xToken',
                tokenBalance: '0x123', // Hex non-zero
                network: 'eth-mainnet',
                tokenMetadata: { decimals: 18 },
              },
            ],
          },
        },
      };
      httpService.post.mockReturnValue(of(mockApiResponse as AxiosResponse));
      const result = await service.getTokenBalances(
        ['eth-mainnet'],
        mockAddress,
      );
      expect(result.tokenBalances).toHaveLength(1);
      // 0x123 hex is 291 decimal
      expect(result.tokenBalances[0].balance).not.toBe('0');
    });

    it('should handle API errors', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('Portfolio API Error')),
      );

      await expect(
        service.getTokenBalances(['eth-mainnet'], mockAddress),
      ).rejects.toThrow('Portfolio API Error');
    });

    it('should filter native tokens with zero balance (0x format)', async () => {
      const mockApiResponse = {
        data: {
          data: {
            tokens: [
              {
                // Native Token with 0x zero balance
                tokenAddress: null,
                tokenBalance: '0x0000000000000000000000000000000000000000',
                network: 'eth-mainnet',
              },
            ],
          },
        },
      };

      httpService.post.mockReturnValue(of(mockApiResponse as AxiosResponse));
      const result = await service.getTokenBalances(
        ['eth-mainnet'],
        mockAddress,
      );
      expect(result.nativeBalances).toHaveLength(0);
    });
  });
});

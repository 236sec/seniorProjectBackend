/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { AlchemysService } from './alchemys.service';
import { CHAINS } from './interfaces/alchemy-api.interface';

describe('AlchemysService', () => {
  let service: AlchemysService;
  let httpService: HttpService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-api-key'),
  };

  const mockHttpService = {
    request: jest.fn(),
    post: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlchemysService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<AlchemysService>(AlchemysService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSupportedChains', () => {
    it('should return list of supported chains', () => {
      const result = service.getSupportedChains();
      expect(result).toEqual(CHAINS);
    });
  });

  describe('getTransactionsByAddress', () => {
    it('should return combined outgoing and incoming transactions', async () => {
      const address = '0x1234567890abcdef'; // Valid length address
      const outgoingResponse: AxiosResponse = {
        data: {
          result: {
            transfers: [{ blockNum: '0x10', from: address, to: '0xabc...' }],
            pageKey: 'next-page-key',
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} as any },
      };

      const incomingResponse: AxiosResponse = {
        data: {
          result: {
            transfers: [{ blockNum: '0x20', from: '0xdef...', to: address }],
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} as any },
      };

      jest
        .spyOn(httpService, 'request')
        .mockReturnValueOnce(of(outgoingResponse))
        .mockReturnValueOnce(of(incomingResponse));

      const result = await service.getTransactionsByAddress(address);

      expect(result.success).toBe(true);
      expect(result.outgoingCount).toBe(1);
      expect(result.incomingCount).toBe(1);
      expect(result.transactionCount).toBe(2);
      // Sorted by blockNum descending (0x20 > 0x10)
      expect(result.transactions[0].blockNum).toBe('0x20');
      expect(result.transactions[1].blockNum).toBe('0x10');
      expect(result.pageKey).toBe('next-page-key');
    });
  });

  describe('getAllTransactionsByAddress', () => {
    it('should fetch all transactions with pagination', async () => {
      const address = '0x1234567890abcdef'; // Valid length address
      // First call return with pageKey
      const firstBatch = {
        success: true,
        transactions: [{ blockNum: '0x20' }],
        pageKey: 'page-2',
        outgoingCount: 1,
        incomingCount: 0,
      };
      // Second call return with no pageKey
      const secondBatch = {
        success: true,
        transactions: [{ blockNum: '0x10' }],
        pageKey: undefined,
        outgoingCount: 1,
        incomingCount: 0,
      };

      // Spy on getTransactionsByAddress to check logic of getAllTransactionsByAddress
      // This avoids complex mocking of HTTP requests loop
      jest
        .spyOn(service, 'getTransactionsByAddress')
        .mockResolvedValueOnce(firstBatch as any)
        .mockResolvedValueOnce(secondBatch as any);

      const result = await service.getAllTransactionsByAddress(address);

      expect(result.success).toBe(true);
      expect(result.totalTransactions).toBe(2);
      expect(result.transactions).toHaveLength(2);
      expect(service.getTransactionsByAddress).toHaveBeenCalledTimes(2);
      expect(service.getTransactionsByAddress).toHaveBeenCalledWith(
        address,
        'eth-mainnet',
        undefined,
      );
      expect(service.getTransactionsByAddress).toHaveBeenCalledWith(
        address,
        'eth-mainnet',
        'page-2',
      );
    });
  });

  describe('formatTokenBalance', () => {
    it('should format token balance correctly', () => {
      expect(service.formatTokenBalance('1500000000000000000', 18)).toBe(
        '1.500000000000000000',
      );
      expect(service.formatTokenBalance('0', 18)).toBe('0');
      expect(service.formatTokenBalance('100', 2)).toBe('1'); // Expect integer string if no remainder
      expect(service.formatTokenBalance('5', 2)).toBe('0.05');
    });
  });

  describe('getTokenBalances', () => {
    it('should return token balances including native and erc20', async () => {
      const address = '0x1234567890abcdef'; // Valid length address
      const chains = ['eth-mainnet'];
      const mockResponse: AxiosResponse = {
        data: {
          data: {
            tokens: [
              {
                tokenAddress: null, // Native
                tokenBalance: '1000000000000000000', // 1 ETH
                network: 'eth-mainnet',
                tokenMetadata: { decimals: 18 },
              },
              {
                tokenAddress: '0xerc20...',
                tokenBalance: '5000000', // 5 USDC (6 decimals)
                network: 'eth-mainnet',
                tokenMetadata: {
                  decimals: 6,
                  symbol: 'USDC',
                  name: 'USD Coin',
                  logo: 'usdc.png',
                },
              },
            ],
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},

        config: { headers: {} as any },
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

      const result = await service.getTokenBalances(chains, address);

      expect(result.address).toBe(address);
      expect(result.chains).toEqual(chains);

      expect(result.nativeBalances).toHaveLength(1);
      expect(result.nativeBalances[0].network).toBe('eth-mainnet');
      expect(result.nativeBalances[0].balance).toBe('1');

      expect(result.tokenBalances).toHaveLength(1);
      expect(result.tokenBalances[0].symbol).toBe('USDC');
      expect(result.tokenBalances[0].decimals).toBe(18); // Service normalizes to 18
      // normalizeTo18Decimals -> 5000000 (6 dec) -> 5 * 10^18
      // formatTokenBalance -> 5 * 10^18 (18 dec) -> 5.0...
    });
  });
});

/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */

import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { Cache } from 'cache-manager';
import { of, throwError } from 'rxjs';
import { CoingeckoService } from './coingecko.service';

describe('CoingeckoService', () => {
  let service: CoingeckoService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;
  let cacheManager: jest.Mocked<Cache>;

  const mockApiKey = 'test-api-key';
  const mockApiUrl = 'https://api.coingecko.com/api/v3';

  beforeEach(async () => {
    const mockHttpService = {
      get: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'COINGECKO_API_KEY') return mockApiKey;
        if (key === 'COINGECKO_API_URL') return mockApiUrl;
        return null;
      }),
    };

    const mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoingeckoService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CoingeckoService>(CoingeckoService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('configuration', () => {
    it('should initialize with correct config', () => {
      // Config is checked in constructor
      expect(configService.get).toHaveBeenCalledWith('COINGECKO_API_KEY');
      expect(configService.get).toHaveBeenCalledWith('COINGECKO_API_URL');
    });

    it('should warn when config is missing', async () => {
      // Setup a new module where config returns null
      const logSpy = jest
        .spyOn(require('@nestjs/common').Logger.prototype, 'warn')
        .mockImplementation(() => {});

      const mockConfigServiceMissing = {
        get: jest.fn().mockReturnValue(undefined),
      };

      await Test.createTestingModule({
        providers: [
          CoingeckoService,
          { provide: HttpService, useValue: httpService },
          { provide: ConfigService, useValue: mockConfigServiceMissing },
          { provide: CACHE_MANAGER, useValue: cacheManager },
        ],
      }).compile();

      expect(logSpy).toHaveBeenCalledWith('COINGECKO_API_KEY not configured');
      expect(logSpy).toHaveBeenCalledWith('COINGECKO_API_URL not configured');

      logSpy.mockRestore();
    });
  });

  describe('getHeaders', () => {
    // getHeaders is private, tested via public methods or check handling Pro API
    it('should use pro API header when URL suggests pro api', async () => {
      // Mock config to return pro url
      configService.get.mockImplementation((key: string) => {
        if (key === 'COINGECKO_API_URL')
          return 'https://pro-api.coingecko.com/api/v3';
        if (key === 'COINGECKO_API_KEY') return 'pro-key';
        return null;
      });

      // Re-compile module to pick up new config in constructor
      const module = await Test.createTestingModule({
        providers: [
          CoingeckoService,
          { provide: HttpService, useValue: httpService },
          { provide: ConfigService, useValue: configService },
          { provide: CACHE_MANAGER, useValue: cacheManager },
        ],
      }).compile();
      const localService = module.get<CoingeckoService>(CoingeckoService);

      const mockResponse: AxiosResponse = {
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValue(of(mockResponse));

      await localService.listCoins();

      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('/coins/list'),
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-cg-pro-api-key': 'pro-key' }),
        }),
      );
    });

    it('should return empty headers if apiKey is missing', async () => {
      const mockConfigServiceNoKey = {
        get: jest.fn((key) => {
          if (key === 'COINGECKO_API_URL') return mockApiUrl;
          return undefined;
        }),
      };
      const module = await Test.createTestingModule({
        providers: [
          CoingeckoService,
          { provide: HttpService, useValue: httpService },
          { provide: ConfigService, useValue: mockConfigServiceNoKey },
          { provide: CACHE_MANAGER, useValue: cacheManager },
        ],
      }).compile();
      const localService = module.get<CoingeckoService>(CoingeckoService);

      const mockResponse: AxiosResponse = {
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValue(of(mockResponse));

      await localService.listCoins();

      expect(httpService.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {},
        }),
      );
    });

    it('should handle apiKey present but apiUrl missing', async () => {
      configService.get.mockImplementation((key) => {
        if (key === 'COINGECKO_API_URL') return undefined;
        if (key === 'COINGECKO_API_KEY') return mockApiKey;
        return null;
      });

      const module = await Test.createTestingModule({
        providers: [
          CoingeckoService,
          { provide: HttpService, useValue: httpService },
          { provide: ConfigService, useValue: configService },
          { provide: CACHE_MANAGER, useValue: cacheManager },
        ],
      }).compile();
      const localService = module.get<CoingeckoService>(CoingeckoService);

      const mockResponse: AxiosResponse = {
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValue(of(mockResponse));

      await localService.listCoins();

      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('undefined/coins/list'),
        expect.objectContaining({
          headers: { 'x-cg-demo-api-key': mockApiKey },
        }),
      );
    });
  });

  describe('listCoins', () => {
    it('should successfully return coin list', async () => {
      const mockData = [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }];
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.listCoins();
      expect(result).toEqual(mockData);
      expect(httpService.get).toHaveBeenCalledWith(
        `${mockApiUrl}/coins/list`,
        expect.objectContaining({
          headers: expect.objectContaining({ 'x-cg-demo-api-key': mockApiKey }),
        }),
      );
    });

    it('should handle non-Error objects thrown', async () => {
      httpService.get.mockReturnValue(throwError(() => 'String Error'));
      await expect(service.listCoins()).rejects.toEqual('String Error');
    });
  });

  describe('listCoinsWithPlatforms', () => {
    it('should return coins with platforms', async () => {
      const mockData = [{ id: 'eth', platforms: { ethereum: '0x...' } }];
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.listCoinsWithPlatforms();
      expect(result).toEqual(mockData);
      expect(httpService.get).toHaveBeenCalledWith(
        `${mockApiUrl}/coins/list`,
        expect.objectContaining({
          params: { include_platform: true },
        }),
      );
    });

    it('should throw error on failure', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('Failed')));
      await expect(service.listCoinsWithPlatforms()).rejects.toThrow('Failed');
    });

    it('should handle non-Error objects thrown', async () => {
      httpService.get.mockReturnValue(throwError(() => 'String Error'));
      await expect(service.listCoinsWithPlatforms()).rejects.toEqual(
        'String Error',
      );
    });
  });

  describe('getCoinsMarkets', () => {
    it('should return market data', async () => {
      const mockData = [{ id: 'btc', current_price: 50000 }];
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getCoinsMarkets(2, 50);
      expect(result).toEqual(mockData);
      expect(httpService.get).toHaveBeenCalledWith(
        `${mockApiUrl}/coins/markets`,
        expect.objectContaining({
          params: expect.objectContaining({
            vs_currency: 'usd',
            page: 2,
            per_page: 50,
          }),
        }),
      );
    });

    it('should use defaults if no args provided', async () => {
      const mockResponse: AxiosResponse = {
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValue(of(mockResponse));

      await service.getCoinsMarkets();
      expect(httpService.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({ page: 1, per_page: 250 }),
        }),
      );
    });

    it('should throw error on failure', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('Failed')));
      await expect(service.getCoinsMarkets()).rejects.toThrow('Failed');
    });

    it('should handle non-Error objects thrown', async () => {
      httpService.get.mockReturnValue(throwError(() => 'String Error'));
      await expect(service.getCoinsMarkets()).rejects.toEqual('String Error');
    });
  });

  describe('getCoinById', () => {
    it('should return coin detail', async () => {
      const mockData = { id: 'btc', name: 'Bitcoin' };
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getCoinById('btc');
      expect(result).toEqual(mockData);
      expect(httpService.get).toHaveBeenCalledWith(
        `${mockApiUrl}/coins/btc`,
        expect.any(Object),
      );
    });

    it('should throw error on failure', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('Failed')));
      await expect(service.getCoinById('btc')).rejects.toThrow('Failed');
    });

    it('should handle non-Error objects thrown', async () => {
      httpService.get.mockReturnValue(throwError(() => 'String Error'));
      await expect(service.getCoinById('btc')).rejects.toEqual('String Error');
    });
  });

  describe('getAssetPlatformsList', () => {
    it('should return platforms list', async () => {
      const mockData = [{ id: 'ethereum' }];
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getAssetPlatformsList();
      expect(result).toEqual(mockData);
      expect(httpService.get).toHaveBeenCalledWith(
        `${mockApiUrl}/asset_platforms`,
        expect.any(Object),
      );
    });

    it('should throw error on failure', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('Failed')));
      await expect(service.getAssetPlatformsList()).rejects.toThrow('Failed');
    });

    it('should handle non-Error objects thrown', async () => {
      httpService.get.mockReturnValue(throwError(() => 'String Error'));
      await expect(service.getAssetPlatformsList()).rejects.toEqual(
        'String Error',
      );
    });
  });

  describe('getHistoricalMarketData', () => {
    it('should return historical data', async () => {
      const mockData = { prices: [] };
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getHistoricalMarketData(
        'btc',
        30,
        'daily',
        '2',
      );
      expect(result).toEqual(mockData);
      expect(httpService.get).toHaveBeenCalledWith(
        `${mockApiUrl}/coins/btc/market_chart`,
        expect.objectContaining({
          params: expect.objectContaining({
            days: '30',
            interval: 'daily',
            precision: '2',
          }),
        }),
      );
    });

    it('should throw error on failure', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('Failed')));
      await expect(
        service.getHistoricalMarketData('btc', 30, 'daily', '2'),
      ).rejects.toThrow('Failed');
    });

    it('should handle non-Error objects thrown', async () => {
      httpService.get.mockReturnValue(throwError(() => 'String Error'));
      await expect(
        service.getHistoricalMarketData('btc', 30, 'daily', '2'),
      ).rejects.toEqual('String Error');
    });
  });

  describe('getCurrentPrice', () => {
    it('should return empty object for empty array', async () => {
      const result = await service.getCurrentPrice([]);
      expect(result).toEqual({});
      expect(cacheManager.get).not.toHaveBeenCalled();
    });

    it('should return cached data if available', async () => {
      const mockPrice = { usd: 100 };
      cacheManager.get.mockImplementation(async (key) => {
        if (key === 'coingecko_price_btc') return mockPrice;
        return null;
      });

      const result = await service.getCurrentPrice(['btc']);
      expect(result).toEqual({ btc: mockPrice });
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('should fetch from API if not in cache', async () => {
      cacheManager.get.mockResolvedValue(null);
      const mockApiData = { btc: { usd: 100 } };
      const mockResponse: AxiosResponse = {
        data: mockApiData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getCurrentPrice(['btc']);
      expect(result).toEqual(mockApiData);
      expect(cacheManager.set).toHaveBeenCalledWith(
        'coingecko_price_btc',
        { usd: 100 },
        300000,
      );
    });

    it('should handle mixed cache hit and miss', async () => {
      const cachedEth = { usd: 2000 };
      const apiBtc = { usd: 50000 };

      cacheManager.get.mockImplementation(async (key) => {
        if (key === 'coingecko_price_eth') return cachedEth;
        return null;
      });

      const mockResponse: AxiosResponse = {
        data: { btc: apiBtc },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getCurrentPrice(['eth', 'btc']);

      expect(result).toEqual({ eth: cachedEth, btc: apiBtc });
      expect(httpService.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({ ids: 'btc' }),
        }),
      );
      expect(cacheManager.set).toHaveBeenCalledWith(
        'coingecko_price_btc',
        apiBtc,
        300000,
      );
    });

    it('should return only successful results if partial api data', async () => {
      // cacheService returns null
      cacheManager.get.mockResolvedValue(null);

      // API requested for btc, eth but returns only btc
      const mockResponse: AxiosResponse = {
        data: { btc: { usd: 50000 } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      httpService.get.mockReturnValue(of(mockResponse));

      const result = await service.getCurrentPrice(['btc', 'eth']);

      expect(result).toEqual({ btc: { usd: 50000 } });
      // Should only cache what was returned
      expect(cacheManager.set).toHaveBeenCalledWith(
        'coingecko_price_btc',
        expect.any(Object),
        300000,
      );
      expect(cacheManager.set).toHaveBeenCalledTimes(1);
    });

    it('should throw error on failure', async () => {
      cacheManager.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => new Error('Failed')));
      await expect(service.getCurrentPrice(['btc'])).rejects.toThrow('Failed');
    });

    it('should handle non-Error objects thrown', async () => {
      cacheManager.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(throwError(() => 'String Error'));
      await expect(service.getCurrentPrice(['btc'])).rejects.toEqual(
        'String Error',
      );
    });
  });
});

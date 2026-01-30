/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import { Cache } from 'cache-manager';
import { of } from 'rxjs';
import { CoingeckoService } from './coingecko.service';

describe('CoingeckoService', () => {
  let service: CoingeckoService;
  let httpService: HttpService;
  let cacheManager: Cache;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'COINGECKO_API_KEY') return 'test-api-key';
      if (key === 'COINGECKO_API_URL')
        return 'https://api.coingecko.com/api/v3';
      return null;
    }),
  };

  const mockHttpService = {
    get: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoingeckoService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CoingeckoService>(CoingeckoService);
    httpService = module.get<HttpService>(HttpService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listCoins', () => {
    it('should return list of coins', async () => {
      const mockResponse: AxiosResponse = {
        data: [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} as any },
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await service.listCoins();
      expect(result).toEqual(mockResponse.data);
      expect(httpService.get).toHaveBeenCalled();
    });
  });

  describe('listCoinsWithPlatforms', () => {
    it('should return list of coins with platforms', async () => {
      const mockResponse: AxiosResponse = {
        data: [
          { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', platforms: {} },
        ],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} as any },
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await service.listCoinsWithPlatforms();
      expect(result).toEqual(mockResponse.data);
      expect(httpService.get).toHaveBeenCalled();
    });
  });

  describe('getCoinsMarkets', () => {
    it('should return coin markets', async () => {
      const mockResponse: AxiosResponse = {
        data: [{ id: 'bitcoin', current_price: 50000 }],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} as any },
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await service.getCoinsMarkets();
      expect(result).toEqual(mockResponse.data);
      expect(httpService.get).toHaveBeenCalled();
    });
  });

  describe('getCoinById', () => {
    it('should return coin details', async () => {
      const coinId = 'bitcoin';
      const mockResponse: AxiosResponse = {
        data: { id: 'bitcoin', name: 'Bitcoin' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} as any },
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await service.getCoinById(coinId);
      expect(result).toEqual(mockResponse.data);
      expect(httpService.get).toHaveBeenCalled();
    });
  });

  describe('getAssetPlatformsList', () => {
    it('should return asset platforms list', async () => {
      const mockResponse: AxiosResponse = {
        data: [{ id: 'ethereum', name: 'Ethereum' }],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} as any },
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await service.getAssetPlatformsList();
      expect(result).toEqual(mockResponse.data);
      expect(httpService.get).toHaveBeenCalled();
    });
  });

  describe('getHistoricalMarketData', () => {
    it('should return historical market data', async () => {
      const coinId = 'bitcoin';
      const mockResponse: AxiosResponse = {
        data: { prices: [[1625097600000, 35000]] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} as any },
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await service.getHistoricalMarketData(
        coinId,
        1,
        'daily',
        '2',
      );
      expect(result).toEqual(mockResponse.data);
      expect(httpService.get).toHaveBeenCalled();
    });
  });

  describe('getCurrentPrice', () => {
    it('should return current prices (cached and fetched)', async () => {
      const coinIds = ['bitcoin', 'ethereum'];
      const cachedBitcoin = { usd: 50000 };
      const fetchedEthereum = { ethereum: { usd: 3000 } };

      // Mock cache behavior: bitcoin in cache, ethereum not
      mockCacheManager.get = jest.fn((key) => {
        if (key === 'coingecko_price_bitcoin')
          return Promise.resolve(cachedBitcoin);
        return Promise.resolve(null);
      });

      const mockResponse: AxiosResponse = {
        data: fetchedEthereum,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} as any },
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await service.getCurrentPrice(coinIds);

      expect(result).toEqual({
        bitcoin: cachedBitcoin,
        ethereum: fetchedEthereum.ethereum,
      });

      expect(cacheManager.get).toHaveBeenCalledTimes(2);
      expect(httpService.get).toHaveBeenCalled(); // Should fetch ethereum
      expect(cacheManager.set).toHaveBeenCalledWith(
        'coingecko_price_ethereum',
        fetchedEthereum.ethereum,
        300000,
      );
    });
  });
});

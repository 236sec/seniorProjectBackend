/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unused-vars */
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CoingeckoService } from 'src/coingecko/coingecko.service';
import { TokenContract } from './schema/token-contract.schema';
import { TokenHistoricalPrice } from './schema/token-historical-price.schema';
import { TokenUpdateLog } from './schema/token-update-log.schema';
import { Token } from './schema/token.schema';
import { TokensService } from './tokens.service';

describe('TokensService', () => {
  let service: TokensService;
  let tokenModel: any;
  let tokenUpdateLogModel: any;
  let tokenContractModel: any;
  let tokenHistoricalPriceModel: any;
  let coingeckoService: any;

  // Mock Mongoose Query Chain
  const createMockQuery = (resolvedValue: any) => ({
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolvedValue),
  });

  const mockTokenModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    bulkWrite: jest.fn(),
    countDocuments: jest.fn(),
    updateOne: jest.fn(),
    findOneAndDelete: jest.fn(),
  };

  const mockTokenUpdateLogModel = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockTokenContractModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    bulkWrite: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
  };

  const mockTokenHistoricalPriceModel = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockCoingeckoService = {
    getCoinsMarkets: jest.fn(),
    listCoinsWithPlatforms: jest.fn(),
    getCoinById: jest.fn(),
    getHistoricalMarketData: jest.fn(),
    getCurrentPrice: jest.fn(),
    getAssetPlatformsList: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokensService,
        { provide: getModelToken(Token.name), useValue: mockTokenModel },
        {
          provide: getModelToken(TokenUpdateLog.name),
          useValue: mockTokenUpdateLogModel,
        },
        {
          provide: getModelToken(TokenContract.name),
          useValue: mockTokenContractModel,
        },
        {
          provide: getModelToken(TokenHistoricalPrice.name),
          useValue: mockTokenHistoricalPriceModel,
        },
        { provide: CoingeckoService, useValue: mockCoingeckoService },
      ],
    }).compile();

    service = module.get<TokensService>(TokensService);
    tokenModel = module.get(getModelToken(Token.name));
    tokenUpdateLogModel = module.get(getModelToken(TokenUpdateLog.name));
    tokenContractModel = module.get(getModelToken(TokenContract.name));
    tokenHistoricalPriceModel = module.get(
      getModelToken(TokenHistoricalPrice.name),
    );
    coingeckoService = module.get(CoingeckoService);

    jest.clearAllMocks();
    // Spy on Logger
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateDatabaseFromCoingecko', () => {
    it('should skip update if too frequent', async () => {
      const recentDate = new Date();
      tokenUpdateLogModel.findOne.mockReturnValue(
        createMockQuery({
          lastUpdatedAt: recentDate,
        }),
      );

      const result = await service.updateDatabaseFromCoingecko();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Update too frequent');
    });

    it('should proceed if last update was long ago', async () => {
      const oldDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      tokenUpdateLogModel.findOne.mockReturnValue(
        createMockQuery({
          lastUpdatedAt: oldDate,
        }),
      );

      coingeckoService.getCoinsMarkets.mockResolvedValue([]);

      const result = await service.updateDatabaseFromCoingecko();
      // Returns false because no coins fetched, but didn't fail on frequency
      expect(result.message).toBe('No coins fetched from CoinGecko');
    });

    it('should fetch coins and update database', async () => {
      // Mock successful flow
      tokenUpdateLogModel.findOne.mockReturnValue(createMockQuery(null)); // First run
      const mockCoins = [
        { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', image: 'url' },
      ];
      coingeckoService.getCoinsMarkets
        .mockResolvedValueOnce(mockCoins)
        .mockResolvedValueOnce([]); // Stop loop

      coingeckoService.listCoinsWithPlatforms.mockResolvedValue([
        {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          platforms: { ethereum: '0x123' },
        },
      ]);

      tokenModel.findOne.mockResolvedValue({ _id: 'objId', id: 'bitcoin' });
      tokenModel.bulkWrite.mockResolvedValue({
        upsertedCount: 1,
        modifiedCount: 0,
      });
      tokenContractModel.bulkWrite.mockResolvedValue({
        upsertedCount: 1,
        modifiedCount: 0,
      });
      tokenUpdateLogModel.create.mockResolvedValue({});

      const result = await service.updateDatabaseFromCoingecko(1, 1);

      expect(result.success).toBe(true);
      expect(tokenModel.bulkWrite).toHaveBeenCalled();
      expect(tokenContractModel.bulkWrite).toHaveBeenCalled();
    });

    it('should handle rate limits (429) during coin fetch', async () => {
      tokenUpdateLogModel.findOne.mockReturnValue(createMockQuery(null));
      coingeckoService.getCoinsMarkets.mockRejectedValue({
        response: { status: 429 },
      });

      const result = await service.updateDatabaseFromCoingecko();
      expect(result.message).toBe('No coins fetched from CoinGecko');
    });

    it('should handle general errors', async () => {
      tokenUpdateLogModel.findOne.mockRejectedValue(new Error('DB Error'));
      const result = await service.updateDatabaseFromCoingecko();
      expect(result.success).toBe(false);
    });

    it('should handle rate limit during platform fetch', async () => {
      tokenUpdateLogModel.findOne.mockReturnValue(createMockQuery(null));
      coingeckoService.getCoinsMarkets.mockResolvedValueOnce([
        { id: 'btc', symbol: 'btc', name: 'Bitcoin', image: 'url' },
      ]);
      coingeckoService.getCoinsMarkets.mockResolvedValueOnce([]);

      // Throw 429 for listCoinsWithPlatforms
      coingeckoService.listCoinsWithPlatforms.mockRejectedValue({
        response: { status: 429 },
      });

      tokenModel.bulkWrite.mockResolvedValue({
        upsertedCount: 1,
        modifiedCount: 0,
      });
      tokenUpdateLogModel.create.mockResolvedValue({});

      const result = await service.updateDatabaseFromCoingecko();
      expect(result.success).toBe(true); // Still marked success if coins are updated
      expect(coingeckoService.listCoinsWithPlatforms).toHaveBeenCalled();
      // Since platform fetch failed, no contracts should be updated
      expect(tokenContractModel.bulkWrite).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated tokens', async () => {
      const mockTokens = [{ name: 'Bitcoin' }];
      tokenModel.find.mockReturnValue(createMockQuery(mockTokens));
      tokenModel.countDocuments.mockResolvedValue(1);

      const result = await service.findAll(1, 10);
      expect(result.data).toEqual(mockTokens);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by search term', async () => {
      const mockTokens = [{ name: 'Bitcoin' }];
      tokenModel.find.mockReturnValue(createMockQuery(mockTokens));
      tokenModel.countDocuments.mockResolvedValue(1);

      await service.findAll(1, 10, 'bit');
      expect(tokenModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.any(Array),
        }),
      );
    });
  });

  describe('findOne & findOneByCoinGeckoId', () => {
    it('should find one by ID', async () => {
      const id = new Types.ObjectId();
      tokenModel.findOne.mockReturnValue(createMockQuery({ _id: id }));
      await service.findOne(id);
      expect(tokenModel.findOne).toHaveBeenCalledWith({ _id: id });
    });

    it('should find one by CoinGecko ID', async () => {
      tokenModel.findOne.mockReturnValue(createMockQuery({ id: 'bitcoin' }));
      await service.findOneByCoinGeckoId('bitcoin');
      expect(tokenModel.findOne).toHaveBeenCalledWith({ id: 'bitcoin' });
    });
  });

  describe('fineToken', () => {
    it('should find by objectId', async () => {
      const id = new Types.ObjectId();
      tokenModel.findOne.mockReturnValue(createMockQuery({ _id: id }));
      await service.fineToken(id, null as any);
      expect(tokenModel.findOne).toHaveBeenCalledWith({ _id: id });
    });

    it('should find by coingeckoId', async () => {
      tokenModel.findOne.mockReturnValue(createMockQuery({ id: 'bitcoin' }));
      await service.fineToken(null as any, 'bitcoin');
      expect(tokenModel.findOne).toHaveBeenCalledWith({ id: 'bitcoin' });
    });

    it('should throw if neither provided', async () => {
      await expect(service.fineToken(null as any, null as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findByContractAddress', () => {
    it('should return populated contract', async () => {
      const mockContract = { contractAddress: '0x123' };
      tokenContractModel.findOne.mockReturnValue(createMockQuery(mockContract));

      const result = await service.findByContractAddress('ethereum', '0x123');
      expect(result).toEqual(mockContract);
    });
  });

  describe('getTokenContracts', () => {
    it('should return empty if token not found', async () => {
      tokenModel.findOne.mockReturnValue(createMockQuery(null));
      const result = await service.getTokenContracts('btc');
      expect(result).toEqual([]);
    });

    it('should return contracts for found token', async () => {
      const tokenId = new Types.ObjectId();
      tokenModel.findOne.mockReturnValue(createMockQuery({ _id: tokenId }));
      tokenContractModel.find.mockReturnValue(
        createMockQuery([{ address: '0x1' }]),
      );

      await service.getTokenContracts('btc');
      expect(tokenContractModel.find).toHaveBeenCalledWith({ tokenId });
    });
  });

  describe('generateTokenContracts', () => {
    it('should handle errors gracefully', async () => {
      tokenModel.countDocuments.mockRejectedValue(new Error('DB Error'));
      const result = await service.generateTokenContracts();
      expect(result.success).toBe(false);
    });

    it('should process tokens and add contracts', async () => {
      tokenModel.countDocuments.mockResolvedValue(1);
      const tokenId = new Types.ObjectId();
      const mockToken = {
        _id: tokenId,
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
      };

      // Mocks for processing logic
      tokenModel.find.mockReturnValue(createMockQuery([mockToken]));
      tokenContractModel.countDocuments.mockReturnValue(createMockQuery(0)); // No existing contracts

      coingeckoService.listCoinsWithPlatforms.mockResolvedValue([
        { id: 'bitcoin', platforms: { eth: '0x123' } },
      ]);

      tokenContractModel.bulkWrite.mockResolvedValue({
        upsertedCount: 1,
        modifiedCount: 0,
      });

      const result = (await service.generateTokenContracts(50, 0)) as Extract<
        Awaited<ReturnType<TokensService['generateTokenContracts']>>,
        { processedTokens: number; totalContractsAdded: number }
      >;
      expect(result.processedTokens).toBe(1);

      expect(result.success).toBe(true);
      expect(result.totalContractsAdded).toBe(1);
    });

    it('should skip if token already has contracts', async () => {
      tokenModel.countDocuments.mockResolvedValue(1);
      tokenModel.find.mockReturnValue(
        createMockQuery([{ id: 'btc', _id: '1' }]),
      );
      tokenContractModel.countDocuments.mockReturnValue(createMockQuery(1)); // Exists

      const result = (await service.generateTokenContracts()) as Extract<
        Awaited<ReturnType<TokensService['generateTokenContracts']>>,
        { skippedTokens: number }
      >;
      expect(result.processedTokens).toBe(0); // It increments skippedTokens, but loop continues
      expect(result.skippedTokens).toBe(1);
    });

    it('should handle rate limits 429 inside loop', async () => {
      tokenModel.countDocuments.mockResolvedValue(1);
      tokenModel.find.mockReturnValue(
        createMockQuery([{ id: 'btc', _id: '1' }]),
      );
      tokenContractModel.countDocuments.mockReturnValue(createMockQuery(0));

      coingeckoService.listCoinsWithPlatforms.mockRejectedValue({
        response: { status: 429 },
      });

      const result = await service.generateTokenContracts();
      // It breaks the loop
      expect(result.success).toBe(true); // It returns the summary so far
    });
  });

  describe('updateTokenImages', () => {
    it('should update images', async () => {
      tokenModel.countDocuments.mockResolvedValue(1);
      const mockToken = { id: 'btc' };
      tokenModel.find.mockReturnValue(createMockQuery([mockToken]));

      coingeckoService.getCoinById.mockResolvedValue({
        id: 'btc',
        image: { thumb: 't', small: 's', large: 'l' },
      });

      const result = (await service.updateTokenImages()) as Extract<
        Awaited<ReturnType<TokensService['updateTokenImages']>>,
        { updated: number }
      >;
      expect(tokenModel.updateOne).toHaveBeenCalled();
      expect(result.updated).toBe(1);
    });

    it('should skip if image exists', async () => {
      tokenModel.countDocuments.mockResolvedValue(1);
      const mockToken = {
        id: 'btc',
        image: { thumb: 't', small: 's', large: 'l' },
      };
      tokenModel.find.mockReturnValue(createMockQuery([mockToken]));

      const result = (await service.updateTokenImages()) as Extract<
        Awaited<ReturnType<TokensService['updateTokenImages']>>,
        { alreadyHasImage: number }
      >;
      expect(result.alreadyHasImage).toBe(1);
      expect(tokenModel.updateOne).not.toHaveBeenCalled();
    });

    it('should handle 429 error', async () => {
      tokenModel.countDocuments.mockResolvedValue(1);
      tokenModel.find.mockReturnValue(createMockQuery([{ id: 'btc' }]));
      coingeckoService.getCoinById.mockRejectedValue({
        response: { status: 429 },
      });

      const result = (await service.updateTokenImages()) as Extract<
        Awaited<ReturnType<TokensService['updateTokenImages']>>,
        { errors: number }
      >;
      // Loop breaks
      expect(result.errors).toBe(1);
    });

    it('should handle generic error', async () => {
      tokenModel.countDocuments.mockRejectedValue(new Error('Fail'));
      const result = await service.updateTokenImages();
      expect(result.success).toBe(false);
    });
  });

  describe('handleTokenImageUpdate', () => {
    it('should log success', async () => {
      tokenModel.countDocuments.mockResolvedValue(0);
      tokenModel.find.mockReturnValue(createMockQuery([]));

      await service.handleTokenImageUpdate();
    });
  });

  describe('updateTokenImage', () => {
    it('should update single token', async () => {
      tokenModel.updateOne.mockReturnValue(createMockQuery({}));
      await service.updateTokenImage('btc', {
        thumb: 't',
        small: 's',
        large: 'l',
      });
      expect(tokenModel.updateOne).toHaveBeenCalled();
    });
  });

  describe('addAddressToNativeToken', () => {
    it('should add native token addresses', async () => {
      coingeckoService.getAssetPlatformsList.mockResolvedValue([
        { id: 'eth', native_coin_id: 'ethereum', name: 'Ethereum' },
      ]);

      const tokenId = new Types.ObjectId();
      tokenModel.findOne.mockReturnValue(
        createMockQuery({ _id: tokenId, symbol: 'ETH', name: 'Ethereum' }),
      );

      tokenContractModel.findOne.mockReturnValue(createMockQuery(null)); // Not exists
      tokenContractModel.create.mockResolvedValue({});

      const result = (await service.addAddressToNativeToken()) as Extract<
        Awaited<ReturnType<TokensService['addAddressToNativeToken']>>,
        { added: number }
      >;
      expect(result.added).toBe(1);
      expect(tokenContractModel.create).toHaveBeenCalled();
    });

    it('should skip if native coin id missing', async () => {
      coingeckoService.getAssetPlatformsList.mockResolvedValue([
        { id: 'eth' }, // no native_coin_id
      ]);
      const result = (await service.addAddressToNativeToken()) as Extract<
        Awaited<ReturnType<TokensService['addAddressToNativeToken']>>,
        { skipped: number }
      >;
      expect(result.skipped).toBe(1);
    });

    it('should skip if token not found in db', async () => {
      coingeckoService.getAssetPlatformsList.mockResolvedValue([
        { id: 'eth', native_coin_id: 'ethereum' },
      ]);
      tokenModel.findOne.mockReturnValue(createMockQuery(null));
      const result = (await service.addAddressToNativeToken()) as Extract<
        Awaited<ReturnType<TokensService['addAddressToNativeToken']>>,
        { errors: number }
      >;
      expect(result.errors).toBe(1);
    });

    it('should skip if native token contract already exists', async () => {
      coingeckoService.getAssetPlatformsList.mockResolvedValue([
        { id: 'eth', native_coin_id: 'ethereum', name: 'Ethereum' },
      ]);
      tokenModel.findOne.mockReturnValue(
        createMockQuery({ _id: '123', symbol: 'ETH' }),
      );
      tokenContractModel.findOne.mockReturnValue(
        createMockQuery({ _id: 'contract' }),
      ); // Exists

      const result = (await service.addAddressToNativeToken()) as Extract<
        Awaited<ReturnType<TokensService['addAddressToNativeToken']>>,
        { skipped: number }
      >;
      expect(result.skipped).toBe(1);
      expect(tokenContractModel.create).not.toHaveBeenCalled();
    });

    it('should catch global errors', async () => {
      coingeckoService.getAssetPlatformsList.mockRejectedValue(
        new Error('Fail'),
      );
      const result = await service.addAddressToNativeToken();
      expect(result.success).toBe(false);
    });
  });

  describe('remove', () => {
    it('should delete token', async () => {
      const id = new Types.ObjectId();
      tokenModel.findOneAndDelete.mockReturnValue(createMockQuery({}));
      await service.remove(id);
      expect(tokenModel.findOneAndDelete).toHaveBeenCalledWith({ _id: id });
    });
  });

  describe('addTokenById', () => {
    it('should add token', async () => {
      coingeckoService.getCoinById.mockResolvedValue({
        id: 'btc',
        symbol: 'btc',
        name: 'Bitcoin',
        image: {},
      });
      tokenModel.updateOne.mockReturnValue(createMockQuery({}));

      await service.addTokenById('btc');
      expect(tokenModel.updateOne).toHaveBeenCalled();
    });

    it('should handle error', async () => {
      coingeckoService.getCoinById.mockRejectedValue(new Error('Fail'));
      const result = await service.addTokenById('btc');
      expect(result).toBeNull();
    });
  });

  describe('getHistoricalPrices', () => {
    it('should return cached data if fresh', async () => {
      const tokenId = new Types.ObjectId();
      tokenModel.findOne.mockReturnValue(createMockQuery({ _id: tokenId }));

      const recentDate = new Date(); // now
      const prices = [{ date: recentDate, price: 100 }];

      tokenHistoricalPriceModel.findOne.mockReturnValue(
        createMockQuery({
          newestDataPoint: recentDate,
          dailyPrices: prices,
        }),
      );

      // Current price fetch
      coingeckoService.getCurrentPrice.mockResolvedValue({
        bitcoin: {
          usd: 101,
          usd_24h_vol: 1000,
          usd_market_cap: 10000,
          last_updated_at: Date.now() / 1000,
        },
      });

      const result = (await service.getHistoricalPrices(
        'bitcoin',
        30,
      )) as Exclude<
        Awaited<ReturnType<TokensService['getHistoricalPrices']>>,
        NotFoundException
      >;
      expect(result.prices.length).toBeGreaterThan(0);
    });

    it('should update if data is stale', async () => {
      const tokenId = new Types.ObjectId();
      tokenModel.findOne.mockReturnValue(createMockQuery({ _id: tokenId }));

      const oldDate = new Date(Date.now() - 2 * 24 * 3600 * 1000); // 2 days ago
      const mockData = {
        newestDataPoint: oldDate,
        dailyPrices: [{ date: oldDate, price: 90 }],
        save: jest.fn(),
      };
      tokenHistoricalPriceModel.findOne
        .mockReturnValueOnce(createMockQuery(mockData)) // First check
        .mockReturnValueOnce(createMockQuery(mockData)); // After update check

      // Mocks for updateHistoricalPrices logic
      coingeckoService.getHistoricalMarketData.mockResolvedValue({
        prices: [[Date.now(), 100]],
        total_volumes: [[Date.now(), 1000]],
        market_caps: [[Date.now(), 10000]],
      });

      const result = await service.getHistoricalPrices('bitcoin', 30);
      expect(coingeckoService.getHistoricalMarketData).toHaveBeenCalled();
    });

    it('should fetch new if no data exists', async () => {
      const tokenId = new Types.ObjectId();
      tokenModel.findOne.mockReturnValue(createMockQuery({ _id: tokenId }));
      tokenHistoricalPriceModel.findOne
        .mockReturnValueOnce(createMockQuery(null)) // Init check
        .mockReturnValueOnce(createMockQuery({ dailyPrices: [] })); // Post update check

      coingeckoService.getHistoricalMarketData.mockResolvedValue({
        prices: [[Date.now(), 100]],
        total_volumes: [],
        market_caps: [],
      });

      tokenHistoricalPriceModel.create.mockResolvedValue({});

      await service.getHistoricalPrices('bitcoin', 30);
      expect(tokenHistoricalPriceModel.create).toHaveBeenCalled();
    });

    it('should throw NotFound if token missing', async () => {
      tokenModel.findOne.mockReturnValue(createMockQuery(null));
      coingeckoService.getCoinById.mockRejectedValue(new Error('Not found'));

      await expect(service.getHistoricalPrices('unknown', 30)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should add token if missing but found in coingecko', async () => {
      tokenModel.findOne.mockReturnValueOnce(createMockQuery(null)); // Not in DB

      // Mock adding
      coingeckoService.getCoinById.mockResolvedValue({ id: 'btc', image: {} });
      tokenModel.updateOne.mockResolvedValue({});

      // Second find
      tokenModel.findOne.mockReturnValueOnce(createMockQuery({ _id: '123' }));

      tokenHistoricalPriceModel.findOne.mockReturnValue(createMockQuery(null));
      coingeckoService.getHistoricalMarketData.mockResolvedValue({
        prices: [[Date.now(), 100]],
        total_volumes: [],
        market_caps: [],
      });
      tokenHistoricalPriceModel.create.mockResolvedValue({});

      await service.getHistoricalPrices('btc', 30);
      expect(tokenModel.updateOne).toHaveBeenCalled();
    });
  });

  describe('updateHistoricalPrices', () => {
    it('should not update if data is already today', async () => {
      const tokenId = new Types.ObjectId();
      const today = new Date();
      const mockData = {
        newestDataPoint: today,
        dailyPrices: [],
        save: jest.fn(),
      };
      tokenHistoricalPriceModel.findOne.mockReturnValue(
        createMockQuery(mockData),
      );

      await service.updateHistoricalPrices(tokenId, 'btc');
      expect(coingeckoService.getHistoricalMarketData).not.toHaveBeenCalled();
    });
  });

  describe('batchUpdateHistoricalPrices', () => {
    it('should update multiple tokens', async () => {
      tokenModel.findOne.mockReturnValue(
        createMockQuery({ _id: new Types.ObjectId() }),
      );
      // Mock updateHistoricalPrices internal flow via mocks
      tokenHistoricalPriceModel.findOne.mockReturnValue(createMockQuery(null)); // No history
      coingeckoService.getHistoricalMarketData.mockResolvedValue({
        prices: [],
        total_volumes: [],
        market_caps: [],
      });
      tokenHistoricalPriceModel.create.mockResolvedValue({});

      const result = await service.batchUpdateHistoricalPrices(
        ['btc', 'eth'],
        1,
      );
      expect(result.success).toBe(2);
    });

    it('should tally failures', async () => {
      tokenModel.findOne.mockReturnValue(createMockQuery(null));
      const result = await service.batchUpdateHistoricalPrices(['unknown'], 1);
      expect(result.failed).toBe(1);
    });
  });

  describe('findTokenContractByChain', () => {
    it('should find contracts', async () => {
      tokenContractModel.find.mockReturnValue(createMockQuery([]));
      await service.findTokenContractByChain('ethereum' as any);
      expect(tokenContractModel.find).toHaveBeenCalledWith({
        chainId: 'ethereum',
      });
    });
  });
});

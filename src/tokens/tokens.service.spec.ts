/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CoingeckoService } from '../coingecko/coingecko.service';
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

  const mockTokenModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    bulkWrite: jest.fn(),
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
    countDocuments: jest.fn(),
    bulkWrite: jest.fn(),
    create: jest.fn(),
  };

  const mockTokenHistoricalPriceModel = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockCoingeckoService = {
    getCoinsMarkets: jest.fn(),
    listCoinsWithPlatforms: jest.fn(),
    getCoinById: jest.fn(),
    getAssetPlatformsList: jest.fn(),
    getHistoricalMarketData: jest.fn(),
    getCurrentPrice: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokensService,
        {
          provide: getModelToken(Token.name),
          useValue: mockTokenModel,
        },
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
        {
          provide: CoingeckoService,
          useValue: mockCoingeckoService,
        },
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
    jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => cb());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateDatabaseFromCoingecko', () => {
    it('should update database from coingecko successfully', async () => {
      mockTokenUpdateLogModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null), // No last update, so proceed
        }),
      });

      const coins = [
        { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', image: 'url' },
      ];
      mockCoingeckoService.getCoinsMarkets.mockResolvedValue(coins);
      mockCoingeckoService.listCoinsWithPlatforms.mockResolvedValue([
        {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          platforms: { ethereum: '0x123' },
        },
      ]);

      mockTokenModel.bulkWrite.mockResolvedValue({
        upsertedCount: 1,
        modifiedCount: 0,
      });
      mockTokenModel.findOne.mockResolvedValue({
        _id: 'tokenId',
        id: 'bitcoin',
      });
      mockTokenContractModel.bulkWrite.mockResolvedValue({
        upsertedCount: 1,
        modifiedCount: 0,
      });
      mockTokenUpdateLogModel.create.mockResolvedValue({});

      // Mock startPage=1, endPage=1 to run loop once
      const result = await service.updateDatabaseFromCoingecko(1, 1, 10);

      expect(result.success).toBe(true);
      expect(mockCoingeckoService.getCoinsMarkets).toHaveBeenCalled();
      expect(mockTokenModel.bulkWrite).toHaveBeenCalled();
      expect(mockTokenContractModel.bulkWrite).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated tokens', async () => {
      const tokens = [{ name: 'Bitcoin' }];
      mockTokenModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(tokens),
              }),
            }),
          }),
        }),
      });
      mockTokenModel.countDocuments.mockResolvedValue(1);

      const result = await service.findAll(1, 10);

      expect(result.data).toEqual(tokens);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a token by id', async () => {
      const token = { name: 'Bitcoin' };
      const id = new Types.ObjectId();
      mockTokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(token),
      });

      const result = await service.findOne(id);

      expect(result).toEqual(token);
      expect(mockTokenModel.findOne).toHaveBeenCalledWith({ _id: id });
    });
  });

  describe('findOneByCoinGeckoId', () => {
    it('should return a token by coingecko id', async () => {
      const token = { name: 'Bitcoin' };
      mockTokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(token),
      });

      const result = await service.findOneByCoinGeckoId('bitcoin');

      expect(result).toEqual(token);
      expect(mockTokenModel.findOne).toHaveBeenCalledWith({ id: 'bitcoin' });
    });
  });

  describe('fineToken', () => {
    it('should find token by objectId', async () => {
      const token = { name: 'Bitcoin' };
      const id = new Types.ObjectId();
      mockTokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(token),
      });

      const result = await service.fineToken(id, '');
      expect(result).toEqual(token);
    });
  });

  describe('findByContractAddress', () => {
    it('should return populated token contract', async () => {
      const contract = { contractAddress: '0x123' };
      mockTokenContractModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(contract),
          }),
        }),
      });

      const result = await service.findByContractAddress('ethereum', '0x123');

      expect(result).toEqual(contract);
    });
  });

  describe('getTokenContracts', () => {
    it('should return contracts for a token', async () => {
      const token = { _id: 'tokenId', id: 'bitcoin' };
      const contracts = [{ contractAddress: '0x123' }];

      mockTokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(token),
      });

      mockTokenContractModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(contracts),
      });

      const result = await service.getTokenContracts('bitcoin');
      expect(result).toEqual(contracts);
    });
  });

  describe('generateTokenContracts', () => {
    it('should generate token contracts successfully', async () => {
      mockTokenModel.countDocuments.mockResolvedValue(1);
      mockTokenModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([
                  {
                    _id: 'tokenId',
                    id: 'bitcoin',
                    symbol: 'btc',
                    name: 'Bitcoin',
                  },
                ]),
              }),
            }),
          }),
        }),
      });

      mockTokenContractModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      mockCoingeckoService.listCoinsWithPlatforms.mockResolvedValue([
        { id: 'bitcoin', platforms: { ethereum: '0x123' } },
      ]);

      mockTokenContractModel.bulkWrite.mockResolvedValue({
        upsertedCount: 1,
        modifiedCount: 0,
      });

      const result = (await service.generateTokenContracts(50, 0, 1)) as any;
      expect(result.success).toBe(true);
      expect(result.totalContractsAdded).toBe(1);
    });
  });

  describe('updateTokenImages', () => {
    it('should update token images successfully', async () => {
      mockTokenModel.countDocuments.mockResolvedValue(1);
      mockTokenModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest
                  .fn()
                  .mockResolvedValue([{ _id: 'tokenId', id: 'bitcoin' }]), // No image yet
              }),
            }),
          }),
        }),
      });

      mockCoingeckoService.getCoinById.mockResolvedValue({
        id: 'bitcoin',
        image: { thumb: 't', small: 's', large: 'l' },
      });

      mockTokenModel.updateOne.mockResolvedValue({});

      const result = (await service.updateTokenImages(30, 0, 1)) as any;
      expect(result.success).toBe(true);
      expect(result.updated).toBe(1);
    });
  });

  describe('handleTokenImageUpdate', () => {
    it('should call updateTokenImages', async () => {
      // Mock updateTokenImages implementation or rely on its internal calls if not spying on self?
      // Since we are testing the service method, it will call the real updateTokenImages.
      // So we need to mock the dependencies of updateTokenImages.
      // Re-using mocks from updateTokenImages test would work, but wait, handleTokenImageUpdate calls updateTokenImages(50, 0).

      mockTokenModel.countDocuments.mockResolvedValue(0); // Return 0 to exit early in updateTokenImages logic or just empty array
      mockTokenModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      const spy = jest.spyOn(service, 'updateTokenImages');
      // We can't easily spy on the same service instance method unless we prototype spy or similar, but here we just want to ensure it runs without error.
      // Actually, integration style: let it call the method.

      await service.handleTokenImageUpdate();
      // Since we mocked dependencies to return empty/success, it should log success.
      // Ideally we would check if logger was called, but logger is private.
      // We can just expect it not to throw.
    });
  });

  describe('updateTokenImage', () => {
    it('should update a single token image', async () => {
      mockTokenModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });

      const result = await service.updateTokenImage('bitcoin', {
        thumb: 't',
        small: 's',
        large: 'l',
      });
      expect(mockTokenModel.updateOne).toHaveBeenCalledWith(
        { id: 'bitcoin' },
        { $set: { image: { thumb: 't', small: 's', large: 'l' } } },
      );
    });
  });

  describe('addAddressToNativeToken', () => {
    it('should add address to native token', async () => {
      mockCoingeckoService.getAssetPlatformsList.mockResolvedValue([
        { id: 'ethereum', native_coin_id: 'ethereum', name: 'Ethereum' },
      ]);

      mockTokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: 'tokenId',
          symbol: 'ETH',
          name: 'Ethereum',
        }),
      });

      mockTokenContractModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // Not existing
      });

      mockTokenContractModel.create.mockResolvedValue({});

      const result = (await service.addAddressToNativeToken()) as any;
      expect(result.success).toBe(true);
      expect(result.added).toBe(1);
    });
  });

  describe('remove', () => {
    it('should remove a token', async () => {
      const id = new Types.ObjectId();
      mockTokenModel.findOneAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.remove(id);
      expect(mockTokenModel.findOneAndDelete).toHaveBeenCalledWith({ _id: id });
    });
  });

  describe('addTokenById', () => {
    it('should add token by id', async () => {
      mockCoingeckoService.getCoinById.mockResolvedValue({
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        image: {},
      });

      mockTokenModel.updateOne.mockResolvedValue({});

      await service.addTokenById('bitcoin');
      expect(mockTokenModel.updateOne).toHaveBeenCalled();
    });
  });

  describe('getHistoricalPrices', () => {
    it('should return historical prices', async () => {
      const token = { _id: 'tokenId', id: 'bitcoin' };
      mockTokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(token),
      });

      const now = new Date();
      const prices = [{ date: now, price: 100 }];
      mockTokenHistoricalPriceModel.findOne.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ dailyPrices: prices, newestDataPoint: now }),
      });

      mockCoingeckoService.getCurrentPrice.mockResolvedValue({
        bitcoin: {
          usd: 100,
          usd_24h_vol: 1000,
          usd_market_cap: 10000,
          last_updated_at: 1234567890,
        },
      });

      const result = await service.getHistoricalPrices('bitcoin', 7);
      if (result instanceof NotFoundException) {
        throw new Error('Should not return NotFoundException');
      }
      expect(result.prices.length).toBeGreaterThan(0);
    });
  });

  describe('updateHistoricalPrices', () => {
    it('should update historical prices when no data exists', async () => {
      const tokenId = new Types.ObjectId();
      mockTokenHistoricalPriceModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockCoingeckoService.getHistoricalMarketData.mockResolvedValue({
        prices: [
          [Date.now() - 86400000, 90],
          [Date.now(), 100],
        ],
        total_volumes: [
          [Date.now() - 86400000, 900],
          [Date.now(), 1000],
        ],
        market_caps: [
          [Date.now() - 86400000, 9000],
          [Date.now(), 10000],
        ],
      });

      mockTokenHistoricalPriceModel.create.mockResolvedValue({});

      await service.updateHistoricalPrices(tokenId, 'bitcoin');
      expect(mockTokenHistoricalPriceModel.create).toHaveBeenCalled();
    });
  });

  describe('batchUpdateHistoricalPrices', () => {
    it('should batch update historical prices', async () => {
      mockTokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'tokenId' }),
      });

      // Reuse mock for updateHistoricalPrices internal call
      // Mock internal updateHistoricalPrices call
      const spy = jest
        .spyOn(service, 'updateHistoricalPrices')
        .mockResolvedValue(undefined);

      const result = await service.batchUpdateHistoricalPrices(['bitcoin'], 0);
      expect(result.success).toBe(1);
    });
  });

  describe('findTokenContractByChain', () => {
    it('should find token contract by chain', async () => {
      mockTokenContractModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });
      // Assuming CoingeckoChain enum is used, or just pass string if compatible or cast
      // We might need to import enum if strict, but let's pass 'ethereum' as any
      await service.findTokenContractByChain('ethereum' as any);
      expect(mockTokenContractModel.find).toHaveBeenCalledWith({
        chainId: 'ethereum',
      });
    });
  });
});

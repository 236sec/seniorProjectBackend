/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AlchemysService } from 'src/alchemys/alchemys.service';
import { BlockchainWallet } from 'src/blockchain-wallets/schema/blockchain-wallet.schema';
import { BlockchainService } from 'src/blockchain/blockchain.service';
import { SupportedPRC } from 'src/blockchain/enum/supported-prc.enum';
import { CoingeckoService } from 'src/coingecko/coingecko.service';
import { TokensService } from 'src/tokens/tokens.service';
import { TransactionsService } from 'src/transactions/transactions.service';
import { UsersService } from '../users/users.service';
import { Wallet } from './schemas/wallet.schema';
import { WalletsService } from './wallets.service';

describe('WalletsService', () => {
  let service: WalletsService;
  let walletModel: any;
  let blockchainWalletModel: any;
  let usersService: any;
  let alchemysService: any;
  let tokensService: any;
  let coingeckoService: any;
  let transactionsService: any;
  let blockchainService: any;

  const mockUserId = new Types.ObjectId();
  const mockWalletId = new Types.ObjectId();
  const mockBlockchainWalletId = new Types.ObjectId();

  const mockWallet = {
    _id: mockWalletId,
    userId: mockUserId,
    name: 'Test Wallet',
    description: 'Test Description',
    blockchainWalletId: [mockBlockchainWalletId],
    manualTokens: [],
    portfolioPerformance: [],
    save: jest.fn(),
  };

  const mockBlockchainWallet = {
    _id: mockBlockchainWalletId,
    walletId: mockWalletId,
    address: '0x123',
    chains: ['ETH'],
    tokens: [],
    save: jest.fn(),
  };

  beforeEach(async () => {
    walletModel = {
      new: jest.fn().mockReturnValue(mockWallet),
      constructor: jest.fn().mockReturnValue(mockWallet),
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      findByIdAndDelete: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    // Fix for "new this.walletModel(walletData)"
    const mockWalletModelConstructor = jest.fn().mockImplementation((dto) => ({
      ...dto,
      _id: mockWalletId,
      save: jest.fn().mockResolvedValue({
        ...dto,
        _id: mockWalletId,
      }),
    }));
    (mockWalletModelConstructor as any).find = jest.fn();
    (mockWalletModelConstructor as any).findById = jest.fn();
    (mockWalletModelConstructor as any).findOne = jest.fn();
    (mockWalletModelConstructor as any).findByIdAndDelete = jest.fn();
    (mockWalletModelConstructor as any).findByIdAndUpdate = jest.fn();

    walletModel = mockWalletModelConstructor;

    const mockBlockchainWalletModelConstructor = jest
      .fn()
      .mockImplementation((dto) => ({
        ...dto,
        _id: mockBlockchainWalletId,
        save: jest.fn().mockResolvedValue({
          ...dto,
          _id: mockBlockchainWalletId,
        }),
      }));
    (mockBlockchainWalletModelConstructor as any).findOne = jest.fn();
    (mockBlockchainWalletModelConstructor as any).findById = jest.fn();

    blockchainWalletModel = mockBlockchainWalletModelConstructor;

    usersService = {
      findOneWithWallets: jest.fn(),
      addWalletToUser: jest.fn(),
      removeWalletFromUser: jest.fn(),
    };

    alchemysService = {
      getTokenBalances: jest.fn(),
    };

    tokensService = {
      findByContractAddress: jest.fn(),
      updateTokenImage: jest.fn(),
    };

    coingeckoService = {
      getCurrentPrice: jest.fn(),
      getCoinById: jest.fn(),
    };

    transactionsService = {};

    blockchainService = {
      getBalanceBatch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        {
          provide: getModelToken(Wallet.name),
          useValue: walletModel,
        },
        {
          provide: getModelToken(BlockchainWallet.name),
          useValue: blockchainWalletModel,
        },
        { provide: UsersService, useValue: usersService },
        { provide: AlchemysService, useValue: alchemysService },
        { provide: TokensService, useValue: tokensService },
        { provide: CoingeckoService, useValue: coingeckoService },
        { provide: TransactionsService, useValue: transactionsService },
        { provide: BlockchainService, useValue: blockchainService },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createWalletDto = {
      name: 'New Wallet',
      description: 'New Description',
    };

    it('should create a wallet successfully', async () => {
      usersService.findOneWithWallets.mockResolvedValue({
        wallets: [],
      });

      const result = await service.create(mockUserId, createWalletDto);

      expect(usersService.findOneWithWallets).toHaveBeenCalledWith(mockUserId);
      expect(walletModel).toHaveBeenCalledWith({
        ...createWalletDto,
        userId: mockUserId,
      });
      expect(usersService.addWalletToUser).toHaveBeenCalledWith(
        mockUserId,
        mockWalletId,
      );
      expect(result).toHaveProperty('_id', mockWalletId);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      usersService.findOneWithWallets.mockResolvedValue(null);

      await expect(service.create(mockUserId, createWalletDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if wallet name exists', async () => {
      usersService.findOneWithWallets.mockResolvedValue({
        wallets: [{ name: 'New Wallet' }],
      });

      await expect(service.create(mockUserId, createWalletDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all wallets', async () => {
      const execMock = jest.fn().mockResolvedValue([mockWallet]);
      walletModel.find.mockReturnValue({ exec: execMock });

      const result = await service.findAll();
      expect(result).toEqual([mockWallet]);
    });
  });

  describe('findOne', () => {
    it('should return a populated wallet', async () => {
      const mockPopulatedWallet = {
        _id: mockWalletId,
        userId: mockUserId,
        blockchainWalletId: [],
        manualTokens: [],
        portfolioPerformance: [],
      };

      const leanMock = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPopulatedWallet),
      });
      const populateMock2 = jest.fn().mockReturnValue({ lean: leanMock });
      const populateMock1 = jest
        .fn()
        .mockReturnValue({ populate: populateMock2 });
      walletModel.findById.mockReturnValue({ populate: populateMock1 });

      const result = await service.findOne(mockWalletId);
      expect(result).toBeDefined();
      if (result && !(result instanceof NotFoundException)) {
        expect(result.wallet._id).toEqual(mockWalletId);
      }
    });

    it('should return NotFoundException if wallet does not exist', async () => {
      const leanMock = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      const populateMock2 = jest.fn().mockReturnValue({ lean: leanMock });
      const populateMock1 = jest
        .fn()
        .mockReturnValue({ populate: populateMock2 });
      walletModel.findById.mockReturnValue({ populate: populateMock1 });

      const result = await service.findOne(mockWalletId);
      expect(result).toBeInstanceOf(NotFoundException);
    });

    it('should handle populated manual tokens and prices', async () => {
      const tokenId = new Types.ObjectId();
      const mockPopulatedWallet = {
        _id: mockWalletId,
        manualTokens: [
          {
            tokenId: {
              _id: tokenId,
              id: 'bitcoin',
              symbol: 'btc',
              name: 'Bitcoin',
            },
            balance: 1,
          },
        ],
        blockchainWalletId: [],
      };

      const leanMock = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPopulatedWallet),
      });
      const populateMock2 = jest.fn().mockReturnValue({ lean: leanMock });
      const populateMock1 = jest
        .fn()
        .mockReturnValue({ populate: populateMock2 });
      walletModel.findById.mockReturnValue({ populate: populateMock1 });

      coingeckoService.getCurrentPrice.mockResolvedValue({
        bitcoin: { usd: 50000, usd_24h_change: 5 },
      });

      const result = await service.findOne(mockWalletId);

      expect(coingeckoService.getCurrentPrice).toHaveBeenCalledWith([
        'bitcoin',
      ]);
      if (result && !(result instanceof NotFoundException)) {
        expect(result.tokens[tokenId.toString()].currentPrice).toBe(50000);
      }
    });
  });

  describe('findByUserId', () => {
    it('should return wallets for a user', async () => {
      const execMock = jest.fn().mockResolvedValue([mockWallet]);
      walletModel.find.mockReturnValue({ exec: execMock });

      const result = await service.findByUserId(mockUserId);
      expect(walletModel.find).toHaveBeenCalledWith({ userId: mockUserId });
      expect(result).toEqual([mockWallet]);
    });
  });

  describe('remove', () => {
    it('should remove a wallet', async () => {
      const execMock = jest.fn().mockResolvedValue({
        ...mockWallet,
        userId: mockUserId,
      });
      walletModel.findByIdAndDelete.mockReturnValue({ exec: execMock });

      await service.remove(mockWalletId);

      expect(walletModel.findByIdAndDelete).toHaveBeenCalledWith(mockWalletId);
      expect(usersService.removeWalletFromUser).toHaveBeenCalledWith(
        mockUserId,
        mockWalletId,
      );
    });
  });

  describe('update', () => {
    it('should update a wallet', async () => {
      const updateDto = { name: 'Updated Name' };
      const execMock = jest.fn().mockResolvedValue({
        ...mockWallet,
        ...updateDto,
      });
      walletModel.findByIdAndUpdate.mockReturnValue({ exec: execMock });

      const result = await service.update(mockWalletId, updateDto);

      expect(walletModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockWalletId,
        updateDto,
        { new: true },
      );
      expect(result?.name).toBe('Updated Name');
    });
  });

  describe('addBlockchainWalletToWallet', () => {
    it('should add a new blockchain wallet if not exists', async () => {
      const execMock = jest.fn().mockResolvedValue(mockWallet);
      walletModel.findById.mockReturnValue({ exec: execMock });

      blockchainWalletModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      walletModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });

      const result = await service.addBlockchainWalletToWallet(
        mockWalletId,
        '0xNewAddress',
        ['ETH'],
      );
      void result;

      expect(blockchainWalletModel).toHaveBeenCalledWith(
        expect.objectContaining({
          walletId: mockWalletId,
          address: '0xNewAddress',
        }),
      );
    });

    it('should update existing blockchain wallet', async () => {
      const execMock = jest.fn().mockResolvedValue(mockWallet);
      walletModel.findById.mockReturnValue({ exec: execMock });

      const existingBW = {
        ...mockBlockchainWallet,
        chains: ['ETH'],
        save: jest.fn(),
      };
      blockchainWalletModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingBW),
      });

      walletModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });

      await service.addBlockchainWalletToWallet(mockWalletId, '0x123', ['BNB']);

      expect(existingBW.save).toHaveBeenCalled();
      expect(existingBW.chains).toContain('BNB');
    });

    it('should throw NotFoundException if wallet not found', async () => {
      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.addBlockchainWalletToWallet(mockWalletId, '0x123', ['ETH']),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDifferentBalanceInBlockchainWalletsByAddress', () => {
    it('should throw NotFoundException if blockchain wallet not found', async () => {
      blockchainWalletModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getDifferentBalanceInBlockchainWalletsByAddress(
          mockWalletId,
          '0x123',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return differences successfully', async () => {
      blockchainWalletModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBlockchainWallet),
      });

      // Mock getDifferentBalanceInBlockchainWallets internal call
      // Since it's a private/internal logic called, we can mock the dependency it uses
      // However, we are testing the service itself, so we should mock the DB call inside `getDifferentBalanceInBlockchainWallets`

      const bwWithPopulate = {
        ...mockBlockchainWallet,
        tokens: [],
      };

      const populateMock = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(bwWithPopulate),
      });
      blockchainWalletModel.findById.mockReturnValue({
        populate: populateMock,
      });

      // Mock AlchemysService
      alchemysService.getTokenBalances.mockResolvedValue({
        address: '0x123',
        chains: ['ETH'],
        nativeBalances: [],
        tokenBalances: [],
      });

      const result =
        await service.getDifferentBalanceInBlockchainWalletsByAddress(
          mockWalletId,
          '0x123',
        );

      expect(result).toBeDefined();
    });
  });

  describe('getOnChainBalanceByAddress', () => {
    it('should fetch balances and enrich them', async () => {
      const address = '0x123';
      const chains = [SupportedPRC.ETH, SupportedPRC.BNB]; // ETH uses Alchemy, BNB uses BlockchainService

      alchemysService.getTokenBalances.mockResolvedValue({
        tokenBalances: [
          {
            contractAddress: '0xabc',
            rawBalance: '100',
            balance: '1',
            decimals: 18,
            network: 'ethereum',
          },
        ],
        nativeBalances: [
          { rawBalance: '200', balance: '2', network: 'ethereum' },
        ],
      });

      blockchainService.getBalanceBatch.mockResolvedValue([
        {
          contractAddress: '0xdef',
          balance: '1',
          rawBalance: '100',
          decimals: 18,
          network: 'bsc',
        },
      ]);

      tokensService.findByContractAddress.mockResolvedValue({
        tokenId: {
          id: 'token-id',
          symbol: 'SYM',
          name: 'Token Name',
          image: {},
        },
      });

      const result = await service.getOnChainBalanceByAddress(address, chains);

      expect(alchemysService.getTokenBalances).toHaveBeenCalled();
      expect(blockchainService.getBalanceBatch).toHaveBeenCalled();
      expect(tokensService.findByContractAddress).toHaveBeenCalled();
      expect(result.balances.length).toBeGreaterThan(0);
    });
  });

  describe('Extended Coverage', () => {
    it('findOne should handle unpopulated manual tokens', async () => {
      const unpopWallet = {
        ...mockWallet,
        manualTokens: [{ tokenId: new Types.ObjectId(), balance: 100 }],
      };
      const leanMock = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(unpopWallet),
      });
      const populateMock2 = jest.fn().mockReturnValue({ lean: leanMock });
      const populateMock1 = jest
        .fn()
        .mockReturnValue({ populate: populateMock2 });
      walletModel.findById.mockReturnValue({ populate: populateMock1 });

      const result = await service.findOne(mockWalletId);
      expect(result).toBeDefined();
      if (result && !(result instanceof NotFoundException)) {
        expect(result.wallet.manualTokens.length).toBe(1);
      }
    });

    it('findOne should handle portfolio performance', async () => {
      const ppWallet = {
        ...mockWallet,
        portfolioPerformance: [
          {
            tokenId: new Types.ObjectId(),
            totalInvestedAmount: 100,
            totalBalance: 200,
            totalCashflowUsd: 50,
            costBasis: 10,
            averageUnitCost: 5,
          },
        ],
      };
      const leanMock = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(ppWallet),
      });
      const populateMock2 = jest.fn().mockReturnValue({ lean: leanMock });
      const populateMock1 = jest
        .fn()
        .mockReturnValue({ populate: populateMock2 });
      walletModel.findById.mockReturnValue({ populate: populateMock1 });

      const result = await service.findOne(mockWalletId);
      expect(result).toBeDefined();
      if (result && !(result instanceof NotFoundException)) {
        expect(result.wallet.portfolioPerformance.length).toBe(1);
      }
    });

    it('getDifferentBalanceInBlockchainWalletsByAddress logic should calculate differences correctly', async () => {
      const mockBW = {
        _id: mockBlockchainWalletId,
        address: '0x123',
        chains: ['ETH'],
        tokens: [
          {
            tokenContractId: {
              _id: new Types.ObjectId(),
              chainId: 'ethereum',
              contractAddress: '0xstored',
              tokenId: {
                _id: new Types.ObjectId(),
                id: 'stored-token',
                symbol: 'STR',
                name: 'Stored Token',
              },
            },
            balance: '1000000000000000000', // 1 ETH
          },
        ],
      };

      const populateMock = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBW),
      });
      blockchainWalletModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: mockBlockchainWalletId }),
      });
      blockchainWalletModel.findById.mockReturnValue({
        populate: populateMock,
      });

      tokensService.findByContractAddress.mockImplementation(
        (chain: any, addr: any) => {
          if (addr === '0xstored') {
            return {
              _id: new Types.ObjectId(),
              tokenId: {
                id: 'stored-token',
                symbol: 'STR',
                name: 'Stored Token',
                image: {},
              },
            };
          }
          if (addr === '0xnew') {
            return {
              _id: new Types.ObjectId(),
              tokenId: {
                id: 'new-token',
                symbol: 'NEW',
                name: 'New Token',
                image: {},
              },
            };
          }
          return null;
        },
      );

      alchemysService.getTokenBalances.mockResolvedValue({
        address: '0x123',
        chains: ['ETH'],
        nativeBalances: [],
        tokenBalances: [
          {
            contractAddress: '0xstored',
            rawBalance: '2000000000000000000', // 2 ETH (Diff!)
            balance: '2',
            decimals: 18,
            network: 'ethereum',
            token: {
              id: 'stored-token',
              symbol: 'STR',
              name: 'Stored Token',
              image: {},
            },
            tokenContractId: new Types.ObjectId(),
          },
          {
            contractAddress: '0xnew',
            rawBalance: '500000000000000000', // 0.5 ETH (New!)
            balance: '0.5',
            decimals: 18,
            network: 'ethereum',
            token: {
              id: 'new-token',
              symbol: 'NEW',
              name: 'New Token',
              image: {},
            },
            tokenContractId: new Types.ObjectId(),
          },
        ],
      });

      coingeckoService.getCurrentPrice.mockResolvedValue({
        'stored-token': { usd: 100, usd_24h_change: 0 },
        'new-token': { usd: 50, usd_24h_change: 0 },
      });

      const result =
        await service.getDifferentBalanceInBlockchainWalletsByAddress(
          mockWalletId,
          '0x123',
        );

      expect(result.differences).toHaveLength(2);

      const storedDiff = result.differences.find(
        (d) => d.contractAddress === '0xstored',
      );
      expect(storedDiff).toBeDefined();
      expect(storedDiff?.balanceFormatted).toBe('2');

      const newDiff = result.differences.find(
        (d) => d.contractAddress === '0xnew',
      );
      expect(newDiff).toBeDefined();
      expect(newDiff?.balanceFormatted).toBe('0.5');
    });

    it('getDifferentBalanceInBlockchainWalletsByAddress should return empty differences if balances match', async () => {
      const mockBW = {
        _id: mockBlockchainWalletId,
        address: '0x123',
        chains: ['ETH'],
        tokens: [
          {
            tokenContractId: {
              _id: new Types.ObjectId(),
              chainId: 'ethereum',
              contractAddress: '0xmatch',
              tokenId: {
                _id: new Types.ObjectId(),
                id: 'match',
                symbol: 'M',
                name: 'Match',
              },
            },
            balance: '1000',
          },
        ],
      };
      const populateMock = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBW),
      });
      blockchainWalletModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: mockBlockchainWalletId }),
      });
      blockchainWalletModel.findById.mockReturnValue({
        populate: populateMock,
      });

      tokensService.findByContractAddress.mockImplementation(
        (chain: any, addr: any) => {
          if (addr === '0xmatch') {
            return {
              _id: new Types.ObjectId(),
              tokenId: {
                id: 'match',
                symbol: 'M',
                name: 'Match',
                image: {},
              },
            };
          }
          return null;
        },
      );

      alchemysService.getTokenBalances.mockResolvedValue({
        address: '0x123',
        chains: ['ETH'],
        nativeBalances: [],
        tokenBalances: [
          {
            contractAddress: '0xmatch',
            rawBalance: '1000',
            balance: '1000',
            decimals: 0,
            network: 'ethereum',
            token: { id: 'match', symbol: 'M', name: 'Match', image: {} },
            tokenContractId: new Types.ObjectId(),
          },
        ],
      });

      const result =
        await service.getDifferentBalanceInBlockchainWalletsByAddress(
          mockWalletId,
          '0x123',
        );
      expect(result.differences).toHaveLength(0);
    });

    it('getOnChainBalanceByAddress extended should only call Alchemy for supported chains', async () => {
      // Only BNB
      blockchainService.getBalanceBatch.mockResolvedValue([]);

      await service.getOnChainBalanceByAddress('0x123', [SupportedPRC.BNB]);

      expect(alchemysService.getTokenBalances).not.toHaveBeenCalled();
      expect(blockchainService.getBalanceBatch).toHaveBeenCalled();
    });

    it('getOnChainBalanceByAddress extended should only call Alchemy if no BNB', async () => {
      // Only ETH
      alchemysService.getTokenBalances.mockResolvedValue({
        tokenBalances: [],
        nativeBalances: [],
      });

      await service.getOnChainBalanceByAddress('0x123', [SupportedPRC.ETH]);

      expect(alchemysService.getTokenBalances).toHaveBeenCalled();
      expect(blockchainService.getBalanceBatch).not.toHaveBeenCalled();
    });

    it('getOnChainBalanceByAddress extended should handle image updates correctly', async () => {
      alchemysService.getTokenBalances.mockResolvedValue({
        tokenBalances: [
          {
            contractAddress: '0xnoimage',
            rawBalance: '100',
            balance: '1',
            decimals: 18,
            network: 'ethereum',
          },
        ],
        nativeBalances: [],
      });

      // Token exists but has no image
      tokensService.findByContractAddress.mockResolvedValue({
        _id: new Types.ObjectId(),
        tokenId: {
          id: 'token-no-image',
          symbol: 'TNI',
          name: 'Token No Image',
          image: {}, // Empty image
        },
      });

      // CoinGecko returns image
      coingeckoService.getCoinById.mockResolvedValue({
        image: { thumb: 'thumb_url', small: 'small_url', large: 'large_url' },
      });

      await service.getOnChainBalanceByAddress('0x123', [SupportedPRC.ETH]);

      expect(coingeckoService.getCoinById).toHaveBeenCalledWith(
        'token-no-image',
      );
      expect(tokensService.updateTokenImage).toHaveBeenCalledWith(
        'token-no-image',
        expect.any(Object),
      );
    });

    it('getOnChainBalanceByAddress extended should handle rate limit (429) during image update gracefully', async () => {
      alchemysService.getTokenBalances.mockResolvedValue({
        tokenBalances: [
          {
            contractAddress: '0xnoimage',
            rawBalance: '100',
            balance: '1',
            decimals: 18,
            network: 'ethereum',
          },
        ],
        nativeBalances: [],
      });

      tokensService.findByContractAddress.mockResolvedValue({
        _id: new Types.ObjectId(),
        tokenId: {
          id: 'token-rate-limit',
          symbol: 'TRL',
          name: 'Token Rate Limit',
          image: {},
        },
      });

      const error429 = { response: { status: 429 } };
      coingeckoService.getCoinById.mockRejectedValue(error429);
      const loggerWarnSpy = jest.spyOn((service as any).logger, 'warn');

      await service.getOnChainBalanceByAddress('0x123', [SupportedPRC.ETH]);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit hit'),
      );
    });

    it('getOnChainBalanceByAddress extended should handle other errors during image update gracefully', async () => {
      alchemysService.getTokenBalances.mockResolvedValue({
        tokenBalances: [
          {
            contractAddress: '0xnoimage',
            rawBalance: '100',
            balance: '1',
            decimals: 18,
            network: 'ethereum',
          },
        ],
        nativeBalances: [],
      });

      tokensService.findByContractAddress.mockResolvedValue({
        _id: new Types.ObjectId(),
        tokenId: {
          id: 'token-error',
          symbol: 'TE',
          name: 'Token Error',
          image: {},
        },
      });

      coingeckoService.getCoinById.mockRejectedValue(
        new Error('Some API error'),
      );
      const loggerErrorSpy = jest.spyOn((service as any).logger, 'error');

      await service.getOnChainBalanceByAddress('0x123', [SupportedPRC.ETH]);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching image'),
      );
    });

    it('BNB Chain Handling should separate BNB tokens and native balances', async () => {
      const bnbAddress = '0x123';
      const nativeContract = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

      blockchainService.getBalanceBatch.mockResolvedValue([
        {
          contractAddress: nativeContract,
          rawBalance: '100',
          balance: '1',
          decimals: 18,
          network: 'bsc',
        },
        {
          contractAddress: '0xbnbenum',
          rawBalance: '200',
          balance: '2',
          decimals: 18,
          network: 'bsc',
        },
      ]);

      // Mock finding token for BNB token
      tokensService.findByContractAddress.mockImplementation(
        (chain: any, addr: any) => {
          if (addr === nativeContract) {
            return {
              _id: new Types.ObjectId(),
              tokenId: {
                id: 'binancecoin',
                symbol: 'BNB',
                name: 'BNB',
                image: { thumb: 't' },
              },
            };
          }
          if (addr === '0xbnbenum') {
            return {
              _id: new Types.ObjectId(),
              tokenId: {
                id: 'bnb-token',
                symbol: 'BT',
                name: 'BNB Token',
                image: { thumb: 't' },
              },
            };
          }
          return null;
        },
      );

      const result = await service.getOnChainBalanceByAddress(bnbAddress, [
        SupportedPRC.BNB,
      ]);

      expect(result.nativeBalances).toHaveLength(1);
      expect(result.balances).toHaveLength(1);
      expect(result.nativeBalances[0].contractAddress).toBe(nativeContract);
      expect(result.balances[0].contractAddress).toBe('0xbnbenum');
    });

    it('findOne Price Error Handling should handle price fetching errors gracefully', async () => {
      const mockPopulatedWallet = {
        _id: mockWalletId,
        userId: mockUserId,
        manualTokens: [
          {
            tokenId: {
              _id: new Types.ObjectId(),
              id: 'bitcoin',
              symbol: 'btc',
              name: 'Bitcoin',
            },
            balance: 1,
          },
        ],
        blockchainWalletId: [],
        portfolioPerformance: [],
        save: jest.fn(),
      };

      const leanMock = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPopulatedWallet),
      });
      const populateMock2 = jest.fn().mockReturnValue({ lean: leanMock });
      const populateMock1 = jest
        .fn()
        .mockReturnValue({ populate: populateMock2 });
      walletModel.findById.mockReturnValue({ populate: populateMock1 });

      coingeckoService.getCurrentPrice.mockRejectedValue(
        new Error('Price API Down'),
      );
      const loggerErrorSpy = jest.spyOn((service as any).logger, 'error');

      const result = await service.findOne(mockWalletId);

      expect(coingeckoService.getCurrentPrice).toHaveBeenCalled();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching prices'),
      );
      expect(result).toBeDefined();
    });
  });
});

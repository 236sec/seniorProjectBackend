/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AlchemysService } from 'src/alchemys/alchemys.service';
import { BanksWalletsService } from 'src/banks-wallets/banks-wallets.service';
import { BlockchainWallet } from 'src/blockchain-wallets/schema/blockchain-wallet.schema';
import { BlockchainService } from 'src/blockchain/blockchain.service';
import { CoingeckoService } from 'src/coingecko/coingecko.service';
import { TokensService } from 'src/tokens/tokens.service';
import { TransactionsService } from 'src/transactions/transactions.service';
import { UsersService } from '../users/users.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
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
  let bankWalletService: any;

  // Mock Wallet Model
  function MockWalletModel(dto: any) {
    Object.assign(this, dto);
    this.save = jest.fn().mockResolvedValue({
      ...dto,
      _id: new Types.ObjectId(),
    });
  }
  MockWalletModel.find = jest.fn();
  MockWalletModel.findById = jest.fn();
  MockWalletModel.findOne = jest.fn();
  MockWalletModel.findByIdAndDelete = jest.fn();
  MockWalletModel.findByIdAndUpdate = jest.fn();

  // Mock BlockchainWallet Model
  function MockBlockchainWalletModel(dto: any) {
    Object.assign(this, dto);
    this.save = jest.fn().mockResolvedValue({
      ...dto,
      _id: new Types.ObjectId(),
    });
  }
  MockBlockchainWalletModel.findOne = jest.fn();
  MockBlockchainWalletModel.findById = jest.fn();

  const mockUsersService = {
    findOneWithWallets: jest.fn(),
    addWalletToUser: jest.fn(),
    removeWalletFromUser: jest.fn(),
  };

  const mockAlchemysService = {
    getTokenBalances: jest.fn(),
  };

  const mockTokensService = {
    findOne: jest.fn(),
    findByContractAddress: jest.fn(),
    updateTokenImage: jest.fn(),
  };

  const mockCoingeckoService = {
    getCurrentPrice: jest.fn(),
    getCoinById: jest.fn(),
  };

  const mockTransactionsService = {};

  const mockBlockchainService = {
    getBalanceBatch: jest.fn(),
  };

  const mockBankWalletService = {
    findByWalletIdAndApiKey: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    getCurrentBalanceWithToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: getModelToken(Wallet.name), useValue: MockWalletModel },
        {
          provide: getModelToken(BlockchainWallet.name),
          useValue: MockBlockchainWalletModel,
        },
        { provide: UsersService, useValue: mockUsersService },
        { provide: AlchemysService, useValue: mockAlchemysService },
        { provide: TokensService, useValue: mockTokensService },
        { provide: CoingeckoService, useValue: mockCoingeckoService },
        { provide: TransactionsService, useValue: mockTransactionsService },
        { provide: BlockchainService, useValue: mockBlockchainService },
        { provide: BanksWalletsService, useValue: mockBankWalletService },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
    walletModel = module.get(getModelToken(Wallet.name));
    blockchainWalletModel = module.get(getModelToken(BlockchainWallet.name));
    usersService = module.get(UsersService);
    alchemysService = module.get(AlchemysService);
    tokensService = module.get(TokensService);
    coingeckoService = module.get(CoingeckoService);
    transactionsService = module.get(TransactionsService);
    blockchainService = module.get(BlockchainService);
    bankWalletService = module.get(BanksWalletsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new wallet', async () => {
      const userId = new Types.ObjectId();
      const createWalletDto: CreateWalletDto = {
        name: 'Test Wallet',
        description: 'Test Description',
      };
      const user = { wallets: [] };
      mockUsersService.findOneWithWallets.mockResolvedValue(user);
      mockUsersService.addWalletToUser.mockResolvedValue(null);

      const result = await service.create(userId, createWalletDto);

      expect(usersService.findOneWithWallets).toHaveBeenCalledWith(userId);
      expect(result).toHaveProperty('_id');
      expect(result.name).toBe(createWalletDto.name);
      expect(usersService.addWalletToUser).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return an array of wallets', async () => {
      const wallets = [{ name: 'Wallet 1' }, { name: 'Wallet 2' }];
      MockWalletModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(wallets),
      });

      const result = await service.findAll();

      expect(result).toEqual(wallets);
    });
  });

  describe('findOne', () => {
    it('should return a populated wallet with tokens and prices', async () => {
      const walletId = new Types.ObjectId();
      const populatedWallet = {
        _id: walletId,
        userId: new Types.ObjectId(),
        name: 'My Wallet',
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
        bankWalletId: [],
      };

      MockWalletModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(populatedWallet),
      });

      mockCoingeckoService.getCurrentPrice.mockResolvedValue({
        bitcoin: { usd: 50000, usd_24h_change: 5 },
      });

      const result = await service.findOne(walletId);

      expect(result).toBeDefined();
      if (result && !(result instanceof NotFoundException)) {
        expect(result.wallet._id).toBe(walletId);
        expect(result.tokens).toBeDefined();
      }
    });
  });

  describe('findByUserId', () => {
    it('should return wallets for a specific user', async () => {
      const userId = new Types.ObjectId();
      const wallets = [{ name: 'User Wallet' }];
      MockWalletModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(wallets),
      });

      const result = await service.findByUserId(userId);

      expect(MockWalletModel.find).toHaveBeenCalledWith({ userId });
      expect(result).toEqual(wallets);
    });
  });

  describe('remove', () => {
    it('should remove a wallet and return it', async () => {
      const walletId = new Types.ObjectId();
      const wallet = { _id: walletId, userId: new Types.ObjectId() };
      MockWalletModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(wallet),
      });

      const result = await service.remove(walletId);

      expect(MockWalletModel.findByIdAndDelete).toHaveBeenCalledWith(walletId);
      expect(usersService.removeWalletFromUser).toHaveBeenCalledWith(
        wallet.userId,
        walletId,
      );
      expect(result).toEqual(wallet);
    });
  });

  describe('update', () => {
    it('should update a wallet', async () => {
      const walletId = new Types.ObjectId();
      const updateDto = { name: 'Updated Name' };
      const updatedWallet = { _id: walletId, ...updateDto };
      MockWalletModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedWallet),
      });

      const result = await service.update(walletId, updateDto);

      expect(MockWalletModel.findByIdAndUpdate).toHaveBeenCalledWith(
        walletId,
        updateDto,
        { new: true },
      );
      expect(result).toEqual(updatedWallet);
    });
  });

  describe('addBankWalletToWallet', () => {
    it('should add a bank wallet to a wallet', async () => {
      const walletId = new Types.ObjectId();
      const apiKey = 'test-api-key';
      const apiSecret = 'test-api-secret';
      const createdBankWallet = { _id: new Types.ObjectId() };

      MockWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: walletId }),
      });
      mockBankWalletService.findByWalletIdAndApiKey.mockResolvedValue(null);
      mockBankWalletService.create.mockResolvedValue(createdBankWallet);
      MockWalletModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.addBankWalletToWallet(
        walletId,
        apiKey,
        apiSecret,
      );

      expect(bankWalletService.create).toHaveBeenCalled();
      expect(MockWalletModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(result).toEqual(createdBankWallet);
    });
  });

  describe('addBlockchainWalletToWallet', () => {
    it('should add a blockchain wallet to a wallet', async () => {
      const walletId = new Types.ObjectId();
      const address = '0x123';
      const chains = ['ETH'];

      MockWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: walletId }),
      });
      MockBlockchainWalletModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      MockWalletModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.addBlockchainWalletToWallet(
        walletId,
        address,
        chains,
      );

      expect(result).toBeDefined();
      expect(result.address).toBe(address);
      expect(MockWalletModel.findByIdAndUpdate).toHaveBeenCalled();
    });
  });

  describe('getBlockchainWalletsByWalletIdAndAddress', () => {
    it('should return a blockchain wallet', async () => {
      const walletId = new Types.ObjectId();
      const address = '0x123';
      const mockResult = { walletId, address };

      MockBlockchainWalletModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockResult),
      });

      const result = await service.getBlockchainWalletsByWalletIdAndAddress(
        walletId,
        address,
      );

      expect(MockBlockchainWalletModel.findOne).toHaveBeenCalledWith({
        walletId,
        address,
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getDifferentBalanceInBlockchainWalletsByAddress', () => {
    it('should return diff balance', async () => {
      const walletId = new Types.ObjectId();
      const address = '0x123';
      const blockchainWallet = { _id: new Types.ObjectId(), address };

      jest
        .spyOn(service, 'getBlockchainWalletsByWalletIdAndAddress')
        .mockResolvedValue(blockchainWallet as any);
      jest
        .spyOn(service, 'getDifferentBalanceInBlockchainWallets')
        .mockResolvedValue('diff' as any);

      const result =
        await service.getDifferentBalanceInBlockchainWalletsByAddress(
          walletId,
          address,
        );

      expect(
        service.getBlockchainWalletsByWalletIdAndAddress,
      ).toHaveBeenCalledWith(walletId, address);
      expect(
        service.getDifferentBalanceInBlockchainWallets,
      ).toHaveBeenCalledWith(blockchainWallet._id);
      expect(result).toBe('diff');
    });
  });

  describe('getDifferentBalanceInBankWallets', () => {
    it('should return bank wallet differences', async () => {
      const bankWalletId = new Types.ObjectId();
      const bankWallet = { tokens: [] };
      mockBankWalletService.findById.mockResolvedValue(bankWallet);
      mockBankWalletService.getCurrentBalanceWithToken.mockResolvedValue({
        data: [],
      });

      const result =
        await service.getDifferentBalanceInBankWallets(bankWalletId);

      expect(bankWalletService.findById).toHaveBeenCalledWith(bankWalletId);
      expect(result.walletId).toBe(bankWalletId);
      expect(result.differences).toEqual([]);
    });
  });

  describe('getDifferentBalanceInBlockchainWallets', () => {
    it('should return blockchain wallet differences', async () => {
      const blockchainWalletId = new Types.ObjectId();
      const blockchainWallet = {
        _id: blockchainWalletId,
        address: '0x123',
        chains: ['ETH'],
        tokens: [],
      };
      MockBlockchainWalletModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(blockchainWallet),
      });

      jest.spyOn(service, 'getOnChainBalanceByAddress').mockResolvedValue({
        address: '0x123',
        chains: ['ETH'],
        nativeBalances: [],
        balances: [], // using 'balances' instead of 'tokenBalances' to match return type of mocked service if needed, but getOnChainBalanceByAddress returns { balances, nativeBalances ... }
      } as any);

      const result =
        await service.getDifferentBalanceInBlockchainWallets(
          blockchainWalletId,
        );

      expect(result.address).toBe('0x123');
    });
  });

  describe('getOnChainBalanceByAddress', () => {
    it('should return on-chain balances', async () => {
      const address = '0x123';
      const chains = ['ETH'];

      mockAlchemysService.getTokenBalances.mockResolvedValue({
        tokenBalances: [],
        nativeBalances: [],
      });

      const result = await service.getOnChainBalanceByAddress(address, chains);

      expect(alchemysService.getTokenBalances).toHaveBeenCalled();
      expect(result.address).toBe(address);
    });
  });
});

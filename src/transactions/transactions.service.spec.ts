/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { BankWallet } from '../banks-wallets/schema/bank-wallets.schema';
import { BlockchainWallet } from '../blockchain-wallets/schema/blockchain-wallet.schema';
import { CoingeckoService } from '../coingecko/coingecko.service';
import { TokenContract } from '../tokens/schema/token-contract.schema';
import { Token } from '../tokens/schema/token.schema';
import { Wallet } from '../wallets/schemas/wallet.schema';
import { CreateTransactionBatchDto } from './dto/create-transaction-batch.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import {
  Transaction,
  TransactionEventType,
  TransactionType,
} from './schema/transaction.schema';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let transactionModel: any;
  let tokenContractModel: any;
  let blockchainWalletModel: any;
  let bankWalletModel: any;
  let walletModel: any;
  let tokenModel: any;
  let coingeckoService: any;

  // Mock class for TransactionModel
  class MockTransactionModel {
    private dto: any;
    save: any;

    constructor(dto: any) {
      this.dto = dto;
      this.save = jest.fn().mockImplementation(() =>
        Promise.resolve({
          ...this.dto,
          _id: new Types.ObjectId(),
          createdAt: new Date(),
          tokenId: this.dto.tokenId, // ensure tokenId is preserved for performance calculation
        }),
      );
    }

    static find = jest.fn();
    static findById = jest.fn();
    static deleteOne = jest.fn();
    static countDocuments = jest.fn();
  }

  const mockTokenContractModel = {
    findById: jest.fn(),
  };

  const mockBlockchainWalletModel = {
    findById: jest.fn(),
  };

  const mockBankWalletModel = {
    findById: jest.fn(),
  };

  const mockWalletModel = {
    findById: jest.fn(),
  };

  const mockTokenModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockCoingeckoService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getModelToken(Transaction.name),
          useValue: MockTransactionModel,
        },
        {
          provide: getModelToken(TokenContract.name),
          useValue: mockTokenContractModel,
        },
        {
          provide: getModelToken(BlockchainWallet.name),
          useValue: mockBlockchainWalletModel,
        },
        {
          provide: getModelToken(BankWallet.name),
          useValue: mockBankWalletModel,
        },
        {
          provide: getModelToken(Wallet.name),
          useValue: mockWalletModel,
        },
        {
          provide: getModelToken(Token.name),
          useValue: mockTokenModel,
        },
        {
          provide: CoingeckoService,
          useValue: mockCoingeckoService,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    transactionModel = module.get(getModelToken(Transaction.name));
    tokenContractModel = module.get(getModelToken(TokenContract.name));
    blockchainWalletModel = module.get(getModelToken(BlockchainWallet.name));
    bankWalletModel = module.get(getModelToken(BankWallet.name));
    walletModel = module.get(getModelToken(Wallet.name));
    tokenModel = module.get(getModelToken(Token.name));
    coingeckoService = module.get<CoingeckoService>(CoingeckoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a manual transaction successfully', async () => {
      const walletId = new Types.ObjectId();
      const tokenId = new Types.ObjectId();
      const createDto: CreateTransactionDto = {
        walletId: walletId,
        tokenId: tokenId,
        type: TransactionType.MANUAL,
        quantity: '0x64', // 100 in hex
        event_type: TransactionEventType.DEPOSIT, // This adds to manualTokens
        price_usd: 10,
        cashflow_usd: 1000,
        timestamp: new Date(),
      };

      const mockWallet = {
        _id: walletId,
        manualTokens: [] as any[],
        portfolioPerformance: [],
        save: jest.fn(),
      };

      const mockToken = {
        _id: tokenId,
      };

      mockWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      mockTokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      });
      // Mock portfolio calc finds existing transactions
      MockTransactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(mockWallet.save).toHaveBeenCalled();
      // deposit logic -> add to manualTokens
      expect(mockWallet.manualTokens.length).toBe(1);
      expect(mockWallet.manualTokens[0].tokenId).toBe(tokenId);
    });
  });

  describe('createBankWalletTransaction', () => {
    it('should create a bank wallet transaction batch successfully', async () => {
      const walletId = new Types.ObjectId();
      const bankWalletId = new Types.ObjectId();
      const tokenId = new Types.ObjectId();

      const batchDto: CreateTransactionBatchDto = {
        walletId: walletId,
        items: [
          {
            walletId: walletId,
            tokenId: tokenId,
            type: TransactionType.SYNCED,
            quantity: '0x64',
            event_type: TransactionEventType.DEPOSIT,
            timestamp: new Date(),
          } as any,
        ],
      };

      const mockWallet = {
        _id: walletId,
        portfolioPerformance: [],
        save: jest.fn(),
      };

      const mockBankWallet = {
        _id: bankWalletId,
        walletId: walletId,
        tokens: [],
        save: jest.fn(),
      };

      const mockToken = {
        _id: tokenId,
      };

      mockWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      mockBankWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBankWallet),
      });
      mockTokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      });
      MockTransactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.createBankWalletTransaction(
        bankWalletId,
        batchDto,
      );

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(mockBankWallet.save).toHaveBeenCalled();
    });
  });

  describe('validateTransaction', () => {
    it('should validate transaction successfully', async () => {
      const walletId = new Types.ObjectId();
      const tokenContractId = new Types.ObjectId();
      const tokenId = new Types.ObjectId();

      mockWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: walletId }),
      });
      mockTokenContractModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: tokenContractId }),
      });
      mockTokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: tokenId }),
      });

      const result = await service.validateTransaction(
        undefined,
        walletId,
        tokenContractId,
        tokenId,
      );

      expect(result.wallet).toBeDefined();
      expect(result.tokenContract).toBeDefined();
      expect(result.token).toBeDefined();
    });
  });

  describe('createBatch', () => {
    it('should create a batch of transactions successfully', async () => {
      const walletId = new Types.ObjectId();
      const tokenId = new Types.ObjectId();

      const batchDto: CreateTransactionBatchDto = {
        walletId: walletId,
        items: [
          {
            walletId: walletId,
            tokenId: tokenId,
            type: TransactionType.MANUAL,
            quantity: '0x64',
            event_type: TransactionEventType.DEPOSIT,
            timestamp: new Date(),
          } as any,
        ],
      };

      const mockWallet = {
        _id: walletId,
        manualTokens: [],
        portfolioPerformance: [],
        save: jest.fn(),
      };

      const mockToken = {
        _id: tokenId,
      };

      mockWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      mockTokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      });
      MockTransactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.createBatch(batchDto);

      expect(result).toBeDefined();
      // MANUAL items don't get pushed to results array in implementation, so length 0 expected
      expect(result.length).toBe(0);
    });
  });

  describe('findAll', () => {
    it('should return all transactions (placeholder)', () => {
      const result = service.findAll();
      expect(result).toBe('This action returns all transactions');
    });
  });

  describe('findOne', () => {
    it('should return a transaction (placeholder)', () => {
      const result = service.findOne(1);
      expect(result).toBe('This action returns a #1 transaction');
    });
  });

  describe('update', () => {
    it('should update a transaction (placeholder)', () => {
      const result = service.update(1, {});
      expect(result).toBe('This action updates a #1 transaction');
    });
  });

  describe('remove', () => {
    it('should remove a manual transaction successfully', async () => {
      const txId = new Types.ObjectId();
      const walletId = new Types.ObjectId();
      const tokenId = new Types.ObjectId();

      const mockTx = {
        _id: txId,
        type: TransactionType.MANUAL,
        walletId,
        tokenId: tokenId,
        quantity: '0x64',
        event_type: TransactionEventType.DEPOSIT,
      };

      // Mock wallet must have standard manualTokens structure to allow reverse withdrawal
      const mockWallet = {
        _id: walletId,
        manualTokens: [
          {
            tokenId: tokenId,
            balance: '0x64', // Enough balance for withdrawal (reversal of deposit)
          },
        ],
        portfolioPerformance: [],
        save: jest.fn(),
      };

      MockTransactionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTx),
      });
      mockWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      MockTransactionModel.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });
      MockTransactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.remove(txId);

      expect(result.removed).toBe(true);
      expect(mockWallet.save).toHaveBeenCalled();

      const tokenInWallet = mockWallet.manualTokens.find(
        (t) => t.tokenId === tokenId,
      );
      if (tokenInWallet) {
        expect(tokenInWallet.balance).toBe('0x0'); // or spliced
      } else {
        expect(true).toBe(true); // spliced out
      }
    });
  });

  describe('findByWalletId', () => {
    it('should return transactions for a wallet', async () => {
      const walletId = new Types.ObjectId();
      const mockData = [{ _id: 'tx1' }];

      MockTransactionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockData),
      });

      const result = await service.findByWalletId(walletId);
      expect(result).toEqual(mockData);
    });
  });

  describe('findByWalletWithPagination', () => {
    it('should return paginated transactions for a wallet', async () => {
      const walletId = new Types.ObjectId();
      const mockData = [{ _id: 'tx1' }];
      const total = 1;

      MockTransactionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockData),
      });
      MockTransactionModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(total),
      });

      const result = await service.findByWalletWithPagination(walletId, 10, 0);

      expect(result.data).toEqual(mockData);
      expect(result.pagination.total).toBe(total);
    });
  });
});

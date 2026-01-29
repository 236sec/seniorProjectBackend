/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BadRequestException, NotFoundException } from '@nestjs/common';
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

  const mockQuery = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };

  const createMockModel = () => {
    const mockModel: any = jest.fn().mockImplementation((dto) => ({
      ...dto,
      _id: new Types.ObjectId(),
      createdAt: new Date(),
      save: jest.fn().mockResolvedValue({
        ...dto,
        _id: new Types.ObjectId(),
        createdAt: new Date(),
      }),
    }));

    mockModel.find = jest.fn(() => mockQuery);
    mockModel.findOne = jest.fn(() => mockQuery);
    mockModel.findById = jest.fn(() => mockQuery);
    mockModel.countDocuments = jest.fn(() => mockQuery);
    mockModel.deleteOne = jest.fn(() => mockQuery);

    return mockModel;
  };

  const mockCoingeckoService = {
    // Add methods if used
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset mockQuery implementation
    mockQuery.exec.mockResolvedValue([]);
    mockQuery.sort.mockReturnThis();
    mockQuery.skip.mockReturnThis();
    mockQuery.limit.mockReturnThis();
    mockQuery.populate.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getModelToken(Transaction.name),
          useValue: createMockModel(),
        },
        {
          provide: getModelToken(TokenContract.name),
          useValue: createMockModel(),
        },
        {
          provide: getModelToken(BlockchainWallet.name),
          useValue: createMockModel(),
        },
        {
          provide: getModelToken(BankWallet.name),
          useValue: createMockModel(),
        },
        { provide: getModelToken(Wallet.name), useValue: createMockModel() },
        { provide: getModelToken(Token.name), useValue: createMockModel() },
        { provide: CoingeckoService, useValue: mockCoingeckoService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    transactionModel = module.get(getModelToken(Transaction.name));
    tokenContractModel = module.get(getModelToken(TokenContract.name));
    blockchainWalletModel = module.get(getModelToken(BlockchainWallet.name));
    bankWalletModel = module.get(getModelToken(BankWallet.name));
    walletModel = module.get(getModelToken(Wallet.name));
    tokenModel = module.get(getModelToken(Token.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const walletId = new Types.ObjectId();
    const tokenContractId = new Types.ObjectId();
    const tokenId = new Types.ObjectId();
    const blockchainWalletId = new Types.ObjectId();

    const mockWallet = {
      _id: walletId,
      blockchainWalletId: [blockchainWalletId],
      manualTokens: [],
      portfolioPerformance: [],
      save: jest.fn().mockResolvedValue(true),
    };

    const mockBlockchainWallet: any = {
      _id: blockchainWalletId,
      walletId: walletId,
      tokens: [],
      save: jest.fn().mockResolvedValue(true),
    };

    const mockTokenContract = {
      _id: tokenContractId,
      tokenId: tokenId,
    };

    const mockToken = {
      _id: tokenId,
      id: 'bitcoin',
    };

    it('should create a SYNCED transaction successfully', async () => {
      const createDto: CreateTransactionDto = {
        coingeckoId: 'bitcoin',
        walletId: walletId,
        tokenContractId: tokenContractId,
        blockchainWalletId: blockchainWalletId,
        quantity: '0x16345785d8a0000', // 100000000000000000
        type: TransactionType.SYNCED,
        event_type: TransactionEventType.DEPOSIT,
        timestamp: new Date(),
      };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      tokenContractModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTokenContract),
      });
      tokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      });
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockToken]),
      });

      blockchainWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBlockchainWallet),
      });

      // Mock finding transactions for portfolio calc
      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(transactionModel).toHaveBeenCalledTimes(1);
      // The mock implementation of constructor is usually not tracked as 'toHaveBeenCalledTimes' on the mock object itself
      // unless we spy on it or use the value itself if it IS the mock.
      // Here `transactionModel` IS the jest.fn() that acts as constructor.

      expect(blockchainWalletModel.findById).toHaveBeenCalledWith(
        new Types.ObjectId(createDto.blockchainWalletId),
      );
      expect(mockBlockchainWallet.save).toHaveBeenCalled();
      // Expect balance update logic to have run (pushed to tokens)
      expect(mockBlockchainWallet.tokens.length).toBe(1);
      expect(mockBlockchainWallet.tokens[0].tokenContractId).toEqual(
        tokenContractId,
      );
    });

    it('should throw BadRequestException if wallet not found', async () => {
      const createDto: CreateTransactionDto = {
        walletId: walletId.toString(),
        type: TransactionType.SYNCED,
        timestamp: new Date(),
      } as any;

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create a MANUAL transaction successfully', async () => {
      const createDto: CreateTransactionDto = {
        coingeckoId: 'bitcoin',
        walletId: walletId,
        tokenId: tokenId,
        quantity: '0x16345785d8a0000',
        type: TransactionType.MANUAL,
        event_type: TransactionEventType.DEPOSIT,
        timestamp: new Date(),
      };

      const manualWalletMock: any = { ...mockWallet, manualTokens: [] };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(manualWalletMock),
      });
      tokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      });
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockToken]),
      });

      // Mock finding transactions for portfolio calc
      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(manualWalletMock.save).toHaveBeenCalled();
      expect(manualWalletMock.manualTokens.length).toBe(1);
      expect(manualWalletMock.manualTokens[0].tokenId).toEqual(tokenId);
    });

    it('should throw BadRequestException if token not found for MANUAL transaction', async () => {
      const createDto: CreateTransactionDto = {
        walletId: walletId.toString(),
        tokenId: tokenId.toString(),
        type: TransactionType.MANUAL,
        timestamp: new Date(),
      } as any;

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      tokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should match decimals to quantity if provided', async () => {
      const createDto: CreateTransactionDto = {
        coingeckoId: 'bitcoin',
        walletId: walletId,
        tokenId: tokenId,
        quantity: '1.0',
        decimals: 18,
        type: TransactionType.MANUAL,
        event_type: TransactionEventType.DEPOSIT,
        timestamp: new Date(),
      };

      const manualWalletMock: any = { ...mockWallet, manualTokens: [] };
      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(manualWalletMock),
      });
      tokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      });
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockToken]),
      });
      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.create(createDto);

      // We know that '1.0' with 18 decimals -> 10^18 -> 0xde0b6b3a7640000
      expect(manualWalletMock.manualTokens[0].balance).not.toBe('1.0');
      expect(manualWalletMock.manualTokens[0].balance).toMatch(/^0x/);
    });

    it('should throw Error if blockchain wallet does not belong to wallet', async () => {
      const createDto: CreateTransactionDto = {
        walletId: walletId.toString(),
        blockchainWalletId: blockchainWalletId.toString(),
        tokenContractId: tokenContractId.toString(),
        type: TransactionType.SYNCED,
        timestamp: new Date(),
      } as any;

      const mockWalletWithWrongId = {
        _id: walletId,
        blockchainWalletId: [new Types.ObjectId()], // mismatch
        save: jest.fn(),
      };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWalletWithWrongId),
      });
      tokenContractModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTokenContract),
      });
      blockchainWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBlockchainWallet),
      });
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await expect(service.create(createDto)).rejects.toThrow(
        'Blockchain wallet does not belong to the specified wallet',
      );
    });

    it('should throw Error for insufficient balance in manual withdrawal', async () => {
      const createDto: CreateTransactionDto = {
        walletId: walletId,
        tokenId: tokenId,
        type: TransactionType.MANUAL,
        event_type: TransactionEventType.WITHDRAWAL, // Withdraw
        quantity: '0x100',
        timestamp: new Date(),
      };

      const mockWalletZeroBalance: any = {
        _id: walletId,
        manualTokens: [], // No tokens
        save: jest.fn(),
      };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWalletZeroBalance),
      });
      tokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      });
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockToken]),
      });

      await expect(service.create(createDto)).rejects.toThrow(
        'Token not found in wallet for withdrawal',
      );
    });

    it('should allow SYNCED withdrawal even if token not present (synced allows negative/creation)', async () => {
      const createDto: CreateTransactionDto = {
        walletId: walletId.toString(),
        tokenContractId: tokenContractId.toString(),
        blockchainWalletId: blockchainWalletId.toString(),
        quantity: '0x100',
        type: TransactionType.SYNCED,
        event_type: TransactionEventType.WITHDRAWAL,
        timestamp: new Date(),
      } as any;

      const mockBlockchainWalletEmpty = {
        _id: blockchainWalletId,
        tokens: [],
        save: jest.fn(),
      };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      tokenContractModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTokenContract),
      });
      blockchainWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBlockchainWalletEmpty),
      });

      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.create(createDto);

      expect(mockBlockchainWalletEmpty.tokens).toHaveLength(1);
      expect(mockBlockchainWalletEmpty.save).toHaveBeenCalled();
    });

    it('should throw Error if blockchain wallet not found in DB', async () => {
      const createDto: CreateTransactionDto = {
        walletId: walletId.toString(),
        blockchainWalletId: blockchainWalletId.toString(),
        tokenContractId: tokenContractId.toString(),
        quantity: '0x100',
        type: TransactionType.SYNCED,
        timestamp: new Date(),
      } as any;

      const mockWalletValid = {
        _id: walletId,
        blockchainWalletId: [blockchainWalletId],
        save: jest.fn(),
      };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWalletValid),
      });
      tokenContractModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTokenContract),
      });
      blockchainWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }); // Not found
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await expect(service.create(createDto)).rejects.toThrow(
        'Blockchain wallet not found',
      );
    });

    it('should update EXISTING portfolio performance', async () => {
      const mockWalletWithPerf = {
        _id: walletId,
        portfolioPerformance: [
          {
            tokenId: tokenId,
            totalInvestedAmount: 100,
            costBasis: 50,
          },
        ],
        save: jest.fn(),
      };
      const tx = {
        _id: new Types.ObjectId(),
        walletId,
        tokenId,
        event_type: TransactionEventType.DEPOSIT,
        quantity: '0xde0b6b3a7640000',
        cashflow_usd: 10,
        createdAt: new Date(),
      };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWalletWithPerf),
      });
      tokenContractModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: tokenContractId, tokenId }),
      });
      tokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      });
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockToken]),
      });
      blockchainWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBlockchainWallet),
      });

      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([tx]),
      });

      const createDto: CreateTransactionDto = {
        walletId: walletId.toString(),
        tokenId: tokenId.toString(),
        type: TransactionType.MANUAL,
        quantity: '0xde0b6b3a7640000',
        timestamp: new Date(),
      } as any;

      await service.create(createDto);

      const perf = mockWalletWithPerf.portfolioPerformance[0];
      // Re-calculated from history (only 1 tx mocked).
      expect(perf.totalInvestedAmount).toBe(10);
    });

    it('should resolve tokenId from coingeckoId if not provided', async () => {
      const createDto: CreateTransactionDto = {
        coingeckoId: 'bitcoin',
        walletId: walletId.toString(),
        // tokenId missing
        quantity: '0x100',
        type: TransactionType.MANUAL,
        event_type: TransactionEventType.DEPOSIT,
        timestamp: new Date(),
      } as any;

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockToken]),
      }); // find by id
      tokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      }); // find by _id

      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.create(createDto);

      // Check if wallet manual tokens has the resolved tokenId
      const token = mockWallet.manualTokens.find(
        (t: any) => t.tokenId.toString() === tokenId.toString(),
      );
      expect(token).toBeDefined();
    });

    it('should remove token if balance becomes zero (DEPOSIT + WITHDRAWAL)', async () => {
      // Setup wallet with balance 100
      const mockWalletNonZero = {
        _id: walletId,
        manualTokens: [{ tokenId: tokenId, balance: '0x100' }],
        portfolioPerformance: [],
        save: jest.fn(),
      };

      const createDto: CreateTransactionDto = {
        walletId: walletId,
        tokenId: tokenId,
        type: TransactionType.MANUAL,
        event_type: TransactionEventType.WITHDRAWAL,
        quantity: '0x100', // Withdraw all
        timestamp: new Date(),
      };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWalletNonZero),
      });
      tokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      });
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockToken]),
      });
      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.create(createDto);

      // Expect token to be removed from manualTokens array
      expect(mockWalletNonZero.manualTokens.length).toBe(0);
    });
  }); // end of create describe block (merged for simplicity in my mental model, actually I am appending inside 'create' describe?)

  // Actually the previous replace inserted into 'create'. I need to close it if I want new describe?
  // No, I am just appending. Ideally I should place them correctly.

  // 'remove' describe block is after 'create'.
  // I'll add a new describe block for 'Edge Cases' or 'Extended Coverage' at the end.

  describe('Extended Coverage', () => {
    const walletId = new Types.ObjectId();
    const tokenId = new Types.ObjectId();

    it('should handle createBatch errors (Token not found)', async () => {
      const batchDto: CreateTransactionBatchDto = {
        walletId: walletId,
        items: [
          {
            coingeckoId: 'unknown',
            quantity: '0x1',
            type: TransactionType.MANUAL,
            event_type: TransactionEventType.DEPOSIT,
            timestamp: new Date(),
          },
        ],
      };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: walletId }),
      });
      // Mock token not found
      tokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.createBatch(batchDto)).rejects.toThrow(
        'Token not found for coingeckoId: unknown',
      );
    });
  });

  describe('createBatch', () => {
    const walletId = new Types.ObjectId();
    const tokenContractId = new Types.ObjectId();
    const tokenId = new Types.ObjectId();
    const blockchainWalletId = new Types.ObjectId();

    const mockWallet = {
      _id: walletId,
      blockchainWalletId: [blockchainWalletId],
      manualTokens: [],
      portfolioPerformance: [],
      save: jest.fn().mockResolvedValue(true),
    };

    const mockBlockchainWallet = {
      _id: blockchainWalletId,
      walletId: walletId,
      tokens: [],
      save: jest.fn().mockResolvedValue(true),
    };

    const mockTokenContract = {
      _id: tokenContractId,
      tokenId: tokenId,
    };

    const mockToken = {
      _id: tokenId,
      id: 'bitcoin',
    };

    it('should create batch transactions (manual ones are skipped in return array)', async () => {
      const batchDto: CreateTransactionBatchDto = {
        walletId: walletId,
        items: [
          {
            coingeckoId: 'bitcoin',
            blockchainWalletId: blockchainWalletId,
            tokenContractId: tokenContractId,
            quantity: '0x1',
            type: TransactionType.SYNCED,
            event_type: TransactionEventType.DEPOSIT,
            timestamp: new Date(),
          },
          {
            coingeckoId: 'bitcoin',
            quantity: '0x1',
            type: TransactionType.MANUAL,
            event_type: TransactionEventType.DEPOSIT,
            timestamp: new Date(),
          },
        ],
      };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      blockchainWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBlockchainWallet),
      });
      tokenContractModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTokenContract),
      });
      tokenModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      });
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockToken]),
      }); // for create
      tokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      }); // for create

      // Mock find for calculateAndUpdatePortfolioPerformance
      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.createBatch(batchDto);

      expect(result).toHaveLength(1);
      expect(mockBlockchainWallet.save).toHaveBeenCalled();
      expect(mockWallet.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const txId = new Types.ObjectId();
    const walletId = new Types.ObjectId();
    const tokenId = new Types.ObjectId();
    const blockchainWalletId = new Types.ObjectId();
    const tokenContractId = new Types.ObjectId();

    it('should remove a SYNCED transaction and revert balance', async () => {
      const mockTx = {
        _id: txId,
        walletId: walletId,
        type: TransactionType.SYNCED,
        blockchainWalletId: blockchainWalletId,
        tokenContractId: tokenContractId,
        tokenId: tokenId,
        quantity: '0x100',
        event_type: TransactionEventType.DEPOSIT,
      };

      const mockBlockchainWallet = {
        _id: blockchainWalletId,
        tokens: [{ tokenContractId: tokenContractId, balance: '0x200' }],
        save: jest.fn(),
      };

      transactionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTx),
      });
      blockchainWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBlockchainWallet),
      });
      transactionModel.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      // For calc performance
      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });
      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: walletId,
          portfolioPerformance: [],
          save: jest.fn(),
        }),
      });

      const result = await service.remove(txId);

      expect(result.removed).toBe(true);
      expect(mockBlockchainWallet.tokens[0].balance).toBe('0x100'); // 0x200 - 0x100 = 0x100
      expect(mockBlockchainWallet.save).toHaveBeenCalled();
      expect(transactionModel.deleteOne).toHaveBeenCalledWith({ _id: txId });
    });

    it('should remove a MANUAL transaction and revert balance (DEPOSIT -> WITHDRAWAL)', async () => {
      const mockTx = {
        _id: txId,
        walletId: walletId,
        type: TransactionType.MANUAL,
        tokenId: tokenId,
        quantity: '0x100',
        event_type: TransactionEventType.DEPOSIT,
      };

      const mockWallet = {
        _id: walletId,
        manualTokens: [{ tokenId: tokenId, balance: '0x200' }],
        portfolioPerformance: [],
        save: jest.fn(),
      };

      transactionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTx),
      });
      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      transactionModel.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      // For calc performance
      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.remove(txId);

      expect(mockWallet.manualTokens[0].balance).toBe('0x100'); // 0x200 - 0x100
      expect(mockWallet.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if transaction to remove does not exist', async () => {
      transactionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.remove(new Types.ObjectId())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByWalletId', () => {
    it('should return transactions for a wallet', async () => {
      const walletId = new Types.ObjectId();

      mockQuery.sort.mockReturnThis();
      mockQuery.populate.mockReturnThis();
      mockQuery.exec.mockResolvedValue(['tx1', 'tx2']);

      transactionModel.find.mockReturnValue(mockQuery);

      const result = await service.findByWalletId(walletId);
      expect(result).toEqual(['tx1', 'tx2']);
      expect(transactionModel.find).toHaveBeenCalledWith({ walletId });
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });

  describe('findByWalletWithPagination', () => {
    it('should return paginated results', async () => {
      const walletId = new Types.ObjectId();
      const data = ['tx1', 'tx2'];
      const total = 12; // 2 pages if limit is 10

      // Mock find chain
      mockQuery.sort.mockReturnThis();
      mockQuery.populate.mockReturnThis();
      mockQuery.skip.mockReturnThis();
      mockQuery.limit.mockReturnThis();
      mockQuery.exec.mockResolvedValue(data);

      transactionModel.find.mockReturnValue(mockQuery);

      // Mock count chain
      const mockCountQuery = { exec: jest.fn().mockResolvedValue(total) };
      transactionModel.countDocuments.mockReturnValue(mockCountQuery);

      const result = await service.findByWalletWithPagination(walletId, 10, 0);

      expect(result.data).toEqual(data);
      expect(result.pagination.total).toBe(total);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.page).toBe(1);
    });
  });

  describe('Portfolio Performance Calculation', () => {
    const walletId = new Types.ObjectId();
    const tokenId = new Types.ObjectId();

    it('should calculate cost basis correctly', async () => {
      // Scenario: Buy 1 @ $10, Buy 1 @ $20. Total 2, Cost Basis $30. Avg Cost $15.
      // Sell 1 @ 25.
      const tx1 = {
        _id: new Types.ObjectId(),
        walletId,
        tokenId,
        event_type: TransactionEventType.DEPOSIT,
        quantity: '0xde0b6b3a7640000', // 1 * 10^18
        cashflow_usd: 10,
        createdAt: new Date('2023-01-01'),
      };
      const tx2 = {
        _id: new Types.ObjectId(),
        walletId,
        tokenId,
        event_type: TransactionEventType.DEPOSIT,
        quantity: '0xde0b6b3a7640000', // 1 * 10^18
        cashflow_usd: 20,
        createdAt: new Date('2023-01-02'),
      };
      const tx3 = {
        _id: new Types.ObjectId(),
        walletId,
        tokenId,
        event_type: TransactionEventType.WITHDRAWAL,
        quantity: '0xde0b6b3a7640000', // 1 * 10^18
        cashflow_usd: 25,
        createdAt: new Date('2023-01-03'),
      };

      const mockWallet = {
        _id: walletId,
        portfolioPerformance: [],
        save: jest.fn(),
      };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      tokenContractModel.findById.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue({ _id: new Types.ObjectId(), tokenId }),
      });
      tokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: tokenId, id: 'test' }),
      });
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ _id: tokenId, id: 'test' }]),
      });
      blockchainWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          tokens: [],
          save: jest.fn(),
        }),
      });

      // Mock finding all transactions including the new ones
      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([tx1, tx2, tx3]),
      });

      const createDto: CreateTransactionDto = {
        walletId: walletId.toString(),
        tokenId: tokenId.toString(),
        type: TransactionType.MANUAL,
        quantity: '0xde0b6b3a7640000',
        timestamp: new Date(),
      } as any;

      await service.create(createDto);

      const perf: any = mockWallet.portfolioPerformance[0];
      expect(perf).toBeDefined();
      expect(perf.costBasis).toBe(15);
      expect(perf.totalInvestedAmount).toBe(30);
      expect(perf.totalCashflowUsd).toBe(-5);
      expect(perf.averageUnitCost).toBe(15);
    });
  });

  describe('Additional Coverage', () => {
    const walletId = new Types.ObjectId();
    const tokenContractId = new Types.ObjectId();
    const tokenId = new Types.ObjectId();
    const blockchainWalletId = new Types.ObjectId();

    const mockWallet = {
      _id: walletId,
      blockchainWalletId: [blockchainWalletId],
      manualTokens: [],
      portfolioPerformance: [],
      save: jest.fn().mockResolvedValue(true),
    };

    const mockBlockchainWallet = {
      _id: blockchainWalletId,
      walletId: walletId,
      tokens: [],
      save: jest.fn().mockResolvedValue(true),
    };

    const mockTokenContract = {
      _id: tokenContractId,
      tokenId: tokenId,
    };

    const mockToken = {
      _id: tokenId,
      id: 'bitcoin',
    };

    beforeEach(() => {
      // Reset specific mocks if needed, though mostly handled in individual tests or outer beforeEach
    });

    it('should throw BadRequestException if token contract not found for SYNCED transaction', async () => {
      const createDto: CreateTransactionDto = {
        walletId: walletId,
        tokenContractId: tokenContractId,
        blockchainWalletId: blockchainWalletId,
        tokenId: tokenId,
        quantity: '0x1',
        type: TransactionType.SYNCED,
        event_type: TransactionEventType.DEPOSIT,
        timestamp: new Date(),
        coingeckoId: 'bitcoin',
      };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      // Token found (for validateTransaction)
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockToken]),
      });
      tokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      });

      // Token contract NOT found
      tokenContractModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw Error if blockchain wallet not found in createBatch', async () => {
      const batchDto: CreateTransactionBatchDto = {
        walletId: walletId,
        items: [
          {
            blockchainWalletId: blockchainWalletId,
            quantity: '0x1',
            type: TransactionType.SYNCED,
            event_type: TransactionEventType.DEPOSIT,
            timestamp: new Date(),
          },
        ],
      };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      // Blockchain wallet NOT found
      blockchainWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.createBatch(batchDto)).rejects.toThrow(
        'Blockchain wallet not found',
      );
    });

    it('should throw Error if blockchain wallet does not belong to wallet in createBatch', async () => {
      const batchDto: CreateTransactionBatchDto = {
        walletId: walletId,
        items: [
          {
            blockchainWalletId: blockchainWalletId,
            quantity: '0x1',
            type: TransactionType.SYNCED,
            event_type: TransactionEventType.DEPOSIT,
            timestamp: new Date(),
          },
        ],
      };

      const mockWalletWrong = { ...mockWallet, blockchainWalletId: [] };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWalletWrong),
      });
      blockchainWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBlockchainWallet),
      });

      await expect(service.createBatch(batchDto)).rejects.toThrow(
        /does not belong to the specified wallet/,
      );
    });

    it('should throw Error if token contract not found in createBatch', async () => {
      const batchDto: CreateTransactionBatchDto = {
        walletId: walletId,
        items: [
          {
            blockchainWalletId: blockchainWalletId,
            tokenContractId: tokenContractId,
            quantity: '0x1',
            type: TransactionType.SYNCED,
            event_type: TransactionEventType.DEPOSIT,
            timestamp: new Date(),
          },
        ],
      };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      blockchainWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBlockchainWallet),
      });
      tokenContractModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.createBatch(batchDto)).rejects.toThrow(
        'Token contract not found',
      );
    });

    it('should assign walletId to blockchain wallet if missing in createBatch', async () => {
      const batchDto: CreateTransactionBatchDto = {
        walletId: walletId,
        items: [
          {
            blockchainWalletId: blockchainWalletId,
            tokenContractId: tokenContractId,
            quantity: '0x1',
            type: TransactionType.SYNCED,
            event_type: TransactionEventType.DEPOSIT,
            timestamp: new Date(),
          },
        ],
      };

      const mockBwNoWallet = { ...mockBlockchainWallet, walletId: undefined };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      blockchainWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBwNoWallet),
      });
      tokenContractModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTokenContract),
      });
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });
      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.createBatch(batchDto);

      expect(mockBwNoWallet.walletId).toEqual(walletId);
      expect(mockBwNoWallet.save).toHaveBeenCalled();
    });

    it('should throw Error if blockchain wallet not found in remove', async () => {
      const txId = new Types.ObjectId();
      const mockTx = {
        _id: txId,
        walletId: walletId,
        type: TransactionType.SYNCED,
        blockchainWalletId: blockchainWalletId,
        tokenContractId: tokenContractId, // required for accessing tokenContractId
      };

      transactionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTx),
      });
      blockchainWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.remove(txId)).rejects.toThrow(
        'Blockchain wallet not found',
      );
    });

    it('should handle NotFoundException if wallet is not found during portfolio performance calculation', async () => {
      // This simulates a race condition where wallet exists during create() validation but not during calc
      const createDto: CreateTransactionDto = {
        walletId: walletId,
        type: TransactionType.MANUAL,
        tokenId: tokenId,
        quantity: '0x1',
        event_type: TransactionEventType.DEPOSIT,
        timestamp: new Date(),
      };

      // 1. validateTransaction -> walletModel.findById (Success)
      // 2. create -> manual update -> wallet.save
      // 3. calculateAndUpdatePortfolioPerformance -> updatePerformaceWithTransactions -> walletModel.findById (FAIL)

      walletModel.findById
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(mockWallet) }) // validate
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(mockWallet) }) // create (manual update checks wallet existence indirectly or uses object? actually uses object from validate)
        // Wait, create passes object to updateManualWalletBalance.
        // But calculateAndUpdatePortfolioPerformance calls findById again.
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });

      tokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      });
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockToken]),
      });
      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      // We expect it to NOT throw but likely just log or return (it returns new NotFoundException but doesn't throw it?)
      // The code says: `return new NotFoundException('Wallet not found');`
      // It returns the exception object, does NOT throw it.
      // So this test verifies it doesn't crash.

      const result = await service.create(createDto);
      expect(result).toBeDefined();
    });

    it('should ignore transactions without tokenId during portfolio calculation', async () => {
      const txNoToken = {
        _id: new Types.ObjectId(),
        walletId,
        tokenId: null, // No token ID
        event_type: TransactionEventType.DEPOSIT,
        quantity: '0x1',
      };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([txNoToken]),
      });

      // Trigger via create or createBatch? createBatch is simpler to mock less overhead maybe?
      // Or just create a dummy one.
      const createDto: CreateTransactionDto = {
        walletId: walletId,
        type: TransactionType.MANUAL,
        tokenId: tokenId,
        quantity: '0x1',
        event_type: TransactionEventType.DEPOSIT,
        timestamp: new Date(),
      };
      tokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      });
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockToken]),
      });

      await service.create(createDto);
      // Simply expecting no error and mockWallet.save called
      expect(mockWallet.save).toHaveBeenCalled();
      // Portfolio performance should be empty if only txNoToken existed (ignoring the one just created which has token)
      // The one just created WILL have token.
      // So transactions found = [txNoToken]. Wait, service.create saves the new one.
      // But transactionModel.find is mocked to return ONLY [txNoToken].
      // So the new one is ignored in calculation (because of mock).
      expect(mockWallet.portfolioPerformance.length).toBe(0);
    });

    it('should return string for placeholder methods', () => {
      expect(service.findAll()).toBe('This action returns all transactions');
      expect(service.findOne(1)).toBe('This action returns a #1 transaction');
      expect(service.update(1, {} as any)).toBe(
        'This action updates a #1 transaction',
      );
    });

    it('should handle withdrawal when current quantity is zero in cost basis calc', async () => {
      // Scenario: Withdrawal but we have 0 quantity tracked in perf loop logic (maybe data inconsistency)
      // Should just subtract quantity and proceed
      const txWithdraw = {
        _id: new Types.ObjectId(),
        walletId,
        tokenId,
        event_type: TransactionEventType.WITHDRAWAL,
        quantity: '0xde0b6b3a7640000', // 1 unit
        cashflow_usd: 10,
        createdAt: new Date(),
      };

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([txWithdraw]),
      });

      // Trigger via valid create
      const createDto: CreateTransactionDto = {
        walletId: walletId,
        type: TransactionType.MANUAL,
        tokenId: tokenId,
        quantity: '0x1',
        event_type: TransactionEventType.DEPOSIT,
        timestamp: new Date(),
      };
      tokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      });
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockToken]),
      });

      await service.create(createDto);

      const perf: any = mockWallet.portfolioPerformance[0];
      expect(perf).toBeDefined();
      // cost basis start 0. withdraw happens.
      // currentQuantity (0) - 1e18 = -1e18
      // cost basis stays 0 because `if (currentQuantity > 0n)` is false.
      expect(perf.costBasis).toBe(0);
      // But total cashflow should be updated
      expect(perf.totalCashflowUsd).toBe(10);
    });

    it('should populate tokenId from tokenContract in create SYNCED if missing', async () => {
      const createDto: CreateTransactionDto = {
        walletId: walletId.toString(),
        tokenContractId: tokenContractId.toString(),
        blockchainWalletId: blockchainWalletId.toString(),
        quantity: '0x1',
        type: TransactionType.SYNCED,
        event_type: TransactionEventType.DEPOSIT,
        timestamp: new Date(),
        // coingeckoId: 'bitcoin' // Not needed if tokenContract provided logic holds
      } as any;

      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWallet),
      });
      blockchainWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBlockchainWallet),
      });
      tokenContractModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTokenContract),
      });
      tokenModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockToken]),
      });
      tokenModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockToken),
      });
      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.create(createDto);
      expect(result.tokenId).toEqual(tokenId);
    });

    it('should revert WITHDRAWAL to DEPOSIT in remove MANUAL', async () => {
      const txId = new Types.ObjectId();
      const mockTx = {
        _id: txId,
        walletId: walletId,
        type: TransactionType.MANUAL,
        tokenId: tokenId,
        quantity: '0x100',
        event_type: TransactionEventType.WITHDRAWAL, // Initial was WITHDRAWAL
      };

      const mockWalletManual = {
        _id: walletId,
        manualTokens: [{ tokenId: tokenId, balance: '0x100' }], // Current balance
        save: jest.fn(),
        portfolioPerformance: [],
      };

      transactionModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTx),
      });
      walletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWalletManual),
      });
      transactionModel.deleteOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });
      transactionModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.remove(txId);

      // Reversal: WITHDRAWAL -> DEPOSIT '0x100'.
      // Current '0x100' + '0x100' = '0x200'.
      expect(mockWalletManual.manualTokens[0].balance).toBe('0x200');
    });
  });
});

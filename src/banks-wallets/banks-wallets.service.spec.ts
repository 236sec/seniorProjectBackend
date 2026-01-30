/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import { Model, Types } from 'mongoose';
import { of } from 'rxjs';
import { TokensService } from 'src/tokens/tokens.service';
import { BanksWalletsService } from './banks-wallets.service';
import { CreateBankWalletDto } from './dto/create-bank-wallet.dto';
import { SupportedAssets } from './enum/supported-assets.enum';
import { InnovestXBalanceResponse } from './interfaces/innovestx-balance.interface';
import { InnovestXProductResponse } from './interfaces/innovestx-products.interface';
import { BankWallet } from './schema/bank-wallets.schema';

describe('BanksWalletsService', () => {
  let service: BanksWalletsService;
  let bankWalletModel: Model<BankWallet>;

  let configService: ConfigService;
  let httpService: HttpService;
  let tokensService: TokensService;

  // Helper to generate valid encrypted string for testing
  const generateEncryptedSecret = () => {
    const algorithm = 'aes-256-cbc';
    const secret = 'test-secret-key'; // Matches mockConfigService
    const encryptionKey = crypto
      .createHash('sha256')
      .update(String(secret))
      .digest('hex')
      .substring(0, 32);

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      algorithm,
      Buffer.from(encryptionKey),
      iv,
    );
    let encrypted = cipher.update('actual-api-secret');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  };

  const mockBankWallet = {
    _id: new Types.ObjectId(),
    walletId: new Types.ObjectId(),
    apiKey: 'test-api-key',
    apiSecret: generateEncryptedSecret(),
    save: jest.fn(),
  };

  class MockBankWalletModel {
    constructor(private data: any) {
      Object.assign(this, data);
    }
    save = jest.fn().mockResolvedValue(mockBankWallet);
    static findOne = jest.fn();
    static findById = jest.fn();
  }

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret-key'),
  };

  const mockHttpService = {
    request: jest.fn(),
  };

  const mockTokensService = {
    findOneByCoinGeckoId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BanksWalletsService,
        {
          provide: getModelToken(BankWallet.name),
          useValue: MockBankWalletModel,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: TokensService,
          useValue: mockTokensService,
        },
      ],
    }).compile();

    service = module.get<BanksWalletsService>(BanksWalletsService);
    bankWalletModel = module.get<Model<BankWallet>>(
      getModelToken(BankWallet.name),
    );
    configService = module.get<ConfigService>(ConfigService);
    httpService = module.get<HttpService>(HttpService);
    tokensService = module.get<TokensService>(TokensService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByWalletIdAndApiKey', () => {
    it('should return a bank wallet if found', async () => {
      const walletId = new Types.ObjectId();
      const apiKey = 'test-api-key';
      MockBankWalletModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBankWallet),
      });

      const result = await service.findByWalletIdAndApiKey(walletId, apiKey);
      expect(result).toEqual(mockBankWallet);
      expect(MockBankWalletModel.findOne).toHaveBeenCalledWith({
        walletId,
        apiKey,
      });
    });
  });

  describe('create', () => {
    it('should create and return a new bank wallet', async () => {
      const createDto: CreateBankWalletDto = {
        walletId: new Types.ObjectId(),
        apiKey: 'new-api-key',
        apiSecret: 'new-secret',
      };

      const result = await service.create(createDto);
      expect(result).toEqual(mockBankWallet);
    });
  });

  describe('getProducts', () => {
    it('should return products from InnovestX', async () => {
      const id = new Types.ObjectId();
      const mockResponse: AxiosResponse<InnovestXProductResponse> = {
        data: {
          code: '200',
          message: 'Success',
          data: [],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {} as any,
        },
      };

      MockBankWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBankWallet),
      });

      jest.spyOn(httpService, 'request').mockReturnValue(of(mockResponse));

      const result = await service.getProducts(id);
      expect(result).toEqual(mockResponse.data);
      expect(MockBankWalletModel.findById).toHaveBeenCalledWith(id);
      expect(httpService.request).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return a bank wallet by ID', async () => {
      const id = new Types.ObjectId();
      MockBankWalletModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockBankWallet),
      });

      const result = await service.findById(id);
      expect(result).toEqual(mockBankWallet);
      expect(MockBankWalletModel.findById).toHaveBeenCalledWith(id);
    });
  });

  describe('getCurrentBalance', () => {
    it('should return current balance from InnovestX', async () => {
      const id = new Types.ObjectId();
      const mockBalanceResponse: InnovestXBalanceResponse = {
        code: '200',
        message: 'Success',
        data: [
          {
            product: SupportedAssets.BTC,
            amount: '1.5',
            hold: '0',
            pendingDeposit: '0',
            pendingWithdraw: '0',
          },
        ],
      };
      const mockResponse: AxiosResponse<InnovestXBalanceResponse> = {
        data: mockBalanceResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {} as any,
        },
      };

      MockBankWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBankWallet),
      });

      jest.spyOn(httpService, 'request').mockReturnValue(of(mockResponse));

      const result = await service.getCurrentBalance(id);

      // Since the service logic filters based on SupportedAssets and non-zero amount
      // and our mock data satisfies this, expected result is the same as mock response data
      expect(result).toEqual(mockBalanceResponse);
      expect(MockBankWalletModel.findById).toHaveBeenCalledWith(id);
      expect(httpService.request).toHaveBeenCalled();
    });
  });

  describe('getCurrentBalanceWithToken', () => {
    it('should return current balance with token details', async () => {
      const id = new Types.ObjectId();
      const mockBalanceResponse: InnovestXBalanceResponse = {
        code: '200',
        message: 'Success',
        data: [
          {
            product: SupportedAssets.BTC,
            amount: '1.5',
            hold: '0',
            pendingDeposit: '0',
            pendingWithdraw: '0',
          },
        ],
      };
      const mockResponse: AxiosResponse<InnovestXBalanceResponse> = {
        data: mockBalanceResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          headers: {} as any,
        },
      };

      const mockToken = {
        _id: 'token-id',
        symbol: 'BTC',
      };

      MockBankWalletModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBankWallet),
      });

      jest.spyOn(httpService, 'request').mockReturnValue(of(mockResponse));
      jest
        .spyOn(tokensService, 'findOneByCoinGeckoId')
        .mockResolvedValue(mockToken as any);

      const result = await service.getCurrentBalanceWithToken(id);

      expect(result.data[0]).toHaveProperty('tokenId', mockToken);
      expect(result.code).toBe('200');
    });
  });
});

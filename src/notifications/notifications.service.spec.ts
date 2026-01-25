/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { MailerService } from '@nestjs-modules/mailer';
import { BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CoingeckoService } from '../coingecko/coingecko.service';
import { TokensService } from '../tokens/tokens.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from './notifications.service';
import { AlertCondition, UserAlert } from './schema/notification.schema';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let userAlertModel: any;
  let usersService: any;
  let tokensService: any;
  let coingeckoService: any;
  let mailerService: any;
  let configService: any;

  const mockQuery = {
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };

  const mockUserAlertModel = {
    aggregate: jest.fn(),
    create: jest.fn(),
    find: jest.fn(() => mockQuery),
    findById: jest.fn(() => mockQuery),
    findByIdAndUpdate: jest.fn(() => mockQuery),
    findByIdAndDelete: jest.fn(() => ({ exec: jest.fn() })),
  };

  const mockUsersService = {
    findOne: jest.fn(),
  };

  const mockTokensService = {
    fineToken: jest.fn(),
  };

  const mockCoingeckoService = {
    getCurrentPrice: jest.fn(),
  };

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockQuery.populate.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getModelToken(UserAlert.name),
          useValue: mockUserAlertModel,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: TokensService,
          useValue: mockTokensService,
        },
        {
          provide: CoingeckoService,
          useValue: mockCoingeckoService,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    userAlertModel = module.get(getModelToken(UserAlert.name));
    usersService = module.get(UsersService);
    tokensService = module.get(TokensService);
    coingeckoService = module.get(CoingeckoService);
    mailerService = module.get(MailerService);
    configService = module.get(ConfigService);

    // Default config behavior
    mockConfigService.get.mockReturnValue('noreply@example.com');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should warn if SMTP_FROM is not configured', async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue(null);
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getModelToken(UserAlert.name),
          useValue: mockUserAlertModel,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: TokensService,
          useValue: mockTokensService,
        },
        {
          provide: CoingeckoService,
          useValue: mockCoingeckoService,
        },
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    module.get<NotificationsService>(NotificationsService);
    expect(warnSpy).toHaveBeenCalledWith('SMTP_FROM not configured');

    warnSpy.mockRestore();
  });

  describe('getActiveAlertTokens', () => {
    it('should return a list of active alert tokens', async () => {
      const mockResult = [
        {
          _id: null,
          tokens: [{ coingeckoId: 'bitcoin', tokenId: new Types.ObjectId() }],
        },
      ];
      mockUserAlertModel.aggregate.mockResolvedValue(mockResult);

      const result = await service.getActiveAlertTokens();

      expect(userAlertModel.aggregate).toHaveBeenCalled();
      expect(result).toEqual(mockResult[0].tokens);
    });

    it('should return empty array if no active alerts', async () => {
      mockUserAlertModel.aggregate.mockResolvedValue([]);

      const result = await service.getActiveAlertTokens();

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    const createDto = {
      userId: new Types.ObjectId(),
      tokenId: new Types.ObjectId(),
      coingeckoId: 'bitcoin',
      condition: AlertCondition.ABOVE,
      targetPrice: 50000,
    };

    it('should create a new alert', async () => {
      const mockUser = { _id: createDto.userId };
      const mockToken = { _id: createDto.tokenId, coingeckoId: 'bitcoin' };
      const mockCreatedAlert = {
        ...createDto,
        user: createDto.userId,
        token: createDto.tokenId,
        isActive: true,
      };

      mockUsersService.findOne.mockResolvedValue(mockUser);
      mockTokensService.fineToken.mockResolvedValue(mockToken);
      mockUserAlertModel.create.mockResolvedValue(mockCreatedAlert);

      const result = await service.create(createDto);

      expect(usersService.findOne).toHaveBeenCalledWith(createDto.userId);
      expect(tokensService.fineToken).toHaveBeenCalledWith(
        createDto.tokenId,
        createDto.coingeckoId,
      );
      expect(userAlertModel.create).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedAlert);
    });

    it('should throw BadRequestException if user not found', async () => {
      mockUsersService.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if token not found', async () => {
      mockUsersService.findOne.mockResolvedValue({ _id: createDto.userId });
      mockTokensService.fineToken.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findByUserId', () => {
    it('should return alerts for a user', async () => {
      const userId = new Types.ObjectId();
      const mockAlerts = [{ _id: 'alert1' }];
      mockQuery.exec.mockResolvedValue(mockAlerts);

      const result = await service.findByUserId(userId);

      expect(userAlertModel.find).toHaveBeenCalledWith({ user: userId });
      expect(mockQuery.populate).toHaveBeenCalledWith(['token']);
      expect(result).toEqual(mockAlerts);
    });
  });

  describe('checkAlertsForTokenPrice', () => {
    it('should return alerts matching criteria', async () => {
      const tokenId = new Types.ObjectId();
      const currentPrice = 50000;
      const mockAlerts = [{ _id: 'alert1' }];

      // Since checkAlertsForTokenPrice does NOT call exec() but returns the query/promise chain
      // We must ensure the mock returns something that can be awaited or treated as such.
      // But typically await works on thenables.
      // Mongoose Query is a thenable.
      // Let's make mockQuery look like a thenable when populated.
      const thenableMock = {
        ...mockQuery,
        then: (resolve) => resolve(mockAlerts),
      };

      mockQuery.populate.mockReturnValue(thenableMock);

      const result = await service.checkAlertsForTokenPrice(
        tokenId,
        currentPrice,
      );

      expect(userAlertModel.find).toHaveBeenCalledWith({
        token: tokenId,
        isActive: true,
        $or: [
          { condition: 'ABOVE', targetPrice: { $lte: currentPrice } },
          { condition: 'BELOW', targetPrice: { $gte: currentPrice } },
        ],
      });
      expect(mockQuery.populate).toHaveBeenCalledWith(['user', 'token']);
      expect(result).toEqual(mockAlerts);
    });
  });

  describe('processPriceAlerts', () => {
    it('should do nothing if no active alerts', async () => {
      // Spy on getActiveAlertTokens
      jest.spyOn(service, 'getActiveAlertTokens').mockResolvedValue([]);
      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.processPriceAlerts();

      expect(service.getActiveAlertTokens).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('No active alerts found.');
    });

    it('should process alerts and send emails', async () => {
      const tokenId = new Types.ObjectId();
      const coingeckoId = 'bitcoin';
      const userId = new Types.ObjectId();
      const alertId = new Types.ObjectId();

      const mockTokens = [{ coingeckoId, tokenId }];
      jest.spyOn(service, 'getActiveAlertTokens').mockResolvedValue(mockTokens);

      mockCoingeckoService.getCurrentPrice.mockResolvedValue({
        [coingeckoId]: { usd: 60000 },
      });

      const mockAlert = {
        _id: alertId,
        user: { email: 'test@example.com', _id: userId },
        token: { name: 'Bitcoin', symbol: 'btc' },
        condition: 'ABOVE',
        targetPrice: 55000,
        isActive: true,
        saved: false,
        save: jest.fn(),
      };

      // Mock checkAlertsForTokenPrice
      jest
        .spyOn(service, 'checkAlertsForTokenPrice')
        .mockResolvedValue([mockAlert as any]);

      // Mock sendEmail
      const sendEmailSpy = jest.spyOn(service, 'sendEmail').mockResolvedValue();

      await service.processPriceAlerts();

      expect(coingeckoService.getCurrentPrice).toHaveBeenCalledWith([
        coingeckoId,
      ]);
      expect(service.checkAlertsForTokenPrice).toHaveBeenCalledWith(
        tokenId,
        60000,
      );
      expect(sendEmailSpy).toHaveBeenCalled();
      expect(mockAlert.save).toHaveBeenCalled();
      expect(mockAlert.isActive).toBe(false);
    });

    it('should handle pagination of coingecko requests', async () => {
      const tokens: { coingeckoId: string; tokenId: Types.ObjectId }[] = [];
      for (let i = 0; i < 30; i++) {
        tokens.push({ coingeckoId: `id-${i}`, tokenId: new Types.ObjectId() });
      }
      jest.spyOn(service, 'getActiveAlertTokens').mockResolvedValue(tokens);
      mockCoingeckoService.getCurrentPrice.mockResolvedValue({});

      await service.processPriceAlerts();

      // Should be called 2 times (20 + 10)
      expect(coingeckoService.getCurrentPrice).toHaveBeenCalledTimes(2);
    });

    it('should skip if price data is missing', async () => {
      const tokenId = new Types.ObjectId();
      const coingeckoId = 'bitcoin';

      jest
        .spyOn(service, 'getActiveAlertTokens')
        .mockResolvedValue([{ coingeckoId, tokenId }]);
      mockCoingeckoService.getCurrentPrice.mockResolvedValue({}); // No data

      const checkSpy = jest.spyOn(service, 'checkAlertsForTokenPrice');

      await service.processPriceAlerts();

      expect(checkSpy).not.toHaveBeenCalled();
    });

    it('should skip if user has no email', async () => {
      const tokenId = new Types.ObjectId();
      const coingeckoId = 'bitcoin';

      jest
        .spyOn(service, 'getActiveAlertTokens')
        .mockResolvedValue([{ coingeckoId, tokenId }]);
      mockCoingeckoService.getCurrentPrice.mockResolvedValue({
        [coingeckoId]: { usd: 100 },
      });

      const mockAlert = { user: {}, token: { name: 'Token' } }; // No email
      jest
        .spyOn(service, 'checkAlertsForTokenPrice')
        .mockResolvedValue([mockAlert as any]);
      const sendEmailSpy = jest.spyOn(service, 'sendEmail');

      await service.processPriceAlerts();

      expect(sendEmailSpy).not.toHaveBeenCalled();
    });

    it('should skip if price is 0', async () => {
      const tokenId = new Types.ObjectId();
      const coingeckoId = 'bitcoin';

      jest
        .spyOn(service, 'getActiveAlertTokens')
        .mockResolvedValue([{ coingeckoId, tokenId }]);
      mockCoingeckoService.getCurrentPrice.mockResolvedValue({
        [coingeckoId]: { usd: 0 },
      });

      const checkSpy = jest.spyOn(service, 'checkAlertsForTokenPrice');

      await service.processPriceAlerts();

      expect(checkSpy).not.toHaveBeenCalled();
    });

    it('should skip if user is missing', async () => {
      const tokenId = new Types.ObjectId();
      const coingeckoId = 'bitcoin';

      jest
        .spyOn(service, 'getActiveAlertTokens')
        .mockResolvedValue([{ coingeckoId, tokenId }]);
      mockCoingeckoService.getCurrentPrice.mockResolvedValue({
        [coingeckoId]: { usd: 100 },
      });

      const mockAlert = { user: null, token: { name: 'Token' } };
      jest
        .spyOn(service, 'checkAlertsForTokenPrice')
        .mockResolvedValue([mockAlert as any]);
      const sendEmailSpy = jest.spyOn(service, 'sendEmail');

      await service.processPriceAlerts();

      expect(sendEmailSpy).not.toHaveBeenCalled();
    });

    it('should continue if no alerts match price', async () => {
      const tokenId = new Types.ObjectId();
      const coingeckoId = 'bitcoin';

      jest
        .spyOn(service, 'getActiveAlertTokens')
        .mockResolvedValue([{ coingeckoId, tokenId }]);
      mockCoingeckoService.getCurrentPrice.mockResolvedValue({
        [coingeckoId]: { usd: 100 },
      });

      jest.spyOn(service, 'checkAlertsForTokenPrice').mockResolvedValue([]); // Empty alerts
      const sendEmailSpy = jest.spyOn(service, 'sendEmail');

      await service.processPriceAlerts();

      expect(sendEmailSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const params = {
        emails: ['test@email.com'],
        subject: 'Test',
        template: 'test',
        context: {},
      };
      mockMailerService.sendMail.mockResolvedValue('OK');
      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.sendEmail(params);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: params.emails,
          subject: params.subject,
        }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Email sent successfully'),
      );
    });

    it('should log error if sendMail fails', async () => {
      const params = {
        emails: ['test@email.com'],
        subject: 'Test',
        template: 'test',
        context: {},
      };
      mockMailerService.sendMail.mockRejectedValue(new Error('Mail error'));
      const errorSpy = jest.spyOn((service as any).logger, 'error');

      await service.sendEmail(params);

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should return if no emails provided', async () => {
      await service.sendEmail({
        emails: [],
        subject: '',
        template: '',
        context: {},
      });
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('should return if emails is null', async () => {
      await service.sendEmail({
        emails: null as any,
        subject: '',
        template: '',
        context: {},
      });
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('should log error if smtp from is not configured', async () => {
      // Re-init service with missing config
      jest.clearAllMocks();
      mockConfigService.get.mockReturnValue(null);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationsService,
          {
            provide: getModelToken(UserAlert.name),
            useValue: mockUserAlertModel,
          },
          { provide: UsersService, useValue: mockUsersService },
          { provide: TokensService, useValue: mockTokensService },
          { provide: CoingeckoService, useValue: mockCoingeckoService },
          { provide: MailerService, useValue: mockMailerService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      const serviceNoConfig =
        module.get<NotificationsService>(NotificationsService);
      const errorSpy = jest.spyOn((serviceNoConfig as any).logger, 'error');

      await serviceNoConfig.sendEmail({
        emails: ['a@a.com'],
        subject: '',
        template: '',
        context: {},
      });

      expect(errorSpy).toHaveBeenCalledWith(
        'Cannot send email: SMTP_FROM is not configured.',
      );
    });

    it('should catch non-Error objects', async () => {
      mockMailerService.sendMail.mockRejectedValue('String Error');
      const errorSpy = jest.spyOn((service as any).logger, 'error');

      await service.sendEmail({
        emails: ['a'],
        subject: 'b',
        template: 'c',
        context: {},
      });

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should catch Error with undefined stack', async () => {
      const err = new Error('No stack');
      err.stack = undefined;
      mockMailerService.sendMail.mockRejectedValue(err);
      const errorSpy = jest.spyOn((service as any).logger, 'error');

      await service.sendEmail({
        emails: ['a'],
        subject: 'b',
        template: 'c',
        context: {},
      });

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all alerts', async () => {
      mockQuery.exec.mockResolvedValue([]);
      // Reset find to return mockQuery again as it might have been changed in prev tests
      mockUserAlertModel.find.mockReturnValue(mockQuery);

      await service.findAll();

      expect(userAlertModel.find).toHaveBeenCalled();
      expect(mockQuery.populate).toHaveBeenCalledWith(['user', 'token']);
    });
  });

  describe('findOne', () => {
    it('should return one alert', async () => {
      const id = new Types.ObjectId();
      mockQuery.exec.mockResolvedValue({});

      await service.findOne(id);

      expect(userAlertModel.findById).toHaveBeenCalledWith(id);
      expect(mockQuery.populate).toHaveBeenCalledWith(['user', 'token']);
    });
  });

  describe('update', () => {
    it('should update alert', async () => {
      const id = new Types.ObjectId();
      const updateDto = {
        isActive: false,
        targetPrice: 30000,
        condition: AlertCondition.ABOVE,
      };
      mockQuery.exec.mockResolvedValue({});

      await service.update(id, updateDto);

      expect(userAlertModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        updateDto,
        { new: true },
      );
    });
  });

  describe('remove', () => {
    it('should remove alert', async () => {
      const id = new Types.ObjectId();
      mockUserAlertModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      await service.remove(id);

      expect(userAlertModel.findByIdAndDelete).toHaveBeenCalledWith(id);
    });
  });
});

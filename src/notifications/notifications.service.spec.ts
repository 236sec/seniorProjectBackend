/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CoingeckoService } from 'src/coingecko/coingecko.service';
import { TokensService } from 'src/tokens/tokens.service';
import { UsersService } from 'src/users/users.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationsService } from './notifications.service';
import { AlertCondition, UserAlert } from './schema/notification.schema';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let model: any;
  let usersService: UsersService;
  let tokensService: TokensService;
  let coingeckoService: CoingeckoService;
  let mailerService: MailerService;

  let configService: ConfigService;

  const mockUserAlert = {
    _id: new Types.ObjectId(),
    user: new Types.ObjectId(),
    token: new Types.ObjectId(),
    targetPrice: 100,
    condition: 'ABOVE',
    isActive: true,
    save: jest.fn(),
  };

  const mockUserAlertModel = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    aggregate: jest.fn(),
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
    get: jest.fn().mockReturnValue('test@example.com'),
  };

  beforeEach(async () => {
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
    model = module.get(getModelToken(UserAlert.name));
    usersService = module.get<UsersService>(UsersService);
    tokensService = module.get<TokensService>(TokensService);
    coingeckoService = module.get<CoingeckoService>(CoingeckoService);
    mailerService = module.get<MailerService>(MailerService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getActiveAlertTokens', () => {
    it('should return aggregation result', async () => {
      const mockResult = [
        { tokens: [{ coingeckoId: 'bitcoin', tokenId: new Types.ObjectId() }] },
      ];
      mockUserAlertModel.aggregate.mockResolvedValue(mockResult);

      const result = await service.getActiveAlertTokens();
      expect(result).toEqual(mockResult[0].tokens);
      expect(mockUserAlertModel.aggregate).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should check user and token then create alert', async () => {
      const dto: CreateNotificationDto = {
        userId: new Types.ObjectId(),
        tokenId: new Types.ObjectId(),
        coingeckoId: 'bitcoin',
        targetPrice: 50000,
        condition: AlertCondition.ABOVE,
      };

      const mockUser = { _id: dto.userId };
      const mockToken = { _id: dto.tokenId };

      mockUsersService.findOne.mockResolvedValue(mockUser);
      mockTokensService.fineToken.mockResolvedValue(mockToken);
      mockUserAlertModel.create.mockResolvedValue(mockUserAlert);

      const result = await service.create(dto);
      expect(result).toEqual(mockUserAlert);
      expect(usersService.findOne).toHaveBeenCalledWith(dto.userId);
      expect(tokensService.fineToken).toHaveBeenCalledWith(
        dto.tokenId,
        dto.coingeckoId,
      );
      expect(mockUserAlertModel.create).toHaveBeenCalled();
    });
  });

  describe('findByUserId', () => {
    it('should find alerts by user id', async () => {
      const userId = new Types.ObjectId();
      const mockExec = jest.fn().mockResolvedValue([mockUserAlert]);
      const mockPopulate = jest.fn().mockReturnValue({ exec: mockExec });
      mockUserAlertModel.find.mockReturnValue({ populate: mockPopulate });

      const result = await service.findByUserId(userId);
      expect(result).toEqual([mockUserAlert]);
      expect(mockUserAlertModel.find).toHaveBeenCalledWith({ user: userId });
    });
  });

  describe('checkAlertsForTokenPrice', () => {
    it('should find alerts matching conditions', async () => {
      const tokenId = new Types.ObjectId();
      const currentPrice = 50000;
      const mockExec = jest.fn().mockResolvedValue([mockUserAlert]);
      const mockPopulate = jest.fn().mockReturnValue(mockExec); // .populate().then() -> query object is thenable or we simulate query chain
      // Actually mongoose Query object: find -> populate -> (await/exec)
      // Service code: return this.userAlertModel.find(...).populate(...) (no exec, returns query)
      // Wait, service wrapper returns the query object directly?
      // "return this.userAlertModel.find(...).populate(['user', 'token']);"
      // It returns the Query object which is thenable.

      // Let's adjust mock to return a chainable object
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockUserAlert]),
        then: (resolve: any) => resolve([mockUserAlert]), // Make it thenable for await in test if needed, or if caller awaits it
      };
      mockUserAlertModel.find.mockReturnValue(mockQuery);

      const result = service.checkAlertsForTokenPrice(tokenId, currentPrice);
      // Since it returns query, we can await it or check it.
      // In processPriceAlerts it is awaited: "const alerts = await this.checkAlertsForTokenPrice(...)"
      // So the object returned by populate must be thenable or have exec.

      // In the test we can just check if it returns the mockQuery which is what we mocked.
      expect(result).toEqual(mockQuery);

      expect(mockUserAlertModel.find).toHaveBeenCalledWith({
        token: tokenId,
        isActive: true,
        $or: [
          { condition: 'ABOVE', targetPrice: { $lte: currentPrice } },
          { condition: 'BELOW', targetPrice: { $gte: currentPrice } },
        ],
      });
    });
  });

  describe('processPriceAlerts', () => {
    it('should process alerts and send emails', async () => {
      // Mock getActiveAlertTokens
      const alertTokens = [
        { coingeckoId: 'bitcoin', tokenId: new Types.ObjectId() },
      ];
      jest
        .spyOn(service, 'getActiveAlertTokens')
        .mockResolvedValue(alertTokens);

      // Mock Coingecko
      const prices = { bitcoin: { usd: 50000, usd_24h_change: 0 } };
      mockCoingeckoService.getCurrentPrice.mockResolvedValue(prices);

      // Mock checkAlertsForTokenPrice
      const mockAlertInstance = {
        ...mockUserAlert,
        user: { email: 'user@test.com' },
        token: { name: 'Bitcoin', symbol: 'btc' },
        save: jest.fn(),
      };
      // service.checkAlertsForTokenPrice returns a Query which is awaited.
      // We spy on the method to return the list directly since it is awaited in the service method
      jest
        .spyOn(service, 'checkAlertsForTokenPrice')
        .mockResolvedValue([mockAlertInstance] as any);

      // Mock sendEmail
      const sendEmailSpy = jest
        .spyOn(service, 'sendEmail')
        .mockResolvedValue(undefined);

      await service.processPriceAlerts();

      expect(service.getActiveAlertTokens).toHaveBeenCalled();
      expect(coingeckoService.getCurrentPrice).toHaveBeenCalledWith([
        'bitcoin',
      ]);
      expect(service.checkAlertsForTokenPrice).toHaveBeenCalled();
      expect(service.sendEmail).toHaveBeenCalled();
      expect(mockAlertInstance.save).toHaveBeenCalled();
    });
  });

  describe('sendEmail', () => {
    it('should call mailer service', async () => {
      const options = {
        emails: ['test@example.com'],
        subject: 'Subject',
        template: 'template',
        context: {},
      };

      mockMailerService.sendMail.mockResolvedValue({ accepted: [] });

      await service.sendEmail(options);

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: options.emails,
        from: 'test@example.com', // from config
        subject: options.subject,
        template: options.template,
        context: options.context,
      });
    });
  });

  describe('findAll', () => {
    it('should return all alerts', async () => {
      const mockExec = jest.fn().mockResolvedValue([mockUserAlert]);
      const mockPopulate = jest.fn().mockReturnValue({ exec: mockExec });
      mockUserAlertModel.find.mockReturnValue({ populate: mockPopulate });

      const result = await service.findAll();
      expect(result).toEqual([mockUserAlert]);
    });
  });

  describe('findOne', () => {
    it('should return one alert by id', async () => {
      const id = new Types.ObjectId();
      const mockExec = jest.fn().mockResolvedValue(mockUserAlert);
      const mockPopulate = jest.fn().mockReturnValue({ exec: mockExec });
      mockUserAlertModel.findById.mockReturnValue({ populate: mockPopulate });

      const result = await service.findOne(id);
      expect(result).toEqual(mockUserAlert);
    });
  });

  describe('update', () => {
    it('should update alert', async () => {
      const id = new Types.ObjectId();
      const dto: UpdateNotificationDto = {
        targetPrice: 60000,
        condition: AlertCondition.ABOVE,
        isActive: true,
      };
      const mockExec = jest
        .fn()
        .mockResolvedValue({ ...mockUserAlert, ...dto });

      mockUserAlertModel.findByIdAndUpdate.mockReturnValue({ exec: mockExec });

      const result = await service.update(id, dto);
      expect(result!.targetPrice).toBe(60000);
      expect(mockUserAlertModel.findByIdAndUpdate).toHaveBeenCalledWith(
        id,
        dto,
        { new: true },
      );
    });
  });

  describe('remove', () => {
    it('should remove alert', async () => {
      const id = new Types.ObjectId();
      const mockExec = jest.fn().mockResolvedValue(mockUserAlert);
      mockUserAlertModel.findByIdAndDelete.mockReturnValue({ exec: mockExec });

      const result = await service.remove(id);
      expect(result).toEqual(mockUserAlert);
    });
  });
});

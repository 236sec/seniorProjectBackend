import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { CoingeckoService } from 'src/coingecko/coingecko.service';
import { CurrentPriceResponse } from 'src/coingecko/interfaces/coingecko-api.interface';
import { Token } from 'src/tokens/schema/token.schema';
import { TokensService } from 'src/tokens/tokens.service';
import { User } from 'src/users/schemas/user.schema';
import { UsersService } from 'src/users/users.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { UserAlert, UserAlertDocument } from './schema/notification.schema';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly fromEmail: string | undefined;

  constructor(
    @InjectModel(UserAlert.name)
    private userAlertModel: Model<UserAlertDocument>,
    private readonly usersService: UsersService,
    private readonly tokensService: TokensService,
    private readonly coingeckoService: CoingeckoService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.fromEmail = this.configService.get<string>('SMTP_FROM');
    if (!this.fromEmail) {
      this.logger.warn('SMTP_FROM not configured');
    }
  }

  /**
   * Retrieves a list of unique Coingecko IDs and their Token ObjectIds
   * for all active alerts.
   */
  async getActiveAlertTokens(): Promise<
    { coingeckoId: string; tokenId: Types.ObjectId }[]
  > {
    interface AggregationResult {
      _id: null;
      tokens: { coingeckoId: string; tokenId: Types.ObjectId }[];
    }

    const result = await this.userAlertModel.aggregate<AggregationResult>([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'tokens',
          localField: 'token',
          foreignField: '_id',
          as: 'tokenData',
        },
      },
      { $unwind: '$tokenData' },
      {
        $group: {
          _id: null,
          tokens: {
            $addToSet: {
              coingeckoId: '$tokenData.id',
              tokenId: '$tokenData._id',
            },
          },
        },
      },
    ]);
    return result.length > 0 ? result[0].tokens : [];
  }

  async create(createNotificationDto: CreateNotificationDto) {
    const user = await this.usersService.findOne(createNotificationDto.userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const token = await this.tokensService.fineToken(
      createNotificationDto.tokenId,
      createNotificationDto.coingeckoId,
    );
    if (!token) {
      throw new BadRequestException('Token not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { coingeckoId, tokenId, userId, ...alertData } =
      createNotificationDto;

    return this.userAlertModel.create({
      ...alertData,
      user: userId,
      token: token._id,
      isActive: true,
    });
  }

  findByUserId(userId: Types.ObjectId) {
    return this.userAlertModel
      .find({ user: userId })
      .populate(['token'])
      .exec();
  }

  checkAlertsForTokenPrice(tokenId: Types.ObjectId, currentPrice: number) {
    return this.userAlertModel
      .find({
        token: tokenId,
        isActive: true,
        $or: [
          { condition: 'ABOVE', targetPrice: { $lte: currentPrice } },
          { condition: 'BELOW', targetPrice: { $gte: currentPrice } },
        ],
      })
      .populate(['user', 'token']);
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async processPriceAlerts() {
    this.logger.log('Starting price alerts check...');
    const alertTokens = await this.getActiveAlertTokens();
    if (alertTokens.length === 0) {
      this.logger.log('No active alerts found.');
      return;
    }

    const coingeckoIds = alertTokens.map((t) => t.coingeckoId);
    const prices: CurrentPriceResponse = {};

    for (let i = 0; i < coingeckoIds.length; i += 20) {
      const chunk = coingeckoIds.slice(i, i + 20);
      const chunkPrices = await this.coingeckoService.getCurrentPrice(chunk);
      Object.assign(prices, chunkPrices);
    }

    for (const tokenInfo of alertTokens) {
      const priceData = prices[tokenInfo.coingeckoId];
      if (!priceData || priceData.usd === 0) continue;

      const alerts = await this.checkAlertsForTokenPrice(
        tokenInfo.tokenId,
        priceData.usd,
      );

      const notificationPromises = alerts.map(async (alert) => {
        const user = alert.user as User;
        const token = alert.token as Token;

        if (user && user.email) {
          await this.sendEmail({
            emails: [user.email],
            subject: `Price Alert: ${token.name} (${token.symbol.toUpperCase()})`,
            template: 'price-alert',
            context: {
              user,
              token,
              price: priceData.usd,
              alert,
              condition: alert.condition,
              targetPrice: alert.targetPrice,
            },
          });
          alert.isActive = false;
          await alert.save();
        }
      });

      await Promise.allSettled(notificationPromises);
    }
    this.logger.log('Price alerts check completed.');
  }

  async sendEmail({
    emails,
    subject,
    template,
    context,
  }: {
    emails: string[];
    subject: string;
    template: string;
    context: ISendMailOptions['context'];
  }) {
    try {
      if (!emails || emails.length === 0) {
        return;
      }
      if (!this.fromEmail) {
        this.logger.error('Cannot send email: SMTP_FROM is not configured.');
        return;
      }
      const sendMailParams: ISendMailOptions = {
        to: emails,
        from: this.fromEmail,
        subject: subject,
        template: template,
        context: context,
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const response = await this.mailerService.sendMail(sendMailParams);

      this.logger.log(
        `Email sent successfully to users: ${emails.join(', ')} with response: ${JSON.stringify(
          response,
        )}`,
      );
    } catch (error) {
      this.logger.error(
        `Error while sending mail with the following parameters : ${JSON.stringify(
          { emails, subject, template, context },
        )}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  findAll() {
    return `This action returns all notifications`;
  }

  findOne(id: number) {
    return `This action returns a #${id} notification`;
  }

  update(id: Types.ObjectId, updateNotificationDto: UpdateNotificationDto) {
    return this.userAlertModel
      .findByIdAndUpdate(id, updateNotificationDto, { new: true })
      .exec();
  }

  remove(id: Types.ObjectId) {
    return this.userAlertModel.findByIdAndDelete(id).exec();
  }
}

import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { AxiosError } from 'axios';
import * as crypto from 'crypto';
import { Model, Types } from 'mongoose';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { TokensService } from 'src/tokens/tokens.service';
import { CreateBankWalletDto } from './dto/create-bank-wallet.dto';
import {
  SupportedAssets,
  SupportedAssetsToCoinGeckoId,
} from './enum/supported-assets.enum';
import {
  InnovestXBalanceResponse,
  InnovestXBalanceWithTokenResponse,
} from './interfaces/innovestx-balance.interface';
import { InnovestXProductResponse } from './interfaces/innovestx-products.interface';
import { BankWallet, BankWalletDocument } from './schema/bank-wallets.schema';

@Injectable()
export class BanksWalletsService {
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-cbc';
  private readonly logger = new Logger(BanksWalletsService.name);

  constructor(
    @InjectModel(BankWallet.name)
    private bankWalletModel: Model<BankWalletDocument>,
    private configService: ConfigService, // Fixed: Removed incorrect @InjectModel(Token.name)
    private readonly httpService: HttpService,
    private tokenService: TokensService,
  ) {
    const secret =
      this.configService.get<string>('ENCRYPTION_SECRET') ||
      'default_secret_please_change';
    // Ensure key is 32 bytes for aes-256-cbc
    this.encryptionKey = crypto
      .createHash('sha256')
      .update(String(secret))
      .digest('hex')
      .substring(0, 32);
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      Buffer.from(this.encryptionKey),
      iv,
    );
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  private decrypt(text: string): string {
    const textParts = text.split(':');
    const ivHex = textParts.shift();
    if (!ivHex) {
      throw new Error('Invalid encrypted text format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      Buffer.from(this.encryptionKey),
      iv,
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  async findByWalletIdAndApiKey(
    walletId: Types.ObjectId,
    apiKey: string,
  ): Promise<BankWalletDocument | null> {
    return this.bankWalletModel.findOne({ walletId, apiKey }).exec();
  }

  async create(
    createBankWalletDto: CreateBankWalletDto,
  ): Promise<BankWalletDocument> {
    const { apiSecret, ...rest } = createBankWalletDto;
    const encryptedSecret = this.encrypt(apiSecret);

    const createdBankWallet = new this.bankWalletModel({
      ...rest,
      apiSecret: encryptedSecret,
    });
    return createdBankWallet.save();
  }

  private async requestInnovestX<T>(
    id: Types.ObjectId,
    path: string,
    method: 'GET' | 'POST' = 'GET',
  ): Promise<T> {
    const wallet = await this.bankWalletModel.findById(id).exec();
    if (!wallet) {
      throw new NotFoundException(
        `Bank Wallet with ID ${id.toString()} not found`,
      );
    }
    const apiKey = wallet.apiKey;
    const apiSecret = this.decrypt(wallet.apiSecret);
    const requestUId = crypto.randomUUID();
    const timestamp = new Date().getTime();
    const host = 'api.innovestxonline.com';
    const query = '';
    const contentType = 'application/json';
    const content_to_sign =
      apiKey +
      method +
      host +
      path +
      query +
      contentType +
      requestUId +
      timestamp.toString() +
      (method === 'GET' ? '' : '');
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(content_to_sign)
      .digest('hex');
    const headers = {
      'Content-Type': contentType,
      'X-INVX-REQUEST-UID': requestUId,
      'X-INVX-TIMESTAMP': timestamp,
      'X-INVX-SIGNATURE': signature,
      'X-INVX-APIKEY': apiKey,
    };
    const url = `https://${host}${path}`;
    const { data } = await firstValueFrom(
      this.httpService
        .request<T>({
          url,
          method,
          headers,
          data: undefined,
        })
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.error(error.response?.data || error.message);
            return throwError(() => error);
          }),
        ),
    );
    return data;
  }

  async getProducts(id: Types.ObjectId): Promise<InnovestXProductResponse> {
    return this.requestInnovestX<InnovestXProductResponse>(
      id,
      '/api/v1/digital-asset/products',
      'GET',
    );
  }

  async findById(id: Types.ObjectId): Promise<BankWalletDocument | null> {
    return this.bankWalletModel.findById(id).populate('tokens').exec();
  }

  async getCurrentBalance(
    id: Types.ObjectId,
  ): Promise<InnovestXBalanceResponse> {
    // FIX: Explicitly type the variable or cast the await result
    // This tells the linter: "I know this response matches InnovestXBalanceResponse"
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const balanceResponse = (await this.requestInnovestX(
      id,
      '/api/v1/digital-asset/account/balance/inquiry' as const,
      'GET' as const,
    )) as InnovestXBalanceResponse;

    const filteredData = balanceResponse.data.filter(
      (item) =>
        (Object.values(SupportedAssets) as string[]).includes(item.product) &&
        Number(item.amount) !== 0,
    );

    return {
      ...balanceResponse,
      data: filteredData,
    };
  }

  async getCurrentBalanceWithToken(
    id: Types.ObjectId,
  ): Promise<InnovestXBalanceWithTokenResponse> {
    const balanceData = await this.getCurrentBalance(id);
    const results = await Promise.all(
      balanceData.data.map(async (item) => {
        const assetKey = item.product as SupportedAssets;
        const coinGeckoId = SupportedAssetsToCoinGeckoId[assetKey];
        const token = await this.tokenService.findOneByCoinGeckoId(coinGeckoId);

        if (!token) {
          throw new NotFoundException(`Token not found for ${assetKey}`);
        }

        return {
          ...item,
          tokenId: token,
        };
      }),
    );
    return {
      ...balanceData,
      data: results,
    };
  }
}

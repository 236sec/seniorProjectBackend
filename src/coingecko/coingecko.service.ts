import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  CoingeckoListCoinsResponse,
  CoingeckoMarketsResponse,
} from './interfaces/coingecko-api.interface';

@Injectable()
export class CoingeckoService {
  private readonly logger = new Logger(CoingeckoService.name);
  private readonly apiKey: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('COINGECKO_API_KEY');

    if (!this.apiKey) {
      this.logger.warn('COINGECKO_API_KEY not configured');
    }

    if (!this.configService.get<string>('COINGECKO_API_URL')) {
      this.logger.warn('COINGECKO_API_URL not configured');
    }
  }

  async listCoins() {
    const apiUrl = this.configService.get<string>('COINGECKO_API_URL');
    const url = `${apiUrl}/coins/list`;

    try {
      const response = await firstValueFrom(this.httpService.get(url));

      return response.data as CoingeckoListCoinsResponse;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Error fetching coin list from CoinGecko: ${errorMessage}`,
      );
      throw error;
    }
  }

  async getCoinsMarkets(page: number = 1, perPage: number = 250) {
    const apiUrl = this.configService.get<string>('COINGECKO_API_URL');
    const url = `${apiUrl}/coins/markets`;

    const params = {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: perPage,
      page: page,
      sparkline: false,
      locale: 'en',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { params }),
      );

      return response.data as CoingeckoMarketsResponse;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Error fetching coins markets from CoinGecko: ${errorMessage}`,
      );
      throw error;
    }
  }
}

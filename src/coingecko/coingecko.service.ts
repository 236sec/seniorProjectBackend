import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { CoingeckoListCoinsResponse } from './interfaces/coingecko-api.interface';

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
}

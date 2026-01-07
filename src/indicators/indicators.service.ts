import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import { join } from 'path';
import { IndicatorResponse } from './interfaces/indicator.interface';

@Injectable()
export class IndicatorsService {
  private readonly logger = new Logger(IndicatorsService.name);
  private readonly dataPath = join(process.cwd(), 'data');

  async getPriceIndicators(coinId: string): Promise<number[]> {
    try {
      const rawData = await fs.readFile(
        join(this.dataPath, `${coinId}.json`),
        'utf-8',
      );
      const prices: number[] = JSON.parse(rawData) as number[];
      return prices;
    } catch (error) {
      this.logger.error('Error reading price indicators file:', error);
      throw new InternalServerErrorException(
        'Could not read price indicators data',
      );
    }
  }

  async getIndicator(
    coinId: string,
    indicatorType: 'rsi' | 'ema20' | 'sma20',
  ): Promise<IndicatorResponse> {
    try {
      const rawData = await fs.readFile(
        join(this.dataPath, `${coinId}-${indicatorType}.json`),
        'utf-8',
      );
      const parsedData = JSON.parse(rawData) as IndicatorResponse;
      return parsedData;
    } catch (error) {
      this.logger.error('Error reading metrics file:', error);
      throw new InternalServerErrorException('Could not read metrics data');
    }
  }
}

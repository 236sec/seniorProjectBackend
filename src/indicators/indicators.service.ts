import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import { join } from 'path';
import { RSIResponse } from './interfaces/rsi.interface';

@Injectable()
export class IndicatorsService {
  private readonly logger = new Logger(IndicatorsService.name);
  private readonly dataPath = join(process.cwd(), 'data');

  async getRSIIndicator(coinId: string): Promise<RSIResponse> {
    try {
      const rawData = await fs.readFile(
        join(this.dataPath, `${coinId}.json`),
        'utf-8',
      );
      console.log('Raw data read from file:', rawData);
      const parsedData: RSIResponse = JSON.parse(rawData) as RSIResponse;
      console.log('Parsed JSON data:', parsedData);
      return parsedData;
    } catch (error) {
      this.logger.error('Error reading metrics file:', error);
      throw new InternalServerErrorException('Could not read metrics data');
    }
  }
}

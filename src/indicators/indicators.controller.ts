import { Controller, Get, Param, Query } from '@nestjs/common';
import { IndicatorsService } from './indicators.service';

@Controller('indicators')
export class IndicatorsController {
  constructor(private readonly indicatorsService: IndicatorsService) {}
  @Get('/:coinId/prices')
  getPriceIndicators(@Param('coinId') coinId: string) {
    return this.indicatorsService.getPriceIndicators(coinId);
  }

  @Get('/:coinId')
  getRsiIndicator(
    @Param('coinId') coinId: string,
    @Query('indicatorType') indicatorType: 'rsi' | 'ema20' | 'sma20',
  ) {
    return this.indicatorsService.getIndicator(coinId, indicatorType);
  }
}

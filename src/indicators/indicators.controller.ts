import { Controller, Get, Param, Query } from '@nestjs/common';
import { IndicatorsService } from './indicators.service';
import { IndicatorType } from './interfaces/indicator.interface';

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
    @Query('indicatorType') indicatorType: IndicatorType,
  ) {
    return this.indicatorsService.getIndicator(coinId, indicatorType);
  }
}

import { Controller, Get, Param } from '@nestjs/common';
import { IndicatorsService } from './indicators.service';

@Controller('indicators')
export class IndicatorsController {
  constructor(private readonly indicatorsService: IndicatorsService) {}
  @Get('/rsi/:coinId')
  getRsiIndicator(@Param('coinId') coinId: string) {
    return this.indicatorsService.getRSIIndicator(coinId);
  }
}

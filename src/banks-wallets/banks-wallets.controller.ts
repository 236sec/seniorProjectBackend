import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Types } from 'mongoose';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import { BanksWalletsService } from './banks-wallets.service';
import { CreateBankWalletDto } from './dto/create-bank-wallet.dto';

@Controller('banks-wallets')
export class BanksWalletsController {
  constructor(private readonly banksWalletsService: BanksWalletsService) {}

  @Post()
  create(@Body() createBankWalletDto: CreateBankWalletDto) {
    return this.banksWalletsService.create(createBankWalletDto);
  }

  @Get(':id/balance')
  getCurrentBalance(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.banksWalletsService.getCurrentBalance(id);
  }

  @Get(':id/products')
  getProducts(@Param('id', ParseObjectIdPipe) id: Types.ObjectId) {
    return this.banksWalletsService.getProducts(id);
  }

  @Get(':id/balance/with-token')
  getCurrentBalanceWithToken(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
  ) {
    return this.banksWalletsService.getCurrentBalanceWithToken(id);
  }
}

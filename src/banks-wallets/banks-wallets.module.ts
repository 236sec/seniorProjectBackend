import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TokensModule } from 'src/tokens/tokens.module';
import { BanksWalletsController } from './banks-wallets.controller';
import { BanksWalletsService } from './banks-wallets.service';
import { BankWallet, BankWalletSchema } from './schema/bank-wallets.schema';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: BankWallet.name, schema: BankWalletSchema },
    ]),
    TokensModule,
  ],
  providers: [BanksWalletsService],
  controllers: [BanksWalletsController],
  exports: [BanksWalletsService],
})
export class BanksWalletsModule {}

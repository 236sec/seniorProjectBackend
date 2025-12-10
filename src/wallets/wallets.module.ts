import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlchemysModule } from 'src/alchemys/alchemys.module';
import { TokensModule } from 'src/tokens/tokens.module';
import { UsersModule } from '../users/users.module';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Wallet.name, schema: WalletSchema }]),
    UsersModule,
    AlchemysModule,
    TokensModule,
  ],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlchemysModule } from 'src/alchemys/alchemys.module';
import {
  BlockchainWallet,
  BlockchainWalletSchema,
} from 'src/blockchain-wallets/schema/blockchain-wallet.schema';
import { BlockchainModule } from 'src/blockchain/blockchain.module';
import { CoingeckoModule } from 'src/coingecko/coingecko.module';
import { TokensModule } from 'src/tokens/tokens.module';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { UsersModule } from '../users/users.module';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wallet.name, schema: WalletSchema },
      { name: BlockchainWallet.name, schema: BlockchainWalletSchema },
    ]),
    UsersModule,
    AlchemysModule,
    TokensModule,
    CoingeckoModule,
    TransactionsModule,
    BlockchainModule,
  ],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}

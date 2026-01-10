import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlockchainWalletsController } from './blockchain-wallets.controller';
import { BlockchainWalletsService } from './blockchain-wallets.service';
import {
  BlockchainWallet,
  BlockchainWalletSchema,
} from './schema/blockchain-wallet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BlockchainWallet.name, schema: BlockchainWalletSchema },
    ]),
  ],
  controllers: [BlockchainWalletsController],
  providers: [BlockchainWalletsService],
})
export class BlockchainWalletsModule {}

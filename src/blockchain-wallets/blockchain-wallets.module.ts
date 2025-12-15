import { Module } from '@nestjs/common';
import { BlockchainWalletsController } from './blockchain-wallets.controller';
import { BlockchainWalletsService } from './blockchain-wallets.service';

@Module({
  controllers: [BlockchainWalletsController],
  providers: [BlockchainWalletsService],
})
export class BlockchainWalletsModule {}

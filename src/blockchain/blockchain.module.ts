import { Module } from '@nestjs/common';
import { TokensModule } from 'src/tokens/tokens.module';
import { BlockchainService } from './blockchain.service';

@Module({
  imports: [TokensModule],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}

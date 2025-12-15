import { Controller } from '@nestjs/common';
import { BlockchainWalletsService } from './blockchain-wallets.service';

@Controller('blockchain-wallets')
export class BlockchainWalletsController {
  constructor(
    private readonly blockchainWalletsService: BlockchainWalletsService,
  ) {}
}

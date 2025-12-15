import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainWalletsController } from './blockchain-wallets.controller';
import { BlockchainWalletsService } from './blockchain-wallets.service';

describe('BlockchainWalletsController', () => {
  let controller: BlockchainWalletsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlockchainWalletsController],
      providers: [BlockchainWalletsService],
    }).compile();

    controller = module.get<BlockchainWalletsController>(
      BlockchainWalletsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

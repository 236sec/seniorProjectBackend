import { Test, TestingModule } from '@nestjs/testing';
import { BlockchainWalletsService } from './blockchain-wallets.service';

describe('BlockchainWalletsService', () => {
  let service: BlockchainWalletsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlockchainWalletsService],
    }).compile();

    service = module.get<BlockchainWalletsService>(BlockchainWalletsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { BanksWalletsService } from './banks-wallets.service';

describe('BanksWalletsService', () => {
  let service: BanksWalletsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BanksWalletsService],
    }).compile();

    service = module.get<BanksWalletsService>(BanksWalletsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

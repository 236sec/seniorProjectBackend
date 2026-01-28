import { Test, TestingModule } from '@nestjs/testing';
import { BanksWalletsController } from './banks-wallets.controller';

describe('BanksWalletsController', () => {
  let controller: BanksWalletsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BanksWalletsController],
    }).compile();

    controller = module.get<BanksWalletsController>(BanksWalletsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

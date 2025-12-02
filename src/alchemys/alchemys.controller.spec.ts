import { Test, TestingModule } from '@nestjs/testing';
import { AlchemysController } from './alchemys.controller';
import { AlchemysService } from './alchemys.service';

describe('AlchemysController', () => {
  let controller: AlchemysController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlchemysController],
      providers: [AlchemysService],
    }).compile();

    controller = module.get<AlchemysController>(AlchemysController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

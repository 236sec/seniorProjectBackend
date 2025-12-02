import { Test, TestingModule } from '@nestjs/testing';
import { AlchemysService } from './alchemys.service';

describe('AlchemysService', () => {
  let service: AlchemysService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AlchemysService],
    }).compile();

    service = module.get<AlchemysService>(AlchemysService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

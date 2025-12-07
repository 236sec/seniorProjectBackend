import { Test, TestingModule } from '@nestjs/testing';
import { CoingeckoService } from './coingecko.service';

describe('CoingeckoService', () => {
  let service: CoingeckoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CoingeckoService],
    }).compile();

    service = module.get<CoingeckoService>(CoingeckoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

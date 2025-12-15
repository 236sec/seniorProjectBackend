import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { QueryTokensDto } from './dto/query-tokens.dto';
import { TokensService } from './tokens.service';

@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get('db-update')
  async dbUpdate(
    @Query('startPage') startPage?: number,
    @Query('endPage') endPage?: number,
    @Query('perPage') perPage?: number,
  ) {
    return this.tokensService.updateDatabaseFromCoingecko(
      startPage,
      endPage,
      perPage,
    );
  }

  @Get('generate-contracts')
  async generateContracts(
    @Query('batchSize') batchSize?: number,
    @Query('startIndex') startIndex?: number,
    @Query('endIndex') endIndex?: number,
  ) {
    return this.tokensService.generateTokenContracts(
      batchSize,
      startIndex,
      endIndex,
    );
  }

  @Get('update-images')
  async updateImages(
    @Query('batchSize') batchSize?: number,
    @Query('startIndex') startIndex?: number,
    @Query('endIndex') endIndex?: number,
    @Query('allTokens') allTokens?: boolean,
  ) {
    if (allTokens) {
      return this.tokensService.handleTokenImageUpdate();
    }
    return this.tokensService.updateTokenImages(
      batchSize,
      startIndex,
      endIndex,
    );
  }

  @Get('update-native-coins')
  async updateNativeCoins() {
    return this.tokensService.addAddressToNativeToken();
  }

  @Get()
  findAll(@Query() query: QueryTokensDto) {
    return this.tokensService.findAll(query.page, query.limit, query.search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tokensService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tokensService.remove(id);
  }
}

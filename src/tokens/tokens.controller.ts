import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { QueryTokensDto } from './dto/query-tokens.dto';
import { TokensService } from './tokens.service';

@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get('db-update')
  async dbUpdate() {
    return this.tokensService.updateDatabaseFromCoingecko();
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

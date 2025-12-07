import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoingeckoModule } from 'src/coingecko/coingecko.module';
import {
  TokenUpdateLog,
  TokenUpdateLogSchema,
} from './schema/token-update-log.schema';
import { Token, TokenSchema } from './schema/token.schema';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Token.name, schema: TokenSchema },
      { name: TokenUpdateLog.name, schema: TokenUpdateLogSchema },
    ]),
    CoingeckoModule,
  ],
  controllers: [TokensController],
  providers: [TokensService],
  exports: [TokensService],
})
export class TokensModule {}

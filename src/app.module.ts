import {
  Logger,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { AlchemysModule } from './alchemys/alchemys.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BanksWalletsModule } from './banks-wallets/banks-wallets.module';
import { BlockchainWalletsModule } from './blockchain-wallets/blockchain-wallets.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { CoingeckoModule } from './coingecko/coingecko.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import rpcConfig from './config/rpc.config';
import { IndicatorsModule } from './indicators/indicators.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TokensModule } from './tokens/tokens.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [rpcConfig],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('MongoDB');

        mongoose.set(
          'debug',
          (
            collectionName: string,
            methodName: string,
            ...methodArgs: unknown[]
          ) => {
            const MAX_QUERY_LENGTH = 500;
            let query = '';
            if (methodArgs[0] !== undefined) {
              if (typeof methodArgs[0] === 'string') {
                query = methodArgs[0];
              } else if (
                typeof methodArgs[0] === 'object' &&
                methodArgs[0] !== null
              ) {
                query = JSON.stringify(methodArgs[0]);
              } else if (
                typeof methodArgs[0] === 'number' ||
                typeof methodArgs[0] === 'boolean'
              ) {
                query = String(methodArgs[0]);
              }
            }

            // Truncate if too long
            if (query.length > MAX_QUERY_LENGTH) {
              query = query.substring(0, MAX_QUERY_LENGTH) + '... (truncated)';
            }

            logger.debug(`${collectionName}.${methodName}(${query})`);
          },
        );
        return {
          uri: configService.get<string>('MONGODB_URI'),
          user: configService.get<string>('MONGODB_USER'),
          pass: configService.get<string>('MONGODB_PASS'),
          dbName: configService.get<string>('MONGODB_DATABASE'),
          autoIndex: true,
        };
      },
      inject: [ConfigService],
    }),
    UsersModule,
    AlchemysModule,
    WalletsModule,
    TokensModule,
    BlockchainWalletsModule,
    CoingeckoModule,
    TransactionsModule,
    IndicatorsModule,
    NotificationsModule,
    BlockchainModule,
    BanksWalletsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

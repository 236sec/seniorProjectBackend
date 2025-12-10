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
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { UsersModule } from './users/users.module';
import { AlchemysModule } from './alchemys/alchemys.module';
import { WalletsModule } from './wallets/wallets.module';
import { TokensModule } from './tokens/tokens.module';
import { CoingeckoModule } from './coingecko/coingecko.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
    CoingeckoModule,
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

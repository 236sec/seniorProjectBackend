import { MailerModule } from '@nestjs-modules/mailer';
import { PugAdapter } from '@nestjs-modules/mailer/dist/adapters/pug.adapter';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { CoingeckoModule } from 'src/coingecko/coingecko.module';
import { TokensModule } from 'src/tokens/tokens.module';
import { UsersModule } from 'src/users/users.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { UserAlert, UserAlertSchema } from './schema/notification.schema';

import { join } from 'path';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: UserAlert.name, schema: UserAlertSchema },
    ]),
    UsersModule,
    TokensModule,
    CoingeckoModule,
    ConfigModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('MAILER_HOST'),
          port: configService.get<number>('MAILER_PORT'),
          secure: configService.get<string>('MAILER_SECURE') === 'true',
          auth: {
            user: configService.get<string>('MAILER_USER'),
            pass: configService.get<string>('MAILER_PASS'),
          },
        },
        defaults: {
          from: configService.get<string>('SMTP_FROM'),
        },
        template: {
          dir: join(__dirname, '/../templates'),
          adapter: new PugAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}

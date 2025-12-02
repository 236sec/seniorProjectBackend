import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlchemysController } from './alchemys.controller';
import { AlchemysService } from './alchemys.service';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [AlchemysController],
  providers: [AlchemysService],
  exports: [AlchemysService],
})
export class AlchemysModule {}

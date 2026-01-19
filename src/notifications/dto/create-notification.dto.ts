/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateIf,
} from 'class-validator';
import { Types } from 'mongoose';
import { ToObjectId } from 'src/common/transformers/to-object-id.transformer';
import { AlertCondition } from '../schema/notification.schema';

export class CreateNotificationDto {
  @IsNotEmpty()
  @ToObjectId()
  userId: Types.ObjectId;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  @ValidateIf((o) => !o.coingeckoId || o.tokenId)
  @IsNotEmpty()
  @ToObjectId()
  tokenId: Types.ObjectId;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  @ValidateIf((o) => !o.tokenId || o.coingeckoId)
  @IsNotEmpty()
  @IsString()
  coingeckoId: string;

  @IsNotEmpty()
  @IsNumber()
  targetPrice: number;

  @IsNotEmpty()
  @IsEnum(AlertCondition)
  condition: AlertCondition;
}

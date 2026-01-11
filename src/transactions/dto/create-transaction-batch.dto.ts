import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, ValidateNested } from 'class-validator';
import { Types } from 'mongoose';
import { ToObjectId } from 'src/common/transformers/to-object-id.transformer';
import { TransctionInfo } from './create-transaction.dto';

export class CreateTransactionBatchDto {
  @IsNotEmpty()
  @ToObjectId()
  walletId: Types.ObjectId;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransctionInfo)
  items: TransctionInfo[];
}

import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { TransctionInfo } from './create-transaction.dto';

export class CreateTransactionBatchDto {
  @IsNotEmpty()
  @IsString()
  walletId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransctionInfo)
  items: TransctionInfo[];
}

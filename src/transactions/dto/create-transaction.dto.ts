import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Types } from 'mongoose';
import { ToObjectId } from 'src/common/transformers/to-object-id.transformer';
import {
  TransactionEventType,
  TransactionType,
} from '../schema/transaction.schema';

export class TransctionInfo {
  @IsOptional()
  @ToObjectId()
  blockchainWalletId: Types.ObjectId;

  @IsString()
  @IsEnum(TransactionType)
  type: TransactionType;

  @IsOptional()
  @IsString()
  from: string;

  @IsOptional()
  @IsString()
  to: string;

  @IsOptional()
  @IsString()
  @IsEnum(TransactionEventType)
  event_type: TransactionEventType;

  @IsOptional()
  @IsNotEmpty()
  @ToObjectId()
  tokenContractId: Types.ObjectId;

  @IsOptional()
  @ToObjectId()
  tokenId: Types.ObjectId;

  @IsOptional()
  @IsString()
  quantity: string;

  @IsOptional()
  @IsNumber()
  price_usd: number;

  @IsOptional()
  @IsNumber()
  cashflow_usd: number;

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  timestamp: Date;
}

export class CreateTransactionDto extends TransctionInfo {
  @IsNotEmpty()
  @ToObjectId()
  walletId: Types.ObjectId;
}

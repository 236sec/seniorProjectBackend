import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  TransactionEventType,
  TransactionType,
} from '../schema/transaction.schema';

export class TransctionInfo {
  @IsOptional()
  @IsMongoId()
  blockchainWalletId: string;

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
  @IsMongoId()
  tokenContractId: string;

  @IsOptional()
  @IsString()
  quantity: string;

  @IsOptional()
  @IsNumber()
  price_usd: number;

  @IsOptional()
  @IsNumber()
  cashflow_usd: number;
}

export class CreateTransactionDto extends TransctionInfo {
  @IsNotEmpty()
  @IsMongoId()
  walletId: string;
}

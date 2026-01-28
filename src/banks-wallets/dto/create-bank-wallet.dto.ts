import { IsNotEmpty, IsString } from 'class-validator';
import { Types } from 'mongoose';
import { ToObjectId } from 'src/common/transformers/to-object-id.transformer';

export class CreateBankWalletDto {
  @IsNotEmpty()
  @ToObjectId()
  readonly walletId: Types.ObjectId;

  @IsNotEmpty()
  @IsString()
  readonly apiKey: string;

  @IsNotEmpty()
  @IsString()
  readonly apiSecret: string;
}

import {
  ArrayNotEmpty,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class AddBlockchainWalletDto {
  @IsNotEmpty()
  @IsMongoId()
  walletId: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  chains: string[];
}

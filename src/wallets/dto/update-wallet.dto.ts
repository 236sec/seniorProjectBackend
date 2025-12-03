import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateWalletDto {
  @IsNotEmpty()
  @IsString()
  readonly name?: string;

  @IsNotEmpty()
  @IsString()
  readonly description?: string;
}

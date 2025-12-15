import { PartialType } from '@nestjs/mapped-types';
import { CreateBlockchainWalletDto } from './create-blockchain-wallet.dto';

export class UpdateBlockchainWalletDto extends PartialType(
  CreateBlockchainWalletDto,
) {}

import { Body, Controller, Param, Patch } from '@nestjs/common';
import { Types } from 'mongoose';
import { ParseObjectIdPipe } from 'src/common/pipes/parse-object-id.pipe';
import { BlockchainWalletsService } from './blockchain-wallets.service';
import { UpdateBlockchainWalletDto } from './dto/update-blockchain-wallet.dto';

@Controller('blockchain-wallets')
export class BlockchainWalletsController {
  constructor(
    private readonly blockchainWalletsService: BlockchainWalletsService,
  ) {}

  @Patch('/:id')
  update(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() updateBlockchainWalletDto: UpdateBlockchainWalletDto,
  ) {
    return this.blockchainWalletsService.update(id, updateBlockchainWalletDto);
  }
}

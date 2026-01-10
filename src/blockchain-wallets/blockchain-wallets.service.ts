import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpdateBlockchainWalletDto } from './dto/update-blockchain-wallet.dto';
import { BlockchainWallet } from './schema/blockchain-wallet.schema';

@Injectable()
export class BlockchainWalletsService {
  constructor(
    @InjectModel(BlockchainWallet.name)
    private blockchainWalletModel: Model<BlockchainWallet>,
  ) {}

  async update(
    id: Types.ObjectId,
    updateBlockchainWalletDto: UpdateBlockchainWalletDto,
  ) {
    const oldWallet = await this.blockchainWalletModel.findById(id);
    if (!oldWallet) {
      throw new NotFoundException('Blockchain wallet not found');
    }

    // Merge old chains with new chains, removing duplicates
    const mergedChains = updateBlockchainWalletDto.chains
      ? Array.from(
          new Set([
            ...(oldWallet.chains || []),
            ...updateBlockchainWalletDto.chains,
          ]),
        )
      : oldWallet.chains;

    await this.blockchainWalletModel.findByIdAndUpdate(id, {
      ...updateBlockchainWalletDto,
      chains: mergedChains,
    });
    return { _id: id };
  }
}

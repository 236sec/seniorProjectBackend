import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AlchemysService } from 'src/alchemys/alchemys.service';
import {
  BlockchainWallet,
  BlockchainWalletDocument,
  TokenBalance,
} from 'src/blockchain-wallets/schema/blockchain-wallet.schema';
import {
  addHexBalances,
  isZeroOrNegative,
  subHexBalances,
} from 'src/common/utils/bigint-string.util';
import {
  TokenContract,
  TokenContractDocument,
} from 'src/tokens/schema/token-contract.schema';
import { Wallet, WalletDocument } from 'src/wallets/schemas/wallet.schema';
import { CreateTransactionBatchDto } from './dto/create-transaction-batch.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import {
  Transaction,
  TransactionDocument,
  TransactionEventType,
  TransactionType,
} from './schema/transaction.schema';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
    @InjectModel(TokenContract.name)
    private tokenContractModel: Model<TokenContractDocument>,
    @InjectModel(BlockchainWallet.name)
    private blockchainWalletModel: Model<BlockchainWalletDocument>,
    @InjectModel(Wallet.name)
    private walletModel: Model<WalletDocument>,
    private readonly alchemysService: AlchemysService,
  ) {}
  async create(createTransactionDto: CreateTransactionDto) {
    // check wallet exists
    const wallet = await this.walletModel
      .findById(createTransactionDto.walletId)
      .exec();
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    // check token contract exists
    const tokenContractId = new Types.ObjectId(
      createTransactionDto.tokenContractId,
    );
    const tokenContract = await this.tokenContractModel
      .findById(tokenContractId)
      .exec();
    if (!tokenContract) {
      throw new Error('Token contract not found');
    }
    if (createTransactionDto.type === TransactionType.SYNCED) {
      const blockchainWalletId = new Types.ObjectId(
        createTransactionDto.blockchainWalletId,
      );
      const blockchainWallet = await this.blockchainWalletModel
        .findById(blockchainWalletId)
        .exec();
      if (!blockchainWallet) {
        throw new Error('Blockchain wallet not found');
      }

      // update token balance in blockchain wallet
      const tokenId = tokenContract._id as unknown as Types.ObjectId;
      const existingIndex = blockchainWallet.tokens.findIndex((t) =>
        t.tokenContractId.equals(tokenId),
      );
      if (existingIndex >= 0) {
        const currentStr =
          (blockchainWallet.tokens[existingIndex]
            .balance as unknown as string) || '0x0';
        const deltaStr =
          (createTransactionDto.quantity as unknown as string) || '0x0';
        if (createTransactionDto.event_type === TransactionEventType.DEPOSIT) {
          blockchainWallet.tokens[existingIndex].balance = addHexBalances(
            currentStr,
            deltaStr,
            18,
          );
        } else if (
          createTransactionDto.event_type === TransactionEventType.WITHDRAWAL
        ) {
          const newBalance = subHexBalances(currentStr, deltaStr, 18);
          // Check if balance is zero or negative, remove token from array
          if (isZeroOrNegative(newBalance)) {
            blockchainWallet.tokens.splice(existingIndex, 1);
          } else {
            blockchainWallet.tokens[existingIndex].balance = newBalance;
          }
        }
      } else {
        const tb: TokenBalance = {
          tokenContractId: tokenId,
          balance: createTransactionDto.quantity,
        };
        blockchainWallet.tokens.push(tb);
      }
      await blockchainWallet.save();
    }

    if (createTransactionDto.type === TransactionType.MANUAL) {
      // For MANUAL transactions, we might have different logic in future
    }

    const createdTransaction = new this.transactionModel(createTransactionDto);
    return createdTransaction.save();
  }

  async createBatch(batchDto: CreateTransactionBatchDto) {
    const { walletId, items } = batchDto;
    const wallet = await this.walletModel.findById(walletId).exec();
    if (!wallet) throw new Error('Wallet not found');
    const results: TransactionDocument[] = [];
    for (const item of items) {
      // check blockchain wallet exists
      const blockchainWallet = await this.blockchainWalletModel
        .findById(item.blockchainWalletId)
        .exec();
      if (!blockchainWallet) throw new Error('Blockchain wallet not found');
      const blockchainWalletId = blockchainWallet._id.toString();

      // check token contract exists
      const tokenContract = await this.tokenContractModel
        .findById(item.tokenContractId)
        .exec();
      if (!tokenContract) throw new Error('Token contract not found');

      const dto: CreateTransactionDto = {
        ...item,
        blockchainWalletId,
        walletId,
      } as CreateTransactionDto;

      if (dto.type === TransactionType.SYNCED) {
        const tokenId = tokenContract._id as unknown as Types.ObjectId;
        const existingIndex = blockchainWallet.tokens.findIndex((t) =>
          t.tokenContractId.equals(tokenId),
        );

        if (dto.event_type === TransactionEventType.DEPOSIT) {
          // DEPOSIT: Add to balance
          if (existingIndex >= 0) {
            const currentStr =
              (blockchainWallet.tokens[existingIndex]
                .balance as unknown as string) || '0x0';
            const deltaStr = (dto.quantity as unknown as string) || '0x0';
            blockchainWallet.tokens[existingIndex].balance = addHexBalances(
              currentStr,
              deltaStr,
              18,
            );
          } else {
            const tb: TokenBalance = {
              tokenContractId: tokenId,
              balance: dto.quantity,
            };
            blockchainWallet.tokens.push(tb);
          }
        } else if (dto.event_type === TransactionEventType.WITHDRAWAL) {
          // WITHDRAWAL: Subtract from balance
          if (existingIndex >= 0) {
            const currentStr =
              (blockchainWallet.tokens[existingIndex]
                .balance as unknown as string) || '0x0';
            const deltaStr = (dto.quantity as unknown as string) || '0x0';
            const newBalance = subHexBalances(currentStr, deltaStr, 18);

            // Check if balance is zero or negative, remove token from array
            if (isZeroOrNegative(newBalance)) {
              blockchainWallet.tokens.splice(existingIndex, 1);
            } else {
              blockchainWallet.tokens[existingIndex].balance = newBalance;
            }
          }
          // If token doesn't exist and it's a withdrawal, ignore
        }
        await blockchainWallet.save();
      }

      if (dto.type === TransactionType.MANUAL) {
        // For MANUAL transactions, we might have different logic in future
      }

      const created = new this.transactionModel(dto);
      results.push(await created.save());
    }
    return results;
  }

  findAll() {
    return `This action returns all transactions`;
  }

  findOne(id: number) {
    return `This action returns a #${id} transaction`;
  }

  update(id: number, _updateTransactionDto: UpdateTransactionDto) {
    void _updateTransactionDto;
    return `This action updates a #${id} transaction`;
  }

  async remove(id: Types.ObjectId) {
    const tx = await this.transactionModel.findById(id).exec();

    if (!tx) {
      throw new Error('Transaction not found');
    }

    if (tx.type === TransactionType.SYNCED) {
      const blockchainWallet = await this.blockchainWalletModel
        .findById(tx.blockchainWalletId)
        .exec();

      if (!blockchainWallet) {
        throw new Error('Blockchain wallet not found');
      }

      const tokenId = new Types.ObjectId(tx.tokenContractId);
      const idx = blockchainWallet.tokens.findIndex((t) =>
        t.tokenContractId.equals(tokenId),
      );

      if (idx >= 0) {
        const currentStr =
          (blockchainWallet.tokens[idx].balance as unknown as string) || '0x0';
        const deltaStr = (tx.quantity as unknown as string) || '0x0';
        blockchainWallet.tokens[idx].balance = subHexBalances(
          currentStr,
          deltaStr,
          18,
        );
        await blockchainWallet.save();
      }
    }

    if (tx.type === TransactionType.MANUAL) {
      // TODO: Implement manual transaction reversal logic in future
    }

    await this.transactionModel.deleteOne({ _id: tx._id }).exec();
    return { removed: true, id: tx._id.toString() };
  }
}

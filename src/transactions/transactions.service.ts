import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AlchemysService } from 'src/alchemys/alchemys.service';
import {
  BlockchainWallet,
  BlockchainWalletDocument,
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
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(TokenContract.name)
    private readonly tokenContractModel: Model<TokenContractDocument>,
    @InjectModel(BlockchainWallet.name)
    private readonly blockchainWalletModel: Model<BlockchainWalletDocument>,
    @InjectModel(Wallet.name)
    private readonly walletModel: Model<WalletDocument>,
    private readonly alchemysService: AlchemysService,
  ) {}
  async create(createTransactionDto: CreateTransactionDto) {
    // validate transaction
    const { wallet, tokenContract } = await this.validateTransaction(
      createTransactionDto.walletId,
      createTransactionDto.tokenContractId,
    );
    if (!wallet || !tokenContract) {
      throw new Error('Validation failed for transaction');
    }
    if (createTransactionDto.type === TransactionType.SYNCED) {
      const blockchainWalletId = new Types.ObjectId(
        createTransactionDto.blockchainWalletId,
      );

      if (
        !wallet.blockchainWalletId.some((id) => id.equals(blockchainWalletId))
      ) {
        throw new Error(
          'Blockchain wallet does not belong to the specified wallet',
        );
      }

      const blockchainWallet = await this.blockchainWalletModel
        .findById(blockchainWalletId)
        .exec();
      if (!blockchainWallet) {
        throw new Error('Blockchain wallet not found');
      }

      // update token balance in blockchain wallet
      this.updateWalletBalance(
        blockchainWallet,
        tokenContract._id,
        createTransactionDto.quantity,
        createTransactionDto.event_type,
      );
      await blockchainWallet.save();
    }

    if (createTransactionDto.type === TransactionType.MANUAL) {
      this.updateManualWalletBalance(
        wallet,
        tokenContract._id,
        createTransactionDto.quantity,
        createTransactionDto.event_type,
      );
      await wallet.save();
    }

    const createdTransaction = new this.transactionModel(createTransactionDto);
    return createdTransaction.save();
  }

  async validateTransaction(walletId: string, tokenContractId: string) {
    const [wallet, tokenContract] = await Promise.all([
      this.walletModel.findById(walletId).exec(),
      this.tokenContractModel.findById(tokenContractId).exec(),
    ]);
    return { wallet, tokenContract };
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

      if (
        !wallet.blockchainWalletId.some((id) => id.equals(blockchainWallet._id))
      ) {
        throw new Error(
          `Blockchain wallet ${blockchainWalletId} does not belong to the specified wallet`,
        );
      }

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
        this.updateWalletBalance(
          blockchainWallet,
          tokenContract._id,
          dto.quantity,
          dto.event_type,
        );
        await blockchainWallet.save();
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

  private updateWalletBalance(
    blockchainWallet: BlockchainWalletDocument,
    tokenContractId: Types.ObjectId,
    quantity: string,
    eventType: TransactionEventType,
  ) {
    const existingIndex = blockchainWallet.tokens.findIndex((t) =>
      t.tokenContractId.equals(tokenContractId),
    );
    const deltaStr = quantity || '0x0';

    if (eventType === TransactionEventType.DEPOSIT) {
      if (existingIndex >= 0) {
        const currentStr =
          blockchainWallet.tokens[existingIndex].balance || '0x0';
        blockchainWallet.tokens[existingIndex].balance = addHexBalances(
          currentStr,
          deltaStr,
          18,
        );
      } else {
        blockchainWallet.tokens.push({
          tokenContractId,
          balance: deltaStr,
        });
      }
    } else if (eventType === TransactionEventType.WITHDRAWAL) {
      if (existingIndex >= 0) {
        const currentStr =
          blockchainWallet.tokens[existingIndex].balance || '0x0';
        const newBalance = subHexBalances(currentStr, deltaStr, 18);

        if (isZeroOrNegative(newBalance)) {
          blockchainWallet.tokens.splice(existingIndex, 1);
        } else {
          blockchainWallet.tokens[existingIndex].balance = newBalance;
        }
      }
    }
  }

  private updateManualWalletBalance(
    wallet: WalletDocument,
    tokenContractId: Types.ObjectId,
    quantity: string,
    eventType: TransactionEventType,
  ) {
    if (!wallet.manualTokens) {
      wallet.manualTokens = [];
    }
    const existingIndex = wallet.manualTokens.findIndex((t) =>
      t.tokenContractId.equals(tokenContractId),
    );
    const deltaStr = quantity || '0x0';

    if (eventType === TransactionEventType.DEPOSIT) {
      if (existingIndex >= 0) {
        const currentStr = wallet.manualTokens[existingIndex].balance || '0x0';
        wallet.manualTokens[existingIndex].balance = addHexBalances(
          currentStr,
          deltaStr,
          18,
        );
      } else {
        wallet.manualTokens.push({
          tokenContractId,
          balance: deltaStr,
        });
      }
    } else if (eventType === TransactionEventType.WITHDRAWAL) {
      if (existingIndex >= 0) {
        const currentStr = wallet.manualTokens[existingIndex].balance || '0x0';
        const newBalance = subHexBalances(currentStr, deltaStr, 18);

        if (isZeroOrNegative(newBalance)) {
          wallet.manualTokens.splice(existingIndex, 1);
        } else {
          wallet.manualTokens[existingIndex].balance = newBalance;
        }
      }
    }
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
        const currentStr = blockchainWallet.tokens[idx].balance || '0x0';
        const deltaStr = tx.quantity || '0x0';
        blockchainWallet.tokens[idx].balance = subHexBalances(
          currentStr,
          deltaStr,
          18,
        );
        await blockchainWallet.save();
      }
    }

    if (tx.type === TransactionType.MANUAL) {
      const wallet = await this.walletModel.findById(tx.walletId).exec();
      if (wallet) {
        // Reversal logic: DEPOSIT -> WITHDRAWAL, WITHDRAWAL -> DEPOSIT
        const reversalEventType =
          tx.event_type === TransactionEventType.DEPOSIT
            ? TransactionEventType.WITHDRAWAL
            : TransactionEventType.DEPOSIT;

        this.updateManualWalletBalance(
          wallet,
          new Types.ObjectId(tx.tokenContractId),
          tx.quantity,
          reversalEventType,
        );
        await wallet.save();
      }
    }

    await this.transactionModel.deleteOne({ _id: tx._id }).exec();
    return { removed: true, id: tx._id.toString() };
  }
}

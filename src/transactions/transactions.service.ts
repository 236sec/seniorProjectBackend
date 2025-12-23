import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { Token, TokenDocument } from 'src/tokens/schema/token.schema';
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
    @InjectModel(Token.name)
    private readonly tokenModel: Model<TokenDocument>,
    private readonly alchemysService: AlchemysService,
  ) {}
  async create(createTransactionDto: CreateTransactionDto) {
    // validate transaction
    const { wallet, tokenContract, token } = await this.validateTransaction(
      createTransactionDto.walletId,
      createTransactionDto.tokenContractId,
      createTransactionDto.tokenId,
    );
    if (!wallet) {
      throw new BadRequestException('Wallet not found');
    }
    if (createTransactionDto.type === TransactionType.SYNCED) {
      if (createTransactionDto.tokenContractId && !tokenContract) {
        throw new BadRequestException('Token contract not found');
      }
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
        tokenContract!._id,
        createTransactionDto.quantity,
        createTransactionDto.event_type,
      );
      await blockchainWallet.save();
    }

    if (createTransactionDto.type === TransactionType.MANUAL) {
      if (createTransactionDto.tokenId && !token) {
        throw new BadRequestException('Token not found');
      }
      this.updateManualWalletBalance(
        wallet,
        token!._id,
        createTransactionDto.quantity,
        createTransactionDto.event_type,
      );
      await wallet.save();
    }

    const createdTransaction = new this.transactionModel(createTransactionDto);
    return createdTransaction.save();
  }

  async validateTransaction(
    walletId: string,
    tokenContractId: string | undefined,
    tokenId: string | undefined,
  ) {
    const walletPromise = this.walletModel.findById(walletId).exec();
    const tokenContractPromise = tokenContractId
      ? this.tokenContractModel.findById(tokenContractId).exec()
      : Promise.resolve(null);
    const tokenIdPromise = tokenId
      ? this.tokenModel.findById(new Types.ObjectId(tokenId)).exec()
      : Promise.resolve(null);

    const [wallet, tokenContract, token] = await Promise.all([
      walletPromise,
      tokenContractPromise,
      tokenIdPromise,
    ]);
    return { wallet, tokenContract, token };
  }

  async createBatch(batchDto: CreateTransactionBatchDto) {
    const { walletId, items } = batchDto;
    const wallet = await this.walletModel.findById(walletId).exec();
    if (!wallet) throw new Error('Wallet not found');
    const results: TransactionDocument[] = [];
    let isWalletModified = false;

    for (const item of items) {
      const dto: CreateTransactionDto = {
        ...item,
        walletId,
      } as CreateTransactionDto;

      if (dto.type === TransactionType.SYNCED) {
        // check blockchain wallet exists
        const blockchainWallet = await this.blockchainWalletModel
          .findById(item.blockchainWalletId)
          .exec();
        if (!blockchainWallet) throw new Error('Blockchain wallet not found');
        const blockchainWalletId = blockchainWallet._id.toString();

        if (
          !wallet.blockchainWalletId.some((id) =>
            id.equals(blockchainWallet._id),
          )
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

        this.updateWalletBalance(
          blockchainWallet,
          tokenContract._id,
          dto.quantity,
          dto.event_type,
        );
        await blockchainWallet.save();
      } else if (dto.type === TransactionType.MANUAL) {
        // check token exists
        const token = await this.tokenModel.findById(item.tokenId).exec();
        if (!token) throw new Error('Token not found');

        this.updateManualWalletBalance(
          wallet,
          token._id,
          dto.quantity,
          dto.event_type,
        );
        isWalletModified = true;
      }

      const created = new this.transactionModel(dto);
      results.push(await created.save());
    }

    if (isWalletModified) {
      await wallet.save();
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
          if (newBalance === '0x0') {
            blockchainWallet.tokens.splice(existingIndex, 1);
          } else {
            throw new Error('Insufficient balance for withdrawal');
          }
        } else {
          blockchainWallet.tokens[existingIndex].balance = newBalance;
        }
      } else {
        throw new Error('Token not found in wallet for withdrawal');
      }
    }
  }

  private updateManualWalletBalance(
    wallet: WalletDocument,
    tokenId: Types.ObjectId,
    quantity: string,
    eventType: TransactionEventType,
  ) {
    if (!wallet.manualTokens) {
      wallet.manualTokens = [];
    }
    const existingIndex = wallet.manualTokens.findIndex((t) =>
      t.tokenId.equals(tokenId),
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
          tokenId,
          balance: deltaStr,
        });
      }
    } else if (eventType === TransactionEventType.WITHDRAWAL) {
      if (existingIndex >= 0) {
        const currentStr = wallet.manualTokens[existingIndex].balance || '0x0';
        const newBalance = subHexBalances(currentStr, deltaStr, 18);

        if (isZeroOrNegative(newBalance)) {
          if (newBalance === '0x0') {
            wallet.manualTokens.splice(existingIndex, 1);
          } else {
            throw new Error('Insufficient balance for withdrawal');
          }
        } else {
          wallet.manualTokens[existingIndex].balance = newBalance;
        }
      } else {
        throw new Error('Token not found in wallet for withdrawal');
      }
    }
  }

  async remove(id: Types.ObjectId) {
    const tx = await this.transactionModel.findById(id).exec();

    if (!tx) {
      throw new NotFoundException('Transaction not found');
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
          new Types.ObjectId(tx.tokenId),
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

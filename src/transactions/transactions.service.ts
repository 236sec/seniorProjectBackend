import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  BlockchainWallet,
  BlockchainWalletDocument,
} from 'src/blockchain-wallets/schema/blockchain-wallet.schema';
import { CoingeckoService } from 'src/coingecko/coingecko.service';
import {
  addHexBalances,
  isNegetive,
  isZero,
  subHexBalances,
  toBigInt,
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
    private readonly coingeckoService: CoingeckoService,
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

      // Populate tokenId from tokenContract for portfolio performance calculation
      if (!createTransactionDto.tokenId && tokenContract) {
        createTransactionDto.tokenId = new Types.ObjectId(
          tokenContract.tokenId,
        );
      }
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

    const createdTransaction = new this.transactionModel({
      ...createTransactionDto,
      walletId: new Types.ObjectId(createTransactionDto.walletId),
    });
    const savedTransaction = await createdTransaction.save();

    // Calculate and update portfolio performance
    await this.calculateAndUpdatePortfolioPerformance(
      new Types.ObjectId(createTransactionDto.walletId),
      [savedTransaction],
    );

    return savedTransaction;
  }

  async validateTransaction(
    walletId: Types.ObjectId,
    tokenContractId: Types.ObjectId | undefined,
    tokenId: Types.ObjectId | undefined,
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

    for (const item of items) {
      const dto: CreateTransactionDto = {
        ...item,
        walletId: walletId,
      };

      if (dto.type !== TransactionType.SYNCED) {
        throw new BadRequestException(
          'Batch creation only supports SYNCED transactions',
        );
      }

      // check blockchain wallet exists
      const blockchainWallet = await this.blockchainWalletModel
        .findById(item.blockchainWalletId)
        .exec();
      if (!blockchainWallet) throw new Error('Blockchain wallet not found');

      if (
        !wallet.blockchainWalletId.some((id) => id.equals(blockchainWallet._id))
      ) {
        throw new Error(
          `Blockchain wallet ${blockchainWallet._id.toString()} does not belong to the specified wallet`,
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

      // Populate tokenId from tokenContract for portfolio performance calculation
      if (!dto.tokenId && tokenContract) {
        dto.tokenId = new Types.ObjectId(tokenContract.tokenId.toString());
      }

      const created = new this.transactionModel({
        ...dto,
        walletId: new Types.ObjectId(dto.walletId),
      });
      results.push(await created.save());
    }

    // Calculate and update portfolio performance after batch
    await this.calculateAndUpdatePortfolioPerformance(
      new Types.ObjectId(walletId),
      results,
    );

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
        const newBalance = subHexBalances(currentStr, deltaStr);

        if (isZero(newBalance)) {
          blockchainWallet.tokens.splice(existingIndex, 1);
        } else if (isNegetive(newBalance)) {
          throw new Error('Insufficient balance for withdrawal');
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
        const newBalance = subHexBalances(currentStr, deltaStr);

        if (isZero(newBalance)) {
          wallet.manualTokens.splice(existingIndex, 1);
        } else if (isNegetive(newBalance)) {
          throw new Error('Insufficient balance for withdrawal');
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

    // Recalculate portfolio performance after removal
    await this.calculateAndUpdatePortfolioPerformance(tx.walletId, [tx]);

    return { removed: true, id: tx._id.toString() };
  }

  async findByWalletId(walletId: Types.ObjectId) {
    // sort by timestamp descending
    return this.transactionModel
      .find({ walletId: walletId })
      .sort({ timestamp: -1 })
      .populate('tokenId')
      .exec();
  }

  async findByWalletWithPagination(
    walletId: Types.ObjectId,
    limit?: number,
    offset?: number,
  ) {
    // Set defaults
    const finalLimit = limit && limit > 0 ? limit : 10;
    const finalOffset = offset && offset > 0 ? offset : 0;

    // Execute query and count in parallel
    const [data, total] = await Promise.all([
      this.transactionModel
        .find({ walletId: walletId })
        .sort({ timestamp: -1 })
        .populate('tokenId')
        .skip(finalOffset)
        .limit(finalLimit)
        .exec(),
      this.transactionModel.countDocuments({ walletId: walletId }).exec(),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / finalLimit);
    const currentPage = Math.floor(finalOffset / finalLimit) + 1;
    const hasNextPage = finalOffset + finalLimit < total;
    const hasPrevPage = finalOffset > 0;

    return {
      data,
      pagination: {
        page: currentPage,
        limit: finalLimit,
        offset: finalOffset,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    };
  }

  private async calculateAndUpdatePortfolioPerformance(
    walletId: Types.ObjectId,
    txs: TransactionDocument[],
  ) {
    void txs;
    // Fetch all transactions for the wallet
    const transactions = await this.transactionModel.find({ walletId }).exec();

    // Update performance with all transactions
    await this.updatePerformaceWithTransactions(walletId, transactions);
  }

  private async updatePerformaceWithTransactions(
    walletId: Types.ObjectId,
    transactions: TransactionDocument[],
  ) {
    const wallet = await this.walletModel.findById(walletId).exec();
    if (!wallet) {
      return new NotFoundException('Wallet not found');
    }

    // Group transactions by tokenId
    const transactionsByToken = new Map<string, TransactionDocument[]>();

    transactions.forEach((tx) => {
      if (!tx.tokenId) return;

      const tokenIdStr = tx.tokenId.toString();
      if (!transactionsByToken.has(tokenIdStr)) {
        transactionsByToken.set(tokenIdStr, []);
      }
      transactionsByToken.get(tokenIdStr)!.push(tx);
    });

    // Update or create performance for each token
    for (const [tokenIdStr, tokenTransactions] of transactionsByToken) {
      const tokenId = new Types.ObjectId(tokenIdStr);

      // Sort transactions by date for cost basis calculation
      tokenTransactions.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );

      // Calculate totals from transactions
      let totalInvestedAmount = 0;
      let totalBalance = '0x0';
      let totalCashflowUsd = 0;

      // Cost Basis Calculation Variables
      let currentCostBasis = 0;
      let currentQuantity = 0n;

      tokenTransactions.forEach((tx) => {
        const txQuantity = toBigInt(tx.quantity || '0x0');

        // Calculate total invested amount (deposits)
        if (tx.event_type === TransactionEventType.DEPOSIT && tx.cashflow_usd) {
          totalInvestedAmount += tx.cashflow_usd;
        }

        // Calculate total balance
        if (tx.event_type === TransactionEventType.DEPOSIT) {
          totalBalance = addHexBalances(totalBalance, tx.quantity || '0x0');
        } else if (tx.event_type === TransactionEventType.WITHDRAWAL) {
          totalBalance = subHexBalances(totalBalance, tx.quantity || '0x0');
        }

        // Calculate total cashflow USD
        if (tx.cashflow_usd) {
          if (tx.event_type === TransactionEventType.DEPOSIT) {
            totalCashflowUsd -= tx.cashflow_usd;
          } else if (tx.event_type === TransactionEventType.WITHDRAWAL) {
            totalCashflowUsd += tx.cashflow_usd;
          }
        }

        // Cost Basis Calculation
        if (tx.event_type === TransactionEventType.DEPOSIT) {
          // Step 2: Add the New Deposit
          currentCostBasis += tx.cashflow_usd || 0;
          currentQuantity += txQuantity;
        } else if (tx.event_type === TransactionEventType.WITHDRAWAL) {
          // Step 1: Adjust the Old Cost Basis for Withdrawals
          if (currentQuantity > 0n) {
            const remainingQuantity = currentQuantity - txQuantity;
            const fraction =
              Number(remainingQuantity) / Number(currentQuantity);
            currentCostBasis = currentCostBasis * fraction;
            currentQuantity = remainingQuantity;
          } else {
            currentQuantity -= txQuantity;
          }
        }
      });

      // Calculate Average Unit Cost
      // Assuming 18 decimals as per other parts of the code
      const currentQuantityNum = Number(currentQuantity) / 1e18;
      let averageUnitCost = 0;
      if (currentQuantityNum > 0) {
        averageUnitCost = currentCostBasis / currentQuantityNum;
      }

      // Find existing performance entry
      const existingIndex = wallet.portfolioPerformance.findIndex((p) =>
        p.tokenId.equals(tokenId),
      );

      if (existingIndex >= 0) {
        // Update existing performance
        wallet.portfolioPerformance[existingIndex].totalInvestedAmount =
          totalInvestedAmount;
        wallet.portfolioPerformance[existingIndex].totalBalance = totalBalance;
        wallet.portfolioPerformance[existingIndex].totalCashflowUsd =
          totalCashflowUsd;
        wallet.portfolioPerformance[existingIndex].costBasis = currentCostBasis;
        wallet.portfolioPerformance[existingIndex].averageUnitCost =
          averageUnitCost;
      } else {
        // Create new performance entry
        wallet.portfolioPerformance.push({
          tokenId,
          totalInvestedAmount,
          totalBalance,
          totalCashflowUsd,
          costBasis: currentCostBasis,
          averageUnitCost: averageUnitCost,
        });
      }
    }

    await wallet.save();
  }
}

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AlchemysService } from 'src/alchemys/alchemys.service';
import {
  BlockchainWallet,
  BlockchainWalletDocument,
} from 'src/blockchain-wallets/schema/blockchain-wallet.schema';
import { CoingeckoService } from 'src/coingecko/coingecko.service';
import { CHAIN_MAPPING } from 'src/common/constants/chain-mapping.constant';
import { TokensService } from 'src/tokens/tokens.service';
import { TransactionsService } from 'src/transactions/transactions.service';
import { UsersService } from '../users/users.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import {
  NormalizedBlockchainWallet,
  NormalizedManualToken,
  NormalizedPortfolioPerformance,
  NormalizedTokenContract,
  NormalizedWallet,
  PopulatedToken,
  PopulatedWallet,
  TokenInfo,
  WalletWithTokens,
} from './interface/get-wallet.dto';
import { PortfolioPerformance } from './schemas/portfolio-performance.schema';
import { Wallet, WalletDocument } from './schemas/wallet.schema';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    @InjectModel(Wallet.name)
    private readonly walletModel: Model<WalletDocument>,
    @InjectModel(BlockchainWallet.name)
    private readonly blockchainWalletModel: Model<BlockchainWalletDocument>,
    private readonly usersService: UsersService,
    private readonly alchemysService: AlchemysService,
    private readonly tokensService: TokensService,
    private readonly coingeckoService: CoingeckoService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async create(userId: Types.ObjectId, createWalletDto: CreateWalletDto) {
    const userWithWallets = await this.usersService.findOneWithWallets(userId);
    if (!userWithWallets) {
      throw new NotFoundException('User does not exist');
    }

    const populatedWallets = userWithWallets.wallets as unknown as Wallet[];
    const existingWalletNames =
      populatedWallets?.map((wallet) => wallet.name) || [];
    if (existingWalletNames.includes(createWalletDto.name)) {
      throw new ConflictException(
        'Wallet with this name already exists for this user',
      );
    }

    const walletData = {
      ...createWalletDto,
      userId: userId,
    };

    const createdWallet = new this.walletModel(walletData);
    const savedWallet = await createdWallet.save();

    await this.usersService.addWalletToUser(userId, savedWallet._id);

    return savedWallet;
  }

  findAll() {
    return this.walletModel.find().exec();
  }

  async findOne(id: Types.ObjectId): Promise<WalletWithTokens | null> {
    const wallet = await this.walletModel
      .findById(id)
      .populate({
        path: 'blockchainWalletId',
        populate: {
          path: 'tokens.tokenContractId',
          populate: {
            path: 'tokenId',
          },
        },
      })
      .populate('manualTokens.tokenId')
      .exec();

    if (!wallet) {
      return null;
    }

    // Normalize the response: extract tokens and replace with IDs
    const tokensMap = new Map<string, TokenInfo>();
    const walletObj = wallet.toObject() as PopulatedWallet;

    // Extract tokens from manualTokens and create normalized array
    const normalizedManualTokens: NormalizedManualToken[] = [];
    if (walletObj.manualTokens && Array.isArray(walletObj.manualTokens)) {
      walletObj.manualTokens.forEach((item) => {
        if (
          typeof item.tokenId === 'object' &&
          '_id' in item.tokenId &&
          'symbol' in item.tokenId &&
          'name' in item.tokenId
        ) {
          // Populated token
          const token = item.tokenId;
          const tokenId = token._id.toString();
          tokensMap.set(tokenId, this.toTokenInfo(token));
          normalizedManualTokens.push({
            tokenId: tokenId,
            balance: item.balance,
          });
        } else {
          // Not populated, just ObjectId
          normalizedManualTokens.push({
            tokenId: item.tokenId.toString(),
            balance: item.balance,
          });
        }
      });
    }

    // Extract tokens from portfolioPerformance and create normalized array
    const normalizedPortfolioPerformance: NormalizedPortfolioPerformance[] = [];
    if (
      walletObj.portfolioPerformance &&
      Array.isArray(walletObj.portfolioPerformance)
    ) {
      walletObj.portfolioPerformance.forEach((item: PortfolioPerformance) => {
        normalizedPortfolioPerformance.push({
          tokenId: item.tokenId.toString(),
          totalInvestedAmount: item.totalInvestedAmount,
          totalBalance: item.totalBalance,
          totalCashflowUsd: item.totalCashflowUsd,
        });
      });
    }

    // Extract tokens from blockchainWalletId.tokens if populated
    const normalizedBlockchainWallets: NormalizedBlockchainWallet[] = [];
    if (walletObj.blockchainWalletId) {
      const blockchainWallets = Array.isArray(walletObj.blockchainWalletId)
        ? walletObj.blockchainWalletId
        : [walletObj.blockchainWalletId];

      blockchainWallets.forEach((bw) => {
        // Check if it's populated (not just an ObjectId)
        if (typeof bw === 'object' && 'address' in bw) {
          const normalizedTokens: NormalizedTokenContract[] = [];

          if (bw.tokens && Array.isArray(bw.tokens)) {
            bw.tokens.forEach((token) => {
              if (
                token.tokenContractId &&
                typeof token.tokenContractId === 'object' &&
                'tokenId' in token.tokenContractId
              ) {
                const populatedContract = token.tokenContractId;
                const populatedToken = populatedContract.tokenId;
                const tokenId = populatedToken._id.toString();
                tokensMap.set(tokenId, this.toTokenInfo(populatedToken));
                normalizedTokens.push({
                  ...token,
                  tokenContractId: {
                    ...populatedContract,
                    tokenId: tokenId,
                  },
                } as NormalizedTokenContract);
              } else {
                // Not populated, just keep as is
                normalizedTokens.push({
                  tokenContractId: {
                    tokenId: (
                      token.tokenContractId as Types.ObjectId
                    ).toString(),
                  },
                  balance: token.balance,
                } as NormalizedTokenContract);
              }
            });
          }

          normalizedBlockchainWallets.push({
            _id: bw._id,
            address: bw.address,
            chains: bw.chains,
            tokens: normalizedTokens,
            createdAt: bw.createdAt,
            updatedAt: bw.updatedAt,
          });
        }
      });
    }

    // Build normalized wallet object
    const normalizedWallet: NormalizedWallet = {
      _id: walletObj._id,
      userId: walletObj.userId,
      name: walletObj.name,
      description: walletObj.description,
      blockchainWalletId: normalizedBlockchainWallets,
      manualTokens: normalizedManualTokens,
      portfolioPerformance: normalizedPortfolioPerformance,
      createdAt: walletObj.createdAt || new Date(),
      updatedAt: walletObj.updatedAt || new Date(),
      __v: walletObj.__v,
    };

    // Convert tokens map to object
    const tokens: Record<string, TokenInfo> = Object.fromEntries(tokensMap);

    return {
      wallet: normalizedWallet,
      tokens,
    };
  }

  findByUserId(userId: Types.ObjectId) {
    return this.walletModel.find({ userId }).exec();
  }

  remove(id: Types.ObjectId) {
    return this.walletModel.findByIdAndDelete(id).exec();
  }

  update(id: Types.ObjectId, updateWalletDto: Partial<Wallet>) {
    return this.walletModel
      .findByIdAndUpdate(id, updateWalletDto, { new: true })
      .exec();
  }

  async addBlockchainWalletToWallet(
    walletId: Types.ObjectId,
    address: string,
    chains: string[],
  ) {
    const wallet = await this.walletModel.findById(walletId).exec();
    if (!wallet) {
      throw new NotFoundException('Wallet does not exist');
    }

    let blockchainWallet = await this.blockchainWalletModel
      .findOne({ address })
      .exec();

    if (!blockchainWallet) {
      blockchainWallet = new this.blockchainWalletModel({
        address,
        chains: Array.from(new Set(chains)),
        tokens: [],
      });
      await blockchainWallet.save();
    } else {
      const mergedChains = Array.from(
        new Set([...(blockchainWallet.chains || []), ...chains]),
      );
      blockchainWallet.chains = mergedChains;
      await blockchainWallet.save();
    }

    await this.walletModel
      .findByIdAndUpdate(
        walletId,
        { $addToSet: { blockchainWalletId: blockchainWallet._id } },
        { new: true },
      )
      .exec();

    return blockchainWallet;
  }

  async getOnChainBalanceByAddress(address: string, chain: string[]) {
    const balancesData = await this.alchemysService.getTokenBalances(
      chain,
      address,
    );
    this.logger.debug(
      `Fetched balances for address ${address} on chains ${chain.join(', ')}`,
    );
    this.logger.debug(`Balances data: ${JSON.stringify(balancesData)}`);

    // Enrich with token metadata from our database
    const enrichedBalances = await Promise.all(
      balancesData.tokenBalances.map(async (balance) => {
        // Map the network to CoinGecko chain ID
        const coinGeckoChainId =
          CHAIN_MAPPING[balance.network] || balance.network;

        // Find token by contract address
        const token = await this.tokensService.findByContractAddress(
          coinGeckoChainId,
          balance.contractAddress,
        );

        // If token exists but has no image, fetch it from CoinGecko and update database
        if (
          token &&
          (!token.image?.thumb || !token.image?.small || !token.image?.large)
        ) {
          try {
            this.logger.debug(
              `Token ${token.id} missing image, fetching from CoinGecko...`,
            );

            const coinData = await this.coingeckoService.getCoinById(
              token.id as string,
            );

            if (coinData?.image) {
              // Update token in database with new image
              await this.tokensService.updateTokenImage(
                token.id as string,
                coinData.image,
              );

              // Update the token object for the response
              token.image = coinData.image;

              this.logger.debug(
                `Updated image for token ${token.id} in database`,
              );
            }
          } catch (error: unknown) {
            const errorResponse =
              error &&
              typeof error === 'object' &&
              'response' in error &&
              typeof error.response === 'object' &&
              error.response &&
              'status' in error.response
                ? (error.response as { status: number })
                : null;

            if (errorResponse?.status === 429) {
              this.logger.warn(
                `Rate limit hit while fetching image for token ${token.id}. Continuing with existing data...`,
              );
            } else {
              this.logger.error(
                `Error fetching image for token ${token.id}: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        }

        return {
          contractAddress: balance.contractAddress,
          balance: balance.rawBalance,
          balanceFormatted: balance.balance,
          symbol: balance.symbol,
          name: balance.name,
          logo: balance.logo,
          decimals: balance.decimals,
          network: coinGeckoChainId,
          token: token
            ? {
                id: token.id as string,
                symbol: token.symbol,
                name: token.name,
                image: token.image,
              }
            : null,
        };
      }),
    );

    // Also enrich native token balances (no real contract address)
    const NATIVE_CONTRACT_ADDRESS =
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const enrichedNativeBalances = await Promise.all(
      balancesData.nativeBalances.map(async (native) => {
        const coinGeckoChainId =
          CHAIN_MAPPING[native.network] || native.network;

        // Find native token via special native address mapping
        const token = await this.tokensService.findByContractAddress(
          coinGeckoChainId,
          NATIVE_CONTRACT_ADDRESS,
        );

        // If token exists but has no image, fetch it from CoinGecko and update database
        if (
          token &&
          (!token.image?.thumb || !token.image?.small || !token.image?.large)
        ) {
          try {
            this.logger.debug(
              `Native token ${token.id} missing image, fetching from CoinGecko...`,
            );

            const coinData = await this.coingeckoService.getCoinById(
              token.id as string,
            );

            if (coinData?.image) {
              await this.tokensService.updateTokenImage(
                token.id as string,
                coinData.image,
              );

              token.image = coinData.image;

              this.logger.debug(
                `Updated image for native token ${token.id} in database`,
              );
            }
          } catch (error: unknown) {
            const errorResponse =
              error &&
              typeof error === 'object' &&
              'response' in error &&
              typeof error.response === 'object' &&
              error.response &&
              'status' in error.response
                ? (error.response as { status: number })
                : null;

            if (errorResponse?.status === 429) {
              this.logger.warn(
                `Rate limit hit while fetching image for native token ${token.id}. Continuing with existing data...`,
              );
            } else {
              this.logger.error(
                `Error fetching image for native token ${token.id}: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }
        }

        return {
          contractAddress: NATIVE_CONTRACT_ADDRESS,
          balance: native.rawBalance,
          balanceFormatted: native.balance,
          symbol: token?.symbol ?? null,
          name: token?.name ?? null,
          logo: token?.image?.thumb ?? null,
          decimals: null,
          network: coinGeckoChainId,
          token: token
            ? {
                id: token.id as string,
                symbol: token.symbol,
                name: token.name,
                image: token.image,
              }
            : null,
        };
      }),
    );

    return {
      address,
      chain,
      nativeBalances: enrichedNativeBalances,
      balances: enrichedBalances,
      totalTokens: enrichedBalances.length,
      tokensWithMetadata: enrichedBalances.filter((b) => b.token !== null)
        .length,
    };
  }

  // Helper to convert PopulatedToken to TokenInfo
  toTokenInfo(token: PopulatedToken): TokenInfo {
    return {
      _id: token._id.toString(),
      id: token.id || '',
      name: token.name,
      symbol: token.symbol,
      image: token.image,
    };
  }
}
